// گزارشِ مصرفِ LLM (2026-10-01) — فقط‌خواندنی.
//  ۱) هر ویرایشِ «متنِ نهایی» از polish_report.usage (جمع/برداشت/تکه‌ها)
//  ۲) همه‌ی فراخوانی‌هایِ LLM (موفق و ناموفق، هر دو مسیرِ متنِ نهایی و پرونده‌ی درمان) از obs_events (رویدادِ `llm.call`)
// اجرا: pnpm llm:usage            (۱۴ روزِ اخیر)
//        pnpm llm:usage -- --days=3 --sessions=20
// هیچ متنِ بالینی خوانده/چاپ نمی‌شود — فقط شناسه‌ی کوتاهِ جلسه و عدد. (LAW-001)
import 'dotenv/config';
import { query, pool } from '../server/src/db/connection.js';

const arg = (name: string, def: number) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = m ? Number(m.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
};
const days = arg('days', 14);
const lastN = arg('sessions', 15);
const fmt = (n: number | null | undefined, d = 4) => (typeof n === 'number' ? n.toFixed(d) : '—');
const parse = (v: unknown): any => (typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}));

(async () => {
  try {
    // ——— ۱) ویرایش‌هایِ تمام‌شده ———
    const r = await query(
      `SELECT session_id, source, finished_at, polish_report FROM final_transcripts
        WHERE stage = 'done' AND finished_at >= (UTC_TIMESTAMP() - INTERVAL ? DAY) ORDER BY finished_at DESC`, [days]);
    type Row = { id: string; at: Date; model: string; calls: number; pt: number; ct: number; rt: number; cost: number | null; chunks: number; turns: number; hasUsage: boolean };
    const rows: Row[] = (r.rows as any[]).map((x) => {
      const rep = parse(x.polish_report);
      const u = rep.usage?.total;
      return {
        id: String(x.session_id).slice(0, 8), at: new Date(x.finished_at), model: String(rep.model || '?'),
        calls: u?.calls ?? 0, pt: u?.prompt_tokens ?? 0, ct: u?.completion_tokens ?? 0, rt: u?.reasoning_tokens ?? 0,
        cost: u ? u.cost_usd : null, chunks: rep.chunks ?? 0, turns: rep.turns ?? 0, hasUsage: !!u,
      };
    });
    console.log(`\n«متنِ نهایی» — ${rows.length} ویرایشِ تمام‌شده در ${days} روزِ اخیر (${rows.filter((x) => x.hasUsage).length} تا دارایِ آمارِ مصرف)\n`);

    const byDay = new Map<string, { n: number; calls: number; pt: number; ct: number; cost: number; unknown: number }>();
    for (const x of rows.filter((y) => y.hasUsage)) {
      const k = x.at.toISOString().slice(0, 10);
      const d = byDay.get(k) ?? { n: 0, calls: 0, pt: 0, ct: 0, cost: 0, unknown: 0 };
      d.n++; d.calls += x.calls; d.pt += x.pt; d.ct += x.ct;
      if (x.cost === null) d.unknown++; else d.cost += x.cost;
      byDay.set(k, d);
    }
    console.log('روز (UTC)    ویرایش  فراخوانی  توکنِ ورودی  توکنِ خروجی   هزینه($)  میانگین/ویرایش($)');
    let grand = 0, grandN = 0;
    for (const [k, d] of [...byDay.entries()].sort()) {
      grand += d.cost; grandN += d.n - d.unknown;
      console.log(`${k}  ${String(d.n).padStart(6)}  ${String(d.calls).padStart(8)}  ${String(d.pt).padStart(11)}  ${String(d.ct).padStart(12)}  ${fmt(d.cost).padStart(9)}  ${fmt(d.n - d.unknown ? d.cost / (d.n - d.unknown) : null).padStart(10)}${d.unknown ? `   (+${d.unknown} با هزینه‌ی نامعلوم)` : ''}`);
    }
    console.log(`جمع: ${fmt(grand)} دلار روی ${grandN} ویرایشِ دارایِ هزینه${grandN ? ` — میانگین ${fmt(grand / grandN)} دلار` : ''}`);

    console.log(`\n${lastN} ویرایشِ آخر:`);
    console.log('جلسه      زمان(UTC)         مدل                              تکه نوبت فراخ.  ورودی خروجی استدلال  هزینه($)');
    for (const x of rows.filter((y) => y.hasUsage).slice(0, lastN)) {
      console.log(`${x.id}  ${x.at.toISOString().slice(0, 16).replace('T', ' ')}  ${x.model.padEnd(32).slice(0, 32)} ${String(x.chunks).padStart(4)} ${String(x.turns).padStart(4)} ${String(x.calls).padStart(5)} ${String(x.pt).padStart(7)} ${String(x.ct).padStart(6)} ${String(x.rt).padStart(7)}  ${fmt(x.cost).padStart(9)}`);
    }

    // ——— ۲) همه‌ی فراخوانی‌ها (موفق و ناموفق) از obs_events ———
    const ev = await query(
      `SELECT ts, session_id, code, duration_ms, detail FROM obs_events WHERE event = 'llm.call' AND ts >= (UTC_TIMESTAMP() - INTERVAL ? DAY) ORDER BY ts DESC`, [days]);
    const calls = (ev.rows as any[]).map((x) => {
      const d = parse(x.detail);
      return { at: new Date(x.ts), sid: x.session_id ? String(x.session_id).slice(0, 8) : '—', ms: Number(x.duration_ms) || 0, ok: d.ok === true, code: x.code, d };
    });
    console.log(`\nهمه‌ی فراخوانی‌هایِ LLM (obs_events، ${days} روزِ اخیر): ${calls.length} فراخوانی، ${calls.filter((c) => !c.ok).length} ناموفق`);
    if (calls.length) {
      const g = new Map<string, { n: number; fail: number; pt: number; ct: number; rt: number; cost: number; unknown: number; ms: number }>();
      for (const c of calls) {
        const k = `${c.at.toISOString().slice(0, 10)}  ${String(c.d.purpose || '?').padEnd(15)} ${String(c.d.model || '?').padEnd(34)}`;
        const x = g.get(k) ?? { n: 0, fail: 0, pt: 0, ct: 0, rt: 0, cost: 0, unknown: 0, ms: 0 };
        x.n++; x.ms += c.ms; if (!c.ok) x.fail++;
        x.pt += Number(c.d.prompt_tokens) || 0; x.ct += Number(c.d.completion_tokens) || 0; x.rt += Number(c.d.reasoning_tokens) || 0;
        if (c.ok) { if (typeof c.d.cost_usd === 'number') x.cost += c.d.cost_usd; else x.unknown++; }
        g.set(k, x);
      }
      console.log('روز (UTC)   مسیر            مدل                                  فراخ. ناموفق  ورودی  خروجی استدلال  هزینه($)  میانگینِ ms');
      for (const [k, x] of [...g.entries()].sort()) {
        console.log(`${k} ${String(x.n).padStart(5)} ${String(x.fail).padStart(6)} ${String(x.pt).padStart(7)} ${String(x.ct).padStart(6)} ${String(x.rt).padStart(7)} ${(x.unknown && !x.cost ? '—' : fmt(x.cost)).padStart(9)} ${String(Math.round(x.ms / x.n)).padStart(11)}`);
      }
      console.log(`\n${lastN} فراخوانیِ آخر:`);
      console.log('زمان(UTC)         جلسه      مسیر            مدل                                 نتیجه   تلاش    ms  ورودی خروجی');
      for (const c of calls.slice(0, lastN)) {
        console.log(`${c.at.toISOString().slice(0, 16).replace('T', ' ')}  ${c.sid}  ${String(c.d.purpose || '?').padEnd(15)} ${String(c.d.model || '?').padEnd(34).slice(0, 34)} ${(c.ok ? 'ok' : 'FAIL ' + (c.code ?? '')).padEnd(8)} ${String(c.d.attempt ?? 0).padStart(3)} ${String(c.ms).padStart(5)} ${String(c.d.prompt_tokens ?? 0).padStart(6)} ${String(c.d.completion_tokens ?? 0).padStart(6)}`);
      }
    } else {
      console.log('(هنوز رویدادی نیست — llm.call فقط وقتی ثبت می‌شود که سرور با startBackgroundJobs بالا آمده باشد؛ سرورِ dev/prod را ری‌استارت کنید.)');
    }

    const capUsd = Number(process.env.FINAL_TRANSCRIPT_DAILY_BUDGET_USD ?? 3);
    const capTok = Number(process.env.FINAL_TRANSCRIPT_DAILY_BUDGET_TOKENS ?? 5_000_000);
    const today = new Date().toISOString().slice(0, 10);
    const t = byDay.get(today);
    console.log(`\nبودجه‌ی امروزِ «متنِ نهایی»: ${fmt(t?.cost ?? 0)} از ${capUsd > 0 ? capUsd : 'بدونِ سقف'} دلار؛ ${(t?.pt ?? 0) + (t?.ct ?? 0)} از ${capTok > 0 ? capTok : 'بدونِ سقف'} توکن`);
    console.log('یادداشت: بخشِ «ویرایش» فقط موفق‌ها را دارد؛ بخشِ «همه‌ی فراخوانی‌ها» شکست‌ها و پرونده‌ی درمان را هم. Soniox جدا حساب می‌شود.');
  } finally {
    await pool.end();
  }
})();
