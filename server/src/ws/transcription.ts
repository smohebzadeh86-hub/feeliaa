// WebSocket proxies: جلسه‌ی زنده + یادداشت صوتی
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { query } from '../db/connection.js';
import { getOwnedSession } from '../db/ownership.js';
import { requireAuth } from '../auth/guard.js';
import { SonioxEngine } from '../stt/soniox.js';

const activeSessions = new Map<string, SonioxEngine>();

export async function transcriptionRoutes(app: FastifyInstance) {
  await app.register(websocket);
  app.addHook('preHandler', requireAuth);

  // ===== جلسه‌ی زنده =====
  app.get('/ws/t/:sessionId', { websocket: true }, (socket, request) => {
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

      // ⭐ اگر جلسه‌ی دیگه‌ای برای این session فعاله، ببندش
      // (refersh مرورگر → WebSocket جدید → قدیمی باید بپره)
      const existing = activeSessions.get(sessionId);
      if (existing) {
        activeSessions.delete(sessionId);
        // engine قدیمی رو بدون completed کردن ببند
        try { existing.stop().then(() => {}); } catch (e) {}
      }

      let manuallyFinalized = false; // ⭐ آیا کاربر «پایان جلسه» زد یا crash شد؟

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: (finalText, nonFinalText) => {
          try {
            const full = finalText + nonFinalText;
            socket.send(JSON.stringify({ type: 'preview', text: full }));
          } catch (e) {}
          if (finalText) {
            query('UPDATE sessions SET transcript = $1, updated_at = now() WHERE id = $2',
              [finalText, sessionId]).catch(() => {});
          }
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
          
          // ⭐ تمایز: کاربر زد یا crash شد؟
          const newStatus = manuallyFinalized ? 'completed' : 'recovered';
          console.log(`[ws] session ${sessionId} → status: ${newStatus}`);
          
          query(
            `UPDATE sessions SET transcript = $1, status = $2, updated_at = now() WHERE id = $3`,
            [finalText, newStatus, sessionId]
          ).then(() => {
            activeSessions.delete(sessionId);
            try { socket.close(); } catch (e) {}
          }).catch(() => {
            activeSessions.delete(sessionId);
            try { socket.close(); } catch (e) {}
          });
        },
        onError: (error) => {
          try {
            socket.send(JSON.stringify({ type: 'error', message: error }));
          } catch (e) {}
        },
      });

      activeSessions.set(sessionId, engine);

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
              // ⭐ کاربر خودش پایان داد — نه crash
              manuallyFinalized = true;
              engine.stop().then(() => {});
            }
          } catch {}
        }
      });

      socket.on('close', () => {
        // ⭐ مرورگر بسته شد — اگر کاربر finalize نفرستاده بود = crash
        // engine.stop() → onFinished → status = 'recovered'
        console.log(`[ws] browser closed for ${sessionId}, manuallyFinalized: ${manuallyFinalized}`);
        const eng = activeSessions.get(sessionId);
        if (eng) {
          eng.stop().then(() => { activeSessions.delete(sessionId); })
            .catch(() => { activeSessions.delete(sessionId); });
        }
      });

    }).catch(err => {
      try { socket.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' })); } catch (e) {}
    });
  });

  // ===== یادداشت صوتی — لایو =====
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
              `INSERT INTO session_notes (session_id, type, text, wall_clock)
               VALUES ($1, 'voice', $2, $3)`,
              [sessionId, finalText.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
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