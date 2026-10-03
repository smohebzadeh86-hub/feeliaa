# CURRENT UI STATE

> **Snapshot شواهد از پیاده‌سازیِ فعلی — 2026-09-25** (شاخه‌ی `feat/clarity`، working tree).
> این سند فقط توصیف است: هیچ پیشنهاد، ارزیابی یا طراحیِ آینده در آن نیست. مرجعِ حقیقت کد است.
> تمامِ ارجاع‌های `public/index.html:N` به شماره‌خطِ working tree در همین تاریخ اشاره دارند.

**منابعِ بررسی‌شده:**
- `public/index.html` (7570 خط؛ CSS inline در خطوط 9–723، markup در 725–1453، JSِ SPA در 1458–7570)
- `public/feelia-rt.js`، `public/feelia-upload.js`، `public/feelia-obs.js`، `public/feelia-analytics.js` — هیچ‌کدام UIِ قابلِ‌مشاهده نمی‌سازند (فقط یک `createElement` در `feelia-analytics.js` و یکی در `feelia-obs.js`، هر دو غیرِ بصری). تمامِ UI در `index.html` است.
- هیچ فایلِ CSSِ جدا، هیچ asset تصویری، هیچ icon library و هیچ فریم‌ورکِ فرانت وجود ندارد.

---

## 1. Global Visual Structure

### 1.1 Page shell
- `<html lang="fa" dir="rtl">` (`index.html:2`)، `<meta name="color-scheme" content="light dark">` (`:6`).
- `body`: flex، `justify-content:center`، `padding:30px 16px 52px`، پس‌زمینه‌ی `radial-gradient(900px 420px at 50% -180px, var(--bg-glow), transparent 70%)` روی `var(--bg)`، `line-height:1.9`، `direction:rtl; text-align:right` (`:53`).
- یک ستونِ مرکزی: `.wrap{width:100%;max-width:620px}` (`:54`). همه‌ی screenها، header، banner، steps و privacy note داخلِ `.wrap` هستند (`:727–1223`).
- **No URL route; screen switching is state/DOM based.** — هیچ router، hash یا `history.pushState` وجود ندارد. جابه‌جاییِ screen با `showScreen(name)` و ویژگیِ `hidden` روی `<section>`ها انجام می‌شود (`:2246–2263`).

### 1.2 ساختارِ لایه‌ها

| عنصر | Selector / ID | موقعیت | در کدام screenها | محتوا |
|---|---|---|---|---|
| Header | `header.app-head` (`:728`) | flow-based (بالای `.wrap`) | همه | لوگو (`.brand-mark` SVG 47×47)، eyebrow «دستیار درمانگر»، عنوان `h1` «فیلیا»؛ سمتِ مقابل: ۴ دکمه‌ی `.icon-btn` (سینی، ادمین، خروج، تم) |
| Banner سراسری | `#bannerBox` (`:760`) | flow-based، `position:relative; z-index:60` (`:372`) | همه | یک `.banner.info/.warn/.error` که با `showBanner()` جایگزین می‌شود (`:1614`) |
| Tray (سینی) | `.tray#trayPanel` (`:762`) | **fixed**، `top:84px; left:50%; translateX(-50%)`، `z-index:61` (`:648`) | همه (پس از ورود؛ دکمه‌اش پیش از ورود `hidden`) | «پردازش‌ها و اعلان‌ها»: آپلودهای جاری، jobها، اعلان‌ها (`renderTray` `:7359`) |
| Flow steps | `nav.flow-steps#stepsNav` (`:764`) | flow-based | فقط `Setup`، `Live`، `Wrapup` (`:2257–2259`) | ۳ دایره‌ی شماره‌دار «آماده‌سازی / جلسه / پایان» با خطِ اتصال |
| Main content | `section.card.screen#screen*` (`:772–1217`) | flow-based | هر بار دقیقاً یکی visible | کارتِ سفید با `card-head` + محتوا |
| Footer-like note | `p.privacy-note` (`:1219`) | flow-based، زیرِ همه‌ی screenها | همه | آیکنِ قفل + «صدای خام هرگز ذخیره نمی‌شود — فقط متن رونویسی‌شده.» |
| Modal layer | `.modal-back` × 16 (`:1225–1452`) | **fixed** `inset:0`، `z-index:50` (`:368`) | بر حسبِ trigger | backdrop + `.modal` |
| Dropdownها | `.sort-drop` (`z-index:6`)، `.client-menu-drop` (`z-index:5`)، `.jalali-cal-drop` (`z-index:20`) | absolute نسبت به wrapper | لیستِ مراجعین، فرم‌های تاریخ | (§11) |
| Fixed bottom bars (فقط ≤480px) | `#liveControls`، `#btnStartSession`، `#btnNewClient`، `#btnNewClientAll` | **fixed** `bottom:12px`، `z-index:40` (`:429–439`) | Live، Setup، Clients، AllClients | (§15) |

- Sidebar: **وجود ندارد.** Drawer: **وجود ندارد.** Footer به‌معنای `<footer>`: **وجود ندارد** (فقط `.privacy-note`).
- Toast: **وجود ندارد.** تنها کانالِ پیامِ گذرا `#bannerBox` است که **خودکار محو نمی‌شود** و تا فراخوانیِ بعدیِ `showBanner`/`clearBanner` باقی می‌ماند (`:1614–1615`).
- ترتیبِ z-index: dropdownها 5/6/20 < fixed bars 40 < modal 50 < bannerBox 60 < tray 61.

---

## 2. Screen Inventory

همه‌ی screenها `<section class="card screen">` هستند. فهرستِ رسمی در `showScreen` (`:2247`):
`['Auth','Clients','AllClients','Setup','Live','Wrapup','ClientDetail','SessionDetail','Admin','AdminTherapist','AdminSessions','AdminSessionDetail','AdminActivity','AdminSessionTimeline']`

| # | Name (عنوانِ نمایشی) | Identifier | `showScreen()` | DOM | Route |
|---|---|---|---|---|---|
| 1 | ورود/ثبت‌نام تراپیست | `Auth` | `showScreen('Auth')` `:2487,2500` | `#screenAuth` `:772` | No URL route |
| 2 | مراجعین (امروز) | `Clients` | `:2513,6328,6930,6951,6962` | `#screenClients` `:908` | No URL route |
| 3 | همه‌ی مراجعین | `AllClients` | `:6957` | `#screenAllClients` `:941` | No URL route |
| 4 | جلسه‌ی جدید | `Setup` | `:5296` | `#screenSetup` `:985` | No URL route |
| 5 | جلسه‌ی زنده | `Live` | `:3198,5377` | `#screenLive` `:1019` | No URL route |
| 6 | تکمیل جلسه | `Wrapup` | `:3252,6243` | `#screenWrapup` `:1075` | No URL route |
| 7 | جزئیاتِ مراجع (پرونده) | `ClientDetail` | `:3966` | `#screenClientDetail` `:1117` | No URL route |
| 8 | جزئیاتِ جلسه | `SessionDetail` | `:5056` | `#screenSessionDetail` `:1146` | No URL route |
| 9 | پنل ادمین | `Admin` | `:2596,2618,2949` | `#screenAdmin` `:800` | No URL route |
| 10 | ادمین — تراپیست | `AdminTherapist` | `:2945,3091` | `#screenAdminTherapist` `:821` | No URL route |
| 11 | ادمین — جلساتِ مراجع | `AdminSessions` | `:3087,3132` | `#screenAdminSessions` `:832` | No URL route |
| 12 | ادمین — جزئیاتِ جلسه | `AdminSessionDetail` | `:3128` | `#screenAdminSessionDetail` `:844` | No URL route |
| 13 | فعالیت‌ها / لاگ | `AdminActivity` | `:2614,2713` | `#screenAdminActivity` `:856` | No URL route |
| 14 | تایم‌لاینِ جلسه | `AdminSessionTimeline` | `:2706` | `#screenAdminSessionTimeline` `:899` | No URL route |

خلاصه‌ی محتوا/اکشن/modal برای هر screen در §3 آمده است.

---

## 3. Page-by-Page UI Structure

### 3.1 Screen: Auth (`#screenAuth`, `:772–798`)
```text
Top:
- h2#authTitle «ورود تراپیست» (در حالتِ ثبت‌نام: «ثبت‌نام تراپیست» — :2402)
- p#authSubtitle «برای دسترسی به پرونده‌ی مراجعین وارد شوید»
Main (فرم عمودی):
- [فقط ثبت‌نام] «نام» — placeholder «نام شما»
- [فقط ثبت‌نام] «تخصص» — placeholder «مثلاً: روان‌شناسِ بالینی»
- «شماره موبایل» — type=tel، dir=ltr، text-align:left، placeholder «۰۹۱۲۳۴۵۶۷۸۹»
- [فقط ثبت‌نام] «ایمیل (اختیاری)» — dir=ltr، placeholder «you@example.com»
- «رمز عبور» — .pw-field با دکمه‌ی چشم (.pw-toggle) در سمتِ چپ؛ placeholder «حداقل ۸ کاراکتر»
Bottom:
- btn-primary btn-block «ورود» / «ثبت‌نام»
- btn-ghost btn-block «حساب ندارید؟ ثبت‌نام کنید» / «حساب دارید؟ وارد شوید»
```
Modal: ندارد. Header: فقط دکمه‌ی تم visible (بقیه `hidden`).

### 3.2 Screen: Clients (`#screenClients`, `:908–939`)
```text
Top:
- h2 «مراجعین» / p «مراجعینِ امروز و سنجاق‌شده‌ها»
- btn-ghost btn-block «همه‌ی مراجعین (N)» (برچسب با تعداد، :3287)
- .search-box — placeholder «جست‌وجوی کد یا نام مستعار…»
- p.today-hint «نتیجه در همه‌ی مراجعین» (فقط هنگامِ جست‌وجو)
Main:
- #skeletonList (۲ کارتِ skeleton هنگامِ بارگذاری)
- .clients-grid#clientsList — گروه‌ها با .history-heading «سنجاق‌شده» و «امروز» (:3485–3486)، هر مورد یک .client-card (§12)
- .empty#emptyFirst / #emptySearch
Bottom:
- btn-ghost btn-block «+ مراجع جدید» (#btnNewClient) — در ≤480px fixed پایینِ صفحه
```
Modalها: `newClientModal`، از منوی کارت: `editCategoryModal`، `deactivateClientModal`، `deleteClientModal`، از دکمه‌ی کارت: `audioUploadModal`.

### 3.3 Screen: AllClients (`#screenAllClients`, `:941–983`)
```text
Top:
- h2 «همه‌ی مراجعین» / p «انتخاب مراجع یا مشاهده پرونده»
- btn-ghost btn-block «بازگشت به صفحه‌ی اول»
- .client-tabs: «فعال [count]» | «غیرفعال [count]»
- .search-box (همان placeholder)
- .filter-bar: ردیفِ افقیِ اسکرول‌شونده‌ی چیپ‌ها «همه / کودک / نوجوان / بزرگسال» (:3390) + دکمه‌ی مربعیِ مرتب‌سازی 36×36
  - dropdown مرتب‌سازی: «پیش‌فرض» (در تبِ غیرفعال: «پیش‌فرض (آخرین جلسه)») / «آخرین جلسه» / «الفبا (نام)»
  - چیپِ دسته‌ی دارای جنسیت، پس از انتخاب، به کنترلِ دوتکه‌ی .cat-seg تبدیل می‌شود (:3343–3357)
Main:
- skeleton / .clients-grid#allClientsList با .history-heading «امروز / دیروز / این هفته / قدیمی‌تر» (فقط در مرتب‌سازیِ پیش‌فرض و بدونِ جست‌وجو، :3492–3502)
- .empty (۶ پیامِ مختلف، §14)
Bottom:
- btn-ghost «+ مراجع جدید» (در تبِ غیرفعال: «افزودنِ پرونده‌ی قبلی»، :3303)
```

### 3.4 Screen: Setup (`#screenSetup`, `:985–1017`)
```text
Top:
- flow-steps (مرحله‌ی ۱ active)
- h2 «جلسه‌ی جدید» / p#setupClientInfo (اطلاعاتِ مراجع)
- .session-summary#setupChips (چیپ‌های خلاصه)
Main:
- .consent-box (طلایی): عنوان با آیکنِ سپر «رضایت مراجع برای رونویسی»، متنِ رضایت، دو دکمه «موافق نیست» (ghost) / «موافق است» (primary)، زیرنویسِ ۱۲px
- #preflightBox: دو banner «در حال بررسی میکروفون…» و «در حال بررسی اتصال رونویسی…» + btn-ghost «بررسی دوباره‌ی میکروفون و اتصال»
Bottom:
- btn-primary btn-xl btn-block «شروع جلسه و رونویسی» (با آیکنِ میکروفون؛ پیش‌فرض disabled؛ ≤480px fixed)
- btn-ghost «بازگشت»
```

### 3.5 Screen: Live (`#screenLive`, `:1019–1073`)
```text
Top:
- flow-steps (مرحله‌ی ۲)
- .rec-chip#recChip (کپسولِ مرکزی)
- #liveConnBanner (بنرِ وضعیتِ اتصال)
Main (.rec-stage، وسط‌چین):
- .rec-dot — دایره‌ی 124px رنگِ clay با دو حلقه‌ی «breathe» و آیکنِ سفیدِ قلم
- .timer «۰۰:۰۰» — 47px / 300
- .rec-status «در حال اتصال…» با نقطه‌ی ۷px
- .level-meter — ۱۸ میله‌ی ۵px (:2216)
- .live-toggle — کارتِ کلید «نمایش متن زنده» / «رونویسی را هم‌زمان ببینید»
- .live-text (hidden تا روشن‌شدنِ کلید)
- .signs-area (بالای آن خطِ dashed):
  - «علائم بدنی»: ۹ چیپ — گریان، لرزش، تنش، سکوت، خشم، پرخاش، گریز چشمی، خواب‌آلودگی، بی‌قراری (:1039–1047)
  - #signsLog: کپسول‌های طلاییِ ثبت‌شده با زمان و ×
  - «یادداشت سریع»: #notesLog + ردیفِ input «یادداشت… (Enter)» + btn-secondary «ثبت»
Bottom:
- #liveControls: «توقف موقت» / «ادامه» (secondary) + btn-danger btn-xl «پایان جلسه» (≤480px: نوارِ ثابتِ پایین)
- btn-ghost «لغو جلسه»
```
Modal: `cancelModal`.

### 3.6 Screen: Wrapup (`#screenWrapup`, `:1075–1115`)
```text
Top:
- flow-steps (مرحله‌ی ۳)
- h2 «تکمیل جلسه» / p#wrapupInfo
- #wrapupChips
Main:
- #wrapupSignsLog (کپسول‌های علائم با ×)
- #wrapupNotesLog (یادداشت‌های سریع، بدونِ حذف)
- #notesList (کارت‌های .note-item با برچسبِ «صوتی»/«متنی» + «حذف»)
- btn-row: «یادداشت صوتی» | «یادداشت متنی» (هر دو secondary با آیکن)
- #voiceNoteBox (sub-panel): تایمرِ 26px، «آماده…»، کادرِ «در حال ضبط… حرف بزنید»، «انصراف» | «پایان ضبط و ثبت» (danger، flex:2)
- #textNoteBox: textarea «متن یادداشت…»، «انصراف» | «افزودن»
Bottom:
- btn-primary btn-xl «ذخیره و پایان» (آیکنِ دیسک)
- btn-ghost «بازگشت بدون ذخیره»
```
Modal: `exitModal`.

### 3.7 Screen: ClientDetail (`#screenClientDetail`, `:1117–1141`)
```text
Top:
- h2#detailTitle «{code} — {alias}» / p#detailMeta «N جلسه»
- [فقط غیرفعال] banner.warn: «این مراجع غیرفعال است · دلیل: … — …» + btn-ghost btn-sm «بازگرداندن به فعال‌ها»
Main:
- #caseFileSection.case-file-doc (فقط اگر case_file_enabled) — §12.6
- h3.detail-section-title «جلساتِ ثبت‌شده»
- #sessionsList — .session-item با دکمه‌ی سطلِ گوشه، «جلسه N»، کپسولِ وضعیت، تاریخ
Bottom:
- btn-primary «شروع جلسه‌ی جدید» (فعال) یا «ثبت جلسات گذشته» (غیرفعال)
- btn-secondary «آپلودِ فایلِ صوتیِ جلسه» (آیکنِ upload)
- btn-ghost «بازگشت»
```
Modalها: `deleteSessionModal`، `audioUploadModal`، `caseFileAutoPromptModal`، `cfAddItemModal`، `cfDeleteItemModal`، `genericConfirmModal`.

### 3.8 Screen: SessionDetail (`#screenSessionDetail`, `:1146–1217`)
```text
Top:
- h2 «{code} — {alias} · جلسه N» / p meta:
  - زنده: «کامل|در جریان|قطع‌شده · تاریخ · ساعت»
  - دستی: «ثبتِ دستی · تاریخ|بدونِ تاریخ»
  - آپلود: «فایلِ صوتیِ آپلودشده · تاریخ · مدت»
Main:
- btn-row: «ویرایش تاریخ/ساعت» (ghost sm؛ فقط زنده) | «بازسازیِ شماره‌گذاریِ گوینده‌ها» (فقط زنده+completed)
- [دستی/آپلود] «تاریخِ تقریبیِ جلسه (اختیاری)» + تقویمِ جلالی + hint «ذخیره شد ✓»
- #uploadJobPanel (کارتِ job با مراحل، فقط آپلود)
- .transcript-box (max-height 400px، اسکرول)
- .transcript-notes (نکات/علائمِ درون‌خطی با زمان)
- [فقط دستی] #archiveNoteAdd: «یادداشتِ صوتی» | «یادداشتِ متنی»؛ پنلِ ضبط با «انصراف / توقف موقت / ادامه / پایان ضبط»؛ پنلِ متن با hint «نتیجه‌ی ضبطِ صوتی — …»، «انصراف / ویرایشِ متن / ذخیره‌ی یادداشت»
Bottom:
- btn-ghost «بازگشت به پرونده»
```
Modalها: `editSessionModal`، `resolveSpeakersModal`.

### 3.9 Screen: Admin (`#screenAdmin`, `:800–819`)
```text
Top: h2 «پنل ادمین» / p «مدیریت تراپیست‌ها و دیتای سیستم»
Main:
- #adminStats: grid ۴ ستونی (inline style) از ۵ کارتِ آمار (عدد 22px/800 sage-deep + برچسب 11.5px) — «تراپیست‌ها، مراجعین، کل جلسات، جلساتِ امروز، جلساتِ این هفته» (:2750–2760)
- btn-secondary «فعالیت‌ها / لاگ»، btn-secondary «دانلود کاملِ دیتای سیستم»
- .search-box «جست‌وجوی نام یا شماره…»
- #adminTherapistsList: .client-card (cursor default) — نام (+ 👑 برای ادمین)، شماره، meta، دو toggle «فعال»/«ادمین»، اکشن‌ها «مشاهده مراجعین» (ghost) / «دانلود دیتا» (ghost) / «حذف» (danger)
Bottom: btn-ghost «بازگشت»
```
Modalها: `genericConfirmModal` (toggleها)، `deleteTherapistModal`.

### 3.10 Screen: AdminTherapist (`:821–829`)
عنوان = نام/شماره، meta «شماره · N مراجع». فهرستِ `.session-item`: «کد — alias» + btn-ghost sm «حذف مراجع»، خطِ تاریخ «N جلسه · آخرین: … · دسته · غیرفعال (دلیل)». Empty: «این تراپیست هنوز مراجعی ندارد». پایین: «بازگشت به پنل ادمین».

### 3.11 Screen: AdminSessions (`:832–840`)
زیرعنوان «صدا فقط برایِ بازبینیِ فنی نگه داشته می‌شود — حداکثر ۳۰ روز.» هر `.session-item`: «جلسه N» + کپسولِ وضعیت، تاریخ/منبع/رضایت، btn «مشاهده‌ی متن و یادداشت‌ها»، و در صورتِ وجودِ صدا: خطِ وضعیت «صدا: … / رونویسی: …» با رنگ‌های hard-coded، پیام‌های سگمنتِ گم‌شده/صف، `<audio controls>` بومی (ارتفاع 32px) + «دانلود» (§12). Empty: «این مراجع هنوز جلسه‌ای ندارد».

### 3.12 Screen: AdminSessionDetail (`:844–852`)
عنوان «… · جلسه N»، meta، `.transcript-box` فقط‌خواندنی (یا «(متنی ثبت نشده)»)، فهرستِ `.note-item` با برچسب «علامت / صوتی / متنی»؛ empty «یادداشت/علامتی برایِ این جلسه ثبت نشده.»

### 3.13 Screen: AdminActivity (`:856–896`)
زیرعنوان «رصدِ سراسریِ جلسات و رویدادهایِ سرور — هیچ‌جا متنِ رونویسی/یادداشت نشان داده نمی‌شود.» `.client-tabs`: «جلسات اخیر» | «رویدادها».
- Pane جلسات: دو `<select>` بومی (ناتمام/پایان‌یافته/همه — ۲۴ ساعت/۷ روز/۳۰ روز)، ردیف‌ها به‌صورتِ `.card` با padding 12px (inline)؛ ردیفِ stale با border نارنجی.
- Pane رویدادها: input «نامِ رویداد (مثلاً session.created)» + select severity؛ ردیف‌های flex با خطِ زیرین، severity رنگی.

### 3.14 Screen: AdminSessionTimeline (`:899–906`)
عنوان «تایم‌لاینِ جلسه»، زیرعنوان «ترکیبِ رویدادهایِ سرور/کلاینت/UI/صدا/یادداشت، مرتب بر زمان.» هر ردیف: نوارِ رنگیِ ۳px در `border-inline-start` بر اساسِ lane، `[lane] label` + زمان، خطِ جزئیاتِ `k=v · …` (11px).

---

## 4. Current Visual Hierarchy

(برداشت‌شده از اندازه/وزن/رنگ/موقعیت در CSS؛ فقط مشاهده.)

**Auth:** 1) `h2` 19px/800 · 2) دکمه‌ی primary (پُر، sage، سایه‌ی glow) · 3) فیلدها · 4) دکمه‌ی ghost · 5) زیرعنوان 13px muted.

**Clients / AllClients:** 1) `h2` · 2) دکمه‌های primary «شروع جلسه» روی کارت‌ها (تنها عناصرِ پُررنگ) · 3) نام مستعار 15px/700 + کد 13px/700 sage-deep · 4) تب‌ها (تبِ فعال پُر با sage) · 5) meta 12px muted و badgeهای 10px.

**Setup:** 1) دکمه‌ی xl «شروع جلسه و رونویسی» (17px padding، 16px) · 2) consent-box طلایی · 3) بنرهای preflight · 4) `h2`.

**Live:**
```text
1. .rec-dot (124px دایره‌ی clay با حلقه‌های متحرک)
2. .timer (47px)
3. دکمه‌ی danger xl «پایان جلسه»
4. .rec-status + level meter
5. چیپ‌های علائم / یادداشت سریع
6. «لغو جلسه» (ghost)
```
(صفحه‌ی Live تنها screenِ بدونِ `card-head`/`h2` است.)

**Wrapup:** 1) دکمه‌ی xl «ذخیره و پایان» · 2) `h2` · 3) کارت‌های یادداشت · 4) دکمه‌های secondary یادداشت.

**ClientDetail:** 1) `h2` · 2) پرونده‌ی درمان (بلوکِ بزرگ با تیترهای 16px/800 teal) · 3) «جلساتِ ثبت‌شده» 15px/700 · 4) کپسول‌های وضعیت · 5) دکمه‌ی primary.

**Case file (داخلی):** 1) بنرِ قرمزِ «هشدارِ ایمنی» / کهربایی · 2) `.cf-quick` (گرادیانت) «مسئله‌ی اصلی» · 3) «نکات کلیدی» · 4) تیترهای بخش با نوارِ ۴px teal · 5) کارت‌های محور با نوارِ راستِ رنگی · 6) چیپ‌ها و hintها 11–12.5px.

**Admin:** 1) اعدادِ آمار 22px/800 · 2) `h2` · 3) کارت‌های تراپیست · 4) دکمه‌ی danger «حذف».

---

## 5. Typography

**Font family:** `'Vazirmatn',Tahoma,sans-serif` (`:53`)؛ بارگذاری از Google Fonts با وزن‌های 300/400/500/600/700/800 (`:8`). همه‌ی کنترل‌ها `font-family:inherit`.
**Fallback:** `Tahoma`، سپس `sans-serif`. فونتِ monospace تعریف نشده.
**Line-height پایه:** `1.9` روی body (`:53`)؛ مقادیرِ دیگر: 1.3 (`.timer`)، 1.4، 1.5، 1.6، 1.7، 1.8، 1.85، 1.95، 2، 2.05، 2.1.
**Letter-spacing:** فقط `.timer{letter-spacing:1px}` (`:287`).
**`font-variant-numeric:tabular-nums`:** `.client-code`، `.timer`، `.client-tab .count`، `.jalali-cal-day`، `.icon-badge`.

| نقش | Selector | اندازه / وزن | ارجاع |
|---|---|---|---|
| Brand h1 | `.brand-text h1` | 17.5px / 800 | `:59` |
| Brand eyebrow | `.brand-eyebrow` | 11px / 600 sage | `:58` |
| Screen heading | `.card-head h2` | 19px / 800 | `:87` |
| Screen subtitle | `.card-head p` | 13px muted | `:88` |
| Section title | `.detail-section-title` | 15px / 700 | `:89` |
| Modal title | `.modal h3` | 17px / 800 | `:375` |
| Modal body | `.modal p` | 13.5px, lh 1.9 | `:376` |
| Tray title | `.tray-head h3` | 15.5px / 800 | `:650` |
| Timer (Live) | `.timer` | 47px / 300 (≤480: 40px) | `:287,413` |
| Timer (voice note) | inline | 26px | `:1095` |
| Admin stat number | inline | 22px / 800 | `:2759` |
| Case file section title | `.cf-section-title` | 16px / 800 teal | `:476` |
| Label | `label` | 13px / 600 ink-2 | `:90` |
| Input | `input,textarea` | 15px | `:91` |
| Search input | `.search-box input` | 14px | `:146` |
| Button | `button.btn` | 15px / 600 | `:127` |
| Button xl | `.btn-xl` | 16px | `:139` |
| Button sm | `.btn-sm` | 13px | `:142` |
| Case-file button | `.cf-btn` | 12.5px / 600 | `:466` |
| Body text (notes, live text) | `.note-item p`, `.live-text` | 14px | `:361,294` |
| Transcript | `.transcript-box` | 13.5px, lh 2.1 | `:399` |
| Meta | `.client-meta`, `.session-date` | 12px muted | `:211,269` |
| Chips | `.sign-chip`, `.sum-chip`, `.rec-chip` | 12.5px / 600 | `:317,334,276` |
| Badge | `.cat-badge`, `.pin-badge`, `.status-reason` | 10px / 600 | `:212–218` |
| Session status pill | `.session-status` | 11px / 600 | `:264` |
| Step label | `.step-label` | 11.5px / 500 | `:68` |
| Smallest text | `.jalali-cal-weekdays span`, `.jstep-lbl`, `.icon-badge`, `.cf-prov` | 10.5px | `:112,665,645,492` |

**No consistent type scale detected** — اندازه‌های فونتِ یافت‌شده: 10، 10.5، 11، 11.5، 12، 12.5، 13، 13.5، 14، 14.5، 15، 15.5، 16، 17، 17.5، 19، 22، 26، 40، 47px. هیچ متغیرِ فونت (`--fs-*`) تعریف نشده است.

---

## 6. Color System

### 6.1 Tokenهای سراسری (`:root` `:10–26` و `[data-theme="dark"]` `:27–49`)

| دسته | Token | Light | Dark |
|---|---|---|---|
| Background | `--bg` | `#f6f4ef` | `#131815` |
| Background glow | `--bg-glow` | `rgba(62,107,94,.09)` | `rgba(78,137,119,.08)` |
| Surface | `--card` | `#ffffff` | `#1c2320` |
| Input surface | `--field` | `#fbfcfa` | `#171d1a` |
| Text | `--ink` | `#2b3a34` | `#e7ece8` |
| Text secondary | `--ink-2` | `#4f5f58` | `#c6cfc9` |
| Muted text | `--muted` | `#84918a` | `#8b978f` |
| Border | `--line` | `#e2e7e2` | `#2c352f` |
| Border soft | `--line-soft` | `#edf0eb` | `#242c28` |
| Primary | `--sage` | `#3e6b5e` | `#427a68` |
| Primary hover | `--sage-hover` | `#2e5749` | `#396858` |
| Primary text/deep | `--sage-deep` | `#2e5749` | `#a6cbb9` |
| Primary soft | `--sage-soft` | `#e6efe9` | `#264032` |
| Primary mist | `--sage-mist` | `#f1f5f2` | `#1f2b26` |
| Danger / Accent-record | `--clay` | `#c96655` | `#c96f5e` |
| | `--clay-hover` | `#ad4f3f` | `#d58370` |
| | `--clay-deep` | `#ad4f3f` | `#e8a294` |
| | `--clay-soft` | `#faebe7` | `#38211b` |
| | `--clay-line` | `#f1d6cf` | `#4a2c24` |
| Warning / consent | `--gold` | `#b08c50` | `#c9a56a` |
| | `--gold-deep` | `#7c6531` | `#d9bc80` |
| | `--gold-soft` | `#f8f1e2` | `#2f2817` |
| Toggle off | `--toggle-off` | `#d9dfda` | `#39443d` |
| Shadow | `--shadow` | `0 1px 2px rgba(43,58,52,.04),0 12px 32px rgba(43,58,52,.07)` | `…rgba(0,0,0,.3)…rgba(0,0,0,.35)` |
| Glow | `--glow-sage` / `--glow-clay` / `--breathe-ring` | `.26` / `.32` / `.45` alpha | `.34` / `.34` / `.4` |

- Success: token جداگانه ندارد؛ `--sage-soft/--sage-deep` نقشِ «کامل/done» را دارند (`.session-status.completed` `:266`، `.jstep.done` `:666`).
- Info: `.banner.info` = sage-mist/sage-deep (`:346`).
- Warning: `.banner.warn` = gold-soft/gold-deep + border `#ecdfc2` (`:347`).
- Error: `.banner.error` = clay-soft/clay-deep/clay-line (`:349`).
- Secondary: رنگِ مستقلی ندارد؛ `.btn-secondary` از sage-mist/sage-soft استفاده می‌کند.
- تم: `data-theme` روی `<html>`؛ `toggleTheme()` (`:2224`) و `initTheme()` (localStorage `feelia_theme` یا `prefers-color-scheme`) (`:2230–2238`).

### 6.2 Tokenهای پرونده‌ی درمان (`.case-file-doc`, `:446–458`)
| Token | Light | Dark |
|---|---|---|
| `--cf-ink` | `#243238` | `#e7ece8` |
| `--cf-muted` | `#6f7d82` | `#93a19d` |
| `--cf-line` | `#dfe8e8` | `#2c3936` |
| `--cf-soft` | `#f5f9f9` | `#1c2320` |
| `--cf-card` | `#fff` | `#232b28` |
| `--cf-teal` / `--cf-teal2` | `#2d6f73` / `#e9f3f2` | `#5fa3a0` / `#1c2e2c` |
| `--cf-teal-btn` | — | `#256a67` |
| `--cf-blue` / `--cf-blue2` | `#3f6f91` / `#eef4f8` | `#7fa8c9` / `#1b2732` |
| `--cf-amber` / `--cf-amber2` | `#b17825` / `#fff7e9` | `#d9ac66` / `#2f2817` |
| `--cf-red` / `--cf-red2` | `#a94742` / `#fff1f0` | `#d99490` / `#38211b` |
| `--cf-green` / `--cf-green2` | `#317652` / `#edf7f1` | `#7fc19d` / `#1c2e24` |

### 6.3 رنگ‌های hard-coded خارج از token
| مقدار | محل | کاربرد |
|---|---|---|
| `#fff` | `:70,118,125,130,132,176,185,191,297,320,397,467,546,548,645,667,669` | متن روی پس‌زمینه‌ی پُر، دستگیره‌ی toggle |
| `rgba(255,255,255,.28)` | `:179` | count روی تبِ فعال |
| `rgba(62,107,94,.13)` | `:92` | focus ring ورودی |
| `rgba(62,107,94,.08)` | `:206` | سایه‌ی hover کارتِ مراجع |
| `rgba(193,102,85,.35)` | `:256` | outline فوکوسِ `.session-delete` |
| `#adb8b2` / `#4a534d` | `:284–285` | `.rec-dot.paused` light/dark |
| `#ecdfc2` / `#453a1f` | `:337–338,347–348,715–716` | border طلاییِ consent/warn/upload-consent |
| `rgba(38,50,45,.45)` | `:368` | backdrop مودال |
| `rgba(0,0,0,.25)` / `.18` | `:374` / `:648` | سایه‌ی modal / tray |
| `#3e6b5e` | `:732` | پس‌زمینه‌ی لوگو (SVG) |
| `#d97706` | `:2652,2691` | border ردیفِ stale؛ severity warn |
| `#eee` | `:2688` | fallbackِ `var(--border,#eee)` |
| `#c0392b` | `:2691,3001,3021,3022,3029` | severity error؛ fallbackِ `--danger` |
| `#b58105` | `:3021,3022,3035` | fallbackِ `--warning` |
| `#2563eb #7c3aed #0891b2 #16a34a #ca8a04 #64748b #999` | `:2716,2722` | رنگِ laneهای تایم‌لاینِ ادمین |
| `#fafafa` | `:2722` | fallbackِ `var(--card-alt,#fafafa)` |
| `#2e7d32` / `#c62828` | `:5168,5172` | fallbackِ `--ok` / `--danger` در hint تاریخ |

---

## 7. Spacing System

**No consistent spacing scale detected** — هیچ token فاصله‌گذاری (`--space-*`) تعریف نشده؛ همه‌ی مقادیر px مستقیم هستند.

مقادیرِ پرتکرار:
- **gap:** 2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14px (پرتکرارترین: 8px و 10px).
- **margin-bottom:** 6, 8, 10, 12, 14, 16, 18, 20, 24px (پرتکرار: 14px برای input و بلوک‌ها).
- **padding کارت/سطح:** `.card` 28px 26px (≤480: 22px 18px)؛ `.modal` 26px؛ `.tray` 18px؛ `.client-card` 18px؛ `.session-item`/`.note-item` 15px 18px؛ `.banner` 14px 18px؛ `.consent-box` 18px؛ `.job-card` 13px 15px؛ `.skeleton-card` 16px.
- **Section spacing:** `.card{margin-bottom:18px}`؛ `.app-head{margin-bottom:24px}`؛ `.flow-steps{margin-bottom:24px}`؛ `.card-head{margin-bottom:20px}`؛ `.sub-panel{padding-top:20px;margin-top:16px}`؛ `.cf-section{margin-top:18px}`.
- **Form spacing:** `label{margin-bottom:7px}`، `input{margin-bottom:14px}`.
- **Button spacing:** `.btn-row{gap:10px}`، `.modal-actions{gap:10px}`، `.client-actions{gap:8px}`؛ فاصله‌ی دکمه‌های پشتِ هم بیشتر با inline `margin-top:10px|14px|16px|18px|20px` تعیین می‌شود (مثلاً `:797,818,1016,1069,1110`).
- inline styleهای فاصله در markup/JS زیادند (مثلاً `:805–809,866,882,1005,1007,1081–1084,2650,2758`).

---

## 8. Surface / Card System

| Surface | Selector | Background | Border | Radius | Shadow | Padding | ارجاع |
|---|---|---|---|---|---|---|---|
| Screen card | `.card` | `--card` | 1px `--line-soft` | `--r-xl` 24px | `--shadow` | 28px 26px | `:75` |
| Client card | `.client-card` | `--card` | 1px `--line-soft` (hover `--sage` + سایه) | `--r-lg` 16px | — | 18px | `:205–206` |
| Session row | `.session-item` | `--card` | 1px `--line-soft` (hover sage) | 16px | — | 15px 18px | `:260` |
| Note card | `.note-item` | `--field` | 1px `--line-soft` | 16px | — | 15px 18px | `:351` |
| Modal | `.modal` | `--card` | — | 24px (literal) | `0 24px 56px rgba(0,0,0,.25)` | 26px؛ max-width 430px | `:374` |
| Tray | `.tray` | `--card` | 1px `--line` | 24px | `0 24px 56px rgba(0,0,0,.18)` | 18px؛ `min(560px,100vw-24px)` | `:648` |
| Job card | `.job-card` | `--card` (failed: clay-soft) | 1px `--line-soft` (failed: clay-line) | 16px | — | 13px 15px | `:656–657` |
| Banner | `.banner` | بر حسبِ نوع | 1.5px | 16px | — | 14px 18px | `:345–349` |
| Consent | `.consent-box` | `--gold-soft` | 1.5px `#ecdfc2` | 16px | — | 18px | `:337` |
| Live text | `.live-text` | `--sage-mist` | 1px `--sage-soft` | 16px | — | 14px 16px؛ max-h 200px | `:294` |
| Transcript | `.transcript-box` | `--field` | 1px `--line` | 16px | — | 16px؛ max-h 400px | `:399` |
| Live toggle | `.live-toggle` | `--card` (checked: sage-mist) | 1.5px `--line` | 16px | `--shadow` | 12px 14px؛ max-w 340px | `:300–303` |
| Sub-panel | `.sub-panel` | شفاف | border-top 1px dashed | — | — | top 20px | `:363` |
| Signs area | `.signs-area` | شفاف | border-top 1px dashed | — | — | top 16px | `:313` |
| Drop zone | `.up-drop` | `--sage-mist` | 2px dashed `--sage-soft` | 16px | — | 26px 16px | `:690` |
| Upload file row | `.up-file` | `--field` | 1px `--line` | 16px | — | 12px 14px | `:695` |
| Dropdown | `.sort-drop`/`.client-menu-drop` | `--card` | 1px `--line` | 11px | `--shadow` | 5px | `:198,234` |
| Calendar popover | `.jalali-cal-drop` | `--card` | 1px `--line` | 16px | `--shadow` | 14px؛ `min(290px,100vw-32px)` | `:102` |
| Tabs container | `.client-tabs` | `--line-soft` | — | 16px | — | 4px | `:173` |
| Skeleton | `.skeleton-card` | `--card`، opacity .5 | 1px `--line-soft` | 16px | — | 16px | `:160` |
| Empty (tray) | `.tray-empty` | `--field` | 1px dashed `--line` | 16px | — | 18px 10px | `:653` |
| Fixed live bar (≤480) | `#liveControls` | `--card` | 1px `--line-soft` | 16px | `--shadow` | 12px 14px 14px | `:429` |
| CF quick box | `.cf-quick` | `linear-gradient(135deg,--cf-soft,--cf-teal2)` | 1px `--cf-line` | 14px | — | 14px | `:551` |
| CF axis card | `.cf-axis` | `--cf-card` | 1px + border-right 4px amber/green/red | 12px | — | summary 10px 12px | `:528–531` |
| CF key point | `.cf-kp-card` | `--cf-card` | border-right 4px teal | 12px | — | 10px 14px | `:499` |
| CF session | `.cf-session` | `--cf-card`، summary `--cf-soft` | 1px | 13px | — | 11px 13px | `:605–606` |
| CF cell | `.cf-cell` | `--cf-card` | 1px | 10px | — | 9px 10px | `:556` |
| CF empty | `.cf-empty` | `--cf-soft` | 1px dashed | 14px | — | 22px 16px | `:471` |
| CF container (dark) | `.case-file-doc` | — | — | — | `0 10px 28px rgba(0,0,0,.35)` فقط dark | — | `:458` |
| Admin stat card | `.card` + inline | `--card` | — | 24px | `--shadow` | 14px (inline) | `:2758` |
| Admin timeline row | inline | `var(--card-alt,#fafafa)` | inline-start 3px lane | 4px | — | 8px 10px | `:2722` |

Radius tokens: `--r-xl:24px; --r-lg:16px; --r-md:11px; --r-sm:8px` (`:21`).

---

## 9. Buttons

پایه: `button.btn` — بدونِ border، radius 15px، padding 14px 20px، 15px/600، `inline-flex` با gap 9px، `transition:background .2s, transform .08s`، `:active` → `scale(.975)`، `:disabled` → opacity .55 + `not-allowed` (`:127–129`). آیکن داخلی 18×18 (`:143`). ارتفاعِ حاصل ≈ 14+14+ارتفاعِ خط (≈28.5px) ⇒ حدود 56px؛ هیچ `height` صریحی ندارد.

| Variant | Selector | ظاهر | Hover | ارجاع |
|---|---|---|---|---|
| Primary | `.btn-primary` | bg `--sage`، متن سفید، سایه‌ی `0 8px 22px --glow-sage` | `--sage-hover` (فقط `:not(:disabled)`) | `:130–131` |
| Danger | `.btn-danger` | bg `--clay`، سفید، سایه‌ی glow-clay | `--clay-hover` | `:132–133` |
| Secondary | `.btn-secondary` | bg sage-mist، متن sage-deep، border 1.5px sage-soft | bg sage-soft | `:134–135` |
| Ghost | `.btn-ghost` | شفاف، ink-2، border 1.5px `--line` | border sage، متن sage-deep، bg sage-mist | `:136–137` |
| Block | `.btn-block` | width 100% | — | `:138` |
| XL | `.btn.btn-xl` | padding 17px 22px، 16px، radius 17px | — | `:139` |
| Small | `.btn.btn-sm` | padding 9px 14px، 13px، radius `--r-md` 11px، ellipsis، بدونِ سایه | — | `:142` |
| Icon (header) | `.icon-btn` | 44×44، radius 14px، bg card، border 1.5px line، رنگ muted؛ آیکن 20px | sage-deep + border sage | `:60–62` |
| Icon busy | `.icon-btn.busy::after` | حلقه‌ی چرخان (border-top sage) | — | `:646` |
| Password toggle | `.pw-toggle` | 36×36، شفاف، absolute left 4px | sage-mist | `:155–156` |
| Sort | `.sort-btn` | 36×36، radius 11px، border 1.5px | sage-deep/border sage (و `.active`) | `:195–196` |
| Client menu (⋮) | `.client-menu-btn` | 32×32، radius 8px، شفاف | sage-mist (+`:focus-visible`) | `:231–232` |
| Session delete | `.session-delete` | 32×32، radius 9px، absolute top/left 12px | clay-soft/clay-deep؛ focus outline 3px | `:242–257` |
| Note remove | `.note-remove` | متنی + آیکن 13px، 12px | clay-soft | `:358–360` |
| Sign remove | `.sign-rm` | آیکن 11px، opacity .55 | opacity 1 | `:324–325` |
| Link | `.link-btn` | شفاف، sage-deep، 12.5px/600 | sage-mist | `:654–655` |
| Job delete | `.job-del` | 30×30، radius 9px | clay-soft | `:712–714` |
| Upload file btn | `.up-file-btn` | 32×32، radius 10px؛ disabled opacity .3 | sage-mist / `.del` clay-soft | `:704–708` |
| Chip-buttons | `.sign-chip`، `.cat-filter-chip`، `.cat-opt`، `.cat-seg button` | کپسول 99px؛ (§12) | — | `:317,184,396,189` |
| Tab | `.client-tab` | flex:1، radius 11px، 13px/600 | sage-mist؛ `.active` پُر با sage | `:174–176` |
| Case file | `.cf-btn` / `.cf-primary` / `.cf-ghost` | کپسول 999px، padding 7px 14px، 12.5px/600، border 1.5px cf-line | (hover تعریف نشده) | `:466–468` |
| CF icon | `.cf-icon-btn` (`.cf-icon-edit`/`.cf-icon-del`) | 26×26، radius 7px | پُر با teal / red | `:543–548` |
| CF star / xref / del | `.cf-star-btn`، `.cf-xref`، `.cf-del` | متن/آیکنِ بی‌زمینه | teal | `:503–509,541` |
| Calendar | `.jalali-cal-nav-btn` 30×30، `.jalali-cal-day`، `.jalali-cal-month-btn` | (§10) | sage-mist | `:105–125` |

- **Loading state دکمه:** کلاس یا spinnerِ اختصاصیِ دکمه وجود ندارد؛ تنها نشانگرِ «مشغول» روی دکمه‌ها `.icon-btn.busy` (سینی) است. برخی دکمه‌ها موقتاً `disabled` می‌شوند (مثلاً `#btnStartSession` `:1012`، `#audioUploadStartBtn` `:1275`، `#deleteTherapistConfirmBtn` `:1438`).
- **Focus:** برای `button.btn` استایلِ `:focus`/`:focus-visible` تعریف نشده (فقط `.client-menu-btn`، `.session-delete`، `.live-toggle:has(input:focus-visible)`، `summary:focus-visible` در پرونده).

---

## 10. Forms

| الگو | Selector | ابعاد/ظاهر | Focus | ارجاع |
|---|---|---|---|---|
| Label | `label` | block، 13px/600 ink-2، mb 7px | — | `:90` |
| Text input / textarea | `input,textarea` | width 100%، padding 13px 15px، border 1.5px line، radius 11px، 15px، bg `--field`، mb 14px | border sage + `box-shadow:0 0 0 4px rgba(62,107,94,.13)`، بدونِ outline | `:91–92` |
| Textarea | `textarea` | min-height 100px، `resize:vertical` | همان | `:93` |
| Search | `.search-box` | آیکنِ 18px absolute سمتِ راست (right:13px)، padding-right 40px، 14px | همان | `:145–147` |
| Password | `.pw-field` | padding-left 44px برای دکمه‌ی چشم؛ `input::-ms-reveal` پنهان | همان | `:153–158` |
| Toggle (switch) | `.toggle-row input` | `appearance:none` 42×24 کپسول؛ دستگیره‌ی 18px سفید؛ checked → sage، `translateX(-18px)` | — | `:295–299` |
| Toggle کارتی | `.live-toggle` | 46×26، دستگیره 20px؛ focus-visible → outline 2px sage | `:has()` | `:300–311` |
| Radio | `.radio-group` / `.radio-opt` | ستونی gap 8px؛ هر گزینه border 1.5px، radius 8px، padding 10px 12px؛ `accent-color:--sage`؛ `:has(input:checked)` → border sage + bg sage-mist | — | `:380–383` |
| Checkbox (upload consent) | `.up-consent input` | 18×18، `accent-color:--sage` داخلِ جعبه‌ی طلایی | — | `:715–717` |
| Category chips (فرم) | `.cat-select` + `.cat-opt` | کپسول، `.sel` پُر با sage؛ شاخه‌ی درختیِ جنسیت با خطوطِ ۲px sage (`.cat-tree*`) | — | `:384–397` |
| Date picker (جلالی) | `renderJalaliPicker` (`:2107`) | trigger = `btn btn-ghost btn-sm` با آیکنِ تقویم و متن «افزودنِ تاریخ» یا «۵ مهر ۱۴۰۵»؛ دکمه‌ی «پاک‌کردنِ تاریخ» (فقط با `allowEmpty`)؛ popover گرید ۷ستونه با سرستون «ش ی د س چ پ ج»؛ کلیک روی عنوان → گرید ۳×۴ ماه + ناوبریِ سال؛ روزهای آینده disabled؛ `.today` حلقه‌ی داخلی، `.selected` پُر | — | `:100–125, 2107–2213` |
| Time | `input type=time` (`#editSessionTime`) | کنترلِ بومی با استایلِ پایه‌ی input | همان | `:1422` |
| Select | `<select>` بومی | **بدونِ قاعده‌ی CSS سراسری** (فقط `.cf-move-panel select` `:522`)؛ در AdminActivity با ظاهرِ پیش‌فرضِ مرورگر | — | `:867–890` |
| File upload | `input type=file` hidden + `.up-drop` (role=button، tabindex=0) | کلیک/drag؛ `.drag` → border sage؛ `multiple`؛ accept صوت/ویدیو | — | `:1256–1263,690–694` |
| Quick note | `.qn-row input` | 13.5px، padding 11px 13px؛ Enter = ثبت (`:6007`) | همان | `:327–329` |
| Case-file inline edit | `[data-cf-editable]` textarea | border 1px teal، radius 8px؛ placeholder «هنوز ثبت نشده — اینجا بنویسید» | — | `:635, 4288` |
| Case-file answer | `.cf-q-item textarea` | 13px، placeholder «پاسخ…» | — | `:632, 4828` |

- **Helper text:** با `div`های inline 12px muted (مثلاً `#manualDateHint`، `#audioUploadDateHint` `:1164,1269`)، `.up-note` (`:718`)، `.exit-sub`.
- **Error text:** خطای فرم در `#bannerBox` نمایش داده می‌شود (مثلاً «شماره موبایل و رمز عبور را وارد کنید.» `:2414`)؛ در مودالِ آپلود `.up-err` (`:719`)؛ در hint تاریخ متنِ قرمز «خطا: …» (`:5171`). حالتِ invalid روی خودِ input (border قرمز) وجود ندارد.
- **Required:** نشانگرِ بصریِ required (ستاره) وجود ندارد؛ فیلدهای اختیاری در label با «(اختیاری)» مشخص می‌شوند.
- **Disabled input:** استایلِ اختصاصی ندارد. حالتِ read-only متنِ صوتی: `#archiveTextNoteInput.readonly-preview` → border dashed (`:366`).
- **Validation:** در زمانِ submit (JS)، نه real-time؛ استثنا: تأییدِ حذفِ تراپیست با تطبیقِ شماره‌ی تایپ‌شده دکمه را فعال می‌کند (`:2888–2892`).

---

## 11. Modals / Dialogs / Drawers

**الگوی مشترک:** `.modal-back` (fixed، `inset:0`، backdrop `rgba(38,50,45,.45)` + `backdrop-filter:blur(7px)`، `display:none` → `.open` = `flex` وسط‌چین، padding 18px، z-index 50) و `.modal` (max-width 430px، width 100%، radius 24px، padding 26px، انیمیشنِ `rise .35s ease`) (`:368–378`). باز/بسته با `classList.add/remove('open')`. بستن: دکمه‌ی انصراف، کلیکِ مستقیم روی backdrop و کلیدِ Escape از طریقِ `MODAL_CLOSERS` (`:7537–7567`). انیمیشنِ بستن وجود ندارد (display:none فوری). Drawer: ندارد.

| # | ID | Trigger | Title | Body | Actions | Close | ارجاع |
|---|---|---|---|---|---|---|---|
| 1 | `newClientModal` | «مراجع جدید» / «افزودنِ پرونده‌ی قبلی» | «مراجع جدید» | «کد یکتا خودکار ساخته می‌شود.»، «نام مستعار (اختیاری)»، «دسته‌بندی (اختیاری)» چیپ‌ها؛ از تبِ غیرفعال: «دلیلِ غیرفعال‌بودن» (۵ radio) + توضیح | «انصراف» ghost / «ایجاد» primary | انصراف، backdrop، Esc | `:1225` |
| 2 | `audioUploadModal` | دکمه‌ی آپلود (کارت/پرونده) | «آپلودِ فایلِ صوتیِ جلسه» | نامِ مراجع، drop zone، فهرستِ فایل‌ها با جابه‌جایی/حذف، خطا، «تاریخِ جلسه (اختیاری)» تقویم، checkbox رضایت، `.up-note` | «انصراف» / «شروعِ آپلود» (flex:2، disabled تا فایل+رضایت) | انصراف، backdrop، Esc | `:1252` |
| 3 | `resolveSpeakersModal` | «بازسازیِ شماره‌گذاریِ گوینده‌ها» | همان | توضیح + پیش‌نمایشِ `.transcript-box` (max-h 260px) | «بستن» / «جایگزینیِ متن» | بستن، backdrop، Esc | `:1280` |
| 4 | `logoutUploadModal` | خروج با آپلودِ ناتمام | «آپلودِ ناتمام دارید» | متنِ پویا + توضیحِ 13px muted | سه دکمه‌ی عمودی: primary «خروج — فایل در این مرورگر بماند (دستگاهِ شخصیِ من)»، secondary «خروج و پاک‌کردنِ فایل از این مرورگر (کامپیوترِ مشترک)»، ghost «ماندن و ادامه‌ی آپلود» | ghost، backdrop، Esc | `:1293` |
| 5 | `deactivateClientModal` | منوی کارت «انتقال به غیرفعال‌ها» | «انتقال به غیرفعال‌ها» | ۴ radio دلیل + توضیح | «انصراف» / «تایید انتقال» primary | انصراف، backdrop، Esc | `:1306` |
| 6 | `editCategoryModal` | منوی کارت «ویرایش» | «ویرایشِ مراجع» | «نامِ مستعار» (label inline-style)، «دسته‌بندی» | «انصراف» / «ذخیره» | انصراف، backdrop، Esc | `:1324` |
| 7 | `caseFileAutoPromptModal` | `maybeShowCaseFileAutoPrompt` (`:4571`) | «پرونده‌ی روندِ درمان» | پرسشِ به‌روزرسانیِ خودکار | «نه، دستی می‌مانم» / «بله، خودکار شود» | **فقط دو دکمه** (در `MODAL_CLOSERS` نیست ⇒ backdrop/Esc بی‌اثر) | `:1339` |
| 8 | `cfAddItemModal` | «+ افزودنِ دارو/محور/گام»، ویرایشِ دارو | پویا `#cfAddItemTitle` | فیلدهای پویا (`openCfAddItemModal` `:4326`) | «انصراف» / «ذخیره» | انصراف، backdrop، Esc | `:1350` |
| 9 | `cfDeleteItemModal` | «حذف» ردیفِ دستی | «حذفِ این ردیف؟» | «این ردیفِ افزوده‌شده برای همیشه حذف می‌شود.» | «انصراف» / «بله، حذف شود» danger | انصراف، backdrop، Esc | `:1361` |
| 10 | `genericConfirmModal` | `showGenericConfirm()` (`:2310`) — toggleهای ادمین، حذفِ مراجع از ادمین و … | پیش‌فرض «مطمئن هستید؟» | پویا | «انصراف» / برچسبِ پویا (danger) | انصراف، backdrop، Esc | `:1372` |
| 11 | `cancelModal` | «لغو جلسه» (Live) | «لغو این جلسه؟» | «رونویسی متوقف و متنِ تا اینجا دور ریخته می‌شود.<br>اگر متن را می‌خواهید، «پایان جلسه» بزنید.» | «ادامه‌ی جلسه» / «بله، لغو شود» danger | + backdrop، Esc | `:1383` |
| 12 | `exitModal` | «بازگشت بدون ذخیره» (Wrapup) | «مطمئن هستید؟» | «این جلسه از قبل ذخیره شده است.» + `.exit-sub` | «ماندن و تکمیل» / «خروج بدون ذخیره» danger | + backdrop، Esc | `:1394, 6337` |
| 13 | `deleteSessionModal` | سطلِ `.session-delete` | «حذف این جلسه؟» | پویا | «انصراف» / «بله، حذف شود» | + backdrop، Esc | `:1405` |
| 14 | `editSessionModal` | «ویرایش تاریخ/ساعت» | «ویرایش تاریخ و ساعت جلسه» | «تاریخ» تقویم، «ساعت شروع» time | «انصراف» / «ذخیره» | + backdrop، Esc | `:1416` |
| 15 | `deleteTherapistModal` | «حذف» (ادمین) | «حذف کامل این تراپیست؟» | متن + «برای تأیید، شماره موبایلش را تایپ کنید» (input ltr) | «انصراف» / «بله، حذف کامل» (disabled تا تطبیق) | + backdrop، Esc | `:1430` |
| 16 | `deleteClientModal` | منوی کارت «حذفِ کامل مراجع» | «حذف مراجع؟» | پویا | «انصراف» / «بله، حذف کامل» | + backdrop، Esc | `:1443` |

- **Overlayهای غیرِ مودال:** `.tray` (کلیک بیرون می‌بندد `:7395`؛ دکمه‌ی «بستن» `.link-btn`)، dropdownهای `.client-menu`/`.sort-menu`/`.jalali-cal-menu` (کلیک بیرون، `closeAllClientMenus` `:3758–3763`).
- **Nested:** تقویمِ جلالی داخلِ `audioUploadModal` و `editSessionModal` (popover با z-index 20 داخلِ مودال). مودالِ دیگری از داخلِ مودال باز نمی‌شود.
- **دیالوگ‌های بومیِ مرورگر:** `Notification.requestPermission()` برای اعلانِ پرونده (`:3989`).

---

## 12. Lists / Tables / Data Display

### 12.1 Client list (`.clients-grid` `:204`)
Grid `repeat(auto-fill,minmax(260px,1fr))` gap 12px (≤480: یک ستون). `.history-heading` تمام‌عرض 12.5px/700. **`.client-card`** (`buildClientCard` `:3599`):
- گوشه‌ی بالا-چپ: منوی ⋮ (`IC_DOTS`) → «ویرایش»، «سنجاق به صفحه‌ی اول»/«برداشتنِ سنجاق»، `hr`، «انتقال به غیرفعال‌ها» یا «بازگرداندن به فعال‌ها»، `hr`، «حذفِ کامل مراجع» (`.danger`).
- ردیفِ بالا (padding-left 38px برای منو): نام مستعار 15px/700 + کد (ltr، tabular) + `.pin-badge` «سنجاق‌شده».
- meta: «N جلسه · آخرین: تاریخ» + `.cat-badge` (مثلاً «نوجوان (دختر)») + `.status-reason` «دلیل: …» (فقط غیرفعال، طلایی، ellipsis).
- اکشن‌ها: primary sm «شروع جلسه» (فعال) یا secondary sm «ثبت جلسات گذشته» (غیرفعال)؛ ghost sm «آپلود صوت» با آیکن؛ ghost sm «پرونده» (اگر case_file_enabled). با ۳ دکمه `.has-3` → دکمه‌ی اول تمام‌عرض، دو دکمه‌ی دیگر نیم‌به‌نیم (`:226–228`).
- کلیک روی کارت → ClientDetail.

### 12.2 Session list (ClientDetail، `:3913–3965`)
`.session-item`: دکمه‌ی سطل (بالا-چپ)، «جلسه N» 14px/700، `.session-status` کپسول:

| برچسب | کلاس | رنگ |
|---|---|---|
| کامل | `completed` | sage-soft/sage-deep |
| در جریان | `in_progress` | gold-soft/gold-deep |
| قطع‌شده | `recovered`/دیگر | clay-soft/clay-deep |
| ثبتِ دستی | `canceled` | line-soft/muted |
| در حالِ پردازش | `processing` | gold |
| پردازش ناموفق | `failed` | clay |
| فایلِ صوتی | status جلسه | — |

خطِ تاریخ 12px muted: «تاریخ · شروع ساعت · N دقیقه» (زنده) یا «تاریخ|بدونِ تاریخ · مدت» (دستی/آپلود).

### 12.3 Timeline
- ادمین (`renderAdminTimeline` `:2717`): ردیف‌های inline-style با نوارِ رنگیِ lane (server آبی، client بنفش، ui فیروزه‌ای، audio سبز، note زرد، db خاکستری).
- پرونده‌ی درمان «روندِ جلسات»: `<details class="cf-session">` آکاردئونی؛ summary با عنوان 14.5px/700 teal + چیپ «رکوردِ N» + چیپِ مدت + «جزئیات ⌄»؛ آخرین رکورد پیش‌فرض باز؛ حالتِ باز/بسته در localStorage (`feelia-cf-open:*` `:4492–4494`)؛ یک ردیفِ ثابتِ dashed «جلسه‌ی آینده» با چیپ «در انتظار».
- Transcript notes (SessionDetail): `.inline-note` (نوارِ راستِ ۳px sage) و `.inline-sign` (کپسولِ طلایی) با زمان (`:5026–5051`).

### 12.4 Admin tables/lists
جدولِ HTML وجود ندارد؛ کارت‌ها/ردیف‌های flex: کارتِ تراپیست (`.client-card`)، ردیف‌های مراجع/جلسه (`.session-item`)، «جلسات اخیر» (`.card` inline)، «رویدادها» (flex با border-bottom، ستون‌های min-width 40/180px)، پخش‌کننده‌ی `<audio>` بومی.

### 12.5 Logs / chips / badges
- `.sign-log-item` (طلایی، زمانِ ltr 10px، ×) (`:322`)، `.note-log-item` (sage-mist، نوارِ راست ۳px) (`:331`)، `.sum-chip`/`.rec-chip` (کپسولِ sage-mist) (`:276,334`)، `.note-tag.tag-voice` (clay) / `.tag-text` (sage) (`:353–356`).
- Tray: `.job-card` با `.jsteps` (۳ یا ۴ دایره‌ی 24px با برچسب‌های «دریافت / تبدیل به متن / متن آماده|متن ذخیره شد / پرونده»؛ حالت‌های done/active/bad/skip)، `.pbar` (8px؛ `.wait` طلایی، `.indet` نوارِ متحرک)، `.job-msg`، اکشن‌ها «تلاشِ دوباره»/«مشاهده‌ی جلسه»/«بستن» (`:7265–7327`). `.notif-item` با آیکنِ 30px (تیک / سند / هشدار)، متن 13px، زمانِ نسبی «همین حالا / N دقیقه پیش / N ساعت پیش / تاریخ» (`:7348–7356`)؛ unread با bg sage-mist.
- Header badge: `.icon-badge` دایره‌ی clay 19px در گوشه‌ی دکمه‌ی سینی؛ «9+» برای بیش از ۹ (`:645,7364`).

### 12.6 Case file sections (`renderCaseFile` `:4586–4837`)
ترتیبِ نمایش:
1. `.cf-toolbar`: عنوان «پرونده‌ی روندِ درمان» + اکشن‌ها: کلید «به‌روزرسانیِ خودکار: روشن|خاموش» (نقطه‌ی رنگی) یا متنِ «به‌روزرسانیِ خودکار فقط برایِ مراجعینِ غیرفعال است»، «ارتقای ساختار» (شرطی)، «ویرایش»، «به‌روزرسانی»، «بازتولیدِ کامل»؛ در ویرایش: «ذخیره» / «انصراف».
2. بنرِ وضعیت (در حالِ به‌روزرسانی / ناموفق + «تلاشِ دوباره»).
3. `.cf-status-pill`: «رکوردهایِ جلسه در سامانه: N · N فیلد در انتظارِ تایید · وضعیتِ کلی».
4. `.cf-rhythm-line`: «ریتمِ درمان — شروع · میانگینِ فاصله‌ی جلسات · طولِ دوره».
5. `.cf-quick`: چیپ «مسئله‌ی اصلی» + متن؛ سلولِ «هویت».
6. بنرها: قرمز «هشدارِ ایمنی — …»؛ کهربایی «مراقب باش — این نکات نباید جلویِ خودِ مراجع مطرح شوند: …»؛ کهربایی «زمینه‌ی حساس — …».
7. «نکات کلیدی» (حداکثر ۳ کارتِ `.cf-kp-card` با ستاره).
8. «دارو و سابقه‌ی درمان»: جدولِ `.cf-table` با ستون‌های «دارو / دوز / دفعات / آخرین تغییر / پزشک / عملیات» (≤520px: کارت‌های `.cf-med-item`).
9. «خلاصه‌ی قبل از جلسه — محورهای کلیدی»: `<details class="cf-axis">` با عنوان، gist، برچسبِ تُن «مطلوب/حساس/نیازمندِ توجه»، «جزئیات ⌄»؛ دکمه‌ی «بازکردنِ همه»؛ یافته‌ها با سرفصل‌های نقش (`CF_ROLE`)، چیپ‌های منبع (`.cf-prov-o` آبی، `.cf-prov-i` کهربایی)، ستاره، پنلِ جابه‌جایی (`.cf-move`)، ارجاع‌های متقاطع با فلش.
10. رابطه‌ی خانوادگی: `.cf-rel-card` با grid دوستونه‌ی سلول‌ها.
11. رابطه‌ی زوجی (شرطی): `.cf-couple-grid` کارت‌های همیشه‌باز؛ کارتِ «نقل» تمام‌عرض؛ کارتِ پرمحتوا در ≥640px دو ستونه.
12. «چه چیزی نسبت به قبل تغییر کرده؟»: جعبه‌های «قبل» ← «اکنون» (grid `1fr 30px 1fr`).
13. «روندِ جلسات» (§12.3).
14. «نقشه‌راهِ جلسه‌ی بعد»: `<details class="cf-step">` با شماره‌ی رنگی بر حسبِ اولویت p1 قرمز/p2 کهربایی/p3 آبی/p4 خاکستری، پرسش، برچسبِ دلیل، «توضیح ⌄»؛ یادداشتِ پایین «شماره و رنگ = سطحِ اولویت · …».
15. «سوالاتِ باز برایِ تراپیست»: `.cf-q-item` با textarea و «ثبتِ پاسخ».
- مقدارِ خالی در همه‌جا: کپسولِ dashed «در انتظار ثبت» (`.cf-pending`). نقطه‌ی کهربایی `.cf-suggest-dot` برای «به‌روزرسانیِ پیشنهادی».

---

## 13. States

| Component | Stateهای موجود در کد | ارجاع |
|---|---|---|
| Flow step | default، `.active` (پُر sage، scale 1.08)، `.done` (sage-soft)؛ خطِ بعد از done رنگی | `:66–73` |
| Record dot | default (clay + breathe)، `.paused` (خاکستری، scale .94، بدونِ حلقه) | `:279–286` |
| Rec status | default (نقطه‌ی sage)، `.warn` (clay-deep bold) | `:288–291` |
| Live state machine (متنِ `#recStatus`) | STARTING، ACTIVE، RECOVERED، RECONNECTING، NETWORK_PAUSED، MANUAL_PAUSED، FINALIZING، FAILED | `:5528–5537` |
| Pause/Resume | «توقف موقت» ↔ «ادامه» (`hidden` جابه‌جا) | `:6050–6054` |
| Level meter | ارتفاعِ پویا 5–36px؛ متوقف → 5px | `:2218–2221` |
| Buttons | hover، active (scale)، disabled | §9 |
| Tabs | default، hover، `.active`، `aria-selected` | `:174–179` |
| Filter chip / seg | default، `.active` | `:184–192` |
| Sort | `.open`، گزینه‌ی `.active` (bold) | `:199–202` |
| Client card | default، hover (border sage + سایه)؛ کلاسِ `.inactive` اضافه می‌شود ولی قاعده‌ی CSS ندارد | `:205–206, 3602` |
| Client menu | `.open`؛ آیتمِ `.danger` hover قرمز | `:235–238` |
| Sign chip | hover، active scale .95، `.logged` (پُر sage) | `:317–320` |
| Toggle | off / checked | `:296–299` |
| Radio | checked (`:has`) | `:382` |
| Calendar | `.today`، `.selected`، disabled (آینده)، filler، ماهِ `.active` | `:114–125` |
| Session status | in_progress، completed، recovered، canceled، processing، failed | `:264–268,720–721` |
| Job step | done، active (حلقه‌ی 4px)، bad، skip (opacity .45) | `:666–672` |
| Progress bar | determinate، `.wait`، `.indet` | `:676–680` |
| Job card | default، `.failed` | `:656–657,674` |
| Notification | default، `.unread`، آیکنِ `.bad` | `:681–686` |
| Upload drop | hover، `.drag` | `:691` |
| Upload file btn | disabled | `:708` |
| Tray icon | `.busy` (spinner)، badge visible | `:646, 7362–7364` |
| Skeleton | pulse | `:160–163` |
| Case file | empty، generating (بدون/با نسخه‌ی قبلی)، error (بدون/با)، view، edit-mode؛ details open/closed؛ `.cf-flash`؛ `.cf-star-btn.on`؛ `.cf-auto-dot.on`؛ تُن محور good/watch/sensitive | `:4589–4632, 469–511, 528–530` |
| Preflight | info (در حال بررسی / آماده)، warn، error | `:5306–5346` |
| Consent | پاسخ‌داده‌نشده / ثبت‌شده (باکس و دکمه‌ی شروع) | `:2336–2372` |
| Auth | login / register | `:2397–2406` |
| Password field | پنهان / نمایان (آیکن چشم / چشمِ خط‌خورده) | `:2382–2389` |
| Theme | light / dark | `:2224–2238` |
| Archive text note | editable / `.readonly-preview` | `:366` |

---

## 14. Empty / Loading / Error UI

### 14.1 Empty
| Screen/Component | متنِ دقیق | Treatment | Action |
|---|---|---|---|
| Clients (امروز) | «امروز مراجعی ثبت یا ویزیت نشده» / «برای دیدنِ بقیه‌ی مراجعین «همه‌ی مراجعین» را باز کنید» | `.empty` وسط‌چین (p 14px/600 + span 12px) بدونِ آیکن | — |
| Clients (پیش‌فرضِ markup) | «هنوز مراجعی ثبت نشده» / «اولین مراجع خود را اضافه کنید» | همان | — |
| جست‌وجو | «مراجعی یافت نشد» / «کد یا نام دیگری را جست‌وجو کنید» | همان | — |
| فیلترِ دسته | «مراجعی در این دسته‌بندی نیست» / «فیلتر را عوض کنید یا «همه» را انتخاب کنید» | همان | — |
| تبِ غیرفعال | «مراجعِ غیرفعالی نیست» / «پرونده‌های قبلی را با «مراجع جدید» در همین تب آرشیو کنید» | همان | — |
| تبِ فعال | «مراجعِ فعالی نیست» / «مراجع جدید اضافه کنید یا از غیرفعال‌ها بازگردانید» | همان | — |
| Admin | «تراپیستی یافت نشد»، «این تراپیست هنوز مراجعی ندارد»، «این مراجع هنوز جلسه‌ای ندارد»، «جلسه‌ای یافت نشد»، «رویدادی یافت نشد» | `.empty` (فقط p) | — |
| Admin session detail | «یادداشت/علامتی برایِ این جلسه ثبت نشده.» | p inline 13px muted | — |
| Tray | «هنوز چیزی نیست. فایلِ صوتیِ جلسه را از صفحه‌ی مراجع با «آپلودِ فایلِ صوتیِ جلسه» اضافه کنید.» / «اعلانی ندارید.» | `.tray-empty` (dashed) | — |
| Case file | «هنوز پرونده‌ای برایِ این مراجع تولید نشده — …»؛ «هنوز محوری ثبت نشده»؛ «هنوز خلاصه‌ای ثبت نشده»؛ «نقشه‌راهی ثبت نشده»؛ «در انتظار ثبت — اطلاعاتِ دارویی هنوز ثبت نشده (…)» | `.cf-empty` (dashed) | «تولیدِ پرونده» / «+ افزودن…» |
| Transcript | «(متنی ثبت نشده)»؛ دستی: «جلسه‌ی ثبت‌شده‌ی دستی — بدونِ رونویسی.» | متنِ درونِ `.transcript-box` | — |
| Date trigger | «افزودنِ تاریخ»؛ meta «بدونِ تاریخ» | متن | — |

### 14.2 Loading
| محل | متن / نشانگر | ارجاع |
|---|---|---|
| لیستِ مراجعین | ۲ `.skeleton-card` با pulse 1.5s | `:921–924, 3281` |
| Preflight | «در حال بررسی میکروفون…»، «در حال بررسی اتصال رونویسی…» (banner.info) | `:1008–1009` |
| Live | «در حال اتصال…»، «در حال برقراریِ اتصال…»، «در حال نهایی‌سازی…» | `:1029, 5529, 5535` |
| Voice note | «آماده…»، «در حال ضبط… حرف بزنید» | `:1096–1097` |
| Wrapup ذخیره | banner «در حال ذخیره…» | `:6920` |
| Case file | «در حال تولید — ممکن است چند دقیقه طول بکشد. …» + «فعال‌کردن اعلان»؛ یا بنرِ کهربایی «در حالِ به‌روزرسانی: …» | `:4602, 4608` |
| Upload (tray) | `.pbar` (determinate/indet/wait) + پیام‌های «آماده‌سازیِ فایل…»، «در حالِ آپلود — N٪ (… از …)»، «بررسیِ نهاییِ فایل رویِ سرور…» و … | `:7294–7327` |
| Job | «در صفِ پردازش…»، «آماده‌سازیِ صدا…»، «در حالِ تبدیل به متن و تفکیکِ گوینده‌ها…» + نوارِ indet | `:7236–7242, 7289` |
| Header | `.icon-btn.busy` حلقه‌ی چرخانِ 1.1s | `:646` |
| Speaker resolve | `#resolveSpeakersStatus` متنِ 12.5px muted | `:1166` |
| سایر درخواست‌ها | بدونِ نشانگرِ loading (صفحه تا پاسخ عوض نمی‌شود) | `showScreen` پس از `await` |

### 14.3 Error
| محل | متن / treatment | Retry |
|---|---|---|
| سراسری | `showBanner('error', …)` — `.banner.error` در `#bannerBox`؛ اغلب «خطا: {پیامِ سرور}» | ندارد (کاربر عمل را تکرار می‌کند) |
| Live | بنرهای `#liveConnBanner`: «ضبط متوقف است.»، «اتصال قطع شد.»، «نشست شما منقضی شده.»، «صدا فعال است ولی متن جدیدی دریافت نمی‌شود.»، «رونویسیِ زنده ناموفق شد.» + `.rec-status.warn` | reconnect خودکار با شمارنده‌ی «تلاش N از M» (`:5758–5759`) |
| Preflight | banner.error با پیامِ میکروفون؛ banner.warn برای رونویسی | «بررسی دوباره‌ی میکروفون و اتصال» |
| Upload modal | `.up-err` (clay-soft، `white-space:pre-line`) | انتخابِ دوباره |
| Job / upload card | `.job-card.failed` + `IC_WARN` در مرحله + پیام از `PROC_ERR` | «تلاشِ دوباره» (برای خطاهای قابلِ تکرار) / «بستن» |
| Notification | `.notif-ic.bad` | — |
| Case file | `.cf-empty` «خطا در تولیدِ پرونده: …» یا `.cf-banner.cf-red` «آخرین به‌روزرسانی ناموفق بود: …» | «تلاشِ دوباره» |
| Admin audio | «فایلِ صدا بارگذاری نشد» (11px قرمز)؛ «سگمنت(هایِ) شماره‌ی … هیچ‌وقت به سرور نرسیده‌اند …» | — |
| Manual date | «خطا: …» قرمز زیرِ تقویم | — |

---

## 15. Responsive Behavior

**Breakpointهای واقعی:**
```text
max-width:480px   (index.html:409)  — سراسری
max-width:520px   (index.html:539, 636) — فقط پرونده‌ی درمان
min-width:640px   (index.html:590) — فقط پرونده‌ی درمان
```
عرضِ ستون در همه‌ی اندازه‌ها حداکثر 620px است (`.wrap`)، بنابراین حالتِ «دسکتاپ» و «تبلت» ظاهرِ یکسان دارند (ستونِ مرکزی 620px). breakpointِ تبلت جداگانه وجود ندارد.

**≤480px (`:409–440`):**
- `body` padding → `20px 12px 40px`؛ `.card` padding → `22px 18px`.
- `.step-label` پنهان (فقط دایره‌های مراحل).
- `.timer` 47→40px؛ `.rec-dot` 124→108px، آیکن 46→40px.
- `.clients-grid` → یک ستون (در بالاتر از آن هم با `minmax(260px)` در عرضِ 620px حداکثر ۲ ستون).
- `#adminStats` → ۲ ستون (از ۴).
- **Fixed bottom elements** (`left:12px; width:calc(100% - 24px); bottom:12px; z-index:40`):
  - Live: `#liveControls` به نوارِ کارتیِ ثابت تبدیل می‌شود (توقف/ادامه + پایان جلسه)؛ `.rec-stage` padding-bottom 158px. «لغو جلسه» ثابت نمی‌شود.
  - Setup: `#btnStartSession` ثابت؛ screen padding-bottom 86px.
  - Clients/AllClients: `#btnNewClient`/`#btnNewClientAll` ثابت با bg card و سایه؛ padding-bottom 80px.
- Modal: اندازه تغییر نمی‌کند (width 100% تا 430px، backdrop padding 18px).
- Tray: `width:min(560px,calc(100vw - 24px))`، `max-height:calc(100vh - 110px)` (بدونِ media query).
- Calendar: `width:min(290px,calc(100vw - 32px))`.

**≤520px (پرونده):** `.cf-grid-2` یک ستون؛ جدولِ دارو پنهان و کارت‌های `.cf-med-mobile` نمایش داده می‌شوند؛ summary محورها `flex-wrap`.
**≥640px (پرونده):** کارتِ زوجیِ `.cf-couple-wide` دو ستونِ grid می‌گیرد و متنش `column-count:2`.

**رفتارهای بدونِ breakpoint:** ردیفِ چیپ‌های فیلتر اسکرولِ افقی با اسکرول‌بارِ پنهان (`:182–183`)؛ `.btn-sm` و عناوینِ job/فایل با ellipsis؛ `.client-actions.has-3` چینشِ دوردیفه در همه‌ی عرض‌ها؛ متن‌ها wrap عادی.

---

## 16. RTL / Persian UI

- **Direction:** `<html dir="rtl">` + `body{direction:rtl;text-align:right}` (`:2, :53`).
- **Alignment:** متن‌ها راست‌چین؛ `.empty`، `.rec-stage`، `.privacy-note`، `.step` وسط‌چین. dropdownهای منو از سمتِ چپ باز می‌شوند (`.sort-drop{left:0}` `:198`، `.client-menu{left:12px}` `:230`)؛ تقویم از راست (`right:0` `:102`).
- **Physical properties:** بیشترِ CSS از `left/right/padding-left/border-right` فیزیکی استفاده می‌کند (مثلاً `.client-top{padding-left:38px}`، `.note-log-item{border-right:3px}`، `.cf-axis{border-right:4px}`)؛ خصوصیاتِ منطقی فقط در `.cat-seg` (`border-inline-start`)، `.cat-tree*` (`inset-inline-*`) و تایم‌لاینِ ادمین (`border-inline-start`) (`:190,389–395,2722`).
- **Toggle:** دستگیره از راست شروع و با `translateX(-18px)` به چپ می‌رود (`:297–299`).
- **Arrows/chevrons:** تقویم: `JALALI_CHEVRON_R` برای «ماهِ قبل» و `JALALI_CHEVRON_L` برای «ماهِ بعد» (`:2140–2141`)؛ آکاردئون‌ها chevron رو به پایین با چرخشِ 180° (`:481–482`)؛ فلشِ «قبل ← اکنون» در پرونده `M15 6l-6 6 6 6` (رو به چپ) (`:4765`)؛ ارجاع‌های متقاطع فلشِ مورب (`:4247`)؛ آیکنِ خروج رو به راست (`:752`).
- **Numbers:** `toFa()` ارقامِ لاتین را به فارسی تبدیل می‌کند (`:1610`) و در شمارنده‌ها، تایمر، تاریخ‌ها و آمار استفاده می‌شود. استثناها: شماره موبایل/ایمیل در فیلدِ ltr، سطوحِ severity و نامِ رویدادها در ادمین (انگلیسی)، `k=v` در تایم‌لاین.
- **Date:** تقویمِ جلالی (نام‌ماه‌ها `:2056`، روزهای هفته «ش ی د س چ پ ج» `:2093`)؛ `fmtDateTime` با `toLocaleString('fa-IR')` (`:2668`)؛ `nowClock` با `fa-IR` (`:2021`).
- **Mixed LTR islands:** `.client-code{direction:ltr}`، `.timer{direction:ltr}`، `.sign-log-time`، `.note-log-time`، `.job-sub{direction:ltr}` (در سینیِ آپلود دوباره `rtl` + `unicode-bidi:plaintext`)، `.up-file-name{unicode-bidi:plaintext}` (`:210,287,323,332,660,698,711`).
- **Inputs/placeholders:** موبایل و ایمیل `dir="ltr"` و `text-align:left` inline (`:786,789`)؛ input تأییدِ حذفِ تراپیست هم ltr (`:1435`)؛ سایرِ placeholderها فارسی و راست‌چین. آیکنِ جست‌وجو سمتِ راستِ فیلد، دکمه‌ی چشمِ رمز سمتِ چپ.
- **Modal alignment:** محتوای مودال راست‌چین؛ `.modal-actions` flex به ترتیبِ DOM (دکمه‌ی انصراف اول ⇒ در RTL سمتِ راست).

---

## 17. Icons

- **Source:** همه‌ی آیکن‌ها SVGِ inline هستند؛ هیچ icon library، icon font یا فایلِ تصویری وجود ندارد. سبک: خطی (`fill="none" stroke="currentColor"`) با `viewBox 0 0 24 24`، stroke-width بین 1.7 تا 2.6؛ رنگ از `currentColor`.
- **سه روشِ تعریف:**
  1. SVG مستقیم در markup (header، search، consent، دکمه‌ها) (`:731–755, 813, 993, 1013, 1086–1091, 1111, 1137, 1220`).
  2. ثابت‌های رشته‌ای در JS: `IC_CAL, IC_CLK, IC_TRSH, IC_X, IC_MIC, IC_PEN, IC_EYE, IC_EYE_OFF, IC_DOTS, IC_ARCHIVE, IC_RESTORE, IC_PIN` (`:1462–1473`)، `IC_CHECK, IC_WARN, IC_DOC` (`:7045–7047`)، `IC_TRASH, IC_UP, IC_DOWN, IC_NOTE` (`:7129–7132`)، `JALALI_CAL_SVG`/`JALALI_CHEVRON_*`.
  3. ثابت‌های پرونده: `CF_CHEV, CF_STAR, CF_ARROW, CF_ICON_EDIT, CF_ICON_TRASH` (`:4087, 4161, 4247, 4308–4309`) با width/height صریحِ 12–14px.
- **Emoji / کاراکتر:** «👑» برای ادمین (`:2793`)، «✓» در «رضایت ✓» و «ذخیره شد ✓»/«✓ فایلِ جلسه دریافت شد» (`:2982, 5167, 7489`)، «×» نه؛ «+» متنی در «+ افزودنِ …» (`:4301`).

| آیکن | اندازه | محل | معنا |
|---|---|---|---|
| لوگو (سه میله‌ی موج) | 47px | header | برند |
| زنگ | 20px | `#trayBtn` | سینیِ پردازش‌ها و اعلان‌ها |
| سپر+تیک | 20px | `#adminBtn` | پنل ادمین |
| خروج | 20px | `#logoutBtn` | خروج |
| ماه | 20px | دکمه‌ی تم | تغییرِ تم |
| ذره‌بین | 18px | `.search-box` | جست‌وجو |
| چشم / چشمِ خط‌خورده | 18px | `.pw-toggle`؛ برچسبِ «علائم بدنی»؛ `.inline-sign` | نمایشِ رمز / علامت |
| میکروفون | 18px | «شروع جلسه…»، «یادداشت صوتی»، برچسبِ صوتی | ضبط |
| قلم | 46px سفید در `.rec-dot`؛ 18px در دکمه‌ها | Live، یادداشتِ متنی | رونویسی/یادداشت |
| دیسک | 18px | «ذخیره و پایان» | ذخیره |
| upload | 18/15px | دکمه‌های آپلود، `.up-drop` (34px) | آپلود |
| ⋮ | 16px | `.client-menu-btn` | منوی کارت |
| سنجاق / آرشیو / بازگردانی / سطل | 14–15px | منوی کارت، `.pin-badge` (10px)، `.session-delete` | — |
| × | 11px | `.sign-rm` | حذفِ علامت/یادداشت |
| تیک / هشدار / سند | 13–15px | `.jstep-dot`، `.notif-ic` | done / خطا / پرونده |
| chevron پایین | 14px | آکاردئون‌های پرونده | باز/بسته |
| ستاره | 14px | پرونده | نکته‌ی کلیدی |
| فلش بالا/پایین | 17px | `.up-file-btn` | ترتیبِ فایل‌ها |
| قفل | 14px | `.privacy-note` | حریمِ خصوصی |
| مرتب‌سازی | 16px | `.sort-btn` | ترتیب |
| چرخش | 18px | «بررسی دوباره‌ی میکروفون و اتصال» | تلاشِ دوباره |

---

## 18. Motion / Animation

| نام | Property | Duration / Easing | کجا | ارجاع |
|---|---|---|---|---|
| `rise` (screen) | opacity 0→1، margin-top 12→0 | .5s `cubic-bezier(.22,.9,.36,1)` both | ورودِ هر `.screen` | `:76, 85` |
| `rise` (modal) | همان | .35s ease | `.modal` هنگامِ باز شدن | `:374` |
| `rise` (tray) | همان | .25s ease | `.tray` | `:648` |
| `breathe` | transform scale 1→1.6، opacity .65→0 | 3.2s `cubic-bezier(.45,0,.2,1)` infinite؛ حلقه‌ی دوم با تأخیرِ 1.6s | حلقه‌های `.rec-dot` | `:281–283` |
| `shimmer` | opacity .5↔.8 | 1.5s infinite | `.skeleton-card` | `:160–163` |
| `spin` | rotate 360° | 1.1s linear infinite | `.icon-btn.busy` | `:646–647` |
| `indet` | margin-right −35%→100% | 1.4s ease-in-out infinite | `.pbar.indet` | `:679–680` |
| Step transition | all .35s؛ خط background .4s | — | `.step-dot`, `.step-line` | `:67,69` |
| Button | background .2s، transform .08s؛ active scale .975 | — | `button.btn` | `:127–128` |
| Chips/tabs/menus | background/color/border-color .15s–.2s | — | `.client-tab`، `.sign-chip`، `.sort-btn`، `.client-card`، `.session-item` و … | `:174,195,205,260,317` |
| Rec dot | background/transform .4s | — | `.rec-dot` → paused | `:279` |
| Level meter | height .09s linear | — | میله‌ها | `:293` |
| Toggle | background .25s، دستگیره transform .25s | — | switch | `:296–297` |
| Live toggle | border-color/background .25s | — | `.live-toggle` | `:300` |
| Progress | width .3s ease | — | `.pbar>span` | `:677` |
| Chevron | transform .18s ease | — | `.cf-chev` | `:481` |
| CF flash | background .3s؛ کلاس پس از 1.8s حذف | — | `.cf-flash` | `:511, 4265–4266` |
| Scroll | `window.scrollTo({top:0,behavior:'smooth'})` هنگامِ تغییرِ screen؛ `scrollIntoView smooth` برای پرونده | — | `:2260, 3968, 4264` |

- بستنِ modal/tray/dropdown: بدونِ انیمیشن (`display:none` / `hidden`).
- Dropdownها و تقویم: بدونِ انیمیشن.
- `prefers-reduced-motion`: قاعده‌ای وجود ندارد.

---

## 19. Current UI Copy

**Navigation / header:** «دستیار درمانگر»، «فیلیا»، title دکمه‌ها: «پردازش‌ها و اعلان‌ها»، «پنل ادمین»، «خروج از حساب»؛ مراحل: «آماده‌سازی»، «جلسه»، «پایان»؛ `<title>`: «فیلیا — دستیار جلسات درمان».

**Headings:** «ورود تراپیست»/«ثبت‌نام تراپیست»، «مراجعین»، «همه‌ی مراجعین»، «جلسه‌ی جدید»، «تکمیل جلسه»، «جلساتِ ثبت‌شده»، «پنل ادمین»، «فعالیت‌ها / لاگ»، «تایم‌لاینِ جلسه»، «پرونده‌ی روندِ درمان»، «نکات کلیدی»، «دارو و سابقه‌ی درمان»، «خلاصه‌ی قبل از جلسه — محورهای کلیدی»، «چه چیزی نسبت به قبل تغییر کرده؟»، «روندِ جلسات»، «نقشه‌راهِ جلسه‌ی بعد»، «سوالاتِ باز برایِ تراپیست»، «پردازش‌ها و اعلان‌ها»، «علائم بدنی»، «یادداشت سریع».

**CTA labels:** «ورود»، «ثبت‌نام»، «مراجع جدید»، «افزودنِ پرونده‌ی قبلی»، «شروع جلسه»، «ثبت جلسات گذشته»، «آپلود صوت»، «پرونده»، «موافق است»/«موافق نیست»، «شروع جلسه و رونویسی»، «توقف موقت»، «ادامه»، «پایان جلسه»، «لغو جلسه»، «ثبت»، «یادداشت صوتی»، «یادداشت متنی»، «پایان ضبط و ثبت»، «افزودن»، «ذخیره و پایان»، «بازگشت بدون ذخیره»، «شروع جلسه‌ی جدید»، «آپلودِ فایلِ صوتیِ جلسه»، «شروعِ آپلود»، «ویرایش تاریخ/ساعت»، «بازسازیِ شماره‌گذاریِ گوینده‌ها»، «جایگزینیِ متن»، «ذخیره‌ی یادداشت»، «ویرایشِ متن»، «تولیدِ پرونده»، «به‌روزرسانی»، «بازتولیدِ کامل»، «ارتقای ساختار»، «ثبتِ پاسخ»، «تلاشِ دوباره»، «مشاهده‌ی جلسه»، «خواندنِ همه»، «بستن»، «بازگشت»، «بازگشت به پرونده»، «بازگشت به صفحه‌ی اول»، «دانلود کاملِ دیتای سیستم»، «مشاهده مراجعین»، «دانلود دیتا»، «حذف»، «دانلود».

**Status labels:** «کامل»، «در جریان»، «قطع‌شده»، «ثبتِ دستی»، «فایلِ صوتی»، «در حالِ پردازش»، «پردازش ناموفق»، «سنجاق‌شده»، «فعال»/«غیرفعال»، «مطلوب»/«حساس»/«نیازمندِ توجه»، «در انتظار ثبت»، «در انتظار»، «به‌روزرسانیِ خودکار: روشن|خاموش»؛ ادمین: «در حالِ انجام»/«پایان‌یافته»/«لغوشده»، «ناتمام»، «صدا: در حالِ همگام‌سازی|ناقص (سگمنتِ گم‌شده)|کامل»، «رونویسی: در انتظار|ناموفق|کامل»؛ Live: متن‌های `rtOnState` (§13).

**Empty state:** §14.1.

**Error messages (نمونه):** «شماره موبایل و رمز عبور را وارد کنید.»، «نام و تخصص الزامی است.»، «ابتدا جلسه‌ی زنده را پایان دهید یا لغو کنید.»، «جلسه قابل ادامه نیست.»، «نامِ دارو الزامی است»، «عنوانِ محور الزامی است»، «عنوانِ گام الزامی است»، «پاسخ نمی‌تواند خالی باشد»، «خطا در ثبتِ یادداشت — متن هنوز در کادر است.»، «میکروفون در دسترس نیست»، «نشست شما منقضی شده — یک‌بار خارج و دوباره وارد شوید.»، «آپلود ناموفق بود.»، «پردازش انجام نشد.»

**Confirmation / success:** «مطمئن هستید؟»، «لغو این جلسه؟»، «حذف این جلسه؟»، «حذف مراجع؟»، «حذف کامل این تراپیست؟»، «حذفِ این ردیف؟»، «بله، حذف شود»، «بله، حذف کامل»، «بله، لغو شود»، «تایید انتقال»؛ بنرها: «جلسه لغو شد.»، «جلسه حذف شد.»، «مراجع حذف شد.»، «مراجع به فهرستِ غیرفعال‌ها منتقل شد.»، «پرونده ذخیره شد.»، «تاریخ و ساعت جلسه به‌روزرسانی شد.»، «متنِ نهایی آماده شد و به پرونده اضافه شد.»، «✓ فایلِ جلسه دریافت شد. …».

**Helper text:** «رونویسی را هم‌زمان ببینید»، «این رضایت یک بار برایِ این مراجع ثبت می‌شود و در جلسه‌هایِ بعدی دوباره پرسیده نمی‌شود.»، «هر فرمتِ رایج: m4a، mp3، wav، ogg، amr، ویدیوی mp4 و …»، «هر فایل تا ۱ گیگابایت؛ کلِ جلسه تا ۵ ساعت»، `.up-note` درباره‌ی ادامه‌ی آپلود در پس‌زمینه، hint تاریخِ فایل (`:7177`)، «شماره و رنگ = سطحِ اولویت · ترتیبِ پیشنهادی، نه جایگزینِ تشخیصِ شما».

**Placeholders:** «نام شما»، «مثلاً: روان‌شناسِ بالینی»، «۰۹۱۲۳۴۵۶۷۸۹»، «you@example.com»، «حداقل ۸ کاراکتر»، «جست‌وجوی کد یا نام مستعار…»، «جست‌وجوی نام یا شماره…»، «یادداشت… (Enter)»، «متن یادداشت…»، «مثلاً: مراجع-الف»، «توضیحِ کوتاه (اختیاری)…»، «نامِ رویداد (مثلاً session.created)»، «پاسخ…»، «هنوز ثبت نشده — اینجا بنویسید».

**Consent / privacy text:**
- Consent box (`:996–999`): «صدای این جلسه به‌صورت زنده به متن تبدیل می‌شود. **صدا هیچ‌جا ذخیره نمی‌شود** — فقط متنِ گفتگو در پرونده ثبت می‌گردد. آیا مراجع آگاهی دارد و موافق است؟»
- Privacy note (`:1221`): «صدای خام هرگز ذخیره نمی‌شود — فقط متن رونویسی‌شده.»
- Upload consent (`:1271`): «مراجع به ضبط و رونویسیِ این جلسه رضایت داده است.»
- Admin sessions (`:835`): «صدا فقط برایِ بازبینیِ فنی نگه داشته می‌شود — حداکثر ۳۰ روز.»
- Live banners: «صدا به‌صورتِ محلی ذخیره می‌شود» (`:5533, 5557`).

---

## 20. Visual Inconsistencies

> فقط ثبتِ مشاهده. بدونِ راه‌حل یا اولویت‌بندی.

**1. Inconsistency:** ارجاع به CSS variableهای تعریف‌نشده با fallbackِ hard-coded.
Locations: `--warn` (`:2652`)، `--border` (`:2688`)، `--card-alt` (`:2722`)، `--danger` (`:3001,3021,3022,3029,5172`)، `--warning` (`:3021,3022,3035`)، `--ok` (`:5168`)، `--field-dim` (`:366`).
Evidence: هیچ‌کدام در `:root`/`[data-theme="dark"]` (`:10–49`) تعریف نشده‌اند؛ مقدارِ fallback در هر دو تم یکسان اعمال می‌شود. همچنین دو fallback مختلف برای `--danger`: `#c0392b` و `#c62828`.
No recommendation at this stage.

**2. Inconsistency:** پالتِ رنگیِ جداگانه برای بخش‌های مختلف.
Locations: tokenهای `--cf-*` پرونده (`:446–458`)؛ رنگ‌های laneِ تایم‌لاینِ ادمین (`:2716`)؛ severityها (`:2691`).
Evidence: primaryِ پرونده teal `#2d6f73` در برابرِ sage `#3e6b5e` بقیه‌ی اپ؛ رنگ‌های lane (`#2563eb`، `#7c3aed`، …) در هیچ token دیگری وجود ندارند.

**3. Inconsistency:** radiusِ دکمه‌ها در variantهای مشابه متفاوت است.
Locations: `button.btn` 15px (`:127`)، `.btn-xl` 17px (`:139`)، `.btn-sm` 11px (`:142`)، `.cf-btn` 999px کپسولی (`:466`)، `.icon-btn` 14px (`:60`)، `.sort-btn` 11px، `.client-menu-btn` 8px، `.session-delete` 9px، `.job-del` 9px، `.up-file-btn` 10px، `.cf-icon-btn` 7px.
Evidence: فقط بخشی از آن‌ها از tokenهای `--r-*` استفاده می‌کنند؛ 15/17/14/9/10/7px token ندارند.

**4. Inconsistency:** radiusِ literal در کنارِ tokenهای radius.
Locations: `.modal{border-radius:24px}` (`:374`) با وجودِ `--r-xl:24px`؛ `8px` در `.sort-drop button`، `.client-menu-drop button`، `.note-log-item`، `.link-btn` (`:200,236,331,654`) با وجودِ `--r-sm:8px`؛ 10/12/13/14px در پرونده؛ `4px` در تایم‌لاینِ ادمین (`:2722`).

**5. Inconsistency:** ارتفاعِ دکمه‌ها در موقعیت‌های مشابه.
Locations: اکشن‌های کارتِ مراجع و ادمین `.btn-sm` (padding 9px)؛ دکمه‌های «دانلود» ادمین با inline `padding:4px 8px` (`:3055,3076`)؛ دکمه‌های `.cf-btn` padding 7px 14px؛ دکمه‌ی «ثبت» یادداشتِ سریع padding 11px 16px (`:329`)؛ trigger تقویم `.btn-sm`.

**6. Inconsistency:** سطوحِ ادمین با inline style به‌جای کلاس ساخته شده‌اند.
Locations: `#adminStats` (`:805, 2758–2760`)، ردیف‌های «جلسات اخیر» (`:2650–2660`)، «رویدادها» (`:2688–2697`)، تایم‌لاین (`:2722–2736`)، باکسِ صدا (`:3006–3080`).
Evidence: `padding:12px` روی `.card` (در برابرِ 28px 26px پیش‌فرض)، `border-radius:4px` برای ردیفِ تایم‌لاین.

**7. Inconsistency:** `<select>` بومی بدونِ استایل در کنارِ inputهای استایل‌خورده.
Locations: `#adminRecentStatusFilter`، `#adminRecentSinceFilter`، `#adminObsSeverityFilter` (`:867–890`).
Evidence: قاعده‌ی سراسری فقط `input,textarea` را پوشش می‌دهد (`:91`)؛ تنها قاعده‌ی select داخلِ پرونده است (`:522`). input کنارِ آن‌ها (`#adminObsEventFilter`) `margin-bottom:14px` و width 100% سراسری را می‌گیرد.

**8. Inconsistency:** برچسب‌های وضعیتِ جلسه برای یک مقدار، در جاهای مختلف متفاوت است.
Locations: `adminSessionStatusFa` «در حالِ انجام / پایان‌یافته / لغوشده» (`:2641`) در برابرِ «در جریان / کامل / قطع‌شده» در ClientDetail، SessionDetail و AdminSessions (`:2973, 3936, 4997`)؛ فیلترِ ادمین «ناتمام» (`:868`).

**9. Inconsistency:** کلاسِ وضعیتِ «ثبتِ دستی» از کلاسِ `canceled` استفاده می‌کند.
Locations: `:3940`. Evidence: کلاسِ CSS `.session-status.canceled` (`:268`) برای نمایشِ «ثبتِ دستی» به‌کار می‌رود.

**10. Inconsistency:** متنِ حریمِ خصوصی/رضایت درباره‌ی ذخیره‌ی صدا در نقاطِ مختلفِ UI با هم هم‌خوان نیستند.
Locations: consent box «صدا هیچ‌جا ذخیره نمی‌شود» (`:998`)؛ privacy note «صدای خام هرگز ذخیره نمی‌شود» (`:1221`)؛ زیرعنوانِ ادمین «صدا فقط برایِ بازبینیِ فنی نگه داشته می‌شود — حداکثر ۳۰ روز.» (`:835`)؛ بنرهای Live «صدا به‌صورتِ محلی ذخیره می‌شود» (`:5533,5557`)؛ مودالِ آپلود (ارسالِ فایلِ صوتی به سرور، `:1272`).
No recommendation at this stage.

**11. Inconsistency:** labelهای فرمِ «ویرایشِ مراجع» با inline style به‌جای استایلِ سراسریِ `label`.
Locations: `:1328` (`font-size:13px;margin-bottom:6px`، بدونِ وزن 600)، `:1330` (یک `div` به‌جای `label` برای «دسته‌بندی»). در `newClientModal` همین فیلدها `label` سراسری دارند (`:1229,1231`).

**12. Inconsistency:** سه تعریفِ متفاوت برای آیکنِ سطل.
Locations: `IC_TRSH` (`:1464`؛ دارای ویژگیِ تکراریِ `stroke-width`)، `IC_TRASH` (`:7129`)، `CF_ICON_TRASH` (`:4309`). همچنین دو آیکنِ قلم (`IC_PEN` `:1467` و `CF_ICON_EDIT` `:4308`) با pathهای متفاوت.

**13. Inconsistency:** رنگِ لوگو hard-coded و مستقل از تم.
Location: `<rect … fill="#3e6b5e"/>` (`:732`) — در تمِ تاریک `--sage` به `#427a68` تغییر می‌کند ولی لوگو ثابت می‌ماند.

**14. Inconsistency:** رنگِ outline فوکوسِ `.session-delete` با token clay متفاوت است.
Location: `rgba(193,102,85,.35)` (`:256`) در برابرِ `--clay:#c96655` = `rgb(201,102,85)`.

**15. Inconsistency:** یک مودال از مکانیزمِ بستنِ مشترک مستثناست.
Location: `caseFileAutoPromptModal` (`:1339`) در `MODAL_CLOSERS` (`:7537–7553`) نیست ⇒ کلیکِ backdrop و Escape آن را نمی‌بندند؛ ۱۵ مودالِ دیگر بسته می‌شوند.

**16. Inconsistency:** دکمه‌ی تم برخلافِ سایرِ `.icon-btn`ها `title`/`aria-label` ندارد.
Location: `:754` در برابرِ `:744,748,751`.

**17. Inconsistency:** کلاسِ `.inactive` روی کارتِ مراجع بدونِ قاعده‌ی CSS.
Location: `:3602`؛ هیچ selectorِ `.client-card.inactive` در CSS نیست (`:9–723`).

**18. Inconsistency:** نشانه‌گذاریِ نقش/تأیید با emoji/کاراکتر در کنارِ آیکن‌های SVG.
Locations: «👑» (`:2793`)، «✓» (`:2982, 5167, 7489`)، «+» متنی (`:4301, 7156`).

**19. Inconsistency:** دو کنترلِ انتخابِ دسته با ظاهرِ متفاوت برای جنسیت.
Locations: ردیفِ فیلتر — `.cat-seg` دوتکه‌ی درجا (`:188–192, 3343`)؛ فرم‌ها — شاخه‌ی درختیِ `.cat-tree` زیرِ چیپ (`:386–395, 3319`).

**20. Inconsistency:** اندازه‌ی فونتِ عنوانِ مودال/سینی/پرونده/screen همگی متفاوت‌اند.
Locations: `h2` 19px، `.modal h3` 17px، `.tray-head h3` 15.5px، `.cf-title` 16px/700، `.cf-section-title` 16px/800، `.detail-section-title` 15px/700 (`:87,375,650,464,476,89`).

**21. Inconsistency:** آیکنِ `.rec-dot` در صفحه‌ی ضبط قلم است، در حالی که دکمه‌ی آغازِ همان جلسه آیکنِ میکروفون دارد.
Locations: `:1024–1026` در برابرِ `:1013`.

**تعداد inconsistencyهای ثبت‌شده: 21**

---

## 21. Screenshot / Evidence Index

**No repository screenshot evidence found** — جست‌وجوی `**/*.{png,jpg,jpeg,webp,gif,svg}` فقط فایل‌های داخلِ `node_modules/` و `server-deploy/node_modules/` را برگرداند (نامرتبط با UIِ Feelia).

**Design references موجود در repo (UIِ اجراشده نیستند):**
| فایل | نوع | وضعیت |
|---|---|---|
| `feelia-design-system.html` | سندِ سیستمِ طراحی (در کامنت‌های CSS به آن ارجاع شده، مثلاً `:152, 169`) | supporting reference طبقِ `CLAUDE.md` |
| `session_assistant_v11 (3).html` | نمونه‌ی اولیه‌ی بدونِ سرور | HISTORICAL طبقِ `CLAUDE.md` |
| «m4.html» | در کامنت `:444` به‌عنوانِ منبعِ پالتِ پرونده نام برده شده | **در repo یافت نشد** |

**Screenshotهای گرفته‌شده در این بررسی:**
| Screen | Path/File | Viewport | State |
|---|---|---|---|
| Auth (ورود تراپیست) | ذخیره نشده — فقط در Browser pane مشاهده شد (`file:///…/public/index.html`، بدونِ backend) | عرضِ پیش‌فرضِ pane (~515px در فریمِ مختصات) | حالتِ ورود، تمِ روشن، بدونِ داده |

سایرِ screenها نیاز به backend و حسابِ کاربری دارند و از آن‌ها screenshot گرفته نشد (قیدِ پروژه: بدونِ ساختِ حساب و بدونِ دادهٔ واقعی).

---

## 22. Current UI Summary

- **UI shell:** یک SPAِ تک‌فایلی (`public/index.html`) با ستونِ مرکزیِ 620px روی پس‌زمینه‌ی کرم با glowِ شعاعیِ سبز. بالای ستون header (لوگو + عنوان + ۴ دکمه‌ی آیکنیِ مربعی)، زیرِ آن بنرِ سراسری، سپس نوارِ مراحلِ سه‌گانه (فقط در جریانِ جلسه)، سپس دقیقاً یک کارتِ screen، و در انتها یادداشتِ حریمِ خصوصی. لایه‌های fixed: سینیِ اعلان‌ها، مودال‌ها و — فقط در ≤480px — دکمه/نوارِ اصلیِ پایینِ صفحه.
- **Navigation:** بدونِ URL route، sidebar یا منوی ناوبری. ۱۴ screen با `showScreen()` و ویژگیِ `hidden` جابه‌جا می‌شوند؛ حرکت بینِ screenها با دکمه‌های «بازگشت»، کلیک روی کارت‌ها/ردیف‌ها، و دکمه‌های header (ادمین، سینی، خروج) انجام می‌شود.
- **سازمان‌دهیِ صفحات:** سه گروه — (۱) ورود؛ (۲) جریانِ تراپیست: مراجعین امروز ← همه‌ی مراجعین ← پرونده‌ی مراجع ← جزئیاتِ جلسه، و جریانِ خطیِ جلسه Setup ← Live ← Wrapup؛ (۳) شش screenِ ادمین. همه‌ی screenها الگوی یکسانِ `card-head` (h2 + زیرعنوان) + محتوا + دکمه‌ی بازگشتِ ghost در پایین دارند (به‌جز Live).
- **Visual language:** کارت‌های سفید با radius بزرگ (24px) و سایه‌ی نرم، کپسول‌ها/چیپ‌ها با radius 99px، رنگِ غالبِ sage برای اکشنِ اصلی، clay برای ضبط/حذف، gold برای رضایت/هشدار؛ آیکن‌های SVGِ خطیِ inline. پرونده‌ی درمان زبانِ بصریِ جداگانه‌ای (پالتِ teal/blue/amber/red، نوارهای رنگیِ کناری، آکاردئون‌های `<details>`) دارد.
- **Typography:** فقط Vazirmatn (Tahoma fallback)، وزن‌های 300–800، line-height پایه 1.9؛ ۲۰ اندازه‌ی مختلف بینِ 10 تا 47px بدونِ scale یا token.
- **Color system:** ~۲۳ token در `:root` با نسخه‌ی کاملِ تمِ تاریک (`data-theme`)، ۱۷ token جداگانه برای پرونده، و مجموعه‌ای از رنگ‌های hard-coded در بخشِ ادمین و fallbackهای متغیرهای تعریف‌نشده.
- **Surface system:** چهار token radius (24/16/11/8px) و یک token سایه؛ سطوحِ فرعی (یادداشت، transcript، job، بنر) با border 1–1.5px و radius 16px؛ مودال‌ها و سینی با سایه‌ی عمیق‌تر.
- **Interaction patterns:** مودالِ وسط‌چین با backdropِ blur برای هر تأیید/فرم؛ dropdownهای absolute که با کلیکِ بیرون بسته می‌شوند؛ تقویمِ جلالیِ popover؛ toggleهای سفارشی؛ بنرِ ماندگار به‌جای toast؛ skeleton برای لیستِ مراجعین؛ polling و نوارِ پیشرفت برای آپلود/پردازش؛ آکاردئون‌های با حافظه‌ی localStorage در پرونده؛ حرکتِ محدود (fade/slide ورود، تنفسِ دایره‌ی ضبط، spinnerها).
- **Responsive behavior:** یک breakpointِ سراسری (≤480px) که paddingها را کم، برچسب‌های مراحل را پنهان، گریدها را تک‌ستونه و دکمه‌های اصلیِ Setup/Live/Clients را به پایینِ صفحه ثابت می‌کند؛ دو breakpointِ اختصاصیِ پرونده (≤520px، ≥640px). دسکتاپ و تبلت ظاهرِ یکسانِ ستونِ 620px دارند.
- **Major visual inconsistencies:** ۲۱ مورد در §20 — از جمله متغیرهای CSS تعریف‌نشده با fallback، پالتِ جداگانه‌ی پرونده و ادمین، radius/ارتفاعِ متفاوتِ دکمه‌ها، inline styleهای ادمین، selectهای بی‌استایل، برچسب‌های متفاوت برای یک وضعیتِ جلسه، و متن‌های ناهم‌خوانِ ذخیره‌ی صدا.
