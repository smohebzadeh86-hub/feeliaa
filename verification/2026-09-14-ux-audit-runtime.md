# 2026-09-14 — اجرای UI برای UX Audit (mock)

> **Evidence** — مشاهده در یک لحظه، نه حقیقتِ دائمی (LAW-019). گزارشِ مصرف‌کننده: [docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md](../docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md).

> **snapshotِ اجرا:** فایل‌های `public/` در لحظه‌ی کپی = `2763414` + فیکس‌های commitنشده‌ی فازِ ۰ (پیش از commitهای `ecf00b4`، `fedeac2`، `8347fbb` که نشستِ دیگری هم‌زمان ساخت). اجرا روی HEAD تکرار نشد؛ بررسیِ کدِ HEAD در [UX_FINDINGS §همگام‌سازی](../docs/05-plans/ux-audit-2026-09-14/UX_FINDINGS.md#همگام‌سازی-با-commitهای-هم‌زمان-head-8347fbb).

<a id="t1"></a>
## T1 — محیط و روش
- **کد:** working tree روی HEAD `2763414` (`feat/clarity`) + تغییراتِ commitنشده‌ی `public/index.html` و `server/src/http/auth.ts` (فیکس‌های فازِ ۰).
- **روش:** اسکریپتِ scratchpad (خارج از repo) فایل‌های واقعیِ `public/index.html`، `feelia-rt.js`، `feelia-analytics.js` را کپی کرد و فقط یک `<script src="stub.js">` پیش از `feelia-rt.js` تزریق کرد. stub: `fetch` برای `/api/*` با داده‌ی canary (۲۴ مراجعِ «مراجع-آزمایشی-N»، کدهای `CL-T0NN`)، `getUserMedia` با oscillatorِ بی‌صدا، `WebSocket`ِ ساختگی برای Soniox. سرورِ استاتیکِ node روی پورتِ 4517 از طریقِ یک configurationِ **موقت** در `.claude/launch.json` (با اجازه‌ی مالک) اجرا شد و پس از تست حذف شد.
- **بدونِ** حساب، رمز، داده‌ی واقعی، Sonioxِ واقعی، یا سرورِ dev (`localhost:3000` در حالِ اجرا بود و استفاده نشد).
- **Browser:** Browser pane (Chromium)؛ viewport ۱۰۲۴×۷۶۸ و ۳۷۵×۸۱۲ (emulation). اسکرین‌شات timeout شد (پنجره پنهان) → اندازه‌گیریِ DOM و درختِ دسترسی.
- **Console:** بدونِ خطا پس از بارگذاری.

<a id="t2"></a>
## T2 — شکستِ ذخیره‌ی یادداشت/علامت حینِ جلسه (UX-001)
- گام‌ها: `setupNewSession(c1)` → `setConsent(true)` → `startSession()` → موتور `ACTIVE`، `micLive=1`، وضعیت «در حال رونویسی…». سپس `__mock.notesFail=true` (هر `POST /api/sessions/:id/notes` → `TypeError('Failed to fetch')`)، یک یادداشتِ سریع و کلیک روی چیپِ «گریان».
- نتیجه: `notesLogItems=1`، `signsLogItems=1`، `bannerBox=""`، `liveConnBanner=""`، **`serverNotes=0`**.
- همچنین: چیپِ Setup «۱۴۰۵/۰۶/۲۳ ۱۵:۴۸»؛ چیپِ Live «CL-T001 · مراجع-آزمایشی-1 · جلسه ۲ · ۲۰۲۶/۰۹/۱۴»؛ دکمه‌ی شروع پیش از رضایت `disabled=true`.

<a id="t3"></a>
## T3 — پایان و تکمیل (UX-001، UX-010، UX-036)
- `endSession()` → پس از ۳٫۵s صفحه = `Wrapup`؛ «جلسه ۲ — مدت: ۰ دقیقه»؛ `wrapupNotesShown=1`، `wrapupSignsShown=1` (همان موارد ذخیره‌نشده)؛ `transcriptVisibleInWrapup=false`؛ وضعیتِ سرور `completed`؛ `micLive=0`.
- `finishSession()` → صفحه = `Clients`، بنرِ خالی (بدونِ تأییدِ ذخیره)؛ **`serverNotes=0`**.

<a id="t4"></a>
## T4 — خروج در حالتِ ضبطِ محلی (UX-003) و history (UX-027)
- `__mock.mintFail=true` (`POST /api/stt/realtime-session` → 503) → شروعِ جلسه → `state=FAILED`، وضعیت «در حال ضبط — متن پس از پایان آماده می‌شود»، بنرِ «رونویسیِ زنده در دسترس نیست — صدا در حال ضبط است…»، `micLive=1`، **`hasActiveRecording()=false`**.
- `logout()` → `screenAuth=true`، **`micLiveAfterLogout=1`**، `rtStateAfterLogout=FAILED`، بدونِ بنرِ هشدار.
- `history.length` پیش و پس از رفتن به Setup/Live/Auth: ۳ → ۳.

<a id="t5"></a>
## T5 — فهرستِ مراجعین در موبایل (UX-028)
- viewport ۳۷۵×۸۱۲، ۲۰ مراجعِ فعال: `firstCardTop=583`، `firstCardH=160`، `newClientTop=4014`، `docH=4170`، منوی کارت ۳۲×۳۲، دکمه‌ی «شروع جلسه» ارتفاع ۵۱، چیپِ فیلتر ۳۴. در دسکتاپ ۱۰۲۴×۷۶۸: «مراجع جدید» در ۲۱۲۶ از ۲۳۱۲.

<a id="t6"></a>
## T6 — پرونده و متنِ جلسه (UX-002، UX-007، UX-029)
- جلسه‌ی آزمایشی `s-past` با `stt_mode=batch-pending`، یک `note_during` («یادداشتِ آزمایشی»)، یک `sign` («گریان») و یک `voice` («یادداشتِ صوتیِ آزمایشی»).
- ردیف‌ها: «جلسه ۲ کامل ۲۰۲۶/۰۹/۱۴ · شروع ۱۵:۴۸ · ۰ دقیقه»، «جلسه ۱ کامل ۲۰۲۶/۰۹/۰۱ · شروع ۱۰:۰۰ · ۴۵ دقیقه» — **بدونِ نشانه‌ی متنِ در انتظار** (`pendingIndicator=false`).
- `#transcriptNotes`: سه آیتم، `firstChildTag=svg`، هر کدام یک span خالی؛ متن‌ها فقط «— ۰۱:۰۰»، «۰۲:۰۰»، «— 10:50» (قالبِ لاتینِ آخری از داده‌ی mock است و در گزارش ادعا نشده). **`noteTextPresent=false`، `signTextPresent=false`**.
- `transcriptBox.isContentEditable=false`؛ دکمه‌ی بازسازیِ گوینده‌ها نمایان؛ در موبایل بالای متن در ۷۱۷px از ۸۱۲.
- production: `git show 8bcdf0e:public/index.html | grep -c "inline-note span:first-child"` → 1؛ `git log -S` → معرفی در `f58bd29`.

<a id="t7"></a>
## T7 — دسترس‌پذیری و کنتراست (UX-018، UX-034، UX-039)
- درختِ دسترسی (فهرستِ مراجعین): دکمه‌ی تم بدونِ نام؛ «شروع جلسه» و «پرونده» تکراری بدونِ نامِ مراجع؛ «گزینه‌های مراجع» تکراری. `.client-card.tabIndex=-1`.
- پرونده: فوکوس روی عنوان + Tab×2 (کلیدِ واقعی) → `BUTTON.session-delete` با `:focus-visible` و outline ۲٫۴px؛ `.session-item.tabIndex=[-1,-1]`.
- کنتراست (محاسبه از رنگ‌های computed، تمِ روشن): `--muted`/کارت ۳٫۲۸؛ `--muted`/پس‌زمینه ۲٫۹۹؛ `--gold-deep`/`--gold-soft` ۴٫۹۶؛ سفید/`--clay` ۳٫۸۱؛ سفید/`--sage` ۶٫۰۵؛ `--sage-deep`/`--sage-mist` ۷٫۴۱.
- هیچ قاعده‌ی `prefers-reduced-motion` در stylesheetها.

## کد-فقط (اجرا نشد)
- `enterApp`: `api('/api/clients').catch(()=>({clients:[]}))` — production خطِ ۱۲۶۸ (UX-005).
- `recovered` فقط در `server/src/ws/transcription.ts:158,316` (UX-008).
- `feelia-rt.js:1130` و `index.html:1466` (`purpose` صفِ صدا — UX-008، INFERRED).

## پاک‌سازی
- `preview_stop` سرورِ mock؛ configurationِ موقتِ `uxmock-temp` از `.claude/launch.json` حذف شد. در زمانِ بررسی، فایل یک configurationِ دیگر (`feelia-ui-mock`، پورتِ 3911، scratchpadِ نشستِ دیگر) هم داشت که متعلق به این نشست نبود و دست نخورد.
- هیچ فایلِ کدِ repo تغییر نکرد.

## محدودیت‌ها
میکروفون/Sonioxِ واقعی، شبکه‌ی واقعی، دستگاهِ واقعی، صفحه‌خوان، sleep/تبِ پس‌زمینه، و پنلِ ادمین اجرا نشدند. mock پاسخ‌های سرور را تقریب می‌زند (منطقِ route از `server/src/http/*.ts` خوانده شد).
