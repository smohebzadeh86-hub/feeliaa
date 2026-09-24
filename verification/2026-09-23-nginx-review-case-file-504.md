# 2026-09-23 — بررسیِ کانفیگِ nginxِ پیشنهادی + رفعِ 504ِ تولیدِ پرونده

**نوع:** AUDIT + FIX (فرانت) + کانفیگِ مرجع · **deploy:** نه · **commit:** نه

## ورودی
مالک یک کانفیگِ nginx از پروژه‌ی دیگری (upstreamهایِ `medical-ecg-*`) فرستاد و خواست نکاتِ مفید برایِ پایداریِ فیلیا بررسی و اعمال شود.
تلاشِ خواندنِ کانفیگِ زنده: `ssh -o BatchMode=yes root@185.110.191.126` → `Permission denied (publickey,password)` — کانفیگِ واقعی دیده نشد.

## یافته‌ها
| # | یافته | منبع | اقدام |
|---|---|---|---|
| 1 | `POST /api/clients/:id/case-file/regenerate` همگام است و چند دقیقه طول می‌کشد (timeoutِ LLM ۵ دقیقه، کلاینت ۱۰ دقیقه). با `proxy_read_timeout`ِ پیش‌فرضِ ۶۰ث، nginx 504ِ HTML می‌دهد؛ `api()` → `status=504` بدونِ `code` → polling متوقف و بنرِ «خطا»، در حالی که سرور تولید را ادامه می‌دهد (هیچ لغوی با قطعِ اتصال در `server/src/features/case-file` نیست). کامنتِ `index.html` که می‌گوید abort به سرور وصل است با کد نمی‌خواند. | `caseFile.routes.ts:35`، `openrouter.adapter.ts:58`، `index.html` `regenerateCaseFile` | فرانت: 504ِ بدونِ code مثلِ timeout (ادامه‌ی polling). nginx: `proxy_read_timeout 660s` روی همین مسیر. |
| 2 | اپ تا ۱۰MB multipart می‌پذیرد؛ پیش‌فرضِ nginx ۱MB است (کانفیگِ زنده نامعلوم). | `server/src/index.ts:61` | `client_max_body_size 12m` در کانفیگِ مرجع. |
| 3 | اپ فشرده‌سازی ندارد؛ `index.html` ≈ ۴۱۰KB، `feelia-rt.js` ≈ ۱۰۸KB. | `public/` | gzip برایِ JS/CSS/JSON. |
| 4 | موارد **خطرناک** در کانفیگِ ارسالی: `Permissions-Policy microphone=()` (ضبط را می‌کُشد)، `max-age=300` رویِ `*.js` (همان باگِ JSِ کهنه)، CSP بدونِ `wss://stt-rt.soniox.com`/Google Fonts، `@backend_fallback` با ۵۰۳ِ text/plain. | کانفیگِ ارسالی | عمداً کپی نشد؛ در سرِ فایلِ مرجع توضیح داده شد. |
| 5 | پیشنهاد (بدونِ اقدام): `app.listen` روی `0.0.0.0` ⇒ پورتِ ۳۰۰۰ اگر فایروال نباشد مستقیم از اینترنت در دسترس است؛ کوکیِ نشست بدونِ `secure`؛ SIGTERM/SIGINT بدونِ `app.close()` ⇒ ۵۰۲ِ کوتاه در هر `pm2 restart`. | `index.ts:97,123`، `auth.ts:111` | نیازمندِ تصمیمِ مالک. |

## تست
- parseِ اسکریپتِ inlineِ `index.html` با `new Function`: ۱ اسکریپت، ۰ خطای syntax.
- اجرایِ خودِ `regenerateCaseFile` با `api` ساختگی: 504ِ بدونِ code → polling ادامه + پیامِ «پس‌زمینه» ✓؛ 502 با code و 502 بدونِ code → توقف + بنرِ خطا (بدونِ تغییر) ✓؛ timeoutِ کلاینت → مثلِ قبل ✓.
- `tsc`/`test:rt` لازم نبود (سرور و `feelia-rt.js` تغییر نکردند).
- کانفیگِ مرجع با `nginx -t` تست **نشد** (nginx روی ماشینِ dev نیست).
