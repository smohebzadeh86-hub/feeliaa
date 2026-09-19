# AI Agent Reading Guide

> **وضعیت:** ACTIVE · **اعتبار:** HIGH · مخاطب: هر AI Agent یا توسعه‌دهنده‌ی جدید.

## ۱. Workflow اجباری

```
1. Understand task         ← درخواست را دقیق بازگو کن؛ ابهامِ واقعی را بپرس
2. Determine affected area ← frontend? backend? DB? صدا؟ ادمین؟ analytics؟
3. Identify module         ← docs/02-reference/module-map.md
4. Identify subsystem      ← docs/07-subsystems/README.md
5. Read relevant docs      ← laws → PRD → implementation plan → subsystem → catalogها
6. Inspect code            ← فایل‌های Code Anchors؛ کد را کامل بخوان، نه فقط grep
7. Plan                    ← تغییرِ حداقلی؛ REQ/LAW مرتبط را نام ببر
8. Implement               ← فقط scope؛ بدونِ refactor نامرتبط
9. Test                    ← LAW-016
10. Verify                 ← رفتارِ قابلِ‌مشاهده (browser/لاگ/شبکه) در صورتِ امکان
11. Update documentation   ← LAW-017؛ جدولِ بخش ۷ CLAUDE.md
12. Log event              ← PROJECT_STATUS.md: ورودیِ جدید بالای Event Log + وضعیت‌ها (LAW-024)
13. Report                 ← فارسی؛ چه شد، چه تست شد، چه نشد، چه ریسکی ماند
```

## ۲. Scope → حداقلِ context

| اگر task به این دست می‌زند… | بخوان | حتماً چک کن |
|---|---|---|
| `public/feelia-rt.js` | subsystems 01، 02، 03 | harness قبل و بعد؛ LAW-008، LAW-012 |
| `public/index.html` بخشِ Live/Setup | module 03، 04؛ subsystem 01 | کدام مسیر فعال است (FeeliaRT / SonioxDirect / proxy) — `startSession` |
| هر متن/کانتینرِ نمایشِ داده در UI | LAW-011، `docs/analytics-clarity.md` §7 | `data-clarity-mask` |
| متنِ رضایت/privacy یا هر چیزی درباره‌ی صدا | LAW-009، LAW-010، subsystem 05 | هم‌خوانیِ متن با رفتار |
| `server/src/http/sessions.ts` | module 03، 04، 05؛ api-catalog | مالکیت (LAW-004)، CAS |
| `server/src/stt/*` | subsystems 02، 05؛ integration-architecture | LAW-003، egress `PROXY_URL` |
| `server/src/ws/*` | subsystem 04 | LAW-015 (frozen) |
| `server/src/http/admin.ts` | module 06 | LAW-005 |
| `server/src/auth/*`، `http/auth.ts` | module 01، platform | کوکی، `active`، `ADMIN_PHONE` |
| migration | data-architecture، database-catalog | LAW-007 |
| env var | configuration-catalog | `.env` در cwd پروسه خوانده می‌شود |
| deploy | deployment-operations | LAW-006؛ بخش‌های UNVERIFIED |

## ۳. نکاتِ ضدِ اشتباه (از تجربه‌ی واقعیِ همین repo)

1. **سه مسیرِ realtime در فرانت هست.** مسیرِ اصلی `FeeliaRT` است؛ `SonioxDirect` فقط وقتی `FeeliaRT.isAvailable()` false است و `localStorage.feelia_direct !== '0'`؛ proxyِ `/ws/t` آخرین fallback. قبل از تغییر، مسیر را در `startSession()` دنبال کن.
2. **seq و هدرِ WebM:** هر اتصال/موتورِ تازه = MediaRecorderِ تازه = هدرِ تازه؛ seq/ordering باید reset شود (باگِ واقعیِ «Audio decode error»).
3. **purpose صدا سه‌تاست** (`transcript`/`note`/`archive`) و انتخابِ اشتباه = duplicate متن یا گم‌شدنِ یادداشت. subsystem 02.
4. **`finish()` منتظرِ drain نیست** (پیش‌فرض non-blocking)؛ `awaitBatch` فقط برای تست.
5. **`MediaRecorder.onstop` async است**؛ قبل از خواندنِ صفِ IndexedDB منتظرِ `stopDurableSegment()` بمان.
6. **harness در working tree ۶ شکست دارد** (در HEAD سالم). قبل از تغییر، خروجیِ baseline را ثبت کن تا شکستِ جدید را از قدیمی تشخیص دهی.
7. **`.env` از cwd خوانده می‌شود** (`dotenv/config`) و `data/` هم نسبت به cwd است؛ dev = `server/`.
8. **روت‌ها encapsulated هستند:** `addHook('preHandler', requireAuth)` داخلِ هر plugin فقط روی همان plugin اثر دارد؛ روتِ جدید را داخلِ plugin درست ثبت کن. `/api/health` و فایل‌های استاتیک بدونِ auth هستند.
9. **فرانت را بدونِ حسابِ واقعی تست کن:** mock backend در scratchpad که `public/` واقعی را سرو و `/api/*` را stub کند. میکروفون در Browser pane در دسترس نیست.
10. **`clarity.ms` از شبکه‌ی dev بلاک است**؛ payloadهای واقعی را فقط از VPS/شبکه‌ی دیگر می‌توان دید.

## ۴. قالبِ گزارشِ نهایی

```
## خلاصه
## تغییرات (فایل:خط)
## تست‌ها (دستور + خروجیِ واقعی، شاملِ شکست‌های قبلی)
## آنچه تأیید نشد و چرا
## اسنادِ به‌روزشده
## ریسک‌ها / تعارض‌های باقی
```

## ۵. وقتی سند و کد نمی‌خوانند

1. کد را معیارِ «وضعیتِ موجود» بگیر (مگر قانون نقض شده باشد).
2. تعارض را به کاربر بگو.
3. سندِ مالک را اصلاح کن (یا اگر scope اجازه نمی‌دهد، به‌عنوانِ پیشنهاد گزارش کن).
4. هرگز سندِ HISTORICAL را برای رفعِ ابهام مبنا قرار نده.
