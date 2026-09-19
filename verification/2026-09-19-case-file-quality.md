# Verification — کیفیتِ متنِ پرونده‌ی روندِ درمان + رفعِ ۳ باگِ UI (2026-09-19)

**نوع:** شواهدِ مشاهده در یک زمان. داده: فقط canary ساختگی (بدونِ داده‌ی واقعیِ مراجع).

## تغییرات
- بک‌اند: تولیدِ دو مرحله‌ای (`digestCorpus` → `generateCaseFile`)، `renderDigest.ts`، `normalizeText.ts`، `caseFileDigestSchema.ts`، `chatJson.ts` (هلپرِ مشترکِ adapterها)، بازنویسیِ prompt (بدونِ کسره‌ی اضافه، قواعدِ ۱۳/۱۴ اصلاح، ۲۰ = زبان + حفظِ ZWNJ، ۲۱ = معیارِ statusTone)، `GENERATING_LOCK_TTL_MS` از ۳ به ۸ دقیقه.
- فرانت: چیپِ why هم‌رنگِ اولویت + نقطه، `cf-role` درون‌خطی (بدونِ جعبه)، تایپوگرافیِ `.case-file-doc` هم‌تراز با design system.

## نتایج
| بررسی | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | ✅ بدونِ خطا |
| تستِ واحدِ `normalizePersianText/normalizeDeep`، schema، `renderDigest`، نبودِ کسره در promptها | ✅ ۶ PASS |
| LLM واقعی (OpenRouter، canary دو جلسه‌ای با غلطِ ASR) | digest: املا/نیم‌فاصله تصحیح شد، ۳ فکتِ دارو/رویداد/خطر بدونِ افزودن/حذف، ۳ ابهامِ درست علامت‌گذاری شد. compose: بدونِ کسره؛ `statusTone` متنوع (watch/good/watch/watch/sensitive) |
| ZWNJ | در اجرای اول compose نیم‌فاصله‌ها را انداخت («بیحوصله») ← قاعده‌ی صریح به prompt اضافه شد ← اجرای دوم: ZWNJ خام ۳۹ = بعد از normalize ۳۹ ✅ |
| فرانت (mock + Browser pane، `loadCaseFile`) | base ۱۴px، عنوانِ بخش ۱۶px، axis-body ۱۳٫۵px، chip ۱۱px، فونتِ Vazirmatn؛ چیپِ p1–p4 هم‌رنگِ اولویت؛ `.cf-role` `display:inline`، بدونِ background/border، هم‌خط با متن |

## محدودیت‌ها / اجرا نشده
- **تأخیر:** canary دو جلسه‌ای: digest ≈۵۸ثانیه + compose ≈۱۰۷ثانیه ≈ ۱۶۵ثانیه (قبلاً یک فراخوانی). timeoutِ فرانتِ regenerate = ۱۰ دقیقه است؛ **timeoutِ reverse proxy روی VPS بررسی نشده (UNVERIFIED)**. برای مراجعِ با جلساتِ زیاد ممکن است بیشتر شود ← در صورتِ نیاز digest per-session موازی شود.
- پرونده‌هایِ قبلاً تولیدشده اصلاح نمی‌شوند؛ باید «به‌روزرسانی/بازتولید» شوند (بازتولیدِ force فیلدهایِ تاییدشده را دور می‌ریزد — اجرا نشد).
- اسکرین‌شاتِ مقایسه با طرحِ مرجع و حالتِ موبایل/تاریکِ کامل گرفته نشد؛ فقط computed style + یک اسکرین‌شاتِ روشنِ ناقص (viewport پنل کوچک بود). حالتِ تاریکِ چیپ‌ها از طریقِ رنگ‌هایِ computed بررسی شد.
- کیفیتِ «کاملاً روان» ذاتاً ذهنی است؛ فقط یک canary کوچک اجرا شد.
