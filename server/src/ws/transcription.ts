// WebSocket proxies: جلسه‌ی زنده + یادداشت صوتی
// Priority 1 (معماری نهایی تأییدشده):
//   DB status ≠ connectionState ≠ Engine generation ≠ chunk identity ≠ transcript confirmation
//   Transcript Integrity سخت‌گیرانه؛ Audio Continuity best-effort.
//   ACK = تحویل به transport سونی‌کس (نه processed، نه durable) — بعد از forward موفق.
//   Dedup با (sessionId, seq) + nextExpected + reorder buffer محدود؛ max به‌تنهایی ملاک نیست.
//   old generation هرگز state نسل جدید را mutate نمی‌کند (check در هر timer/callback/write).
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { query } from '../db/connection.js';
import { getOwnedSession } from '../db/ownership.js';
import { requireAuth } from '../auth/guard.js';
import { SonioxEngine } from '../stt/soniox.js';
import {
  P1_PARAMS,
  getOrCreateRecord,
  getRecord,
  isCurrentGeneration,
  markForwarded,
  clearReorderTimer,
  clearGraceTimer,
  drainInOrder,
  resetOrdering,
  type P1Record,
} from './p1.js';

export async function transcriptionRoutes(app: FastifyInstance) {
  await app.register(websocket);
  app.addHook('preHandler', requireAuth);

  // ===== جلسه‌ی زنده (Priority 1) =====
  app.get('/ws/t/:sessionId', { websocket: true }, (socket: any, request: any) => {
    const { sessionId } = request.params as { sessionId: string };
    const sonioxKey = process.env.SONIOX_API_KEY;

    if (!sonioxKey) {
      socket.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      socket.close();
      return;
    }

    // P1-fix (early-message race): هندلر message از همان ابتدای lifecycle نصب می‌شود.
    // پیام‌هایی که قبل از پایان setup ناهمگام (SELECT دیتابیس + اتصال Soniox) می‌رسند،
    // به‌ترتیب در earlyQueue نگه داشته می‌شوند و بعد از آماده شدن engine تخلیه می‌شوند.
    // سقف 512 پیام: در عمل setup حدود ۱-۲ ثانیه است و هرگز پر نمی‌شود.
    const earlyQueue: Array<{ data: Buffer; isBinary: boolean }> = [];
    let routeReady = false;
    let routeMessage: ((data: Buffer, isBinary: boolean) => Promise<void>) | null = null;
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      const buf = Buffer.from(data);
      if (!routeReady || !routeMessage) {
        if (earlyQueue.length < 512) earlyQueue.push({ data: buf, isBinary });
        return;
      }
      routeMessage(buf, isBinary).catch(() => {});
    });

    getOwnedSession(sessionId, request.therapistId!).then(async (owned: any) => {
      if (!owned) {
        socket.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        socket.close();
        return;
      }

      // DB تنها source of truth برای confirmed است.
      let initialTranscript = '';
      let dbStatus = 'in_progress';
      try {
        const t = await query('SELECT transcript, status FROM sessions WHERE id = ?', [sessionId]);
        initialTranscript = t.rows[0]?.transcript ?? '';
        dbStatus = t.rows[0]?.status ?? 'in_progress';
      } catch (e) {}
      if (dbStatus === 'completed' || dbStatus === 'canceled') {
        try { socket.send(JSON.stringify({ type: 'error', message: 'جلسه پایان یافته است' })); } catch {}
        try { socket.close(); } catch {}
        return;
      }

      // هر اتصال جدید = generation جدید = MediaRecorder تازه‌ی کلاینت (هدرِ WebM تازه).
      // پس ordering/seq هم برای همین نسل صفر می‌شود — وگرنه بایتِ ته‌مانده‌ی استریمِ
      // قبلی به‌عنوانِ اولین بایتِ موتورِ جدید می‌رسه و Soniox رد می‌کنه (باگِ واقعی).
      const rec: P1Record = getOrCreateRecord(sessionId, '');
      if (rec.terminal === 'completed' || rec.terminal === 'canceled') {
        try { socket.send(JSON.stringify({ type: 'error', message: 'جلسه پایان یافته است' })); } catch {}
        try { socket.close(); } catch {}
        return;
      }
      rec.generation += 1;
      const gen = rec.generation;
      rec.resumeArmed = false; // hygiene نسل جدید؛ armed فقط در پنجره resume همین نسل معنا دارد
      (rec as any).lastConfirmedLen = (rec as any).lastConfirmedLen ?? initialTranscript.length;
      if (initialTranscript.length > ((rec as any).lastConfirmedLen ?? 0)) {
        (rec as any).lastConfirmedLen = initialTranscript.length;
      }

      // Handover: موتور زنده‌ی نسل قدیمی را abort کن (بدون finalize، بدون onFinished).
      // abort جلوی mutate نسل جدید را می‌گیرد؛ confirmed در DB امن است.
      const prevEngine = rec.engine;
      const prevGen = rec.engineGeneration;
      if (prevEngine && prevGen < gen) {
        try { prevEngine.abort(); } catch {}
        if (rec.engineGeneration === prevGen) rec.engine = null;
      }
      // reconnect نسل جدید، grace نسل قدیمی را مصرف می‌کند.
      clearGraceTimer(rec);
      resetOrdering(rec); // نسلِ جدید = MediaRecorderِ تازه‌ی کلاینت = seq از ۱
      rec.handoverUntil = Date.now() + P1_PARAMS.HANDOVER_TIMEOUT_MS;
      rec.connectionState = 'RECONNECTING';
      if (rec.terminal === 'finalizing') {
        // finalize در حال انجام نسل دیگری است — اتصال جدید پذیرفته نیست
        try { socket.send(JSON.stringify({ type: 'error', message: 'جلسه در حال نهایی‌سازی است' })); } catch {}
        try { socket.close(); } catch {}
        return;
      }

      let manuallyFinalized = false;
      let socketAlive = true;
      // pairing: هر chunk-meta (seq) دقیقاً قبل از blob خودش می‌آید (ترتیب WS حفظ می‌شود)
      const pendingSeqs: number[] = [];
      let helloClientId = '';

      const safeSend = (obj: unknown) => {
        if (!socketAlive) return;
        try { socket.send(JSON.stringify(obj)); } catch {}
      };
      const sendAck = (seq: number) => safeSend({ type: 'ack', ackSeq: seq });

      // release فقط با identity check (نسل قدیمی هرگز نسل جدید را پاک نمی‌کند)
      const releaseEngineIfCurrent = () => {
        if (rec.engineGeneration === gen && (rec.engine === engine)) rec.engine = null;
      };

      // ---- interruption واحد (network/refresh/close همگی یک مسیر) ----
      let interrupted = false;
      const interruptConnection = () => {
        if (!isCurrentGeneration(rec, gen)) return; // نسل جدید آمده — هیچ کاری نکن
        if (rec.terminal) return; // finalize/cancel ترمینال است
        if (interrupted) return;
        interrupted = true;
        // abort فقط موتور همین نسل
        if (rec.engineGeneration === gen && rec.engine) {
          try { rec.engine.abort(); } catch {}
          rec.engine = null;
        }
        clearReorderTimer(rec);
        rec.connectionState = 'INTERRUPTED';
        // hint همان‌طور در RAM می‌ماند تا reconnect (یک‌بار تحویل) یا timeout (دور ریخته)
        clearGraceTimer(rec);
        rec.graceGeneration = gen;
        rec.graceTimer = setTimeout(() => {
          rec.graceTimer = null;
          // identity check: اگر نسل جدید آمده، هیچ کاری نکن
          if (!isCurrentGeneration(rec, rec.graceGeneration) || rec.generation !== rec.graceGeneration) return;
          if (rec.connectionState !== 'INTERRUPTED') return;
          if (rec.terminal) return;
          // فقط in_progress → recovered (با finalize/cancel مسابقه نده)
          query(
            `UPDATE sessions SET status = 'recovered', updated_at = NOW() WHERE id = ? AND status = 'in_progress'`,
            [sessionId]
          ).catch(() => {});
          rec.connectionState = 'CLOSED';
          rec.hint = null; // hint منقضی شد؛ هرگز وارد confirmed نمی‌شود
          rec.buffer.clear();
          clearReorderTimer(rec);
        }, P1_PARAMS.GRACE_TIMEOUT_MS);
      };

      // ---- reorder timer برای head-gap ----
      const armReorderTimer = () => {
        if (rec.terminal) return;
        if (rec.buffer.size === 0) { clearReorderTimer(rec); return; }
        // timer نسل قدیمی نباید timer نسل جدید را بلوکه کند
        if (rec.reorderTimer) {
          if (rec.reorderGeneration === gen) return; // یک timer برای head کافی است
          clearReorderTimer(rec);
        }
        const head = rec.nextExpected;
        if (rec.buffer.has(head)) { clearReorderTimer(rec); return; } // نباید arm شود
        const handover = Date.now() < rec.handoverUntil;
        const delay = handover ? P1_PARAMS.HANDOVER_TIMEOUT_MS : P1_PARAMS.REORDER_TIMEOUT_MS;
        rec.reorderHead = head;
        rec.reorderGeneration = gen;
        rec.reorderTimer = setTimeout(() => {
          rec.reorderTimer = null;
          // identity check سه‌شرطی
          if (!isCurrentGeneration(rec, rec.reorderGeneration)) return;
          if (rec.terminal) return;
          if (rec.nextExpected !== rec.reorderHead) return; // قبلاً resolve شده
          if (rec.buffer.has(rec.nextExpected)) {
            // مسابقه: بین arm و fire رسیده — drain کن
            drainInOrder(rec, tryForward, sendAck);
            if (rec.buffer.size > 0) armReorderTimer();
            return;
          }
          // timeout معتبر → head = skipped (ناپیوستگی صوتی ثبت‌شده، نه transcript جعلی)
          console.log(`[p1] session ${sessionId} gen ${gen}: seq ${rec.nextExpected} skipped (gap timeout)`);
          rec.nextExpected += 1;
          drainInOrder(rec, tryForward, sendAck);
          if (rec.buffer.size > 0 && !rec.buffer.has(rec.nextExpected)) armReorderTimer();
        }, delay);
      };

      // forward فقط اگر سوکت Soniox باز است (مبنای ACK) — بدون صف داخلی
      const tryForward = (seq: number, buf: Buffer): boolean => {
        const eng = (rec.engineGeneration === gen) ? rec.engine : null;
        if (!eng) return false;
        try {
          const ok = eng.trySendAudioChunk(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBufferLike);
          return ok;
        } catch { return false; }
      };

      const handleChunk = (seq: number, buf: Buffer) => {
        if (!Number.isInteger(seq) || seq <= 0) return;
        if (!isCurrentGeneration(rec, gen)) return; // نسل قدیمی
        if (rec.terminal) return;
        // P1-F3: در pause واقعی drop؛ ولی در پنجره setup داخلی resume بافر کن (armed همگام ست شده)
        if (rec.connectionState === 'MANUAL_PAUSED' && !rec.resumeArmed) return;
        const anyRec = rec as any;
        anyRec.maxSeen = Math.max(anyRec.maxSeen ?? 0, seq);
        // قانون تک‌خطی: seq < nextExpected → همیشه drop
        if (seq < rec.nextExpected) return; // late-skipped یا duplicate
        if (seq === rec.nextExpected) {
          let ok = false;
          try { ok = tryForward(seq, buf); } catch { ok = false; }
          if (ok) {
            markForwarded(rec, seq);
            sendAck(seq);
            rec.nextExpected += 1;
            drainInOrder(rec, tryForward, sendAck);
            if (rec.buffer.size === 0) clearReorderTimer(rec);
            else if (!rec.buffer.has(rec.nextExpected)) armReorderTimer();
          } else {
            // Soniox باز نیست — نگه دار، ACK نده (replay خواهد شد)
            if (!rec.buffer.has(seq)) {
              if (rec.buffer.size >= P1_PARAMS.REORDER_BUFFER_MAX) {
                // backpressure: head اجباری skip (فقط به جلو)
                console.log(`[p1] session ${sessionId} gen ${gen}: buffer overflow, skip ${rec.nextExpected}`);
                rec.nextExpected += 1;
                drainInOrder(rec, tryForward, sendAck);
              }
              rec.buffer.set(seq, buf);
            }
            armReorderTimer();
          }
          return;
        }
        // seq > nextExpected → buffer (dedupe با Map)
        if (rec.buffer.has(seq)) return;
        if (rec.buffer.size >= P1_PARAMS.REORDER_BUFFER_MAX) {
          console.log(`[p1] session ${sessionId} gen ${gen}: buffer overflow, skip ${rec.nextExpected}`);
          rec.nextExpected += 1;
          const d = drainInOrder(rec, tryForward, sendAck);
          if (d === 0) { /* head هنوز غایب */ }
          if (seq < rec.nextExpected) return;
          if (seq === rec.nextExpected) { handleChunk(seq, buf); return; }
        }
        rec.buffer.set(seq, buf);
        armReorderTimer();
      };

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: (finalText, nonFinalText) => {
          // stale guard: موتور نسل قدیمی حق write ندارد
          if (!isCurrentGeneration(rec, gen)) return;
          if (rec.engineGeneration !== gen) return;
          if (rec.terminal) return;
          const full = finalText + nonFinalText;
          safeSend({ type: 'preview', text: full, confirmed: finalText, hint: nonFinalText });
          // hint فقط RAM و موقت — هرگز persist نهایی
          if (nonFinalText) {
            rec.hint = { text: nonFinalText, uptoSeq: rec.nextExpected - 1, at: Date.now() };
          } else {
            rec.hint = null;
          }
          if (finalText) {
            // monotonic guard: confirmed هرگز به عقب برنمی‌گردد
            const lastLen = (rec as any).lastConfirmedLen ?? 0;
            if (finalText.length < lastLen) return;
            (rec as any).lastConfirmedLen = finalText.length;
            query('UPDATE sessions SET transcript = ?, updated_at = NOW() WHERE id = ?',
              [finalText, sessionId]).catch(() => {});
          }
        },
        onStatus: (status, message) => {
          if (!isCurrentGeneration(rec, gen)) return;
          safeSend({ type: 'status', status, message });
          if (status === 'connected') {
            // سوکت Soniox باز شد — buffer را به ترتیب تخلیه کن
            drainInOrder(rec, tryForward, sendAck);
            if (rec.buffer.size === 0) clearReorderTimer(rec);
          }
        },
        onFinished: (finalText) => {
          // stale guard: فقط نسل جاری حق finalize-write دارد
          if (!isCurrentGeneration(rec, gen)) return;
          if (rec.engineGeneration !== gen) return;
          safeSend({ type: 'finished', finalText });
          // P1: فقط finalize صریح ترمینال است. پایان خودجوش Soniox (بدون stop) یعنی
          // interruption: transcript را نگه دار، status را عوض نکن، سوکت را ببند تا
          // کلاینت reconnect کند (نسل جدید با prefix=DB). recovered فقط با grace timeout.
          if (!manuallyFinalized) {
            if (rec.terminal) return;
            query(`UPDATE sessions SET transcript = ?, updated_at = NOW() WHERE id = ?`,
              [finalText, sessionId]).catch(() => {});
            if (rec.engineGeneration === gen) rec.engine = null;
            clearReorderTimer(rec);
            if (isCurrentGeneration(rec, gen) && !rec.terminal) {
              rec.connectionState = 'INTERRUPTED';
              clearGraceTimer(rec);
              rec.graceGeneration = gen;
              rec.graceTimer = setTimeout(() => {
                rec.graceTimer = null;
                if (!isCurrentGeneration(rec, rec.graceGeneration) || rec.generation !== rec.graceGeneration) return;
                if (rec.connectionState !== 'INTERRUPTED' || rec.terminal) return;
                query(`UPDATE sessions SET status = 'recovered', updated_at = NOW() WHERE id = ? AND status = 'in_progress'`,
                  [sessionId]).catch(() => {});
                rec.connectionState = 'CLOSED';
                rec.hint = null;
                rec.buffer.clear();
                clearReorderTimer(rec);
              }, P1_PARAMS.GRACE_TIMEOUT_MS);
            }
            try { socket.close(); } catch {}
            return;
          }
          const newStatus = 'completed';
          if (rec.terminal === 'canceled' || rec.terminal === 'completed') return;
          rec.terminal = 'completed';
          console.log(`[ws] session ${sessionId} gen ${gen} → status: ${newStatus}`);
          query(
            `UPDATE sessions SET transcript = ?, status = ?, updated_at = NOW() WHERE id = ?`,
            [finalText, newStatus, sessionId]
          ).then(() => {
            releaseEngineIfCurrent();
            rec.connectionState = 'CLOSED';
            clearGraceTimer(rec);
            clearReorderTimer(rec);
            try { socket.close(); } catch (e) {}
          }).catch(() => {
            releaseEngineIfCurrent();
            rec.connectionState = 'CLOSED';
            try { socket.close(); } catch (e) {}
          });
        },
        onError: (error) => {
          if (!isCurrentGeneration(rec, gen)) return;
          safeSend({ type: 'error', message: error });
        },
      }, { initialTranscript });

      rec.engine = engine;
      rec.engineGeneration = gen;

      engine.start().then(() => {
        if (!isCurrentGeneration(rec, gen)) return;
        if (rec.connectionState === 'RECONNECTING') rec.connectionState = 'ACTIVE';
      }).catch(err => {
        // P1-fix: قبلاً اینجا فقط خطا فرستاده می‌شد و سوکت باز می‌ماند — یعنی کلاینت
        // برای همیشه در «در حال اتصال…» می‌ماند بدون هیچ retryای. الان سوکت را می‌بندیم
        // تا منطق reconnect موجود سمت کلاینت (attemptWSReconnect) طبیعی فعال شود.
        if (rec.engineGeneration === gen) rec.engine = null;
        safeSend({ type: 'error', message: 'خطا در اتصال به Soniox' });
        try { socket.close(); } catch {}
      });

      routeMessage = async (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          const buf = Buffer.from(ab);
          // pairing با آخرین chunk-meta همین اتصال (ترتیب WS)
          let seq: number | undefined = pendingSeqs.shift();
          if (seq === undefined) {
            // legacy fallback (کلاینت قدیمی بدون meta): تخصیص سمت سرور، بدون collision
            const anyRec = rec as any;
            const base: number = (typeof anyRec.maxSeen === 'number') ? anyRec.maxSeen : (rec.nextExpected - 1);
            seq = Math.max(base, rec.nextExpected - 1) + 1;
            anyRec.maxSeen = seq;
          }
          handleChunk(seq as number, buf);
        } else {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'hello') {
              helloClientId = String(msg.clientId ?? '');
              if (helloClientId && !rec.clientId) rec.clientId = helloClientId;
              // resumePoint + hint یک‌بارمصرف (hint هرگز وارد confirmed نمی‌شود)
              const resumePoint = rec.nextExpected - 1;
              safeSend({
                type: 'resumed',
                generation: gen,
                resumePoint,
                hint: rec.hint ? rec.hint.text : '',
              });
              if (rec.hint) rec.hint = null; // یک‌بار تحویل شد
              if (rec.connectionState === 'RECONNECTING') {
                // بعد از hello، ACTIVE می‌شود وقتی engine هم ready است؛ فعلاً RECONNECTING نگه دار
              }
            } else if (msg.type === 'chunk-meta') {
              const s = Number(msg.seq);
              if (Number.isInteger(s) && s > 0 && pendingSeqs.length < 256) pendingSeqs.push(s);
            } else if (msg.type === 'pause') {
              if (!isCurrentGeneration(rec, gen)) return;
              if (rec.terminal) return;
              // P1-F2 (idempotent/state-aware): تکرار pause فقط re-ack؛ خارج از ACTIVE/RECONNECTING ignore
              if (rec.connectionState === 'MANUAL_PAUSED') { safeSend({ type: 'paused' }); return; }
              if (rec.connectionState !== 'ACTIVE' && rec.connectionState !== 'RECONNECTING') return;
              // Manual Pause = intentional: بدون grace timer، بدون reconnect خودکار
              rec.pauseEpoch += 1; // باطل‌کننده resume در-flight هم‌زمان
              rec.resumeArmed = false;
              if (rec.engineGeneration === gen && rec.engine) {
                try { rec.engine.abort(); } catch {}
                rec.engine = null;
              }
              rec.hint = null; // در pause دور ریخته می‌شود
              // P1-F1: buffer عمداً نگه داشته می‌شود — ورودی معتبر موتور بعدی است، نه gap
              clearReorderTimer(rec);
              clearGraceTimer(rec);
              rec.connectionState = 'MANUAL_PAUSED';
              safeSend({ type: 'paused' });
            } else if (msg.type === 'resume') {
              if (!isCurrentGeneration(rec, gen)) return;
              if (rec.terminal) return;
              if (rec.connectionState !== 'MANUAL_PAUSED') return;
              // P1-F2: resume تکراریِ هم‌زمان که موتورش ساخته شده → موتور دوم نساز، فقط converge کن
              if (rec.engine && rec.engineGeneration === gen) {
                safeSend({ type: 'resumed', generation: gen, resumePoint: rec.nextExpected - 1, hint: '' });
                return;
              }
              // P1-F3: armed همگام قبل از await — chunkهای پنجره setup بافر می‌شوند، نه drop
              rec.resumeArmed = true;
              const myEpoch = rec.pauseEpoch;
              // Resume صریح: prefix تازه از DB؛ صف‌های معتبر (buffer/unacked) replay می‌شوند، نه skip
              try {
                const t = await query('SELECT transcript FROM sessions WHERE id = ?', [sessionId]);
                const fresh = t.rows[0]?.transcript ?? '';
                (rec as any).lastConfirmedLen = Math.max((rec as any).lastConfirmedLen ?? 0, fresh.length);
                // P1-F2: pause جدیدتر در حین await برنده است؛ نسل/ترمینال هم ممکن است عوض شده باشد
                if (rec.pauseEpoch !== myEpoch) { rec.resumeArmed = false; return; }
                if (!isCurrentGeneration(rec, gen) || rec.terminal) { rec.resumeArmed = false; return; }
                if (rec.engine && rec.engineGeneration === gen) {
                  safeSend({ type: 'resumed', generation: gen, resumePoint: rec.nextExpected - 1, hint: '' });
                  return;
                }
                // موتورِ تازه = MediaRecorderِ تازه‌ی کلاینت (بعدِ pauseSessionLive میکروفون واقعاً
                // خاموش شده بود) = هدرِ WebM تازه. seq هم برای همین موتور از ۱ شروع می‌شود.
                resetOrdering(rec);
                const e2 = new SonioxEngine(sonioxKey, {
                  onPreview: (finalText, nonFinalText) => {
                    if (!isCurrentGeneration(rec, gen)) return;
                    if (rec.engineGeneration !== gen) return;
                    if (rec.terminal) return;
                    safeSend({ type: 'preview', text: finalText + nonFinalText, confirmed: finalText, hint: nonFinalText });
                    if (nonFinalText) rec.hint = { text: nonFinalText, uptoSeq: rec.nextExpected - 1, at: Date.now() };
                    else rec.hint = null;
                    if (finalText) {
                      const lastLen = (rec as any).lastConfirmedLen ?? 0;
                      if (finalText.length < lastLen) return;
                      (rec as any).lastConfirmedLen = finalText.length;
                      query('UPDATE sessions SET transcript = ?, updated_at = NOW() WHERE id = ?', [finalText, sessionId]).catch(() => {});
                    }
                  },
                  onStatus: (status, message) => {
                    if (!isCurrentGeneration(rec, gen)) return;
                    safeSend({ type: 'status', status, message });
                    if (status === 'connected') {
                      drainInOrder(rec, tryForward, sendAck);
                      if (rec.buffer.size === 0) clearReorderTimer(rec);
                    }
                  },
                  onFinished: (finalText) => {
                    if (!isCurrentGeneration(rec, gen)) return;
                    if (rec.engineGeneration !== gen) return;
                    safeSend({ type: 'finished', finalText });
                    if (!manuallyFinalized) {
                      if (rec.terminal) return;
                      query(`UPDATE sessions SET transcript = ?, updated_at = NOW() WHERE id = ?`,
                        [finalText, sessionId]).catch(() => {});
                      if (rec.engineGeneration === gen) rec.engine = null;
                      try { socket.close(); } catch {}
                      return;
                    }
                    const ns = 'completed';
                    if (rec.terminal === 'canceled' || rec.terminal === 'completed') return;
                    rec.terminal = 'completed';
                    query(`UPDATE sessions SET transcript = ?, status = ?, updated_at = NOW() WHERE id = ?`,
                      [finalText, ns, sessionId]).then(() => {
                        if (rec.engineGeneration === gen) rec.engine = null;
                        rec.connectionState = 'CLOSED';
                        try { socket.close(); } catch {}
                      }).catch(() => {
                        if (rec.engineGeneration === gen) rec.engine = null;
                        rec.connectionState = 'CLOSED';
                        try { socket.close(); } catch {}
                      });
                  },
                  onError: (error) => {
                    if (!isCurrentGeneration(rec, gen)) return;
                    safeSend({ type: 'error', message: error });
                  },
                }, { initialTranscript: fresh });
                rec.engine = e2;
                rec.engineGeneration = gen;
                rec.connectionState = 'ACTIVE';
                rec.handoverUntil = Date.now() + P1_PARAMS.HANDOVER_TIMEOUT_MS;
                safeSend({ type: 'resumed', generation: gen, resumePoint: rec.nextExpected - 1, hint: '' });
                e2.start().catch(() => {
                  if (rec.engineGeneration === gen) rec.engine = null;
                  safeSend({ type: 'error', message: 'خطا در اتصال به Soniox' });
                  try { socket.close(); } catch {}
                });
              } catch {}
            } else if (msg.type === 'finalize') {
              if (!isCurrentGeneration(rec, gen)) return;
              if (rec.terminal) return;
              manuallyFinalized = true;
              rec.terminal = 'finalizing';
              rec.resumeArmed = false;
              rec.connectionState = 'FINALIZING';
              clearGraceTimer(rec);
              clearReorderTimer(rec);
              // drain: هرچه در buffer است و Soniox باز است، به ترتیب بفرست (بدون ACK جدید؟ ACK بده)
              drainInOrder(rec, tryForward, sendAck);
              const eng = (rec.engineGeneration === gen) ? rec.engine : null;
              if (eng) { try { eng.stop().then(() => {}).catch(() => {}); } catch {} }
              else {
                // موتوری نیست — مستقیم complete کن با DB فعلی
                try {
                  const t = await query('SELECT transcript FROM sessions WHERE id = ?', [sessionId]);
                  const cur = t.rows[0]?.transcript ?? '';
                  await query(`UPDATE sessions SET transcript = ?, status = 'completed', updated_at = NOW() WHERE id = ?`, [cur, sessionId]);
                } catch {}
                rec.terminal = 'completed';
                rec.connectionState = 'CLOSED';
                safeSend({ type: 'finished', finalText: '' });
                try { socket.close(); } catch {}
              }
            } else if (msg.type === 'cancel') {
              if (!isCurrentGeneration(rec, gen)) return;
              if (rec.terminal) return;
              rec.terminal = 'canceled';
              rec.resumeArmed = false;
              manuallyFinalized = false;
              clearGraceTimer(rec);
              clearReorderTimer(rec);
              if (rec.engineGeneration === gen && rec.engine) {
                try { rec.engine.abort(); } catch {}
                rec.engine = null;
              }
              rec.connectionState = 'CLOSED';
              rec.hint = null;
              rec.buffer.clear();
              query(`UPDATE sessions SET status = 'canceled', updated_at = NOW() WHERE id = ? AND status = 'in_progress'`,
                [sessionId]).catch(() => {});
              try { socket.close(); } catch {}
            } else if (msg.type === 'close-hint') {
              // Beacon fast-path hint — correctness به آن وابسته نیست
              interruptConnection();
            }
          } catch {}
        }
      };

      // P1-fix: تخلیه مرتب earlyQueue بعد از آماده شدن engine.
      // تا routeReady=true نشده، پیام‌های تازه همچنان صف می‌شوند؛ آخرین splice بعد از
      // ست شدن فلگ و بدون هیچ await میانی انجام می‌شود، پس در Node تک‌نخی هیچ پیامی
      // بین check آخر و ست شدن فلگ گم یا جابه‌جا نمی‌شود.
      if (routeMessage) {
        let pending = earlyQueue.splice(0);
        for (const m of pending) { try { await routeMessage(m.data, m.isBinary); } catch {} }
        while (earlyQueue.length > 0) {
          pending = earlyQueue.splice(0);
          for (const m of pending) { try { await routeMessage(m.data, m.isBinary); } catch {} }
        }
        routeReady = true;
        pending = earlyQueue.splice(0);
        for (const m of pending) { try { await routeMessage(m.data, m.isBinary); } catch {} }
      }

      socket.on('close', () => {
        socketAlive = false;
        // ترمینال‌ها recovered نمی‌سازند؛ finalize در onFinished مدیریت می‌شود
        const r = getRecord(sessionId);
        if (!r) return;
        if (!isCurrentGeneration(r, gen)) return; // نسل جدید آمده
        if (r.terminal === 'finalizing' || r.terminal === 'completed' || r.terminal === 'canceled') {
          if (r.engineGeneration === gen) r.engine = null;
          return;
        }
        if (r.connectionState === 'MANUAL_PAUSED') {
          // pause عمدی است — نه interruption، نه grace، نه recovered
          if (r.engineGeneration === gen) r.engine = null;
          return;
        }
        interruptConnection();
      });

    }).catch(err => {
      try { socket.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' })); } catch (e) {}
    });
  });

  // ===== یادداشت صوتی — لایو (بدون تغییر Priority 1) =====
  app.get('/ws/voice/:sessionId', { websocket: true }, (socket, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const sonioxKey = process.env.SONIOX_API_KEY;

    if (!sonioxKey) {
      socket.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      socket.close();
      return;
    }

    getOwnedSession(sessionId, request.therapistId!).then(owned => {
      if (!owned) {
        socket.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        socket.close();
        return;
      }

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: (finalText, nonFinalText) => {
          try {
            const full = finalText + nonFinalText;
            socket.send(JSON.stringify({ type: 'preview', text: full }));
          } catch (e) {}
        },
        onStatus: (status, message) => {
          try {
            socket.send(JSON.stringify({ type: 'status', status, message }));
          } catch (e) {}
        },
        onFinished: (finalText) => {
          try {
            socket.send(JSON.stringify({ type: 'finished', finalText }));
          } catch (e) {}
          if (finalText && finalText.trim()) {
            query(
              `INSERT INTO session_notes (id, session_id, type, text, wall_clock)
               VALUES (?, ?, 'voice', ?, ?)`,
              [randomUUID(), sessionId, finalText.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
            ).then(() => {
              try { socket.close(); } catch (e) {}
            }).catch(() => {
              try { socket.close(); } catch (e) {}
            });
          } else {
            try { socket.send(JSON.stringify({ type: 'status', status: 'error', message: 'متنی ثبت نشد' })); } catch (e) {}
            try { socket.close(); } catch (e) {}
          }
        },
        onError: (error) => {
          try {
            socket.send(JSON.stringify({ type: 'error', message: error }));
          } catch (e) {}
        },
      });

      engine.start().catch(err => {
        try {
          socket.send(JSON.stringify({ type: 'error', message: 'خطا در اتصال به Soniox' }));
        } catch (e) {}
      });

      socket.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          engine.sendAudioChunk(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        } else {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'finalize') {
              engine.stop().then(() => {});
            }
          } catch {}
        }
      });

      socket.on('close', () => {
        engine.stop().then(() => {}).catch(() => {});
      });

    }).catch(err => {
      try { socket.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' })); } catch (e) {}
    });
  });
}
