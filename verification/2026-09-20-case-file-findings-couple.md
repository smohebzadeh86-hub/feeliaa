# Verification — «یافته» (Finding) برای رابطه‌ی زوجین — 2026-09-20

> Evidence (مشاهده در یک زمان)، نه حقیقتِ فعلی. دادهٔ کاملاً ساختگی؛ هیچ متنِ بالینیِ واقعی (LAW-001).

| بررسی | دستور/روش | نتیجه |
|---|---|---|
| typecheck | `cd server && npx tsc --noEmit` | تمیز |
| harness پرونده | `pnpm test:cf` (`scripts/case-file-harness.ts`) | 27 PASS / 0 FAIL |
| mutation-check | حذفِ شرطِ فکتِ یتیم در `finalizeCouple` | 6 FAIL (F12, F13, F23–F26)؛ فایل برگردانده شد، دوباره 27 PASS |
| harness realtime | `pnpm test:rt` | 35 PASS / 0 FAIL |
| UI v2/v1/edit | mock در scratchpad + `public/` واقعی (fixture از `finalizeCouple`+`mergeCaseFileDraft`) | چیپ‌ها از `source`؛ نقلِ عینی؛ نقشِ خالی «در انتظار ثبت»؛ «موارد دیگر»؛ fallbackِ v1؛ textareaِ مشتق؛ `overflowX=false` |
| مدل واقعی | OpenRouter `deepseek/deepseek-v4.1-flash`، فقط مرحله‌ی ۲، digestِ ساختگی | schema پذیرفته؛ 11 یافته، 0 شناسه‌ی ساختگی، 0 یتیم، 0 برچسبِ نامعتبر، 3 نقلِ کلمه‌به‌کلمه؛ **293 ثانیه** |

## محدودیت‌ها (صادقانه)
- Browser pane پنهان بود ⇒ اسکرین‌شات خالی؛ **قضاوتِ بصری انجام نشد**، فقط DOM و استایلِ محاسبه‌شده.
- `404` روی `/api/client-config` از mock است (stub نشده)، ربطی به تغییر ندارد.
- تست با DB/سرورِ واقعی و پرونده‌ی کاملِ end-to-end (دو مرحله‌ی LLM + ذخیره + بارگذاری) انجام نشده.
- زمانِ ۲۹۳ثانیه فقط یک نمونه است؛ نیازمندِ پایش.
