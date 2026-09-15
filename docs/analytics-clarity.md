# تحلیلِ تجربه‌ی کاربری با Microsoft Clarity

> این نسخه مستندِ همان چیزی است که در این commitِ مجزا deploy می‌شود (بر پایه‌ی `main`/HEAD،
> بدونِ فیچرهای دیگرِ commit‌نشده مثلِ وضعیت/دسته‌بندیِ مراجع). اگر بعداً آن فیچرها هم merge شوند،
> این سند و allowlistِ `feelia-analytics.js` باید به‌روزرسانی شوند (بخشِ ۶، ردیف‌های «هنوز فعال نیست»).

هدف: فقط تحلیلِ رفتارِ UI (کلیک، اسکرول، rage/dead click، مسیرِ حرکت بینِ صفحه‌ها، funnel).
Clarity **هرگز** محلِ جمع‌آوریِ داده‌ی بالینی یا شخصی نیست.

## ۱. کجاست؟

| فایل | نقش |
|---|---|
| `public/feelia-analytics.js` | کلِ integration: consent، لودِ یک‌باره‌ی اسکریپت، allowlistِ رویدادها و صفحه‌ها. `window.FeeliaAnalytics` |
| `server/src/http/clientConfig.ts` | `GET /api/client-config` (پشتِ `requireAuth`) — Project ID را از env می‌دهد؛ برای ادمین همیشه `null` |
| `public/index.html` | `data-clarity-mask` روی عناصرِ حساس، کارتِ رضایت، و فراخوانی‌های یک‌خطیِ `uxTrack()` / `FeeliaAnalytics.*` |

هیچ npm package یا dependencyِ جدیدی اضافه نشده (فرانت bundler ندارد). اسکریپت همان تگِ رسمیِ
`https://www.clarity.ms/tag/<projectId>` است، ولی به‌جای snippetِ inline از یک فایلِ خارجی تزریق می‌شود.

## ۲. چطور initialize می‌شود؟

```text
DOMContentLoaded → init() → /api/auth/me → enterApp()
      ↓ (fire-and-forget، بدونِ await)
FeeliaAnalytics.boot(therapist)
   ├─ ادمین؟                       → خاموش
   ├─ offline؟                      → صبر تا رویدادِ online (اپ منتظر نمی‌ماند)
   └─ GET /api/client-config (timeout ۳ ثانیه)
        ├─ null / خطا / timeout     → خاموش (بی‌صدا)
        └─ projectId
             ├─ اجازه‌ی ذخیره‌شده = granted → تزریقِ یک‌باره‌ی <script async> + consentv2
             ├─ denied                      → خاموش (فقط لینکِ «روشن کردن» در پایینِ صفحه)
             └─ نامشخص                      → کارتِ رضایت بالای صفحه‌ی مراجعین
```

- اسکریپت در هر بارگذاریِ صفحه حداکثر یک‌بار تزریق می‌شود (`script[data-feelia-clarity]`).
- URL در فیلیا هیچ‌وقت عوض نمی‌شود (SPA با `showScreen`)، پس re-init روی تغییرِ صفحه وجود ندارد.
- هر خطا (بلاک‌شدنِ clarity.ms، ad-blocker، قطعی، CSP) فقط Clarity را خاموش می‌کند؛ هیچ متدی throw نمی‌کند.
- بعد از logout، اگر Clarity لود شده بود صفحه reload می‌شود تا ضبط به کاربرِ بعدیِ همان تب نرسد.

## ۳. Consent

- رضایتِ **خودِ تراپیست** است (رفتارِ خودش ضبط می‌شود) — کاملاً جدا از رضایتِ بالینیِ مراجع برای رونویسی.
- ذخیره: `localStorage` با کلیدِ `feelia_ux_consent_v1:<therapistId>` (به تفکیکِ تراپیست، روی همان مرورگر). DB تغییری نکرده.
- پیش‌فرض: بدونِ تصمیم، **هیچ درخواستی به Clarity نمی‌رود**.
- اجازه: `clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' })`.
- لغو: لینکِ پایینِ صفحه → `clarity('consent', false)` (پاک‌کردنِ کوکی‌ها و توقفِ ردیابی طبقِ مستنداتِ Microsoft) و خاموشیِ فوریِ wrapper.
- رویدادهایی که قبل از مشخص‌شدنِ وضعیت رخ می‌دهند (مثلاً `login_completed`) فقط در حافظه می‌مانند و فقط اگر اجازه از قبل داده شده باشد ارسال می‌شوند.

## ۴. Environment

| متغیر | کجا | اثر |
|---|---|---|
| `CLARITY_PROJECT_ID` | همان `.env`ی که `dotenv` از cwdِ پروسه می‌خواند | خالی/نبود = **خاموش** (پیش‌فرضِ dev). فرمتِ مجاز: `^[a-z0-9]{6,20}$` — غیرِ آن هم خاموش + یک warning در لاگ |

- **Development:** `pnpm dev` با cwdِ `server/` اجرا می‌شود → `server/.env`. آنجا ست نکنید.
- **Production (feelia.ir):** pm2 با cwdِ `/root/feeliaa` اجرا می‌کند → **`/root/feeliaa/.env`** (نه `server/.env`).
  بعد از ست‌کردن: `pm2 restart feelia --update-env`.
- **Staging:** الان وجود ندارد؛ اگر اضافه شد، یک Clarity projectِ جدا بسازید تا داده‌ها مخلوط نشوند.

### خاموش کردن
1. **سراسری (فوری برای همه):** `CLARITY_PROJECT_ID` را از `.env` پاک کنید و سرویس را restart کنید.
   از بارگذاریِ بعدیِ صفحه، هیچ مرورگری Clarity را لود نمی‌کند.
2. **برای یک تراپیست:** لینکِ «تحلیلِ تجربه‌ی کاربری روشن است — خاموش کردن» پایینِ صفحه.

## ۵. صفحه‌ها (screen tracking)

با هر `showScreen(name)`: `clarity('set','screen',<name>)` و رویدادِ `screen_<name>`. هیچ ID یا URLی ارسال نمی‌شود.

| Screen در کد | نامِ ارسالی | وضعیت |
|---|---|---|
| `Clients` | `clients` | فعال + mask |
| `Setup` | `session_setup` | فعال + mask |
| `Live` | `session_live` | فعال + mask |
| `Wrapup` | `session_wrapup` | فعال + mask |
| `ClientDetail` | `client_profile` | فعال + mask |
| `Auth` | — | Clarity قبل از login لود نمی‌شود |
| `Admin`, `AdminTherapist` | — | برای ادمین هرگز لود نمی‌شود |

## ۶. رویدادها

هیچ رویدادی پارامتر ندارد. نامِ خارج از allowlistِ `EVENTS` بی‌صدا دور ریخته می‌شود.

| Event | Trigger |
|---|---|
| `signup_completed` / `login_completed` | موفقیتِ `submitAuth` |
| `logout_clicked` | `logout` |
| `client_create_opened` / `client_created` / `client_create_failed` | مودالِ مراجعِ جدید |
| `transcript_opened` | باز کردنِ متنِ یک جلسه در پرونده |
| `session_meta_edited` / `session_deleted` | ویرایشِ تاریخ/حذفِ جلسه |
| `client_deleted` | حذفِ کاملِ مراجع |
| `client_consent_given` / `client_consent_declined` | دکمه‌های رضایتِ مراجع در Setup |
| `preflight_mic_failed` + tag `mic_error` | خطای میکروفون؛ مقدارِ tag فقط نامِ خطای مرورگر (`NotAllowedError`، …) یا `other` |
| `session_start_clicked` / `session_started` / `session_start_failed` | `startSession` |
| `session_pause_clicked` / `session_resume_clicked` / `session_end_clicked` | دکمه‌های صفحه‌ی Live (هر سه موتور) |
| `session_canceled` / `session_saved` / `session_exit_without_save` | لغو / ذخیره و پایان / خروج بدونِ ذخیره |
| `session_live_resume_clicked` / `session_interrupted_resume_clicked` | بنرهای ادامه‌ی جلسه |
| `live_text_toggled` | چک‌باکسِ «نمایش متن زنده» |
| `sign_added` | کلیک روی چیپِ علامت — **نوعِ علامت ارسال نمی‌شود** |
| `quick_note_added` / `text_note_added` | ثبتِ یادداشت — **متن ارسال نمی‌شود** |
| `voice_note_started` / `voice_note_stop_clicked` | یادداشتِ صوتی |
| `ux_consent_granted` | تراپیست اجازه‌ی Clarity را داد |
| `screen_*` | بخشِ ۵ |

**هنوز فعال نیست در این deploy** (چون خودِ UIِ مربوطه هنوز commit/merge نشده — allowlist آماده است، ولی جایی برای صدازدنش نیست):
`client_deactivated`, `client_reactivated`, `client_category_edited`, `clients_tab_switched`. وقتی فیچرِ وضعیت/دسته‌بندیِ مراجع (migrationهای `008`, `009`) بعداً merge شود، این ۴ فراخوانی هم به همان الگو (یک خط `uxTrack('...')` بعد از موفقیتِ API) اضافه شوند.

کلیک‌ها، اسکرول، rage/dead click و heatmap را خودِ Clarity به‌صورتِ خودکار ثبت می‌کند.

## ۷. چه چیزی عمداً پوشانده شده؟

همه با `data-clarity-mask="true"` (این attribute تنظیمِ داشبورد را override می‌کند). input و dropdown در Clarity همیشه mask هستند.

| ناحیه | محتوا |
|---|---|
| `#screenAuth` | تلفن، ایمیل، نام، تخصص، رمز |
| `#bannerBox` | بنرهای جلسه‌ی ناتمام / ساختِ مراجع (کد و نامِ مستعار) |
| `#searchInput`, `#clientsList` | نامِ مستعار، کد، تاریخ‌ها |
| `#setupClientInfo`, `#setupChips` | کد/نامِ مستعار، تاریخ و ساعت |
| `#recChip`, `#liveConnBanner`, `#liveText` | کد·نامِ مستعار·تاریخ، پیام‌های خطا، **رونویسیِ زنده** |
| `#signsRow`, `#signsLog` | **علائم** |
| `#notesLog`, `.qn-row` | **یادداشت‌های حینِ جلسه** |
| `#wrapupInfo`, `#wrapupChips`, `#wrapupSignsLog`, `#wrapupNotesLog`, `#notesList` | خلاصه، علائم، یادداشت‌ها |
| `#voiceNoteBox`, `#textNoteBox` | **رونویسیِ یادداشتِ صوتی**، متنِ یادداشت |
| `#detailTitle`, `#sessionsList`, `#sessionDetail` | کد/نامِ مستعار، تاریخِ جلسات، **متنِ کاملِ جلسه** و یادداشت‌ها |
| مودال‌ها | مراجعِ جدید، حذفِ مراجع/جلسه، ویرایشِ تاریخ، خروج، حذفِ تراپیست |

### قوانین برای توسعه‌ی بعدی
- هر container جدیدی که دیتای مراجع/جلسه/تراپیست نشان می‌دهد **باید** `data-clarity-mask="true"` بگیرد.
- `data-clarity-unmask` در این پروژه ممنوع است.
- `clarity('identify', …)` ممنوع است.
- رویدادِ جدید فقط با نامِ ثابت و بدونِ داده، از طریقِ `uxTrack('name')` + اضافه‌کردن به `EVENTS`.

## ۸. تنظیماتِ داشبوردِ Clarity (دستی)

- **Masking mode:** Balanced (اعداد/ایمیل mask؛ برچسب‌های UI خوانا). ناحیه‌های حساس با attribute مستقل از این تنظیم mask هستند.
- **Google Analytics integration:** خاموش.
- **Cookies:** مطابقِ جریانِ رضایتِ بالا.

## ۹. CSP

فعلاً nginx و پاسخِ ArvanCloud جلوی `feelia.ir` هیچ Content-Security-Policyی ندارند (تأییدشده روی سرورِ production). اگر بعداً CSP اضافه شد، حداقلِ لازم طبقِ مستنداتِ Microsoft:

```text
script-src  https://www.clarity.ms https://*.clarity.ms
connect-src https://*.clarity.ms https://c.bing.com
img-src     https://*.clarity.ms https://c.bing.com
```

`unsafe-inline`/`unsafe-eval` لازم نیست چون لودر یک فایلِ خارجی است.

## ۱۰. بررسیِ دستی بعد از deploy

1. DevTools → Network → فیلترِ `clarity`: قبل از اجازه **هیچ** درخواستی نباشد؛ بعد از اجازه یک `tag/<id>` و `collect`ها.
2. در Clarity → Recordings یک جلسه‌ی تستی را ببینید: متنِ مراجع/رونویسی/یادداشت/علائم باید `•`/`▪` دیده شوند.
3. ادمین login کند → هیچ درخواستی به `clarity.ms` نرود.
