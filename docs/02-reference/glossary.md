# Glossary — واژه‌نامه

> **وضعیت:** ACTIVE-CANONICAL.

| اصطلاح | معادل در کد | تعریف |
|---|---|---|
| تراپیست | `therapists`، `therapistId` | کاربرِ اصلیِ سیستم؛ صاحبِ مراجعین |
| ادمین | `is_admin` | تراپیست با دسترسیِ پنلِ ادمین |
| مراجع | `clients` | فردِ درمان‌شونده؛ با کد `CL-XXXX` و نام مستعار شناخته می‌شود (نامِ واقعی ذخیره نمی‌شود) |
| جلسه | `sessions` | یک جلسه‌ی درمانی با شماره‌ی ترتیبی برای هر مراجع |
| نشست (auth) | `auth_sessions`، کوکیِ `feelia_session` | ورودِ تراپیست؛ متفاوت از «جلسه» |
| رضایت | `consent` | موافقتِ مراجع با رونویسی؛ پیش‌شرطِ جلسه |
| Preflight | `runPreflight` | بررسیِ میکروفون و `/api/stt/check` پیش از شروع |
| Wrapup | `#screenWrapup` | صفحه‌ی تکمیلِ جلسه (یادداشتِ بعد، یادداشتِ صوتی، ذخیره) |
| علامت | `session_notes.type='sign'` | علامتِ رفتاری/بدنی با زمان (مثلاً «گریان») |
| یادداشتِ سریع | `note_during` | یادداشتِ متنی حینِ جلسه با `offset_ms` |
| یادداشتِ بعد | `note_after` | یادداشتِ متنی در Wrapup |
| یادداشتِ صوتی | `type='voice'` | صدای تراپیست که به متنِ یادداشت تبدیل می‌شود؛ هرگز واردِ transcript نمی‌شود |
| Transcript | `sessions.transcript` | متنِ رونویسیِ جلسه |
| Confirmed / Final | `self.confirmed`، `is_final` | توکن‌های قطعیِ Soniox؛ تغییر نمی‌کنند |
| Interim / Non-final / Hint | `self.interim`، `rec.hint` | متنِ موقت در حالِ گفتن؛ هرگز persist نمی‌شود |
| FeeliaRT | `window.FeeliaRT`، `RTSession` | موتورِ اصلیِ realtime در مرورگر |
| Temp key / Mint | `mintTemporaryKey` | کلیدِ موقتِ single-use Soniox که سرور برای هر اتصال صادر می‌کند |
| Keepalive | `startKeepalive`، `KEEPALIVE_INTERVAL_MS` | پیامِ کنترلیِ Soniox که حینِ توقفِ دستی اتصال و context (شماره‌ی گوینده) را زنده نگه می‌دارد |
| Generation | `RTSession.generation`، `P1Record.generation` | شماره‌ی اتصالِ Soniox؛ هر reconnect/resume +1 |
| Epoch | `connEpoch`، `pauseEpoch` | شمارنده‌ی ابطالِ کارهای در-flight (نتیجه‌ی دیررس نادیده گرفته شود) |
| Unreliable | `self.unreliable` | پرچمِ یک‌طرفه: متنِ realtime ممکن است گپ داشته باشد → batch |
| Durable recording / سگمنت | `durableRec`، `AudioQueueDB` | ضبطِ موازیِ ۲۴kbps، هر ۶۰s یک فایلِ مستقل در IndexedDB |
| Batch fallback | `stt/batchqueue.ts` | رونویسیِ صدای ذخیره‌شده با API async بعد از شکستِ realtime |
| Purpose | `transcript` / `note` / `archive` | مقصدِ یک سگمنتِ آپلودشده |
| Archive (صدا) | `session_audio`، `data/session-audio` | نگهداریِ ۱۴روزه‌ی صدا برای بازبینیِ ادمین |
| CAS | `transcript_version` | Compare-and-swap؛ نوشتنِ متن فقط با نسخه‌ی پایه‌ی صحیح |
| Rebase | `persistConfirmed` روی 409 | گرفتنِ متنِ سرور؛ متنِ طولانی‌تر برنده |
| مارکرِ ناپیوستگی | `noteDiscontinuity` | خطِ «[اتصال دوباره برقرار شد — …]» در متن |
| Diarization / گوینده | `speaker`، «گوینده N» | تشخیصِ گوینده توسطِ Soniox؛ شماره per-connection |
| Resolve speakers | `speakerResolve.ts` | رونویسیِ دوباره‌ی کلِ صدای آرشیو برای یکدست‌کردنِ گوینده‌ها (پیش‌نمایش + تأیید) |
| Recovered | `status='recovered'` | جلسه‌ای که در مسیرِ legacy بعد از ۶۰s قطعی رها شده |
| P1 / P3 | کامنت‌ها | «Priority 1» پروتکلِ ordering/ACK مسیرِ legacy؛ «P3» ادامه‌ی جلسه بعد از reload |
| ACK / seq / reorder buffer | `ws/p1.ts` | ترتیب‌دهیِ chunkهای صدا در مسیرِ legacy |
| Grace timeout | `GRACE_TIMEOUT_MS` | ۶۰s انتظار قبل از `recovered` |
| Legacy proxy | `/ws/t`، `/ws/voice` | مسیرِ قدیمیِ ارسالِ صدا از طریقِ سرور |
| SonioxDirect | `index.html` | نسخه‌ی قدیمیِ اتصالِ مستقیم (قبل از FeeliaRT) |
| Egress / Proxy | `PROXY_URL` | مسیرِ خروجیِ سرور به اینترنت |
| Watchdog | `startSttWatchdog` | هشدارِ «صدا هست ولی متن نمی‌آید» |
| Clarity / Mask | `data-clarity-mask` | تحلیلِ رفتارِ UI؛ پوشاندنِ محتوای حساس |
| DIAG-TEMP | کامنت | برچسبِ کدِ تشخیصیِ موقت (LAW-023) |
| DERIVED / APPROVED | requirement-catalog | REQِ استخراج‌شده از کد / تأییدشده توسطِ مالک |
| INFERRED / UNVERIFIED | همه‌ی اسناد | استنباط از کد بدونِ اجرا / غیرقابلِ‌بررسی از repo |
