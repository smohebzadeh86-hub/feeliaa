# 2026-09-18 — تلاش برایِ لغوِ واقعیِ فراخوانیِ OpenRouter روی abortِ کاربر — ناموفق، برگردانده شد

> نوعِ رویداد: CODE (تلاش) + FINDING + REVERT. دنباله‌ی
> [2026-09-18-case-file-regenerate-client-timeout-mismatch.md](2026-09-18-case-file-regenerate-client-timeout-mismatch.md).

## زمینه
بعدِ رفعِ خطایِ کاذبِ UI (پرونده‌ی قبلی)، مالک درخواستِ رفعِ عمیق‌ترِ ریشه‌ای کرد: وقتی
کاربر واقعاً درخواست را رها می‌کند (بستنِ تب/ناوبری/network drop)، فراخوانیِ OpenRouter
روی سرور هم باید لغو شود — نه اینکه بی‌فایده در پس‌زمینه ادامه پیدا کند و هزینه/زمان
هدر بدهد.

## تلاش
- `LLMProvider.generateCaseFile` یک `signal?: AbortSignal` اختیاری گرفت؛ هر دو آداپتور
  (`openrouter.adapter.ts`، `openai.adapter.ts`) آن را به `client.chat.completions.create(body, { signal })`
  پاس دادند (پشتیبانیِ SDKِ `openai@^4.104` تأیید شد — تستِ ایزوله: abort در t=1s → reject
  در همان t=1.0s با `APIUserAbortError`).
- `generateCaseFile.ts` و `caseFile.routes.ts` این signal را از `request.signal`ِ خودِ
  Fastify (v5.12.1، getterِ built-in) تا adapter رد کردند.

## کشف: `request.signal` در این مسیرِ خاص قابلِ‌اتکا فایر نمی‌شود
با چند diagnosticِ موقتِ ایزوله (routeهایِ آزمایشیِ جدا در `index.ts`، بدونِ داده‌ی
بالینی، حذف‌شده بعدِ تست):
- روتِ ساده (GET/POST، بدونِ preHandler) → abortِ کلاینت به‌درستی `request.signal`
  را فایر می‌کرد.
- روت با هر `preHandler`ای (حتی no-op، یا `requireAuth`ِ واقعی) که `request.signal` را
  **داخلِ خودِ handler** (نه preHandler) برایِ اولین بار می‌خواند → abort هرگز فایر
  نمی‌شد، حتی بعدِ ۱۵+ ثانیه.
- خواندنِ `request.signal` **داخلِ preHandler** به‌جایِ handler، در یک روتِ آزمایشیِ
  ایزوله، مشکل را حل کرد.
- همین «راه‌حل» وقتی روی روتِ واقعیِ `case-file/regenerate` (که از `addHook('preHandler', requireAuth)`
  در سطحِ plugin استفاده می‌کند، نه یک preHandlerِ مستقیمِ per-route) پیاده شد،
  **کار نکرد** — با یک preHandlerِ اضافیِ کوچک که فقط `request.signal` را «لمس»
  می‌کرد، در تستِ سرتاسریِ واقعی (ثبت‌نامِ synthetic → مراجع → جلسه → یادداشت →
  regenerate → abort در t=۳ثانیه) پرونده هنوز ~۹-۱۷ ثانیه بعد با موفقیت `ready` شد —
  یعنی فراخوانیِ OpenRouter اصلاً لغو نشده بود.
- فرضیه‌ی «connection pooling/keep-alive مانعِ دیدنِ closeِ سمتِ سرور می‌شود» هم رد
  شد: تکرارِ تست با `http.Agent({keepAlive:false})` و `req.destroy()` (قطعِ واقعیِ
  socket، نه فقط abortِ fetch) هم همان نتیجه را داد — پرونده باز هم موفق `ready` شد.

نتیجه: در Fastify v5.12.1 + شکلِ فعلیِ hookهایِ این routeها، رفتارِ `request.signal`
غیرِقابل‌اتکا/inconsistent است و علتِ دقیقش (باگِ Fastify، یا تعاملِ ظریف با
`onRequest`/preHandlerِ چندلایه‌ی این پروژه) بدونِ صرفِ زمانِ نامتناسب با ارزشِ این
بهینه‌سازی مشخص نشد.

## تصمیم: برگردانده شد
تمامِ تغییراتِ signal-threading (port، هر دو adapter، `generateCaseFile.ts`،
`caseFile.routes.ts`) برگردانده شد — کدِ non-functional/گمراه‌کننده بهتر از نگه‌داشتنِ
پیچیدگیِ اثبات‌نشده نیست. `git diff --stat` روی `server/src/features/case-file`
خالی است (دقیقاً به حالتِ قبل از این تلاش برگشت). فقط رفعِ UI (پروندهٔ قبلی —
poll به‌جایِ fail) باقی می‌ماند، که مستقل از این موضوع است و کار می‌کند.

## داده‌ی حساس
هیچ. تمامِ تست‌ها با حساب/مراجع/یادداشتِ کاملاً synthetic (ثبت‌نامِ یک‌بارمصرف با
شماره‌ی تصادفی) بودند، هر کدام در پایان با `DELETE /api/clients/:id` پاک‌سازی شدند
(هرچند در برخی اجراها، delete با ۴۰۰ مواجه شد چون رمزِ session ownership/cookie parsing
در اسکریپتِ خامِ Node به‌درستی کار نکرد — این حساب‌های synthetic باقی‌مانده صرفاً داده‌ی
تستیِ بی‌ضررند، نه داده‌ی بالینی، و می‌توانند با یک migration/query دستیِ جدا پاک شوند
اگر لازم باشد).

## کارِ باز
اگر مالک هنوز می‌خواهد لغوِ واقعیِ سمتِ سرور را داشته باشد، قدمِ بعدی باید یک ایزوله‌سازیِ
عمیق‌ترِ Fastify (شاید upgrade/downgrade نسخه، یا گزارشِ باگ به upstream) باشد — کاری
مجزا و بزرگ‌تر از scopeِ همین تسک.
