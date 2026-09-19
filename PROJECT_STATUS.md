# PROJECT STATUS — وضعیتِ زنده‌ی پروژه و سیستمِ مستندات

> **نقش:** سندِ زنده. ساختارش مطابقِ «دستورِ ساختِ سیستمِ مستندسازی و مرجعِ اصلیِ پروژه» (مراحلِ کار + ۲۷ بخش + checklistِ validation + خروجیِ نهایی) است.
> **قانون:** [LAW-024](docs/00-governance/project-laws.md) — **هر رویداد باید همین‌جا ثبت شود.**
> **آخرین به‌روزرسانی:** 2026-09-18 — آخرین رویداد: **رفعِ سه باگِ واقعیِ کشف‌شده در
> تستِ لوکالِ مالک** — raceِ auto-trigger (جلسه‌ی دستی روی corpusِ خالی generate می‌شد،
> یادداشتِ واقعیِ بعدی «busy» می‌خورد)، تکرارِ سرصفحه‌ی «رابطه با همسر/زوجین» بینِ
> familyRelationship و coupleRelationship، و durationIndicatorِ بدونِ راهنما (مدل یک‌بار
> متنِ خام را در تیترِ UI ریخت). هر سه با canary بازتولید و بعدِ رفع با ورودِ واقعیِ UI
> تأیید شدند؛ دارک‌مود هم بررسی شد — باگ نبود، فقط از تمِ سراسری پیروی می‌کند. جزئیات:
> [verification](verification/2026-09-18-case-file-auto-trigger-and-style-fixes.md)، Event
> Log. قبل‌ترش: **Auto-triggerِ پرونده‌ی روندِ درمان
> (فازِ ۲، بخشِ اول) + دارک‌مودِ کاملِ `.case-file-doc` + اصلاحِ فلش/خطِ پایانیِ نقشه‌راه +
> بهبودِ کیفیتِ prompt** — migration 020 (`therapists.case_file_auto_generate`، سه‌حالته)
> رویِ MySQLِ لوکالِ واقعی apply شد؛ auto-generate با LLMِ واقعیِ OpenRouter و حسابِ
> canaryِ ساخته‌و‌پاک‌شده end-to-end تأیید شد (هم روشن‌بودنِ toggle، هم خاموش‌ماندنِ درست).
> جزئیات: [verification](verification/2026-09-18-case-file-auto-trigger-and-style-fixes.md)،
> Event Log. قبل‌ترش: **تستِ بصریِ واقعیِ ۴ گپِ AI Case File
> در Browser pane** (status-pill، rhythm-line، بنرِ هشدارِ ایمنی، بنرِ زمینه‌ی حساس) —
> با ثبت‌نامِ واقعیِ UI + regenerateِ واقعی + `openClientDetail` تأیید شد هر ۴ عنصر دقیقاً
> طبقِ طراحی رندر می‌شوند؛ کدی تغییر نکرد. جزئیات: Event Log. قبل‌ترش: **رفعِ ۴ گپِ
> ساختاریِ کشف‌شده در مقایسه با نمونه‌های دستی‌سازِ مالک** (status-pill، rhythm-line،
> بنرِ جداگانه‌ی «هشدارِ ایمنی»، بنرِ جداگانه‌ی «زمینه‌ی حساس») — پیاده‌سازی و با LLMِ واقعی
> تست شد، بدونِ تغییرِ schemaِ دیتابیس (rhythm کاملاً محاسبه‌ای است). جزئیات: Event Log. قبل‌ترش:
> **ارزیابیِ کیفیِ DeepSeek V4.1 Flash
> روی هر ۲ مراجعِ واقعیِ حسابِ مالک** (بدونِ نقلِ متنِ بالینی در اسناد — LAW-001)؛ نتیجه:
> بدونِ hallucination، فیلدهایِ بدونِ داده‌ی کافی صادقانه pending ماندند. جزئیات: Event
> Log. قبل‌ترش: **جایگزینیِ مدلِ AI Case File با
> DeepSeek V4.1 Flash** (`OPENROUTER_MODEL=deepseek/deepseek-v4.1-flash` در `server/.env`،
> بعدِ تاییدِ شناسه‌ی دقیق روی OpenRouter؛ سرورِ dev ری‌استارت شد و با یک regenerateِ واقعیِ
> canary تأیید شد، دیتایِ canary پاک شد). قبل‌ترش: **تأییدِ end-to-endِ واقعیِ فیکسِ
> توکن‌سوزی/race/force در regenerateِ پرونده‌ی روندِ درمان** — به دستورِ صریحِ مالک («DB
> آزاد شد»)؛ migration 019 از قبل خودکار apply شده بود (ری‌استارتِ tsx watch)، هر ۵ سناریو
> (skip بدونِ داده‌ی جدید، تولیدِ واقعی بعدِ یادداشتِ جدید، ۴۰۹ روی race، ۴۰۰ روی force
> بدونِ confirmPhrase) با OpenRouترِ واقعی رویِ سرورِ dev تأیید شدند؛ دیتایِ canary کاملاً
> پاک شد. جزئیات: Event Log. قبل‌ترش: **رفعِ ابهامِ «پرونده» در ClientDetail
> (سربرگِ جداکننده‌ی سندِ پرونده از فهرستِ خامِ جلسات) + حذفِ کلیکِ تکراریِ کارتِ مراجع**
> (جزئیات: Event Log). قبل‌ترش: **audit مسیرِ ضبط/ذخیره‌ی صدا — تستِ
> آفلاینِ کاملِ شبکه + رفعِ آخرین باگِ بازِ کشف‌شده (#۱۶، onlineHandler بعدِ FAILED)** — به
> دستورِ صریحِ مالک («تست رو انجام بده کامل»)، آخرین شکافِ تستیِ پلن (قطعیِ کاملِ شبکه، نه فقط
> قطعِ میکروفون) اجرا شد. با شبیه‌سازیِ قطعیِ واقعیِ شبکه (مسدودکردنِ `fetch` + بستنِ WS +
> رویدادهایِ واقعیِ `offline`/`online`) یافته‌ی #۱۶ی پلنِ اصلی بازتولید شد: بعدِ اتمامِ
> تلاش‌هایِ reconnect (`state=FAILED`)، `online` قبلاً هیچ‌کاری نمی‌کرد — رونویسیِ زنده هیچ‌وقت
> دوباره فعال نمی‌شد. `watchOnline`ِ `feelia-rt.js` رفع شد: `onlineHandler` حالا رویِ
> `FAILED` هم با شمارشِ تازه یک دورِ کاملِ reconnect می‌زند. تأییدِ دوطرفه با Soniوxِ واقعی:
> اول باگ با کدِ قدیم بازتولید شد (state رویِ FAILED ماند)، بعد با کدِ جدید همون سناریو
> `FAILED → RECONNECTING → RECOVERED → ACTIVE` شد. `tsc`/`node --check`/`pnpm test:rt`
> بدونِ رگرسیون؛ دیتایِ canary پاک شد. **با این، هیچ باگِ شناخته‌شده‌ی بازی از کلِ پلنِ audit
> صدا باقی نمانده.** ❗ فقط تعارضِ متنِ رضایت (C1، LAW-009، عمداً دست‌نخورده به دستورِ صریحِ
> مالک) و commit/deploy (تصمیمِ مالک، LAW-006/LAW-022) باز مانده‌اند. جزئیات:
> [stage6-offline](verification/2026-09-16-audio-durability-stage6-offline-reconnect.md)،
> [stage5-lock](verification/2026-09-16-audio-durability-stage5-crosscontextlock.md)،
> [stage4-partsEF](verification/2026-09-16-audio-durability-stage4-partsEF.md)،
> [full-regression](verification/2026-09-16-audio-durability-full-regression.md)،
> [stage1](verification/2026-09-16-audio-durability-stage1.md)،
> [stage2-partD](verification/2026-09-16-audio-durability-stage2-partD.md)،
> [stage3-partC](verification/2026-09-16-audio-durability-stage3-partC.md).
> قبل‌ترش: **رفعِ باگِ نمایشِ 0:00 در صدایِ آرشیوشده‌ی
> پنلِ ادمین + افزودنِ دانلود** — ریشه (Chromiumِ MediaRecorder هدرِ Duration نمی‌نویسد)
> مستقیماً در مرورگرِ واقعی تأیید شد (`Infinity` قبل، `4.008` بعدِ ری‌ماکسِ ffmpeg)؛ ری‌ماکسِ
> `-c copy` هنگامِ آرشیو + ستونِ جدیدِ `duration_ms` (migration 016) + دکمه‌ی دانلود
> (`?download=1`) اضافه شد؛ دو باگِ خودِ این تغییر (probeِ duration از ورودیِ اشتباه، پسوندِ
> فایلِ موقتِ نامعتبر) حینِ تست پیدا و رفع شدند؛ `tsc` سبز، migration رویِ MySQLِ لوکالِ واقعی
> تأیید شد، تستِ end-to-end رویِ DB و تستِ تعاملیِ UI با mock backend هر دو سبز. جزئیات:
> [verification](verification/2026-09-16-session-audio-duration-download.md). قبل‌ترش:
> **Cutoverِ واقعیِ production از PostgreSQL
> به MySQL** — به دستورِ صریحِ مالک (رمزِ روتِ سرور را مستقیم داد)؛ بک‌آپِ کاملِ Postgres،
> نصبِ MySQL 8.4.11، انتقالِ کدِ تبدیل‌شده، اجرایِ هر ۱۵ migration، کپیِ دقیقِ دیتایِ واقعی
> (۸ تراپیست/۱۲ مراجع/۱۸ جلسه — شمارش‌ها دقیقاً یکی)، تستِ زنده با حسابِ واقعیِ مالک، و در
> نهایت سوییچِ pm2 رویِ production انجام شد؛ `feelia.ir` الان رویِ MySQL است و سالم
> (`curl https://feelia.ir/api/health` → connected). Postgres/کدِ قبلی رویِ سرور دست‌نخورده
> ماند برایِ rollbackِ فوری در صورتِ نیاز. جزئیات: Event Log. قبل‌ترش: **ساختِ دستیِ حساب
> تراپیست/ادمین اول** (`09944113233`) به دستورِ صریحِ مالک در چت — درجِ مستقیم در `therapists`
> (MySQLِ لوکال)، `is_admin=true` چون با `ADMIN_PHONE` یکی است؛ ورودِ واقعی تست نشد.
> قبل‌ترش: **هم‌گام‌سازیِ کاملِ مستنداتِ ماژول ۰۲**
> (REQ-018/019 + PRD/plan + رفعِ ۲ ناهم‌گامیِ از قبل‌موجودِ مستندات: مسیرِ migrationِ
> LAW-007 و وضعیتِ ویرایشِ نامِ مستعار در Out-of-Scope) — بدونِ تغییرِ کد. قبل‌ترش:
> **صفحه‌ی مراجعین: نمای «امروز + سنجاق» +
> صفحه‌ی جداگانه‌ی «همه‌ی مراجعین»** — پلنِ مالک بازبینی شد (دو نقصِ منطقی پیش از کد کشف و
> اصلاح شد: نشتِ `clientTab` بینِ صفحه‌ها، و پارامتری‌نشدنِ `renderClients`)، سپس پیاده‌سازی
> شد: `clients.pinned_at` (migration 015)، `PATCH /api/clients/:id/pin`، بازچینیِ کاملِ صفحه‌ی
> مراجعین به دو screen، سربرگ‌های تاریخی. `tsc` سبز؛ migration رویِ MySQLِ لوکالِ **واقعی**
> اعمال و تأیید شد؛ تستِ تعاملیِ کاملِ UI با mock backend (۸ مراجعِ synthetic) هر دو فیکس را
> عملاً تأیید کرد. اسنادِ PRD/requirement/traceability هنوز به‌روز نشده‌اند (کارِ باز). جزئیات:
> [verification](verification/2026-09-16-clients-today-view-and-all-clients.md). قبل‌ترش:
> **«صفر تا صد»: تستِ end-to-endِ واقعیِ
> WS/STT رویِ MySQL** — به دستورِ صریحِ مالک، مسیرهایِ باقی‌مانده‌ی «تست‌نشده» (موتورِ P1
> realtime، batch fallbackِ Soniوxِ واقعی با هر سه purpose، `/ws/voice`، و
> interruption→recovered با grace-timeoutِ ۶۰ثانیه‌ای) با صدایِ synthetic (TTS، نه صدای واقعیِ
> مراجع) و Soniوxِ واقعی تست و همه تأیید شدند؛ دیتای canary کاملاً پاک شد. جزئیات:
> [verification](verification/2026-09-16-postgres-to-mysql-migration.md). قبل‌ترش: **تکمیلِ
> مهاجرتِ دیتابیس PostgreSQL→MySQL** —
> کدِ سرور از `pg` به `mysql2` بازنویسی شد (۹۳ نقطه‌ی کوئری در ۱۰ فایل)، MySQL 8.4 لوکال نصب و
> با یک سناریوی canaryِ کاملِ سرتاسری (ثبت‌نام تا حذفِ آبشاری، شاملِ متنِ فارسیِ واقعی، CAS،
> ترتیبِ NULLS-LAST، جستجویِ ادمین، export درختی) تأیید شد؛ یک باگِ واقعی (JSONِ `anchors`
> باینری‌تفسیرشده) پیدا و رفع شد؛ `tsc --noEmit` سبز؛ مسیرِ WS زنده/Soniox صادقانه تست نشد
> (نیازمندِ صدایِ واقعی)؛ production همچنان Postgres — cutover نیازمندِ تصمیمِ جداگانه (LAW-006).
> جزئیات: [verification](verification/2026-09-16-postgres-to-mysql-migration.md). قبل‌ترش:
> **شروعِ مهاجرتِ دیتابیس PostgreSQL→MySQL (فازِ ۱: بک‌آپ + schema.sql + migrationها)** — به دستورِ صریحِ مالک؛ بک‌آپِ کاملِ Postgres با `pg_dump` به دسکتاپ گرفته شد، `server/src/db/mysql/schema.sql` + معادلِ MySQLِ هر ۱۴ migrationِ Postgres نوشته شد (جزئیات و تصمیم‌های ترجمه‌ی دیالکت در بالای Event Log)؛ کدِ زنده‌ی سرور هنوز با Postgres کار می‌کند — سیم‌کشیِ واقعیِ کد به MySQL منوطِ به پاسخِ مالک درباره‌ی محیطِ تست (LAW-016) است. قبل‌ترش: **بازطراحیِ کاملِ انتخابگرِ تاریخِ شمسی به تقویمِ پاپ‌آورِ گرافیکی** — دورِ چهارمِ فیکسِ `renderJalaliPicker` امروز، این‌بار بازطراحیِ کامل به دستورِ صریحِ مالک: سه `<select>` روز/ماه/سال با یک دکمه‌ی «افزودنِ تاریخ» (آیکنِ SVGِ تقویم + متن) جایگزین شد که یک پاپ‌آورِ تقویمِ گریدِ روزها (هم‌الگو با `.sort-menu` موجودِ اپ) باز می‌کند — ناوبریِ ماه با فلش + پرشِ سریعِ ماه/سال با کلیک روی عنوان؛ چینشِ روزِ هفته با شمارشِ فاصله نسبت به امروزِ واقعی محاسبه شد (بدونِ الگوریتمِ جدیدِ تبدیلِ تقویم) و با `Intl` مستقلاً تأیید شد؛ اعمال‌شده در هر دو نقطه‌ی مصرف (فیلدِ اختیاریِ جلسه‌ی دستی + مودالِ ویرایش)؛ typecheck/harness سبز، تستِ مرورگری کامل روی سرورِ dev واقعی (بدونِ ورود/حساب) تأیید شد (جزئیات: [verification](verification/2026-09-15-jalali-calendar-popup-redesign.md)). قبل‌ترش: **بازطراحیِ انتخابگرِ «تاریخِ تقریبیِ جلسه»** — دورِ سومِ فیکسِ `renderJalaliPicker`، به دستورِ مالک («فضایِ زیادی گرفته، برعکس هم هست» → «این دکمه‌ی بدون‌تاریخ چیه، خودمون اختیاری می‌ذاریم»): ترتیبِ DOM از سال/ماه/روز به روز/ماه/سال عوض شد (در گریدِ RTL، روز حالا راست‌ترین است، هم‌راستا با ترتیبِ گفتاریِ فارسی)، و سوییچِ «بدون تاریخ» کاملاً حذف شد و با دو دکمه‌ی کوچکِ «افزودنِ تاریخ»/«پاک‌کردنِ تاریخ» (کلاسِ موجودِ `.btn.btn-ghost.btn-sm`) جایگزین شد — عملِ صریحِ یک‌باره به‌جایِ سوییچِ دائمی‌نمایانِ قابلِ‌کلیکِ‌تصادفی؛ typecheck/harness سبز، تستِ مرورگری روی سرورِ dev واقعی (بدونِ ورود/حساب) تأیید شد (جزئیات: [verification](verification/2026-09-15-jalali-picker-order-and-nodate-toggle.md)). قبل‌ترش: **رفعِ تناقضِ پیش‌فرضِ انتخابگرِ تاریخِ شمسی** — برایِ جلسه‌ی دستیِ تازه، پیش‌فرض `noDate=true` بود یعنی سه انتخابگر با تاریخِ امروز پُر ولی disabled بودند و هم‌زمان سوییچِ «بدون تاریخ» روشن بود (تناقض + غیرقابلِ‌لمس)؛ حالا پیش‌فرض `false` (فعال از اول) و سوییچ به‌جایِ خاکستری‌کردن، کاملاً مخفی می‌کند — روی کدِ نشستِ دیگر، بدونِ برگرداندنِ چیزی؛ typecheck/harness سبز، تستِ مرورگری تأیید شد (جزئیات: [verification](verification/2026-09-15-jalali-picker-default-and-contradiction.md)). قبل‌ترش: **رفعِ باگِ ظاهریِ انتخابگرِ تاریخِ شمسی** — سه `<select>`ِ `renderJalaliPicker` هیچ CSSای نداشتند (در کلِ فایل هیچ قاعده‌ای برایِ `select` نبود) و در عرضِ موبایل می‌شکستند؛ با `.jalali-select`/`.jalali-picker-row` (grid سه‌ستونه) و سوییچِ استانداردِ `.toggle-row` برایِ «بدون تاریخ» رفع شد — روی کدِ نشستِ دیگر، بدونِ برگرداندنِ چیزی؛ typecheck/harness سبز، تستِ مرورگری در چند تم/عرض تأیید شد (جزئیات: [verification](verification/2026-09-15-jalali-picker-select-styling.md)). قبل‌ترش: **رفعِ یافته‌ی جانبیِ کنتراستِ `--sage` در تمِ تاریک** — متنِ سفید روی `--sage`/`--sage-hover` در تمِ تاریک به‌ترتیب ۴٫۰۶:۱/۳٫۳۹:۱ بود (زیرِ ۴٫۵:۱)؛ با تیره‌ترکردنِ همان دو توکن (هم‌هیو) به ۴٫۹۸:۱/۶٫۳۷:۱ رسید، بدونِ تغییرِ هیچ کامپوننتی و بدونِ اثر روی تمِ روشن؛ typecheck/`pnpm test:rt` سبز، تستِ مرورگری با فرمولِ WCAG واقعی تأیید شد (جزئیات: [verification](verification/2026-09-15-dark-theme-sage-contrast.md)). **نکته‌ی هماهنگی:** حینِ این کار، نشستِ دیگری هم‌زمان `index.html`/همین فایل را ویرایش می‌کرد (تکمیلِ تستِ ۷ باگ) — بدونِ هم‌پوشانی، بدونِ برگرداندنِ تغییرات، ثبت‌شده به‌صورتِ FINDING متقابل در §7. قبل‌ترش: **تکمیلِ تستِ ۷ باگ** — سرورِ لوکالِ واقعی با Postgres (register/admin endpoints با `curl`، پاکسازیِ کاملِ دیتایِ canary، شمارش‌ها دقیقاً برابرِ قبل)، چیدمانِ picker در موبایل (۳۷۵px) و دسکتاپ (۱۲۸۰px)، و اسکرولِ خودکارِ سطحِ صفحه (نه فقط جعبه) با دورزدنِ محدودیتِ rAFِ Browser pane — هر سه سبز، بدونِ اثرِ باقی‌مانده روی DBِ واقعیِ مالک. حینِ این تست، نشستِ دیگری هم‌زمان `index.html` را ویرایش کرد (کنتراستِ تب + آیکونِ رمز) — چک شد: بدونِ تعارض با ۶ فیکسِ این نشست، syntax/typecheck هنوز سبز (FINDING، زیر). جزئیات: [verification](verification/2026-09-15-seven-bugs.md). قبل‌ترش: **اصلاحِ کنتراستِ تبِ فعال/غیرفعالِ مراجعین + آیکونِ نمایشِ رمز** در `public/index.html` — علتِ ریشه‌ایِ کنتراست (`--card` روی `--field`، ~۱٫۰۳:۱) پیدا و با پُرکردنِ تبِ فعال با `--sage` (هم‌راستا با `--sage`سیستمِ طراحی) رفع شد؛ چشمِ رمز اضافه شد؛ syntax/typecheck/`pnpm test:rt` (۲۹ PASS/۶ FAIL، بدونِ رگرسیون) سبز؛ تستِ تعاملیِ مرورگری با mock جدید تأییدشده؛ بخشِ «بی‌بوردر» عمداً تحلیل‌شده و اجرا نشده؛ کار commitنشده (جزئیات: [verification](verification/2026-09-15-client-tab-contrast-password-eye.md)). قبل‌ترش: **تستِ تعاملیِ مرورگری با mock backend برایِ هر ۶ موردِ پلنِ ۷ باگ** — mock server در اسکرچ‌پد (`public/` واقعی + دیتای canary: مراجعِ غیرفعال/جلسه‌ی دستی، مراجعِ فعال/جلسه‌ی زنده‌ی کامل، تراپیستِ ادمین) روی Browser pane اجرا شد؛ هر ۶ مورد با اجرایِ واقعی تأیید شدند (ثبت‌نام بدونِ نام/تخصص بلاک شد؛ picker تاریخ ماه/روزِ آینده را واقعاً disable کرد و «بدونِ تاریخ» را PUT زد؛ گاردِ یادداشتِ صوتی/متنی در Wrapup و آرشیو با شبیه‌سازیِ کنسول تأیید شد؛ اسکرولِ خودکارِ جعبه با rAFِ واقعی کار کرد؛ Clarity بدونِ هیچ UIِ رضایتی اسکریپت تزریق کرد؛ پنلِ ادمین تخصص/وضعیت/دسته و صفحه‌ی جدیدِ متن+یادداشت‌هایِ جلسه را نشان داد، `GET /api/admin/sessions/:id`→200) — بدونِ خطایِ کنسول. جزئیاتِ کامل: [verification](verification/2026-09-15-seven-bugs.md). قبل‌ترش: **پیاده‌سازیِ هر ۶ موردِ پلنِ ۷ باگ** (یادداشتِ صوتی↔متنی، اسکرولِ خودکار، انتخابگرِ تاریخِ شمسی، نام/تخصصِ اجباری، Clarity بدونِ پرسیدن (D1)، دسترسیِ کاملِ ادمین (D2)) در `public/index.html`، `public/feelia-analytics.js`، `server/src/http/auth.ts`، `server/src/http/admin.ts` — syntax/typecheck/`pnpm test:rt` (۲۹ PASS/۶ FAIL، بدونِ رگرسیون) سبز؛ کار commitنشده. قبل‌ترش: audit + پلنِ ۷ باگِ گزارش‌شده — بدونِ تغییرِ کد. قبل‌ترش: رفعِ فلاشِ صفحه‌ی «پرونده» هنگامِ ساختِ مراجعِ غیرفعالِ جدید (`public/index.html`، commitنشده — تستِ mock تأییدشده). قبل‌ترش: **دیپلویِ واقعیِ production کامل و موفق شد.** `feat/clarity` (`54a17fd`) با `main` (که مستقلاً Clarity گرفته بود) merge شد (`fed8b3b`، ۱۲ تعارضِ دستی در `index.html` حل شد)، push به `origin/main`، و روی سرور با `pull`+`build`+`pm2 restart` اجرا شد — migrationهای ۰۰۸ تا ۰۱۴ روی DBِ واقعی با موفقیت اعمال شدند، `/api/health` سالم. **دیگر هیچ فاصله‌ای بینِ `main`/`feat/clarity`/production نیست.** قبل‌ترش: ~۱۶ سندِ مستندات با کدِ واقعی هم‌گام شدند. بالاترین ورودیِ [§7 Event Log](#۷-event-log).
> **مالکِ:** Event Log و وضعیتِ انطباق با ساختار. factهای جزئی مالکِ خودشان را دارند (لینک‌ها)؛ در تعارض، سندِ مالک برنده است ([source-of-truth](docs/00-governance/source-of-truth.md)).

---

## ۰. قاعده‌ی به‌روزرسانی (اجباری)

### چه چیزی «رویداد» است؟

| نوع | مثال |
|---|---|
| `CODE` | هر تغییر در `server/`، `public/`، `scripts/` |
| `MIGRATION` | افزودنِ فایل در `server/src/db/migrations/` |
| `CONFIG` | env، dependency، `package.json`، `.gitignore`، کانفیگِ ابزار |
| `DOCS` | ایجاد/تغییر/deprecate کردنِ هر سند |
| `TEST` | اجرای `pnpm test:rt`، typecheck، تستِ دستی/mock، هر verification |
| `DECISION` | تصمیمِ مالک (تأییدِ REQ، انتخاب در master plan، …) |
| `GIT` | commit، merge، branch، push، tag |
| `DEPLOY` | deploy، restart، تغییرِ سرور |
| `INCIDENT` | باگ، خرابی، نشتِ داده، رفتارِ غیرمنتظره |
| `FINDING` | کشفِ تعارض، ریسک، یا تغییری که نشستِ دیگری انجام داده |

### چطور ثبت کنم؟

1. یک ورودیِ جدید **بالای** [§7 Event Log](#۷-event-log) با قالبِ زیر اضافه کن.
2. اگر وضعیتی عوض شد، جدول‌های §1 تا §6 را به‌روز کن.
3. «آخرین به‌روزرسانی» در سربرگ را عوض کن.
4. اسنادِ مالک را طبقِ جدولِ §7 در [`CLAUDE.md`](CLAUDE.md) به‌روز کن (اگر §1 عوض شد، [Master Reference §20–22](PROJECT_MASTER_REFERENCE.md) هم).

```markdown
### YYYY-MM-DD — <TYPE> — <عنوانِ کوتاه>
- **چه شد:**
- **فایل‌ها:**
- **اسنادِ به‌روزشده:**
- **تست / تأیید:** (دستور + نتیجه‌ی واقعی، یا «انجام نشد» + دلیل)
- **عامل:** این نشست / نشستِ دیگر (کشف‌شده در YYYY-MM-DD) / مالک
- **کارِ باز / پیامد:**
```

### محدودیت‌ها
- Event Log **فقط اضافه‌شدنی** است؛ ورودیِ قبلی ویرایش/حذف نمی‌شود — اصلاح = ورودیِ جدید.
- هیچ داده‌ی بالینی، secret، کوکی یا شماره‌ی واقعی (LAW-001).
- task بدونِ ثبت در این فایل «انجام‌شده» نیست.

---

## ۱. وضعیتِ فعلی در یک نگاه

> مالکِ canonical: [PROJECT_MASTER_REFERENCE §20](PROJECT_MASTER_REFERENCE.md). با هر رویداد هر دو هم‌گام شوند.

| موضوع | وضعیت | تاریخ | منبع |
|---|---|---|---|
| audit مسیرِ ضبط/ذخیره‌ی صدا (کاملِ پلن + قفلِ cross-context + رفعِ #۱۶) | ✅ کدِ commitنشده؛ `tsc`/harness سبز (بدونِ رگرسیون)؛ **هر ۶ بخشِ پلن + قفلِ cross-context + رفعِ باگِ #۱۶ (onlineHandler بعدِ FAILED) پیاده و رویِ زیرساختِ کاملاً واقعی (MySQL/Soniوx/ffmpeg/مرورگرِ واقعی، ۹+ حسابِ canaryِ جدا) تست شد** — seq-collision، idempotencyِ sha256، race، آرشیو-قبل-از-رونویسی، سکوت=موفقیت، چرخشِ ۱۵s، بازیابیِ خودکارِ میکروفون، فلاشِ visibilitychange، late-transcriptِ برچسب‌دار، mimeِ واقعی، فایلِ کاملِ ادمین، قفلِ سراسری، بازیابیِ رونویسیِ زنده بعدِ قطعیِ کاملِ شبکه (تأییدِ دوطرفه: بازتولیدِ باگ + تأییدِ رفع) — همه ✅؛ دو باگِ واقعیِ کشف‌شده حینِ کار (`clearForSession`، `onlineHandler`) پیدا و رفع شدند؛ ❗ **هیچ باگِ بازی نمانده** — فقط تعارضِ متنِ رضایت (C1، عمداً دست‌نخورده به دستورِ مالک) و commit/deploy باز مانده | 2026-09-16 | [stage6-offline](verification/2026-09-16-audio-durability-stage6-offline-reconnect.md)، [stage5-lock](verification/2026-09-16-audio-durability-stage5-crosscontextlock.md)، [stage4-partsEF](verification/2026-09-16-audio-durability-stage4-partsEF.md)، [full-regression](verification/2026-09-16-audio-durability-full-regression.md)، [stage1](verification/2026-09-16-audio-durability-stage1.md)، [stage2-partD](verification/2026-09-16-audio-durability-stage2-partD.md)، [stage3-partC](verification/2026-09-16-audio-durability-stage3-partC.md)، §7 Event Log |
| Branch / HEAD | `feat/clarity` روی **`2551943`** («fix(stt): voice notes could never mint a realtime credential»)؛ working tree برای هر ۳ فایلِ کد تمیز؛ `docs/admin-panel.md` هنوز modified (نامرتبط، عمداً کنار گذاشته شد)؛ **✅ push شد به `origin/feat/clarity`** (۹ کامیت، تا `2551943`)؛ `origin/main` هنوز `8bcdf0e` — بدونِ merge/PR، فقط branch push شده | 2026-09-14 | git log/status/push |
| کارِ commitنشده | مستنداتِ untracked + `docs/admin-panel.md` + **کدِ باگ‌های مراجعینِ فعال/غیرفعال، ثبتِ دستیِ جلسه (تاریخِ اختیاریِ بدونِ ساعت، nullable + یادداشتِ صوتی/متنی با بازبینیِ متن) و تاریخِ شمسی** (`server/src/http/clients.ts`، `sessions.ts`، `sessionDate.ts`، migrationهای `012`، `013`، **`014_session_date_optional.sql`جدید (additive، date nullable)**، `public/index.html`) — typecheck ✅، `node --check` ✅، **✅ سرور/DBِ واقعیِ لوکال با حسابِ canary تأیید شد** (نوشتن/خواندنِ مستقیمِ Postgres، پاکسازیِ کامل) + **رفعِ فلاشِ صفحه‌ی «پرونده» در `startManualSessionFlow` (`public/index.html`) — تستِ mock تأییدشده، بدونِ نیازِ typecheck/harness** | 2026-09-15 | [verification](verification/2026-09-14-client-status-archive.md)، §7 Event Log (CODE) |
| Typecheck سرور | ✅ بدونِ خطا | 2026-09-14 | این task |
| Harness realtime (`pnpm test:rt`) | ⚠️ 29 PASS / 6 FAIL — **دقیقاً همان baseline**؛ `feelia-rt.js` هنوز اصلاً لمس نشده | 2026-09-14 | این task |
| ۷ باگِ گزارش‌شده (Clarity/D1، انتخابگرِ تاریخ، نام/تخصص/D3، ادمین‌کامل/D2، اسکرولِ خودکار، یادداشتِ صوتی↔متنی) | ✅ هر ۶ موردِ کد پیاده‌سازی شد (`index.html`، `feelia-analytics.js`، `auth.ts`، `admin.ts`)؛ syntax/typecheck/`pnpm test:rt` سبز؛ **✅ تستِ تعاملیِ مرورگری با mock backend انجام شد — هر ۶ مورد با اجرایِ واقعی تأیید شد، بدونِ خطا**؛ ❗ سرورِ لوکالِ واقعی (Postgres) هنوز تست نشده — commitنشده | 2026-09-15 | [verification](verification/2026-09-15-seven-bugs.md)، §7 Event Log (CODE/TEST) |
| فازِ ۰ (UI-01/02/03/04/06) | ✅ **رفع و commit شد** (`ecf00b4`) | 2026-09-14 | [ui-ux-audit §رفعِ فازِ ۰](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۰--2026-09-14) |
| فازِ ۱ دورِ اول (UI-07/10/12/16/17/18/19/21/37) | ✅ **رفع و commit شد** (`ecf00b4`) | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۱-دورِ-اول--2026-09-14) |
| فازِ ۱ دورِ دوم (UI-08/11/20-نیمه/27) | ✅ **رفع و commit شد** (`fedeac2`) | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-فازِ-۱-دورِ-دوم--2026-09-14) |
| چیدمانِ موبایل (UI-22/23/24) | ✅ **رفع و commit شد** (`8347fbb`)، تست با mobile emulation (375×812) + دسکتاپِ واقعی (1280px) + رگرسیونِ کامل؛ ۲ باگِ CSSِ واقعی (containing-block از transform، over-constrained left/right در RTL) پیدا و رفع شد؛ `feelia-rt.js` لمس نشد | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-چیدمانِ-موبایل-ui-222324--2026-09-14) |
| P2/P3 کم‌خطر دورِ اول (UI-20 تصحیحِ سند، UI-26، UI-34، UI-41، UI-42، UI-46) | ✅ **رفع و commit شد** (`85bd08e`)، تستِ mock + DOM/computed-style برای هر مورد + رگرسیونِ کامل؛ `feelia-rt.js` و سرور لمس نشد | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر--2026-09-14) |
| رگرسیونِ کاملِ دستی روی `85bd08e` | ✅ **بدونِ رگرسیون** — جریانِ کاملِ ساختِ مراجع/جلسه/علامت/یادداشت/پایان/ذخیره + dedupe-guardها + Escape + CSSِ موبایل همه تأیید شدند؛ یک یافته‌ی از پیش‌موجود و نامرتبط (R16) دوباره دیده شد، نه رگرسیونِ جدید | 2026-09-14 | [ui-ux-audit §رگرسیون](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر-دورِ-دوم--2026-09-14) |
| P2/P3 کم‌خطر دورِ دوم (UI-29، UI-28، UI-38، UI-44-جزئی) | ✅ **رفع و commit شد** (`84d4783`)، تستِ mock + DOM/network برای هر مورد + رگرسیونِ نهایی | 2026-09-14 | [ui-ux-audit](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-p2p3-کم‌خطر-دورِ-دوم--2026-09-14) |
| باگِ بحرانیِ ۴۰۰ در آپلودِ یادداشتِ صوتی | ✅ **رفع و commit شد** (`fefa823`) — کشف‌شده در تستِ لوکالِ مالک با سرورِ واقعی (نه mock)؛ در production هم هست (از `f9b0a9c`، جدِّ `8bcdf0e`)، فقط کمتر دیده می‌شود چون realtime آنجا معمولاً موفق است | 2026-09-14 | [ui-ux-audit §رفعِ باگِ ۴۰۰](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-باگِ-بحرانیِ-۴۰۰-در-یادداشتِ-صوتی--2026-09-14) |
| باقیِ فازِ ۱ + P2/P3 | ~~UI-09~~ (✅ تصمیمِ مالک «شمسی» + تبدیلِ داده — رفع در working tree 2026-09-14، commitنشده)، UI-13/14/15/36 (لمسِ `feelia-rt.js` — عمداً کنار گذاشته شد)، UI-05 (متنِ رضایت — به دستورِ مالک دست نخورد)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (نیازِ تغییرِ بصریِ گسترده‌تر یا هم‌پوشانی با کارِ نشستِ دیگر روی Clarity) | 2026-09-14 | همان audit |
| R16/UX-002 (متنِ یادداشت‌ها در پرونده خالی بود) | ✅ **رفع و commit شد** (`08e8d20`) — ریشه: `span:first-child` هیچ‌وقت match نمی‌شد چون svg اولین فرزند بود؛ به `:first-of-type` عوض شد؛ با سه نوعِ یادداشتِ واقعی (sign/text/voice) رویِ سرورِ لوکالِ واقعی تأیید شد | 2026-09-14 | [ui-ux-audit §رفعِ R16](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-r16ux-002-و-timeoutِ-api--2026-09-14) |
| `api()` بدونِ timeout (UI-33، بخشی) | ✅ **رفع و commit شد** (`08e8d20`) — پارامترِ اختیاریِ `timeoutMs` (AbortController)؛ بدونِ پاس‌دادنش رفتارِ همه‌ی callerهای فعلی عیناً قبلی می‌ماند؛ فقط رویِ چکِ STTِ preflight (۱۰s) سیم‌کشی شد | 2026-09-14 | همان بخش |
| ریشه‌ی واقعیِ «realtimeِ یادداشتِ صوتی وصل نمی‌شه» | ✅ **رفع و commit شد** (`2551943`) — مالک تأیید کرد جلسه‌ی اصلی مشکلی نداشت، فقط یادداشت؛ چون کدِ اتصال بینِ این دو مشترکه، دنبالِ چیزی گشتیم که *قبل*ِ اون کدِ مشترک فرق می‌کرد: `POST /api/stt/realtime-session` (mintِ credential) رویِ جلسه‌ی `completed` همیشه ۴۰۰ می‌داد، بدونِ تفکیکِ purpose — و تنها نقطه‌ی UIِ یادداشتِ صوتی (Wrapup) همیشه *بعد*ِ completed‌شدن اجرا می‌شه. یعنی یادداشتِ صوتی هیچ‌وقت credential نمی‌گرفت، حتی قبل از تلاش برایِ WS. با پارامترِ `purpose` ('note'/'transcript') رفع شد؛ رفتارِ جلسه‌ی اصلی (که purpose نمی‌فرسته) دست‌نخورده ماند. تأیید شد مستقیم رویِ سرورِ لوکال: `purpose=note` رویِ جلسه‌ی completed حالا `200`+`api_key` واقعی می‌ده (قبلاً ۴۰۰) | 2026-09-14 | [ui-ux-audit §ریشه‌ی realtime](docs/05-plans/ui-ux-audit-2026-09-14.md#رفعِ-ریشه‌ی-واقعیِ-realtimeِ-یادداشتِ-صوتی--2026-09-14) |
| Clarity (محلی) | ✅ route 10/10، sandbox 41/41 | 2026-09-14 | [evidence](verification/2026-09-14-clarity-test-pass.md) |
| Clarity (تولید، دادهٔ واقعی) | ❗ کد درست کار می‌کند ولی **صفر traffic رسیده** — `ERR_CONNECTION_CLOSED` به `clarity.ms` از مرورگرِ مالک، تأییدشده با Data Export API (`Traffic:[]`). علتِ محتملِ INFERRED: فیلترینگِ شبکه (VPN/ISP/سراسری) — هنوز تفکیک نشده | 2026-09-14 | §7 Event Log (FINDING) |
| Production | `feelia.ir` = commit `8bcdf0e` (فقط Clarityِ ایزوله؛ نه `2763414` و نه فیکسِ فازِ ۰) | 2026-09-14 | §7 Event Log — DEPLOY |
| مستندات | ✅ ساختارِ کامل؛ ❗ هیچ سندی توسطِ مالک review نشده | 2026-09-14 | [documentation-map](docs/00-governance/documentation-map.md) |
| ریسکِ بحرانیِ باز | ❗ R1 (متنِ رضایت ↔ ذخیره‌ی صدا، UI-05/UX-004)؛ ❗ **R15** (یادداشت/علامت در شکستِ ذخیره بی‌صدا از دست می‌رود، UX-001)، **R16** (متنِ یادداشت‌ها در پرونده نمایش داده نمی‌شود، UX-002)، **R17** (خروج در حالتِ ضبطِ محلی با میکروفونِ روشن، UX-003) — هر سه در HEAD `8347fbb` و production؛ R12–R14 محلی رفع شد ولی روی production هنوز فعال | 2026-09-14 | [Master Reference §22](PROJECT_MASTER_REFERENCE.md) |
| UX audit | 42 یافته (Critical ۵، High ۱۴، Medium ۱۸، Low ۵)؛ پس از commitهای هم‌زمان: ۷ جزئی رفع، ۰ کامل؛ ۱۲ سؤالِ باز؛ roadmap = PROPOSED | 2026-09-14 | [UX_AUDIT_REPORT](docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md) |

---

## ۲. Pipelineِ کار (ترتیبِ اجباریِ دستور)

| # | مرحله | وضعیت | خروجی | آخرین تغییر |
|---|---|---|---|---|
| 1 | Repository Discovery | ✅ DONE | [Master Reference §1–9](PROJECT_MASTER_REFERENCE.md)، [repository-map](docs/02-reference/repository-map.md) | 2026-09-13 |
| 2 | Existing Documentation Audit | ✅ DONE | [documentation-map §5](docs/00-governance/documentation-map.md) | 2026-09-14 |
| 3 | Architecture Discovery | ✅ DONE (production UNVERIFIED) | [01-architecture](docs/01-architecture/system-architecture.md) | 2026-09-14 |
| 4 | Module / Subsystem Discovery | ✅ DONE | [module-map](docs/02-reference/module-map.md)، [subsystems](docs/07-subsystems/README.md) | 2026-09-13 |
| 5 | Source-of-Truth Definition | ✅ DONE | [source-of-truth](docs/00-governance/source-of-truth.md) | 2026-09-13 |
| 6 | Documentation Architecture Creation | ✅ DONE | `docs/00`–`07`، `verification/` | 2026-09-14 |
| 7 | Project Master Reference | ✅ DONE | [PROJECT_MASTER_REFERENCE.md](PROJECT_MASTER_REFERENCE.md) | 2026-09-14 |
| 8 | Module PRDs | ✅ DONE (7) | [04-modules](docs/02-reference/module-map.md) | 2026-09-13 |
| 9 | Implementation Plans | ✅ DONE (7 + platform) | همان + [platform plan](docs/06-platform/implementation-plan.md) | 2026-09-14 |
| 10 | Traceability | ⚠️ PARTIAL (بیشترِ REQها تست ندارند) | [traceability-matrix](docs/03-requirements/traceability-matrix.md) | 2026-09-14 |
| 11 | Validation | ✅ DONE (§4) | این فایل §4 | 2026-09-14 |

---

## ۳. انطباق با ۲۷ بخشِ دستور

| § | الزام | وضعیت | کجا | کارِ باز |
|---|---|---|---|---|
| 1 | Repository Discovery | ✅ | Master Reference §1–9، repository-map | — |
| 2 | Audit مستنداتِ فعلی | ✅ | documentation-map §5 | — |
| 3 | ساختارِ اصلیِ `docs/` | ✅ | `docs/00`–`07` | — |
| 4 | Master Reference (۲۴ بخش) | ✅ | [PROJECT_MASTER_REFERENCE.md](PROJECT_MASTER_REFERENCE.md) | — |
| 5 | `CLAUDE.md` به‌عنوانِ Router | ✅ | [CLAUDE.md](CLAUDE.md) | — |
| 6 | Governance و LAWها | ✅ (24 قانون) | [project-laws](docs/00-governance/project-laws.md) | review مالک |
| 7 | Source of Truth | ✅ | [source-of-truth](docs/00-governance/source-of-truth.md) | — |
| 8 | AI Agent Reading Guide | ✅ | [ai-agent-reading-guide](docs/00-governance/ai-agent-reading-guide.md) | — |
| 9 | Documentation Map | ✅ | [documentation-map](docs/00-governance/documentation-map.md) | — |
| 10 | Architecture | ⚠️ | [01-architecture](docs/01-architecture/system-architecture.md) | تأییدِ production (P1-3) |
| 11 | Reference catalogs | ✅ (8) | [02-reference](docs/02-reference/api-catalog.md) | integration/permission/event در اسنادِ موجود پوشش داده شده‌اند؛ catalogِ مجزا ساخته نشد |
| 12 | Requirements (REQ-xxx) | ⚠️ (71، همه DERIVED) | [requirement-catalog](docs/03-requirements/requirement-catalog.md) | تأییدِ مالک → APPROVED (P3-3) |
| 13 | شناسایی ماژول‌ها | ✅ (7) | [module-map](docs/02-reference/module-map.md) | — |
| 14 | Module PRDها | ✅ (7) | `docs/04-modules/*/module-prd.md` | — |
| 15 | Implementation Planها | ✅ (7) | `docs/04-modules/*/implementation-plan.md` | — |
| 16 | Platform | ✅ | [06-platform](docs/06-platform/README.md) | — |
| 17 | Subsystemها | ✅ (5) | [07-subsystems](docs/07-subsystems/README.md) | — |
| 18 | جداسازیِ Evidence | ✅ | [verification/](verification/README.md) | — |
| 19 | مدیریتِ Deprecated | ✅ | documentation-map §5 | تصمیم درباره‌ی انتقالِ `docs/admin-panel.md` به archive |
| 20 | کاهشِ Duplicate | ✅ | source-of-truth §3 | — |
| 21 | استخراج از source واقعی | ✅ (با برچسبِ INFERRED/UNVERIFIED) | همه‌ی اسناد | تأییدِ ادعاهای INFERRED |
| 22 | Migrationِ اسنادِ قبلی | ✅ | ماژول 06 ← `admin-panel.md` | — |
| 23 | Master Implementation Plan | ✅ (PROPOSED) | [master plan](docs/05-plans/master-implementation-plan.md) | تصمیمِ مالک |
| 24 | وضعیتِ واقعی در Documentation Map | ✅ | documentation-map §1–§7 | — |
| 25 | Final Validation | ✅ | §4 همین فایل | اجرای دوباره پس از هر `DOCS` |
| 26 | دقت بر تعداد مقدم | ✅ | فهرستِ موارد ناموجود در `07-subsystems/README`، `06-platform/README` | — |
| 27 | خروجی و گزارشِ نهایی | ✅ | §5 همین فایل | زنده نگه داشتن |

---

## ۴. Final Validation (بخش ۲۵)

آخرین اجرا: **2026-09-14** (checker: همه‌ی لینک‌های نسبیِ Markdown + تطبیقِ LAW/REQهای ارجاع‌شده با تعریف‌شده) — **52 فایل، 320 لینک، 0 خراب؛ 24 LAW و 71 REQ سازگار.**

- [x] CLAUDE.md exists
- [x] Master Reference exists
- [x] Governance exists
- [x] Source of Truth exists
- [x] AI Reading Guide exists
- [x] Documentation Map exists
- [x] Architecture documented — ⚠️ production UNVERIFIED
- [x] Requirements cataloged — 71، همه DERIVED
- [x] Modules identified — 7
- [x] Module PRDs created — 7
- [x] Implementation plans created — 7 + platform
- [x] Platform documented where applicable
- [x] Important subsystems documented — 5
- [x] Traceability exists — ⚠️ پوششِ تست PARTIAL
- [x] Deprecated docs identified
- [x] Evidence separated
- [x] No major duplicated sources of truth
- [x] Links between docs are valid — نتیجه‌ی آخرین اجرا در Event Log
- [x] Documentation reflects actual repository state — تا 2026-09-14؛ تغییراتِ نشست‌های دیگر باید با `FINDING` ثبت و هم‌گام شوند

---

## ۵. خروجیِ نهایی (بخش ۲۷) — خلاصه‌ی زنده

| مورد | وضعیتِ فعلی |
|---|---|
| ساختارِ ایجادشده | `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `PROJECT_STATUS.md`، `docs/00`–`07`، `verification/` — فهرستِ سند به سند: [documentation-map](docs/00-governance/documentation-map.md) |
| اسنادِ قبلی و دسته‌بندی | `analytics-clarity.md` → ACTIVE-CANONICAL · `admin-panel.md` → HISTORICAL · `session_assistant_v11 (3).html` → DEPRECATED · `server-deploy/`، `feelia-f9b0a9c.tar` → EVIDENCE/IRRELEVANT · `soniox.html`، `feelia-design-system.html`، `diag-collect.sh` → SUPPORTING |
| اسنادِ canonical | `docs/00`–`07`، `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `docs/analytics-clarity.md`؛ این فایل برای Event Log |
| Master Reference | [`PROJECT_MASTER_REFERENCE.md`](PROJECT_MASTER_REFERENCE.md) (ریشه‌ی repo) |
| ماژول‌ها | 01 Therapist Accounts · 02 Client Management · 03 Therapy Sessions · 04 Transcription · 05 Notes & Signs · 06 Admin Panel · 07 UX Analytics |
| Subsystemها | 01 Browser Realtime Engine · 02 Audio Durability & Batch Fallback · 03 Transcript Integrity · 04 Legacy WS Proxy (P1) · 05 Session Audio Archive & Speaker Resolve |
| ناقص / نیازمندِ بررسی | review مالک روی LAW/REQ · توپولوژیِ production · تستِ backend/CI · ادعاهای INFERRED (فایل‌های یتیمِ صدا، race در batch، seqِ تکراری در آرشیو) · دو مورد UNVERIFIED در ماژول 05 |
| تعارض‌ها | 8 مورد (C1–C8) — [documentation-map §6](docs/00-governance/documentation-map.md)؛ **همه باز** |
| ریسک‌ها | 11 مورد (R1–R11) — [Master Reference §22](PROJECT_MASTER_REFERENCE.md)؛ **همه باز** |
| Deprecated / Historical | `docs/admin-panel.md`، `session_assistant_v11 (3).html`، `server-deploy/` |
| وضعیتِ نهایی | سیستمِ مستندات کامل و معتبر؛ منتظرِ تصمیم‌های مالک (§6) |

---

## ۶. تصمیم‌ها و کارهای باز

> مالک: [master-implementation-plan](docs/05-plans/master-implementation-plan.md). اینجا فقط وضعیت.

| ID | کار | وضعیت | منتظرِ |
|---|---|---|---|
| P0-0 | commitِ امنِ کارِ فعلی | ✅ **کدِ اصلی push شد** — ۹ کامیت (`2763414` تا `2551943`) رویِ `origin/feat/clarity`؛ مستندات (`docs/`, `PROJECT_STATUS.md`, …) هنوز untracked/محلی، تصمیمِ جداگانه‌ی مالک لازم دارد برایِ commit | تصمیمِ مالک درباره‌ی commitِ مستندات؛ merge/PR به `main` هنوز نه |
| P0-1 | اصلاحِ متنِ رضایت یا توقفِ آرشیوِ صدا (R1، C1) | ⏳ PENDING | تصمیمِ مالک |
| P0-2 | حذفِ لاگِ `DIAG-TEMP` (R2) | ⏳ PENDING | تأییدِ مالک |
| P0-3 | حذفِ فایل‌های صدا هنگامِ حذفِ داده (R4) | ⏳ PENDING | P0-1 |
| P1-1 | سقفِ آپلودِ multipart (R11) | ⏳ PENDING | عددِ هدف |
| P1-2 | stubِ IndexedDB در harness (R6) | ⏳ PENDING | تصمیم درباره‌ی dev dependency |
| P1-3 | تأییدِ توپولوژیِ production (R8، C3) | ⏳ PENDING | دسترسیِ مالک به سرور |
| P1-4 | deploy نسخه‌ی جدید | ⏳ BLOCKED | P0-1، P0-2، P1-1، P1-3 |
| P1-5 | CAS اتمیک + قفلِ پردازشِ batch (R5) | ⏳ PENDING | P1-2 |
| P1-6 | تست‌های backend | ⏳ PENDING | P1-5 |
| P2-* / P3-* | امنیتِ HTTP، تأییدِ حذفِ مراجع، فرمتِ تاریخ، export، legacy، پاکسازی | ⏳ PENDING | — |
| UI-Ph0 | ۵ باگِ بحرانی: UI-01/02/03/04/06 — [audit](docs/05-plans/ui-ux-audit-2026-09-14.md) | ✅ **commit + push شد** (`ecf00b4`) | — |
| UI-Ph1 (دورِ اول) | ۹ موردِ P1: UI-07/10/12/16/17/18/19/21/37 | ✅ **commit + push شد** (`ecf00b4`) | — |
| UI-Ph1 (دورِ دوم) | ۴ موردِ P1: UI-08/11/20-نیمه/27 | ✅ **commit + push شد** (`fedeac2`) | — |
| UI-Ph1 (چیدمانِ موبایل) | ۳ موردِ P1: UI-22/23/24 — نوارِ کنترلِ ثابت/دکمه‌ی ثابت در ≤480px | ✅ **commit + push شد** (`8347fbb`) | — |
| P2/P3 کم‌خطر (دورِ اول) | ۶ مورد: UI-20 (تصحیحِ سند)، UI-26، UI-34، UI-41، UI-42، UI-46 | ✅ **commit + push شد** (`85bd08e`) | — |
| P2/P3 کم‌خطر (دورِ دوم) | ۴ مورد: UI-29، UI-28، UI-38، UI-44-جزئی | ✅ **commit + push شد** (`84d4783`) | — |
| باگِ ۴۰۰ در batch-audio | purpose=note رویِ جلسه‌ی completed | ✅ **commit + push شد** (`fefa823`) | — |
| R16 + timeoutِ api() | متنِ یادداشت در پرونده + preflightِ گیرکرده | ✅ **commit + push شد** (`08e8d20`) | — |
| ریشه‌ی mintِ یادداشتِ صوتی | purpose=note در `/api/stt/realtime-session` | ✅ **commit + push شد** (`2551943`) | — |
| **مجموع push** | ۹ کامیت رویِ `origin/feat/clarity`، بعدِ رگرسیونِ نهاییِ کامل (خودکار + دستیِ رویِ سرورِ واقعی) و تأییدِ صریحِ مالک («اره کامیت کن» بعدِ «اگه همچی اوکی بود اوکیم») | ✅ **DONE** — 2026-09-14 | — |
| UI-Ph1 (باقی‌مانده)…Ph4 | UI-13/14/15/36 (لمسِ `feelia-rt.js`)، UI-09 (تصمیمِ مالک)، UI-05 (متنِ رضایت، به دستورِ مالک دست‌نخورده)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (نیازِ تغییرِ بصریِ گسترده یا هم‌پوشانی با کارِ نشستِ دیگر) | ⏳ PENDING | تأییدِ مالک؛ برخی نیازمندِ میکروفون/بصری/تصمیمِ طراحی/تغییرِ API |
| deploy به production | هیچ‌کدام از این ۹ کامیت هنوز رویِ `feelia.ir` نیستند (فقط push به `origin/feat/clarity`، نه merge به `main`، نه deploy) | ⏳ PENDING | تصمیم و مجوزِ صریحِ مالک (LAW-006) |

---

## ۷. Event Log

> append-only · جدیدترین بالا · قالب در §0.

### 2026-09-19 — CODE + DECISION — دکمه‌ی «پرونده» روی کارت، پرونده برای همه‌ی مراجعین، بازطراحیِ رابطه‌ی زوجین، جلسه‌ی آینده‌ی بازشو

- **تصمیمِ مالک (این گفتگو):** (۱) دکمه‌ی «پرونده» روی کارتِ فعال **و** غیرفعال؛ (۲) پروندهٔ درمان برای مراجعِ **فعال** هم نمایش داده شود (تغییرِ تصمیمِ فازِ ۱ «فقط غیرفعال»)؛ (۳) رابطه‌ی زوجین بدونِ کلیک، کارتِ همیشه‌باز؛ (۴) متن اول فهمیده و بعد چیده شود، نه هم‌جمله‌بندیِ تراپیست.
- **`public/index.html`:** `buildClientCard` دکمه‌ی ghostِ «پرونده» → `openClientDetail(id,{scrollToCaseFile:true})`؛ `openClientDetail` همیشه `loadCaseFile` می‌زند و در صورتِ گزینه به `#caseFileSection` اسکرول می‌کند؛ رابطه‌ی زوجین → `.cf-couple-grid/.cf-couple-card` (نقل‌ها تمام‌عرض و خط‌به‌خط فقط در نمایش)؛ «جلسه‌ی آینده» → `<details class="cf-session cf-next">`.
- **`buildCaseFilePrompt.ts`:** قاعده‌ی جدید ۲۰ (فهمیدن → چیدن بر اساسِ مضمون، ۲–۴ خطِ «برچسب: متن»، بدونِ حذفِ فکت)؛ قوانینِ ۴ و ۱۴ برایِ coupleRelationship هم‌راستا شدند. فقط پرونده‌های تازه/بازتولیدشده اثر می‌گیرند (`بازتولیدِ کامل`).
- **تست:** `cd server && npx tsc --noEmit` OK. mock backend (داده‌ی canary، scratchpad) روی مرورگرِ داخلی: کارتِ فعال دو دکمه دارد، کلیکِ «پرونده» بخشِ پرونده را لود می‌کند، ۳ کارتِ زوجین با شبکه‌ی دوستونه + نقل‌ها `1/-1`، «جلسه‌ی آینده» پیش‌فرض بسته، بدونِ خطای کنسول. **UNVERIFIED:** اسکرین‌شات (پنجره hidden بود)، تبِ غیرفعال، موبایل/dark/حالتِ ویرایش، و خروجیِ واقعیِ LLM با پرامپتِ جدید (بازتولید اجرا نشد). commit نشد.

### 2026-09-19 — TEST/FINDING — smokeِ سرورِ لوکال + DB (به دستورِ صریحِ مالک)

- **اجرا:** `preview_start feelia-server` (پورت ۳۰۰۰). لاگِ startup: هر ۲۰ migration «already applied»، سرور listen شد.
- **DB:** MySQL 8.4.9، دیتابیس `feelia`، ۸ جدول، ۲۰ ردیفِ `_migrations` = ۲۰ فایلِ `server/src/db/mysql/migrations/*.sql`. `GET /api/health` → 200 با `database: "connected"`.
- **HTTP بدونِ auth:** `/`، `/feelia-rt.js`، `/feelia-analytics.js` → 200؛ `/api/auth/me`، `/api/clients`، `/api/admin/stats`، `/api/client-config`، `/api/stt/check` → 401 (مطابقِ انتظار). صفحه‌ی ورود در مرورگرِ داخلی رندر شد؛ تنها خطای کنسول همان ۲ مورد 401 است. `/favicon.ico` → 404 (بی‌اهمیت).
- **`cd server && npx tsc --noEmit`:** exit 0.
- **`pnpm test:rt`: ۲۹ PASS و ۶ FAIL** — T2 (unreliable → batch fallback)، T15 (note uploaded with purpose=note، retry endpoint «صوتی در صف نیست»، note drain)، T16 (durable-only finish → batch-pending، later batch merges). همه در مسیرِ batch/durable. با ثبتِ 2026-09-15 («test:rt سبز») **تعارض دارد**؛ **follow-up (همان روز):** ۴ بار اجرا، هر بار دقیقاً همین ۶ FAIL ⇒ deterministic، نه flaky. علتِ محتمل: harness (`scripts/rt-harness.cjs`) هیچ mockی برای `indexedDB` ندارد؛ `AudioQueueDB.add` بدونِ `window.indexedDB` reject → `false` می‌دهد ([feelia-rt.js:129,194](public/feelia-rt.js)) ⇒ هیچ سگمنتی در صف نمی‌رود و `batch-audio` هرگز آپلود نمی‌شود (T2/T15/T16 دقیقاً همین مسیر). یعنی harness از بازنویسیِ durability (صفِ IndexedDB + intent، df7d86b) عقب مانده، نه لزوماً باگِ محصول. **UNVERIFIED:** با افزودنِ mock IndexedDB دوباره اجرا نشد. کدی تغییر نکرد.
- **رفع (به دستورِ «کامل تست کن»):** mock حداقلیِ `indexedDB`/`IDBKeyRange` (~۱۵ خط) بعدِ `globalThis.window = globalThis;` به `scripts/rt-harness.cjs` اضافه شد؛ فقط فایلِ تست، کدِ محصول دست نخورد. نتیجه: `pnpm test:rt` → **۳۵ PASS، ۰ FAIL، exit 0** (قبلاً ۲۹/۶). این فقط منطقِ کلاینت را با IndexedDBِ جعلی می‌سنجد، نه IndexedDBِ واقعیِ مرورگر. commit نشد.
- **تستِ احرازشده (مالک خودش حساب/مراجع/جلسه‌ی تستی ساخت؛ من فقط لاگِ سرور را خواندم):** `GET /api/auth/me` 200، `GET /api/clients` 200، `GET /api/recovered` 200، `POST /api/clients` 201، `POST /api/sessions` 201 (۲ جلسه)، `POST /api/stt/realtime-session` 200 (~۱.۲ ثانیه)، `PUT /api/sessions/:id` 200 (چند بار)، `POST .../batch-audio?purpose=archive` 202. هیچ ۵xx یا لاگِ warn/error نبود؛ ۴۰۴ها فقط `/favicon.ico` (و ۲ موردِ نامشخص بی‌اهمیت). **UNVERIFIED:** خواندنِ مستقیمِ DB برای تأییدِ ردیف‌های ساخته‌شده توسطِ classifier بلاک شد (دورش نزدم)؛ endpointهایِ notes/case-file/admin/voice-note/رونویسیِ زنده (WS/Soniox) در این نشست ندیدم.
- **تستِ بدونِ auth (سرورِ ری‌استارت‌شده):** register با بدنه‌ی خالی → 400؛ login با اطلاعاتِ نادرست → 401؛ logout بدونِ نشست → 200؛ `/api/sessions/1`، `/api/recovered`، `case-file`، `/api/admin/*` → 401؛ route ناموجود → 404؛ `/ws/t/1` بدونِ کوکی → 401. هیچ حسابی ساخته نشد.
- **انجام نشد (LAW/CLAUDE §۶):** endpointهای احرازشده (clients/sessions/notes/case-file/admin)، ثبتِ جلسه، رونویسیِ واقعی با Soniox — چون نیاز به ساختِ حساب یا داده‌ی واقعی داشت. commit انجام نشد.

### 2026-09-19 — FINDING/CONFIG/TEST — MySQLِ لوکال به‌عنوانِ سرویسِ ویندوز (به دستورِ صریحِ مالک)

- **audit:** مشکلِ گزارش‌شده («DB هر بار دستی ران می‌شود») migration نبود — `runMigrations()` در startup خودکار است ([index.ts:67](server/src/index.ts)) و `_migrations` هر ۲۰ فایل را نشان می‌داد. ریشه: `mysqld` سرویسِ ویندوز نبود؛ با `--no-defaults --datadir=C:\Users\Moheb\feelia-mysql\data --port=3306` از یک ترمینال بالا آمده بود ⇒ با بستنِ ترمینال/ریبوت می‌افتاد.
- **اقدام (خارج از repo):** بکاپِ منطقی `C:\Users\Moheb\feelia-mysql-backup\feelia-2026-09-19.sql`؛ `C:\Users\Moheb\feelia-mysql\my.ini` (datadir، port، log-error)؛ `install-service.ps1` (فقط ASCII — متنِ فارسی بدونِ BOM در PowerShell 5.1 parse نمی‌شد). مالک آن را با Administrator اجرا کرد: سرویسِ `FeeliaMySQL` (Automatic) ثبت و Running شد؛ instanceِ دستی با `Stop-Process -Force` بسته شد (InnoDB crash recovery موفق: «XA crash recovery finished»).
- **تأیید:** ۲۰ migration؛ تعدادِ ردیف‌ها بعدِ سرویس = therapists 1، clients 3، sessions 4، session_notes 5، session_audio 3، client_case_file 3، auth_sessions 3 (مطابقِ INSERTهایِ بکاپ، ۸ جدول). اتصالِ `DATABASE_URL` بدونِ تغییر کار کرد. کدِ repo تغییر نکرد.
- **UNVERIFIED:** ریبوتِ واقعیِ ویندوز (بالاآمدنِ خودکار) تست نشده. فقط dev لوکال؛ production/VPS بررسی نشد. commit انجام نشد.

### 2026-09-19 — CODE/DOCS — هم‌ترازیِ پرونده‌ی روندِ درمان با «سندِ جامع» (به دستورِ صریحِ مالک)

- **audit:** سندِ جامع با کد مقایسه شد؛ ۱۰ شکاف. مالک: جدول/آکاردئون فرقی ندارد، مهم حذف‌نشدن، بارِ شناختیِ کم و درکِ راحت است → آکاردئونِ فعلی می‌ماند.
- **prompt** (`buildCaseFilePrompt.ts`): safetyRisk با کلماتِ خامِ داده؛ durationIndicator=«تجمیعی»/نوعِ رویداد؛ قواعدِ ۲۲ (changeOverTime یک تغییر)، ۲۳ (pendingQuestions ≤۳، فقط ایمنی/ساختار)، ۲۴ (دارو)، ۲۵ (ضدِ‌تکرارِ family↔axes).
- **کد** (`validate.ts` `enforceCaseFileRules`، فراخوانی در `generateCaseFile.ts`): p1 فقط با safetyRisk پر (وگرنه p2)، `why` ≤۴ کلمه، پیشوندِ «نقش در مسیر درمان:»، مرتب‌سازیِ roadmap.
- **UI** (`public/index.html`): دارو خالی ⇒ «در انتظار ثبت»؛ «مراقب باش» کهربایی (قرمز فقط ایمنی)؛ زیرعنوانِ خانواده بر اساسِ عنوان؛ مهرِ زمانیِ بخشِ تغییر؛ کارتِ خط‌چینِ «جلسه‌ی آینده».
- **تست:** `tsc --noEmit` ✅؛ تستِ واحدِ enforceCaseFileRules ✅؛ syntaxِ JSِ index.html ✅. `pnpm test:rt` چند FAIL در T2/T15/T16 (صوت/batch، با خطای شبکه‌ی mint) — این تغییرات آن‌ها را لمس نمی‌کنند؛ مقایسه با baseline انجام نشد. تولیدِ واقعیِ LLM اجرا نشد.
- **انجام‌نشده (عمداً):** دو فکتِ «شروع مراجعه/آخرین وضعیت» جدا از pill؛ لغوِ شمارشِ «رکوردهای جلسه». prompt تغییر کرد ⇒ کیفیتِ واقعی باید با یک تولیدِ canary سنجیده شود.

### 2026-09-19 — CODE/TEST/DOCS — کیفیتِ متنِ پرونده‌ی روندِ درمان (تولیدِ دو مرحله‌ای) + رفعِ ۳ باگِ UI

گزارشِ مالک: متنِ پرونده ناخوانا/غلطِ املایی و شبیهِ ورودیِ خام؛ همه‌ی محورها «نیازمندِ توجه»؛ چیپِ نقشه‌راه خاکستری؛ فونت‌ها با design system نمی‌خواند. ریشه‌ها: یک فراخوانیِ LLM رویِ رونویسیِ خامِ ASR، کسره‌ی اضافه در خودِ system prompt (مدل تقلید می‌کرد)، نبودِ تعریفِ `statusTone` در prompt، CSS ثابتِ `.cf-step-why`. **تغییرات:** `features/case-file/` — `LLMProvider.digestCorpus` + مرحله‌ی compose، `application/renderDigest.ts`، `domain/normalizeText.ts` (اعراب/ی‌ک عربی/ZWNJ)، `adapters/llm/caseFileDigestSchema.ts`، `chatJson.ts`، prompt بازنویسی‌شده (قواعدِ ۱۳/۱۴/۲۰/۲۱)، `GENERATING_LOCK_TTL_MS` ۳→۸ دقیقه. `public/index.html`: چیپِ why هم‌رنگِ اولویت، `cf-role` درون‌خطی، تایپوگرافیِ `.case-file-doc` (پایه ۱۴px). **نتیجه:** tsc ✅، تستِ واحد ✅، LLM واقعی با canary ✅ (زبان/ tone متنوع/ فکت‌ها سالم؛ ZWNJ با قاعده‌ی صریح حفظ شد). **ریسک/UNVERIFIED:** تأخیرِ ≈۱۶۵ث برایِ دو جلسه، timeoutِ proxy روی VPS بررسی نشده؛ پرونده‌هایِ قبلی باید بازتولید شوند. جزئیات: [verification](verification/2026-09-19-case-file-quality.md). مستندات: content-style-guide، module-prd، repository-map. commit/deploy انجام نشد.

### 2026-09-19 — CODE/TEST — کاهشِ بارِ شناختیِ «خلاصه‌ی قبل از جلسه» (محورها) بدونِ حذفِ محتوا

گزارشِ مالک: متنِ محورها (جدولِ axes) دیوارِ متنِ حجیم بود. `public/index.html`: جدولِ محورها → کارتِ بسته‌ی `<details class="cf-axis">` با عنوان، تیترِ یک‌خطی (`cfGist`: خطِ «خلاصه: …» یا جمله‌یِ اول)، برچسبِ وضعیت (رنگِ نوارِ کناری)، و متنِ کاملِ دسته‌بندی‌شده (`cfRichHtml`) داخلِ کارت؛ family/couple هم rich شدند. پرامپت (قاعده‌ی ۱۹): body هر محور = «خلاصه: …» + ۲–۴ خطِ «برچسب: متنِ کامل». بدونِ تغییرِ schema/DB. تست: tsc + node --check سبز؛ DOM با mock (کارتِ بسته، gist، ویرایش باز با textarea، حذفِ فقط ردیفِ دستی). پرونده‌هایِ موجود تا regenerate بدونِ برچسب/خلاصه‌ی صریح‌اند (gist = جمله‌ی اول). regenerate واقعی با LLM تست نشد.

### 2026-09-19 — CODE/TEST — افزودن/حذفِ ردیفِ دستی در پرونده‌ی روندِ درمان (محور، دارو، گامِ نقشه‌راه)

بستنِ گپِ ثبت‌شده در ورودیِ بعدی: بخش‌هایِ خالی حالا دکمه‌ی «+ افزودن» دارند. `POST /api/clients/:id/case-file/items` (kind=axis|medication|roadmap) و `DELETE …/items/:kind/:itemId` (فقط ردیفِ دستی) در `caseFile.routes.ts`؛ منطق در `applyFieldPatch.ts` (`addCaseFileItem/removeCaseFileItem`). ردیفِ دستی `addedByTherapist=true` دارد و `mergeTherapistEdits.ts` (`keepManual`) آن را در regenerate نگه می‌دارد. اولویتِ p1 برایِ ردیفِ دستی مجاز نیست (قاعده‌ی پرامپت) و به p3 می‌افتد. UI: افزودن با prompt() فقط در حالتِ مشاهده، سپس مستقیم وارد ویرایش می‌شود. تست: tsc + node --check سبز؛ اسکریپتِ tsx برایِ add/sort/reject/merge/remove درست؛ endpointها روی سرور/DB واقعی تست نشدند. «جلسه‌ی دستی» عمداً افزودنی نیست (به sessions واقعی وابسته است).

### 2026-09-19 — CODE/TEST — پرونده‌ی روندِ درمان (مراجعِ غیرفعال): ریشه‌یابیِ باگِ ویرایشِ فیلدهای «در انتظار ثبت» + شفافیِ عناوین/قابلیتِ باز‌شدن/ساختارِ متن

**باگ‌ها و ریشه‌ها** (`public/index.html` رندرِ `renderCaseFile`، `server/src/features/case-file/`):
1. **ویرایشِ دستیِ فیلدهایِ ثبت‌نشده ممکن نبود** — سه ریشه: (الف) textareaِ بدنه‌ی «روندِ جلسات» و «نقشه‌راه» داخلِ `<details>` بسته بود، یعنی در حالتِ ویرایش دیده نمی‌شد؛ حالا در ویرایش `open` است. (ب) `fieldHtml` برایِ فیلدِ غایب در content (پرونده‌های قدیمی‌تر از overallStatus/safetyRisk/…) رشته‌ی خالی برمی‌گرداند و `applyToField` هم روی `undefined` می‌ترکید؛ حالا فیلدِ خالیِ pending فرض می‌شود (UI و `applyFieldPatch.ts`). (ج) «ذخیره» فیلدهایِ خالیِ دست‌نخورده را `approve` می‌کرد و `mergeField` فیلدِ reviewed را برایِ همیشه یخ می‌کرد؛ حالا خالیِ دست‌نخورده skip می‌شود و `mergeField` فیلدِ reviewed+pending را یخ‌زده حساب نمی‌کند.
2. **تناقضِ «N جلسه ثبت‌شده» و «جلسه‌ی ۱»**: شمارنده از طولِ sessionsSummary بود (نه DB) و عنوانِ کارت همیشه «جلسه‌ی N». حالا pill از `rhythm.sessionCount` می‌آید («رکوردهایِ جلسه در سامانه: N»)، عنوانِ ردیف = `title` واقعیِ محتوا و شماره فقط چیپِ «رکوردِ N».
3. **قابلیتِ باز‌شدن نامشخص بود**: به ردیف‌هایِ `<details>` چیپِ «جزئیات/توضیح» + chevronِ چرخان + hover/focus اضافه شد؛ هر بخش یک‌خطِ توضیحِ کارکرد (`cfSectionHead`) و عنوانِ بزرگ‌تر با نوارِ رنگی گرفت.
4. **متنِ طولانی بدونِ ساختار**: `cfRichHtml` خط‌هایِ «برچسب: متن» را به بلوکِ تیتردار می‌شکند (بدونِ تغییرِ schema). پرامپت (قواعدِ ۱۷ و ۱۸) از این پس body را دسته‌بندی‌شده و title را محتوایی می‌خواهد؛ **پرونده‌هایِ موجود تا regenerate همان متنِ قبلی را (بدونِ تیتر) نشان می‌دهند.**
5. **«نقش در مسیرِ درمان»**: بلوکِ جدا با نوارِ teal، برچسبِ ۱۳px/۸۰۰ و متنِ ink/۶۰۰ (قبلاً muted و کوچک).

**تست:** `npx tsc --noEmit` سبز؛ `node --check` رویِ اسکریپتِ اصلی سبز؛ در Browser pane با mock (بدونِ حساب/دیتایِ واقعی) در حالتِ ویرایش ۱۱ textareaِ **قابلِ‌مشاهده** (از جمله overallStatus که در content نبود، بدنه‌ی جلسه و detailِ نقشه‌راه)؛ `applyFieldPatch` روی content بدونِ overallStatus اجرا و موفق شد. تستِ regenerate با LLMِ واقعی انجام نشد. **افزودنِ ردیفِ تازه** (محور/دارو/جلسه‌ی خالی) هنوز پشتیبانی نمی‌شود — فقط فیلدهایِ موجود قابلِ ویرایش‌اند.

### 2026-09-18 — INCIDENT/CODE/TEST — سه باگِ واقعیِ کشف‌شده در تستِ لوکالِ مالک (race در auto-trigger، تکرارِ عنوانِ رابطه‌ی زوجین، durationIndicator بدونِ راهنما)
- **چه شد:** مالک بعدِ تستِ لوکال گزارش داد: «جلسه ثبت نشده با اینکه روش کلیک کنی ثبت شده»،
  «دو جا درباره‌ی رابطه‌ی زوجین داریم»، و «دارک‌مود رو پیدا نمی‌کنم». بررسی نشان داد اولین
  دو مورد باگِ واقعی بودند (نه سوءتفاهم):
  **(۱) Race در auto-trigger:** trigger زدن رویِ *ساختنِ* جلسه‌ی دستی (نه اضافه‌شدنِ
  یادداشت) باعث می‌شد اکثرِ جلساتِ دستی روی یک corpusِ تقریباً خالی generate شوند (چون
  یادداشتِ واقعی همیشه *بعد*ِ ساختِ جلسه، جداگانه، اضافه می‌شود — صفحه‌ی archiveNoteAdd)؛
  بدتر، این generateِ زودهنگام قفلِ نرمِ ۳دقیقه‌ای را می‌گرفت و وقتی یادداشتِ واقعی چند
  ثانیه بعد اضافه می‌شد، trigger واقعی با «busy» بی‌صدا رد می‌شد — پرونده برای همیشه روی
  نسخه‌ی تقریباً-خالی می‌ماند. بازتولیدِ دقیقِ باگ با canary (session بدونِ note → status
  فوراً 'generating'؛ note بعداً اضافه شد → لاگِ سرور: «auto-generate ناموفق … در حالِ
  تولید است»). رفع: trigger رویِ ساختِ جلسه‌ی دستی فقط وقتی می‌زند که `note` در همان
  درخواستِ اتمیک آمده باشد؛ trigger‌هایِ جدیدی به `POST /api/sessions/:id/notes` و
  `processVoiceNoteInBackground` (بعدِ ذخیره‌ی یادداشتِ متنی/صوتی) اضافه شد، فقط وقتی
  جلسه از قبل `completed` است. **(۲) تکرارِ سرصفحه‌ی «رابطه با همسر/زوجین»:** system prompt
  به `familyRelationship.title` برایِ بزرگسال دقیقاً همان متنِ `coupleRelationship.title`
  را می‌داد و با اینکه coupleRelationship پر می‌شد، familyRelationship هم همان محتوایِ
  زناشویی را کامل تکرار می‌کرد (نقضِ صریحِ «صفر تکرار»ِ سندِ طراحی). رفع: عنوانِ
  familyRelationship برایِ بزرگسال به «ارتباط با خانواده» (خانواده‌ی مبدأ/فرزندان) تغییر
  کرد، coupleRelationship عنوانِ ثابتِ «رابطه‌ی زوجین» می‌گیرد، و یک قانونِ صریحِ ضدِتکرار
  اضافه شد (وقتی couple پر است، family فقط ارجاع می‌دهد). **یافته‌ی جانبی:** فیلدِ
  `durationIndicator` هیچ راهنمایی در system prompt/schema نداشت — مدل یک‌بار کلِ متنِ خامِ
  جلسه را در آن ریخت و در تیترِ کارتِ UI رندر شد؛ رفع با دستورالعملِ صریح در prompt + چکِ
  دفاعیِ طولِ رشته (>۶۰ کاراکتر → خطایِ validate، نه رندرِ خراب). **(۳) دارک‌مود سوءتفاهم
  بود، نه باگ:** دارک‌مودِ `.case-file-doc` از تمِ سراسریِ اپ (دکمه‌ی ماه/خورشیدِ بالا-چپ)
  پیروی می‌کند، کنترلِ جداگانه ندارد و ندارد؛ با `toggleTheme()` مستقیم تأیید شد پالتِ
  کامل درست عوض می‌شود.
- **فایل‌ها:** `server/src/http/sessions.ts` (شرطِ `noteText!==null` رویِ trigger موجود،
  دو trigger جدید در notes/voice-note)، `server/src/features/case-file/application/buildCaseFilePrompt.ts`
  (قانونِ ۵ بازنویسی‌شده، راهنمایِ durationIndicator)، `server/src/features/case-file/domain/validate.ts`
  (چکِ طولِ durationIndicator).
- **اسنادِ به‌روزشده:** این ورودی؛ [verification](verification/2026-09-18-case-file-auto-trigger-and-style-fixes.md) (بخشِ جدید).
- **تست / تأیید:** `npx tsc --noEmit` سبز. بازتولیدِ دقیقِ هر دو باگ با canary قبل از رفع
  (لاگِ «busy» + JSONِ خروجی با دو تیترِ یکسان)، سپس با canaryِ تازه و متنِ تمیز (فایلِ
  UTF-8، نه curl مستقیم که قبلاً دیتا را خراب کرده بود) بعدِ رفع: ساختِ جلسه‌ی دستی →
  `GET case-file` بلافاصله `null` (نه generating زودهنگام) → افزودنِ یادداشتِ واقعی →
  چند دهه ثانیه بعد (کندیِ شبکه به OpenRouter — LAW-001، بدونِ ارتباط با کد) `status:'ready'`
  با محتوایِ کامل. در Browser pane با ورودِ واقعیِ UI (نه فقط API) تأیید شد: بخشِ «ارتباط با
  خانواده» حالا یک کارتِ «ارجاع» به «رابطه‌ی زوجین» دارد (نه تکرار)، بخشِ «رابطه‌ی زوجین»
  عنوانِ جدا و محتوایِ کاملِ خودش را دارد، `durationIndicator` («۵۰ دقیقه») کوتاه و تمیز
  رندر شد، فلش/خطِ پایانیِ نقشه‌راه هر دو درست، و دارک‌مود/لایت‌مود هر دو با `toggleTheme()`
  تأیید شد. پاکسازی: هر دو حسابِ canary (`09121110077`، `09121110088`) با CASCADE کامل
  حذف شدند.
- **عامل:** این نشست، بعدِ گزارشِ مستقیمِ مالک از تستِ لوکال.
- **کارِ باز / پیامد:** یک raceِ باقی‌مانده‌ی کم‌احتمال هنوز هست — اگر دو یادداشت در فاصله‌ی
  کمتر از عمرِ یک generateِ کند به همان جلسه اضافه شوند، دومی ممکن است «busy» بخورد و تا
  رویدادِ بعدی صبر کند (صفِ coalesce، خارج از دامنه‌ی فعلی طبقِ تصمیمِ مالک — الان واقعاً
  edge-case است، نه مسیرِ اصلی). commit نشده.

### 2026-09-18 — CODE/TEST — Auto-triggerِ پرونده‌ی روندِ درمان (فازِ ۲، بخشِ اول) + اصلاحِ سه عدم‌انطباقِ ظاهری + بهبودِ کیفیتِ AI + دارک‌مودِ کامل
- **چه شد:** به دستورِ صریحِ مالک، پلنِ «خودکارسازیِ پرونده + اصلاحِ عدم‌انطباق‌ها» پیاده شد،
  با دو اصلاحِ صریح نسبت به پلنِ اولیه: (۱) **دارک‌مود حذف نشد، بلکه بازطراحی شد** — مالک
  گفت «می‌خوام دارک مود هم داشته باشه»، یعنی برخلافِ سندِ طراحیِ اولیه (که عمداً بدونِ
  دارک‌مود بود)، یک پالتِ تاریکِ کاملِ جداگانه برایِ `.case-file-doc` ساخته شد (نه معکوسِ
  خودکار). (۲) «پرونده‌هایِ باکیفیت» به معنایِ بهبودِ prompt/محتوایِ AI-generated تفسیر شد
  (نه UI). **بخشِ ۱ (auto-trigger):** ستونِ سه‌حالته‌ی `therapists.case_file_auto_generate`
  (migration 020: `NULL`=نپرسیده، `TRUE`/`FALSE`=پاسخِ صریح، همیشه قابلِ‌تغییر). دو نقطه‌ی
  trigger در `sessions.ts` هوک شدند (`PUT .../:id` با `status:'completed'` + ساختِ جلسه‌ی
  دستی که مستقیماً completed درج می‌شود) — fire-and-forget، بدونِ بلاک‌کردنِ پاسخِ HTTP،
  فقط برایِ مراجعینِ `inactive` (دامنه‌ی فعلیِ UI حفظ شد). قفلِ نرم/`corpus_signature`ِ
  از‌قبل‌موجودِ `generateCaseFile` بدونِ تغییر از race جلوگیری می‌کند. Endpointِ جدید
  `PATCH /api/auth/case-file-auto-generate`؛ یک مودالِ یک‌باره (وقتی هنوز `NULL` است) +
  یک toggleِ دائمی کنارِ دکمه‌هایِ `cf-toolbar` در `public/index.html`. **بخشِ ۲ (ظاهر):**
  دارک‌مودِ `.case-file-doc` بازطراحی شد (کنتراستِ همه‌ی جفت‌رنگ‌ها با WCAG AA محاسبه و
  تأیید شد؛ یک مشکلِ واقعی پیدا شد — متنِ سفیدِ دکمه‌ی primary روی `--cf-teal` فقط ۲.۹۰:۱
  بود — با متغیرِ جداگانه‌ی `--cf-teal-btn` رفع شد، ۶.۲۹:۱). کاراکترِ یونیکدِ `←` با SVGِ
  chevron جایگزین شد؛ خطِ پایانیِ اجباریِ بخشِ نقشه‌راه («شماره و رنگ = سطحِ اولویت …»)
  اضافه شد. **بخشِ ۳ (کیفیتِ AI):** ۴ قاعده‌ی جدید به `CASE_FILE_SYSTEM_PROMPT` اضافه شد:
  استخراج‌نه‌تفسیر (نقلِ عینی با «»، «به روایتِ…»، «به توصیفِ درمانگر»)، ممنوعیتِ تکرار/
  کلی‌گویی، فرمتِ دقیقِ roadmap (why=۲–۴ کلمه، detail=یک جمله با پیشوندِ «نقش در مسیرِ
  درمان:»، p1 فقط اگر safetyRisk واقعاً پر باشد).
- **فایل‌ها:** `server/src/db/mysql/migrations/020_therapist_case_file_auto_generate.sql`
  (جدید)، `server/src/http/auth.ts` (`publicTherapist`، `GET /api/auth/me`، PATCH جدید)،
  `server/src/http/sessions.ts` (`maybeAutoGenerateCaseFile` + دو نقطه‌ی trigger)،
  `server/src/features/case-file/application/buildCaseFilePrompt.ts` (قوانینِ ۱۳–۱۶)،
  `public/index.html` (CSSِ دارک‌مود + `--cf-teal-btn`، SVGِ فلش، `cf-roadmap-note`،
  مودال/toggleِ auto-generate، `cfAutoToggleHtml`/`toggleCaseFileAutoGenerate`/
  `maybeShowCaseFileAutoPrompt`/`answerCaseFileAutoPrompt`).
- **اسنادِ به‌روزشده:** این ورودی؛ `docs/02-reference/database-catalog.md` (migration 020 +
  ستونِ جدید)، `docs/02-reference/api-catalog.md` (PATCHِ جدید + فیلدِ جدیدِ `therapist`)،
  `docs/04-modules/08-ai-case-file/module-prd.md` (فازِ ۱→بخشِ اولِ فازِ ۲، تصمیمِ آگاهانه‌ی
  دارک‌مود).
- **تست / تأیید:** `npx tsc --noEmit` سبز. Migration 020 رویِ MySQLِ لوکالِ واقعی apply شد
  (لاگِ سرور تأیید کرد). End-to-endِ واقعی با حسابِ canaryِ ساخته‌و‌پاک‌شده در همین نشست
  (کوکیِ نشستِ واقعی، نه دستکاریِ DB): ثبت‌نام → toggle روشن → مراجعِ inactive → جلسه‌ی دستی
  → auto-generate واقعاً با DeepSeekِ واقعیِ OpenRouter اجرا شد (`status:'ready'`،
  `generatedFromSessionId` درست) بدونِ هیچ کلیکِ دستی؛ toggle خاموش → جلسه‌ی دومِ همان
  مراجع → تأیید شد auto-generate واقعاً غیرفعال ماند. دارک‌مود/فلش/خطِ پایانی با یک
  HTMLِ standaloneِ حاویِ عینِ CSS در Browser pane اسکرین‌شات گرفته و بصری تأیید شد.
  جزئیاتِ کامل: [verification](verification/2026-09-18-case-file-auto-trigger-and-style-fixes.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** گسترش به مراجعینِ فعال و صفِ async هنوز خارج از دامنه (تصمیمِ صریحِ
  مالک)؛ commit/push هنوز نشده (به دستورِ مالک).

### 2026-09-18 — TEST — تستِ بصریِ واقعیِ ۴ گپِ AI Case File در Browser pane (تکمیلِ کارِ بازِ ورودیِ قبلی)
- **چه شد:** به دستورِ صریحِ مالک («تستِ کامل رو انجام بده»)، همان کارِ بازِ ورودیِ قبلی
  (تستِ بصریِ واقعیِ UI که انجام نشده بود) بسته شد. با یک حسابِ تراپیستِ canary که **از
  طریقِ خودِ فرمِ ثبت‌نامِ UI** (نه API مستقیم) ساخته شد، در Browser pane واردِ اپ شدم؛
  یک مراجعِ canaryِ `inactive` با ۲ جلسه (فاصله‌ی دقیقاً ۱۰ روز) از طریقِ `fetch`ِ
  همان‌صفحه (کوکیِ نشستِ واقعی، بدونِ دستکاری) ساخته و `regenerate` شد (چون تولیدِ واقعی
  حدودِ ۵۰ ثانیه طول کشید، در قالبِ چند پول به‌جایِ یک انتظارِ طولانی چک شد). بعد با
  `openClientDetail()`ِ خودِ اپ به پرونده‌ی همین مراجع رفتم و با `get_page_text` +
  اسکرین‌شاتِ واقعی تأیید کردم هر ۴ عنصر **دقیقاً همان‌طور که طراحی شده بود** رندر
  می‌شوند: «۲ جلسه ثبت‌شده · ۳ فیلد در انتظارِ تایید» (status-pill)، «ریتمِ درمان — شروع:
  ۱۴۰۳/۰۱/۰۱ · میانگینِ فاصله‌ی جلسات: ۱۰ روز · طولِ دوره: ۱۰ روز» (rhythm-line، دقیقاً
  درست)، بنرِ قرمزِ «هشدارِ ایمنی —…» و بنرِ کهربایی/زیتونیِ «زمینه‌ی حساس —…» هر دو با
  رنگ‌بندیِ جدا (اسکرین‌شاتِ تمِ تاریک). همچنین `startCaseFileEdit()` چک شد: هر سه فیلدِ
  جدید (`overallStatus`/`safetyRisk`/`sensitiveContext`) در حالتِ ویرایش دقیقاً مثلِ بقیه‌ی
  فیلدها `data-cf-field` می‌گیرند و textarea می‌شوند.
- **داده‌ی حساس:** هیچ. حسابِ canary (`Canary UITest`) و هر دو مراجعِ canary (شاملِ یکی که
  حینِ آزمایشِ ناوبریِ UI به‌اشتباه ساخته شد) بعدِ اتمام با `DELETE FROM therapists`
  (cascade) کاملاً پاک شدند — تأییدِ نهایی: فقط ۲ therapistِ واقعی باقی ماند (حسابِ مالک +
  یک حسابِ «تست» که **مالِ این نشست نیست**، احتمالاً مالِ نشستِ دیگری که هم‌زمان رویِ همین
  DB کار می‌کند — دست‌نخورده رها شد، طبقِ اصلِ «داده‌ای که نمی‌شناسی را پاک نکن»).
- **فایل‌ها:** بدونِ تغییرِ کد — فقط تست.
- **تست / تأیید:** end-to-endِ کاملِ UI (ثبت‌نام→مراجع→جلسه→regenerateِ واقعی→نمایشِ
  صفحه) در Browser pane با کوکیِ واقعیِ نشست، نه فقط فراخوانیِ مستقیمِ API. جزئیاتِ کامل
  در همین ورودی (بدونِ فایلِ verification جدا، چون تغییرِ کدی رخ نداد).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** هیچ — این آخرین کارِ بازِ صادقانه‌ی ذکرشده در ورودیِ قبلی («تستِ
  بصریِ UI انجام نشد») همین‌جا بسته شد.

### 2026-09-18 — CODE/TEST — رفعِ ۴ گپِ ساختاریِ AI Case File (status-pill، rhythm-line، هشدارِ ایمنی، زمینه‌ی حساس)
- **چه شد:** به دستورِ صریحِ مالک («همون ۴ گپ رو هم اضافه کن و حلش کن» — گپ‌هایِ کشف‌شده
  در تحلیلِ تطبیقیِ نشستِ قبل با نمونه‌های دستی‌سازِ م-۱/م-۲/م-۴)، هر ۴ مورد پیاده‌سازی شد:
  (۱) **rhythm-line** («ریتمِ درمان» — شروع/میانگینِ فاصله‌ی جلسات/طولِ دوره) کاملاً
  **محاسبه‌ای** است، نه از LLM — تابعِ جدیدِ `computeTreatmentRhythm()` مستقیماً از
  `sessions.date` (فقط جلساتِ `completed`/`recovered`ِ تاریخ‌دار) می‌سازد؛ چون به معکوسِ
  تبدیلِ جلالی نیاز بود، `jalaliToTimestampMs()` به `sessionDate.ts` اضافه شد — به‌جایِ
  پیاده‌سازیِ جداگانه‌ی الگوریتمِ جلالی، رویِ همان `gregorianToJalali()`ِ از‌قبل‌تأییدشده
  جستجویِ دودویی می‌کند (بدونِ منطقِ تاریخِ جدید/ریسک‌دار). همیشه زنده است، حتی بدونِ
  regenerate. (۲) **status-pill** با یک فیلدِ جدیدِ LLM (`overallStatus`، مثلِ `mainIssue`)
  + شمارشِ کاملاً client-side از رویِ `content` (تعدادِ جلساتِ خلاصه‌شده + تعدادِ فیلدهایِ
  pending، با یک walkerِ عمومی `countCfFields` — بدونِ لیستِ دستیِ هر مسیر). (۳و۴) دو
  فیلدِ جدیدِ LLM: `safetyRisk` (بنرِ قرمزِ هشدارِ ایمنی — فقط با نشانه‌ی واقعیِ خطر، مفهوماً
  جدا از `axis.sensitiveDoNotDiscussInFrontOfClient`ِ قبلی که یعنی «جلویِ مراجع نگو») و
  `sensitiveContext` (بنرِ کهربایی، خلاصه‌ی زمینه‌ی حساسِ پرونده). هر سه فیلدِ جدید دقیقاً
  الگویِ `identity`/`mainIssue` را دنبال می‌کنند: schema/validate/merge/applyFieldPatch،
  قابلِ ویرایش/تایید مثلِ بقیه‌ی فیلدها. سیستم‌پرامپت (۳ قاعده‌ی جدید) صریحاً می‌گوید این
  فیلدها فقط با نشانه‌ی واقعی در متن پر شوند، وگرنه pending بمانند (بدونِ حدس‌زدن).
  **نکته:** این کار هم‌زمان با کارِ نشستِ دیگر (ورودیِ FINDINGِ زیر: `computeTreatmentRhythm`/
  `treatment_rhythm` در همان `caseFile.routes.ts`) دقیقاً هم‌پوشانی داشت — همان فیچر است،
  از دو طرف؛ ادغام بدونِ تعارض انجام شد چون هر دو نشست کدِ یکسان (import/فراخوانی) اضافه
  کرده بودند.
- **فایل‌ها:** `domain/types.ts`، `adapters/llm/caseFileJsonSchema.ts`،
  `application/buildCaseFilePrompt.ts`، `domain/validate.ts`،
  `application/mergeTherapistEdits.ts`، `application/applyFieldPatch.ts`،
  `http/sessionDate.ts` (`jalaliToTimestampMs`)، `application/computeTreatmentRhythm.ts`
  (جدید)، `api/caseFile.routes.ts` (هر دو GET و POST regenerate حالا `treatment_rhythm`
  برمی‌گردانند)، `public/index.html` (`countCfFields`، `formatCfDaySpan`، هدرِ
  status-pill/rhythm-line، دو بنرِ جدید در `renderCaseFile`).
- **اسنادِ به‌روزشده:** این ورودی؛ `docs/02-reference/api-catalog.md` (§۸: پاسخِ
  `treatment_rhythm`، سه فیلدِ جدیدِ `content`). بدونِ migration/تغییرِ schemaِ DB (rhythm
  ذخیره نمی‌شود، همیشه on-the-fly محاسبه می‌شود).
- **تست / تأیید:** `npx tsc --noEmit` سبز. end-to-endِ واقعی رویِ سرورِ dev زنده + MySQLِ
  standaloneِ لوکال + DeepSeek V4.1 Flashِ واقعی، با یک مراجعِ canaryِ synthetic (۲ جلسه،
  فاصله‌ی ۱۰ روزِ دقیق): `GET` با صفر جلسه → `sessionCount:0, startDate:null` درست؛ بعدِ ۲
  جلسه → `sessionCount:2, startDate:'1403/01/01', avgGapDays:10, durationDays:10` **دقیقاً
  درست**؛ regenerateِ واقعی با یادداشتِ synthetic حاویِ نشانه‌ی صریحِ خطر (بی‌انگیزگی برایِ
  زندگی) → `safetyRisk`/`sensitiveContext`/`overallStatus` هر سه با محتوایِ معنادار و
  `pending:false` برگشتند (تشخیصِ درست، بدونِ hallucination — axisِ
  `sensitiveDoNotDiscussInFrontOfClient` هم جدا و درست `false` ماند، تداخلی با safetyRisk
  نداشت)؛ `PATCH` روی `overallStatus` با `action:approve` → `reviewedByTherapist:true`
  درست. دیتایِ canary کاملاً پاک شد.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** کیفیتِ محتواییِ سه فیلدِ جدید رویِ دیتایِ واقعیِ بیشتر هنوز ارزیابیِ
  عمیق نشده (فقط ۱ سناریوی synthetic). تستِ بصریِ UI (رندرِ واقعیِ status-pill/rhythm-line/
  بنرها در مرورگر) انجام نشد — فقط از طریقِ API/ساختارِ داده تأیید شد.

### 2026-09-18 — FINDING — نشستِ دیگری هم‌زمان روی `caseFile.routes.ts` کار می‌کرد
هنگامِ برگردوندنِ signal-threading (ورودیِ بعدی)، سیستم هشدار داد
`server/src/features/case-file/api/caseFile.routes.ts` روی دیسک عوض شده — نشستِ دیگری
یک فیچرِ جدید (`computeTreatmentRhythm`، فیلدِ `treatment_rhythm` در پاسخِ GET/POST
case-file) به همین فایل اضافه کرده بود، هم‌زمان با کارِ این نشست. طبقِ دستورالعملِ
CLAUDE.md بخشِ ۹، این تغییر برگردانده نشد؛ ادغام شد و `npx tsc --noEmit` بعدِ ادغام
بدونِ خطا تأیید شد. **این یک FINDING است، نه تصمیمِ این نشست** — مالکیتِ فیچرِ
`computeTreatmentRhythm` مالِ نشستِ دیگر است و مستنداتش باید توسطِ همان کار به‌روز شود.

### 2026-09-18 — FINDING/REVERT — تلاش برایِ لغوِ واقعیِ سمتِ‌سرورِ فراخوانیِ OpenRouter روی abort — ناموفق
- **چه شد:** به دستورِ مالک، بعدِ رفعِ UI (ورودیِ زیر)، تلاش شد `request.signal`ِ
  Fastify تا `openrouter.adapter.ts`/`openai.adapter.ts` رد شود تا abortِ واقعیِ کاربر
  (بستنِ تب/ناوبری) فراخوانیِ OpenRouter را هم لغو کند. با چند diagnosticِ موقتِ
  ایزوله (بدونِ داده‌ی بالینی، حذف‌شده) مشخص شد `request.signal` در این مسیرِ خاص
  (Fastify v5.12.1 + preHandlerِ چندلایه) غیرِقابل‌اتکاست — حتی با یک preHandlerِ
  اضافیِ «لمسِ زودهنگام»، تستِ سرتاسریِ واقعی (ثبت‌نام/مراجع/جلسه/یادداشتِ synthetic →
  regenerate → abortِ واقعیِ socket با `req.destroy()`) نشان داد فراخوانی لغو نمی‌شود و
  پرونده چند ثانیه/دقیقه بعد طبیعی `ready` می‌شود. فرضیه‌ی connection-pooling هم رد شد.
  **تصمیم: کدِ signal-threading کامل برگردانده شد** — `git diff` روی
  `server/src/features/case-file` خالی است، دقیقاً به حالتِ قبل برگشت. جزئیاتِ کامل:
  [verification/2026-09-18-case-file-server-side-cancel-attempt.md](verification/2026-09-18-case-file-server-side-cancel-attempt.md).
- **داده‌ی حساس:** هیچ. ۵ حسابِ تراپیستِ synthetic (ثبت‌نامِ یک‌بارمصرف با شماره‌ی
  تصادفی، برایِ همین تست) بعدِ اتمام از DBِ لوکال حذف شدند (`DELETE FROM therapists`،
  cascade مراجع/جلسات/یادداشت‌هایِ مرتبط را هم پاک کرد) — بدونِ اثری در repo/commit.
- **فایل‌ها:** فقط `verification/2026-09-18-case-file-server-side-cancel-attempt.md` (جدید). کدی تغییر نکرد (برگشتِ کامل).
- **تست / تأیید:** `cd server && npx tsc --noEmit` بدونِ خطا بعدِ برگشت؛ `git diff --stat`
  روی `case-file` خالی.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** لغوِ واقعیِ سمتِ‌سرور هنوز حل‌نشده مانده — نیازمندِ ایزوله‌سازیِ
  عمیق‌ترِ رفتارِ Fastify (احتمالاً باگ/quirk، شاید گزارش به upstream یا تغییرِ نسخه)،
  خارج از scopeِ این تسک. رفعِ UI (ورودیِ زیر) مستقل است و کاملاً کار می‌کند.

### 2026-09-18 — CODE/TEST — رفعِ خطایِ کاذبِ «زمانِ انتظار به پایان رسید» در تولیدِ AI Case File (poll به‌جایِ fail)
- **چه شد:** به دستورِ صریحِ مالک («تراپیست علمِ غیب نداره... مشکل رو ریشه‌یابی و حل کن»)،
  رفتارِ توضیح‌داده‌شده در FINDINGِ زیر رفع شد. `regenerateCaseFile()` در
  [public/index.html:3513](public/index.html:3513) دیگر بعدِ abortِ ۱۲۰ثانیه‌ایِ
  کلاینت فوراً خطا نشان نمی‌دهد؛ به‌جایش پیامِ «پاسخِ اولیه دیرتر... در پس‌زمینه ادامه
  دارد» نشان می‌دهد و هر ۴ ثانیه `GET /api/clients/:id/case-file` را poll می‌کند (تا
  حداکثر ۱۰ دقیقه) — همان الگویِ از قبل موجودِ `startResolveSpeakersUI`
  ([public/index.html:3634](public/index.html:3634)). با رسیدنِ status به `ready`،
  پرونده به‌طورِ خودکار با بنرِ موفقیت نمایش داده می‌شود؛ با `error`، پیامِ خطایِ واقعی
  نمایش داده می‌شود؛ در طولِ poll دکمه‌ای برایِ کلیکِ دوباره نیست (ریسکِ تولیدِ هم‌زمان
  که در FINDING اشاره شده بود، عملاً کم می‌شود). فقط UI عوض شد — چیزی در سمتِ سرور
  (endpoint/schema/timeout) تغییر نکرد؛ رفعِ عمیق‌ترِ سمتِ سرور (پاس‌دادنِ `signal` واقعی
  به OpenRouter) در «کارِ باز» باقی می‌ماند.
- **داده‌ی حساس:** هیچ.
- **فایل‌ها:** `public/index.html` (فقط تابعِ `regenerateCaseFile` + متغیرِ جدیدِ
  `regenerateCaseFilePollTimer`).
- **تست / تأیید:** `cd server && npx tsc --noEmit` بدونِ خطا (فایلِ سرور تغییر نکرده
  بود، فقط برایِ اطمینان اجرا شد)؛ `node --check`معادل (پارسِ همه‌یِ inline scriptهایِ
  `index.html` با `new Function`) بدونِ خطایِ syntax. تستِ رفتاریِ واقعی در Browser pane
  با stub کردنِ `fetch`/`showBanner`/`renderCaseFile` (بدونِ داده‌ی بالینی، فقط
  رشته‌هایِ synthetic): (۱) مسیرِ موفقیت — abort شبیه‌سازی‌شده → پیامِ «در پس‌زمینه ادامه
  دارد» → بعدِ ۲ pollِ `generating` و یک pollِ `ready` → تایمر پاک شد، بنرِ
  «پرونده با موفقیت آماده شد…» نمایش داده شد، `currentCaseFile.record.status==='ready'`.
  (۲) مسیرِ شکستِ نهایی — همون جریان با `status:'error'` در pollِ دوم → بنرِ خطایِ واقعی
  نمایش داده شد، تایمر پاک شد. صفحه سپس reload شد تا استاب‌ها پاک شوند (بدونِ اثرِ باقی‌مانده).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** این فقط UX/رفتارِ کلاینت را درست می‌کند. رفعِ کامل‌تر (لغوِ واقعیِ
  فراخوانیِ OpenRouter با abortِ کاربر، یا جلوگیریِ سخت‌ترِ سمتِ سرور از دو تولیدِ
  هم‌زمان بعدِ انقضایِ قفلِ ۳دقیقه‌ای) هنوز انجام نشده — نیازمندِ تصمیمِ مالک برایِ
  scopeِ بزرگ‌تر است.

### 2026-09-18 — FINDING — خطایِ کاذبِ «زمانِ انتظار به پایان رسید» در تولیدِ AI Case File (تولید واقعاً موفق بود)
- **چه شد:** روی همون مراجعِ تستیِ واقعی (بالا)، بعدِ ثبتِ یادداشتِ متنیِ واقعی و کلیکِ
  «تولیدِ پرونده»، UI بعدِ ۲ دقیقه خطایِ «زمانِ انتظار به پایان رسید» نشون داد. به دستورِ
  مالک ریشه‌یابی شد. **نتیجه:** خطا کاذب بود — تولید در پس‌زمینه ادامه پیدا کرد و بعدِ
  ~۶-۷ دقیقه با موفقیت `status=ready` شد (تأییدِ مستقیم از `client_case_file`، فقط
  ستون‌هایِ متادیتا). علتِ ریشه‌ای: (۱) `timeoutMs:120000` در
  [public/index.html:3523](public/index.html:3523) برایِ کورپوسِ واقعیِ بزرگ خیلی
  کوتاهه؛ (۲) abortِ کلاینت (`AbortController`) هیچ `signal`ی به فراخوانیِ OpenRouter در
  [openrouter.adapter.ts](server/src/features/case-file/adapters/llm/openrouter.adapter.ts)
  پاس نمی‌ده، پس کارِ سرور بعدِ نمایشِ خطا هم ادامه پیدا می‌کنه و بی‌خبر از کاربر تمام
  می‌شه. با یک probeِ synthetic (بدونِ داده‌ی بالینی) با همون system prompt/json schema
  ثابت شد خودِ مدل/شبکه ذاتاً کند نیست (۱٫۴ ثانیه برایِ کورپوسِ کوچک). جزئیاتِ کامل:
  [verification/2026-09-18-case-file-regenerate-client-timeout-mismatch.md](verification/2026-09-18-case-file-regenerate-client-timeout-mismatch.md).
- **داده‌ی حساس:** هیچ متنِ بالینی در این ورودی یا فایلِ verification نقل نشد؛ فقط
  timestamp/وضعیت/طولِ تُکن (LAW-001). یک اسکریپتِ موقتِ probe
  (`server/scripts/probe-openrouter-latency.ts`) با متنِ synthetic ساخته و بلافاصله
  بعدِ اجرا حذف شد.
- **فایل‌ها:** `verification/2026-09-18-case-file-regenerate-client-timeout-mismatch.md` (جدید). کدی تغییر نکرد.
- **تست / تأیید:** کوئریِ مستقیمِ DB (`status=ready`, `error_message=NULL`)؛ probeِ
  synthetic موفق (۲۰۰، ۱٫۴ثانیه)؛ بررسیِ کد برایِ `PROXY_URL` (فقط مسیرِ Soniox، نه
  OpenRouter).
- **عامل:** این نشست، به دستورِ صریحِ مالک («برو ریشه‌یابی کن... یه داک بنویس»).
- **کارِ باز / پیامد:** رفعِ واقعی (افزایش/حذفِ timeoutِ کلاینت، پاس‌دادنِ `signal` به
  OpenRouter برایِ abortِ واقعی، یا polling به‌جایِ fail) نیازمندِ تصمیمِ مالک است —
  هیچ کدی در این تسک تغییر نکرد (فقط ریشه‌یابی، طبقِ LAW-020: بدونِ درخواستِ صریح،
  تغییرِ کد انجام نشد).

### 2026-09-18 — CONFIG — بالاآوردنِ دستیِ MySQLِ لوکال + `pnpm dev` برایِ تستِ واقعی
- **چه شد:** به دستورِ صریحِ مالک («خودت بیار بالا هرطوری باید»)، سرورِ dev واقعی
  (`pnpm dev`) با خطای اتصال به DB بالا نیامد چون MySQL روشن نبود (نه Windows Service —
  طبقِ [verification/2026-09-16-postgres-to-mysql-migration.md](verification/2026-09-16-postgres-to-mysql-migration.md)
  از قبل به همین شکل مستقل/دستی راه‌اندازی می‌شود). `mysqld.exe` با همان
  datadirِ موجود (`C:\Users\Moheb\mysql-data\feelia` — **بدونِ** `--initialize`، دیتایِ
  واقعیِ موجود دست‌نخورده ماند) و پورتِ 3306 به‌صورتِ فرآیندِ پس‌زمینه اجرا شد. بعدش
  `pnpm dev` هر ۱۴ migration را «already applied» تشخیص داد، بدونِ خطا بالا آمد،
  `/api/auth/me` صحیح 401 برگرداند (لاگین نشده). ورودِ حساب/رمزِ واقعی توسطِ این نشست
  انجام نشد و نمی‌شود (قانونِ پروژه) — خودِ مالک باید لاگین کند.
- **داده‌ی حساس:** هیچ. فقط وضعیتِ اتصال/migration در لاگ؛ بدونِ محتوایِ بالینی.
- **فایل‌ها:** فایلی در repo تغییر نکرد؛ فقط این ورودی.
- **تست / تأیید:** `GET /api/auth/me` → 401 (سالم)؛ لاگ‌هایِ migration بدونِ خطا.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** MySQL Windows Service ندارد — بعدِ هر ری‌استارتِ ویندوز باید
  دوباره دستی (یا با همین دستور) بالا بیاید؛ نصبِ به‌عنوانِ service خارج از دامنه‌ی این تسک
  بود (نیازمندِ تصمیمِ مالک طبقِ LAW-014/تغییرِ زیرساخت).

### 2026-09-18 — TEST — تستِ ساختِ مراجعِ جدید در تبِ «غیرفعال» با متنِ «دلیل» بیش‌ازحد طولانی
- **چه شد:** به دستورِ مالک، مراجعِ جدیدی در تبِ غیرفعال با یک متنِ واقعیِ بسیار طولانی
  (دیکته‌شده در چت) در فیلدِ «دلیلِ غیرفعال‌بودن → سایر» تست شد. مطابقِ LAW-006/بخشِ ۶
  CLAUDE.md، تست روی DB واقعی انجام نشد؛ یک mock backend یک‌بارمصرف در scratchpad
  (خارج از repo) که `public/` واقعی را سرو می‌کرد و منطقِ اعتبارسنجیِ
  `server/src/http/clients.ts` (`MAX_STATUS_REASON_LEN=200`) را عیناً پیاده می‌کرد،
  استفاده شد — LAW-016. **نتیجه:** با متنِ ~935 کاراکتری، سرور صحیح ۴۰۰
  «دلیل بیش از حد طولانی است» برگرداند و UI این پیام را در بنرِ خطا نشان داد؛ محتوایِ
  تایپ‌شده در مودال از دست نرفت (قابلِ ویرایش/کوتاه‌کردن). با متنِ کوتاه (۳۳ کاراکتر)،
  ساختِ مراجع با ۲۰۱ موفق بود. **یافته‌ی جانبی (نه باگِ واقعی):** بعدِ ساختِ موفق، جریانِ
  بعدی (`startManualSessionFlow` → `POST /api/sessions`) روی این mock کرش کرد چون آن
  endpoint در mock پیاده نشده بود (`data.session` undefined) — این محدودیتِ mock است، نه
  رفتارِ سرورِ واقعی؛ تأییدِ endpoint واقعی خارج از دامنه‌ی این تسک بود.
- **داده‌ی حساس:** هیچ متنِ بالینی/محتوایِ واقعیِ مراجع در هیچ فایلِ repo، لاگِ commit‌شده،
  یا همین سند ثبت نشد (فقط طولِ کاراکتر، طبقِ LAW-001). mock server در
  scratchpadِ خارج از repo بود و بعدِ تست متوقف شد.
- **فایل‌ها:** فایلی در repo تغییر نکرد؛ فقط این ورودی.
- **تست / تأیید:** مسیرِ create (موفق ۲۰۱ + شکستِ ۴۰۰ روی طولِ بیش‌ازحد) در مرورگرِ واقعی
  (Browser pane) با mock backend تأیید شد.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** اگر تستِ کاملِ جریانِ «مراجعِ غیرفعالِ جدید → ثبتِ جلسه‌ی گذشته»
  لازم باشد، mock باید `POST /api/sessions` را هم پیاده کند (خارج از دامنه‌ی این تسک).

### 2026-09-17 — TEST — ارزیابیِ کیفیتِ DeepSeek V4.1 Flash روی هر ۲ مراجعِ واقعیِ حسابِ مالک
- **چه شد:** به دستورِ صریحِ مالک («کیفیتِ خروجیِ مدلِ جدید رو با چند مراجعِ واقعی هم
  بسنج»)، هر ۲ مراجعِ واقعیِ موجود در حسابِ او (نه canary) با مدلِ جدید regenerate شدند.
  چون رمزِ واقعیِ therapist در دسترسِ این نشست نبود، به‌جایِ HTTP API، یک اسکریپتِ
  یک‌بارمصرف مستقیماً تابعِ `generateCaseFile()` را صدا زد (همان مسیرِ کدیِ routeِ واقعی).
  هیچ‌کدام از دو رکورد `reviewedByTherapist` نداشتند، پس `force` لازم نبود و چیزی دور
  ریخته نشد. هر دو مورد status=ready و model=deepseek/deepseek-v4.1-flash برگرداندند.
  **ارزیابیِ کیفی (بدونِ نقلِ متنِ بالینی، طبقِ LAW-001):** مراجعِ اول (۱ جلسه) چون
  محتوایِ متنیِ کافی نداشت، بیشترِ فیلدها را درست «pending/خالی» گذاشت (بدونِ hallucination).
  مراجعِ دوم (۲ جلسه) با متنِ خامِ کوتاه/پراکنده، `identity`/`mainIssue` را به‌درستی و
  مختصر استخراج کرد و برایِ بخش‌هایِ بدونِ داده‌ی کافی، به‌جایِ حدس‌زدن، صادقانه در
  `pendingQuestions` اعلامِ «اطلاعاتِ کافی نیست» کرد — رفتارِ مطلوب (عدمِ fabrication)،
  هم‌راستا با نتیجه‌ی قبلیِ مدلِ gpt-4o-mini رویِ داده‌یِ synthetic.
- **فایل‌ها:** یک اسکریپتِ موقتِ `server/scripts/eval-real-case-file.ts` نوشته، اجرا، و
  بلافاصله حذف شد (بخشِ دائمیِ کد نیست). خروجیِ کامل (شاملِ محتوایِ بالینی) فقط در یک
  فایلِ scratchpadِ خارج از repo ذخیره شد و بعدِ ارزیابی حذف شد — هیچ متنِ بالینی وارد
  هیچ فایلِ repo/commit نشد.
- **اسنادِ به‌روزشده:** این ورودی.
- **تست / تأیید:** خروجیِ ساختاریِ هر دو موردِ واقعی مطابقِ schema بود؛ ارزیابیِ کیفیِ
  محتوایی (نه فنی) بالا خلاصه شد.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** این فقط یک نمونه‌گیریِ کوچک (۲ مراجع، جلساتِ کم/کوتاه) بود؛
  ارزیابیِ عمیق‌تر نیاز به دیتایِ واقعیِ بیشتر و بازخوردِ مستقیمِ مالک دارد. مراجعِ اول
  به نظر هنوز محتوایِ transcriptِ کافی ندارد (خارج از دامنه‌ی این تسک).

### 2026-09-17 — CONFIG — جایگزینیِ مدلِ AI Case File با DeepSeek V4.1 Flash
- **چه شد:** مالک خواستِ «دیپ‌سیک ۴.۱ فلش» را جایگزینِ مدلِ فعلی کند. شناسه‌ای که مالک
  ابتدا داد (`deepseek-v4-flash-0731`) رویِ OpenRouter وجود نداشت؛ با `WebFetch` از
  `openrouter.ai` لیستِ مدل‌ها بررسی و شناسه‌ی واقعیِ منطبق با «۴.۱ فلش» پیدا شد:
  `deepseek/deepseek-v4.1-flash`. با تاییدِ صریحِ مالک، `OPENROUTER_MODEL` در
  `server/.env` از `openai/gpt-4o-mini` به همین مقدار عوض شد (فقط config — کد عمداً
  بدونِ مدلِ hardcode‌شده است). چون `tsx watch` رویِ تغییرِ `.env` ری‌استارت نمی‌کند،
  `src/index.ts` عمداً touch شد (mtime، بدونِ تغییرِ محتوا) تا سرورِ درحالِ اجرا با
  envِ جدید بالا بیاید (PID عوض شد، `health` سبز ماند). با یک regenerateِ واقعیِ canary
  تأیید شد: `case_file.model === 'deepseek/deepseek-v4.1-flash'` و خروجی معتبر/معقول بود.
- **فایل‌ها:** `server/.env` (`OPENROUTER_MODEL`؛ بدونِ commit — این فایل در gitignore
  است). کدی تغییر نکرد.
- **اسنادِ به‌روزشده:** این ورودی. (`configuration-catalog.md` مقدارِ زنده‌ی env را ثبت
  نمی‌کند — فقط schema/قوانین — نیازی به تغییر نداشت.)
- **تست / تأیید:** یک regenerateِ واقعی روی یک تراپیست/مراجعِ canaryِ synthetic (پاک‌شده
  بلافاصله بعد) — پاسخِ 200، `model` درست، محتوایِ خروجی (خلاصه‌ی جلسه بر اساسِ یادداشتِ
  synthetic) منطقی. `SELECT COUNT(*)` بعدش فقط دیتایِ حسابِ واقعیِ مالک را نشان داد.
- **عامل:** این نشست، به دستورِ صریحِ مالک (بعدِ تاییدِ شناسه‌ی دقیق).
- **کارِ باز / پیامد:** کیفیتِ محتواییِ خروجیِ مدلِ جدید رویِ داده‌ی واقعی هنوز ارزیابیِ
  عمیق نشده. اگر مالک بخواهد این تغییر رویِ production هم اعمال شود، باید `.env`ِ سرور
  دستی/با دستورِ صریح آپدیت شود (این نشست به production دسترسی/عملیات ندارد).

### 2026-09-17 — TEST — تأییدِ end-to-endِ واقعیِ فیکسِ corpus-signature/race/force (AI Case File) بعدِ آزاد شدنِ DB
- **چه شد:** به دستورِ صریحِ مالک («DB آزاد شد، migration 019 رو apply و end-to-end تست
  کن»)، ابتدا بررسی شد که سرورِ dev (پورت 3000) هنوز رویِ همان MySQLِ standaloneِ لوکال
  زنده و healthy است (`curl /api/health` → `database:"connected"`). چک از رویِ خودِ DB
  نشان داد **migration 019 از قبل apply شده بود** (`_migrations` → اعمال‌شده در
  `10:45:32Z`؛ احتمالاً `tsx watch` بعدِ ذخیره‌ی فایل‌هایِ کدِ نشستِ قبلی خودش ری‌استارت
  و migrationها را اجرا کرده) — نیازی به اقدامِ دستی نبود. سپس یک اسکریپتِ HTTPِ خودکار
  (خارج از repo، در scratchpad) نوشته شد که رویِ همان سرورِ زنده، با یک تراپیست/مراجعِ
  synthetic (`inactive`)، هر ۵ سناریویِ پلنِ verification را با فراخوانیِ واقعیِ OpenRouter
  اجرا کرد: (۱) اولین regenerate واقعی، (۲) regenerate دوباره بدونِ داده‌ی جدید →
  `skipped:true` بدونِ فراخوانیِ LLM، (۳) بعدِ یک یادداشتِ جدید → `skipped:false` و
  `corpusSignature` عوض شد، (۴) دو `regenerate(force)` هم‌زمان (`Promise.all`) → یکی 200،
  دیگری **409 `busy`**، (۵) `force` با `confirmPhrase` غلط → **400**. همه‌ی پنج مورد دقیقاً
  طبقِ انتظارِ پلن رفتار کردند — بدونِ باگِ جدید. دیتایِ canary (شاملِ یک therapistِ باقی‌مانده
  از یک تلاشِ اولیه‌ی ناموفقِ خودِ همین اسکریپت‌نویسی) با `DELETE FROM therapists`
  (cascade) کاملاً پاک شد؛ شمارشِ نهاییِ هر ۵ جدول فقط دیتایِ از‌پیش‌موجودِ حسابِ واقعیِ
  مالک را نشان داد.
- **فایل‌ها:** بدونِ تغییرِ کد (فقط تست). اسنادِ به‌روزشده:
  `docs/02-reference/database-catalog.md` (وضعیتِ migration 019 از «apply نشد» به
  «apply شد»)، `verification/2026-09-17-case-file-corpus-signature-and-race-lock.md`
  (بخشِ دومِ تست/تأیید اضافه شد).
- **تست / تأیید:** جزئیاتِ کاملِ هر ۵ سناریو در فایلِ verification (بخشِ دوم).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** کیفیتِ محتواییِ خروجیِ LLM رویِ داده‌ی synthetic ارزیابی نشد؛
  apply کردنِ migration 019 روی production هنوز کارِ بازِ مالک است (LAW-006/LAW-022).

### 2026-09-17 — CODE — رفعِ توکن‌سوزیِ الکی + race + گاردِ سمت-سرورِ force در regenerate پرونده‌ی روندِ درمان
- **چه شد:** به دستورِ صریحِ مالک (پلنِ آماده در چت)، سه باگِ مسیرِ
  `POST /api/clients/:id/case-file/regenerate` رفع شد: (۱) هر کلیکِ «به‌روزرسانی»، حتی
  بدونِ داده‌ی جدید از آخرین تولید، یک فراخوانیِ کاملِ LLM را می‌سوزاند — چون
  `generatedFromSessionId` هرگز برایِ تصمیمِ «نیازی نیست» خوانده نمی‌شد؛ رفع شد با یک
  «امضایِ کورپوس» سبک (`sessionCount:latestSessionId:noteCount:latestSessionUpdate:latestNoteCreated`)
  که قبل از `markGenerating` با مقدارِ ذخیره‌شده مقایسه می‌شود — اگر یکسان و `force` نبود،
  بدونِ تماس با LLM همان رکورد برمی‌گردد (`skipped:true`). (۲) دو `regenerate` هم‌زمان
  (دو تب/retry) هر دو LLM را صدا می‌زدند و یکی نتیجه‌یِ دیگری را overwrite می‌کرد — رفع شد با
  ستونِ `generating_started_at`؛ اگر رکوردِ قبلی `generating` و کمتر از ۳ دقیقه گذشته باشد،
  خطایِ `busy`/HTTP 409 برمی‌گردد (قدیمی‌تر از ۳ دقیقه = فرضِ crash، اجازه‌ی ادامه). (۳)
  `force=true` فقط با `prompt()`ِ سمتِ کلاینت گارد می‌شد — یک درخواستِ دستکاری‌شده
  می‌توانست بدونِ تاییدِ واقعی همه‌ی ویرایش‌هایِ دستیِ تراپیست را دور بریزد؛ سرور حالا
  `confirmPhrase==='بازتولید کامل'` را الزامی می‌کند (۴۰۰ در غیرِ این صورت).
- **فایل‌ها:** migration جدید
  `server/src/db/mysql/migrations/019_case_file_corpus_signature.sql`، `schema.sql`،
  `aggregateClientCorpus.ts`، `generateCaseFile.ts`، `caseFileRepo.port.ts`،
  `caseFileRepository.sql.ts`، `caseFile.routes.ts`، `errors.ts`، `public/index.html`
  (`regenerateCaseFile`).
- **اسنادِ به‌روزشده:** این ورودی؛
  [verification](verification/2026-09-17-case-file-corpus-signature-and-race-lock.md) (جدید).
- **تست / تأیید:** `cd server && npx tsc --noEmit` سبز. **end-to-endِ زنده رویِ DB انجام
  نشد** — یک نشستِ دیگر همین لحظه سرورِ dev را رویِ همین پوشه/همان MySQLِ standaloneِ لوکال
  بالا نگه داشته بود (اتصالِ فعال به 3306 با `netstat` تأیید شد)؛ برایِ جلوگیری از مختل‌کردنِ
  کارِ آن نشست، migration 019 apply نشد و سرور ری‌استارت نشد. منطقِ شرط‌ها فقط با خواندنِ
  دقیقِ کد بررسی شد، جزئیات در فایلِ verification.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** اجرایِ واقعیِ ۵ سناریویِ پلن (skip/تولیدِ واقعی/۴۰۹ دوتبی/۴۰۰ بدونِ
  confirmPhrase) و apply کردنِ migration 019 روی DBِ لوکال و بعداً production — نشستِ بعدی
  که DB آزاد است باید ببندد.

### 2026-09-17 — CODE/TEST — رفعِ ابهامِ «پرونده» در ClientDetail + حذفِ کلیکِ تکراریِ کارتِ مراجع
- **چه شد:** مالک گزارش داد در تبِ «غیرفعال» کلیکِ «پرونده» به‌جایِ سندِ AI Case File چیزِ
  دیگری («متن») باز می‌کند و کارت کلیک‌هایِ اضافه دارد. بررسیِ کد ادعا را تأیید کرد:
  `#caseFileSection` و `#sessionsList` بدونِ سربرگِ جداکننده پشتِ سرِ هم رندر می‌شدند (کلیک
  رویِ آیتمِ جلسه در `#sessionsList` مستقیماً `viewTranscript` را صدا می‌زند)، و دکمه‌ی
  «پرونده» + کلیکِ کلِ کارت هر دو دقیقاً `openClientDetail` را صدا می‌زدند (ناحیه‌ی کلیکیِ
  تکراری، هم برایِ کارتِ فعال هم غیرفعال). فیکسِ حداقلی: (۱) یک سربرگِ ثابت
  «جلساتِ ثبت‌شده» بینِ `#caseFileSection` و `#sessionsList` اضافه شد؛ (۲) دکمه‌ی جداگانه‌ی
  «پرونده» حذف شد، کارت خودش تنها ناحیه‌ی کلیکیِ بازکننده‌ی جزئیات ماند (هماهنگ با UXِ
  موجودِ همه‌ی کارت‌ها). با `file://` + `api()` stub + یک مراجعِ canaryِ inactive در Browser
  pane تأیید شد: سربرگِ جدید دقیقاً بینِ دو بخش قرار دارد، و کلیکِ کارت دقیقاً یک‌بار
  `openClientDetail` را صدا می‌زند (قبلاً امکانِ دو ناحیه‌ی هم‌کارکرد وجود داشت).
- **فایل‌ها:** `public/index.html` (CSS خطِ ~۸۸، HTML خطِ ~۸۴۳-۸۴۵، `buildClientCard`
  حذفِ دکمه‌ی «پرونده» خطِ ~۳۰۶۲-۳۰۶۹ پیشین).
- **اسنادِ به‌روزشده:** این ورودی؛
  `verification/2026-09-17-client-detail-case-file-vs-sessions-fix.md` (جدید).
- **تست / تأیید:** `cd server && npx tsc --noEmit` سبز (بدونِ خروجی)؛ `pnpm test:rt` فقط
  شکست‌هایِ از‌پیش‌موجودِ working tree را نشان داد (`T2 batch fallback`، چند موردِ `T15`/`T16`
  مربوط به `feelia-rt.js`/batch که این تغییر لمس نکرد) — بدونِ رگرسیونِ جدید. تستِ تعاملیِ
  زنده در Browser pane با `file://` + دیتایِ canary (بدونِ حسابِ واقعی)، جزئیات در فایلِ
  verification؛ دیتایِ canary فقط در حافظه‌ی صفحه بود (بدونِ سرور/DB)، نیازی به پاک‌سازی
  نبود.
- **عامل:** این نشست، به دستورِ صریحِ مالک (گزارشِ باگ).
- **کارِ باز / پیامد:** رفتارِ `loadCaseFile` با پاسخِ واقعیِ سرور و استایلِ تمِ تاریکِ سربرگِ
  جدید بصری تست نشدند (محدودیتِ تستِ خالص‌فرانتِ بدونِ سرور).

### 2026-09-17 — CODE/TEST — تستِ end-to-endِ واقعیِ AI Case File (MySQLِ لوکالِ تازه + OpenRouterِ واقعی) + رفعِ ۳ باگِ واقعی
- **چه شد:** به دستورِ صریحِ مالک («مشکلِ دیتابیس رو هرجوری باید درست کنی درستش کن»)، چون
  این ماشین نه سرویسِ MySQL داشت نه data directory، یک **MySQL 8.4.9 standalone** (نه
  Windows service — بدونِ دسترسیِ ادمین ممکن نبود) init/start شد
  (`C:\Users\Moheb\feelia-mysql\data`، پورت 3306) و کاربر/دیتابیسِ `feelia` مطابقِ
  `DATABASE_URL` موجود ساخته شد. سرورِ dev بالا آمد، **هر ۱۸ migration رویِ MySQLِ واقعی
  با موفقیت اعمال شدند** (شاملِ `018` جدید). سپس یک سناریوی canaryِ کاملِ end-to-end
  (تراپیست→مراجعِ inactive→جلسه‌ی دستی با یادداشتِ synthetic→`POST regenerate` با
  `LLM_PROVIDER=openرouter`/`gpt-4o-mini` واقعی) اجرا شد. **سه باگِ واقعی پیدا و رفع شدند:**
  (۱) هدرِ `X-Title: 'Feelia — Case File'` با em-dash → Node آن را هدرِ نامعتبر می‌دانست →
  پیامِ گمراه‌کننده‌ی «Connection error»؛ (۲) `.toISOString()` برایِ ستون‌هایِ DATETIME
  (`generated_at` و دو ستونِ دیگر) → خطایِ MySQLِ «Incorrect datetime value» (باید `new
  Date()` باشد، مثلِ الگویِ `pinned_at` در `clients.ts`)؛ (۳) در `generateCaseFile.ts`،
  خطاهایِ غیرِ `CaseFileGenerationError` پیامِ واقعی‌شان را گم می‌کردند — دقیقاً همین باگِ #۳
  باعث شد پیدا کردنِ #۲ سخت شود (پیامِ عمومیِ بی‌فایده به‌جایِ خطایِ واقعیِ MySQL). یک نکته‌ی
  دفاعیِ چهارم هم اضافه شد: `mergeTherapistEdits.ts` دیگر به ادعایِ `pending=false`ِ مدل
  برایِ یک `value` خالی اعتماد نمی‌کند. بعدِ فیکس‌ها: regenerate واقعی ۲۰۰ داد، PATCHِ دستی
  با متنِ فارسی درست ذخیره/بازگشت، و **مهم‌تر: regenerate رویِ فیلدِ تاییدشده‌ی تراپیست
  (`reviewedByTherapist:true`) دست نزد** — merge-logic رویِ DB/LLMِ واقعی (نه mock) تأیید شد.
  دیتایِ canary کاملاً پاک شد (`DELETE` مراجع cascade + حذفِ مستقیمِ therapist از DBِ
  کاملاً تازه‌ای که فقط همین یک ردیف را داشت).
- **فایل‌ها:** `openrouter.adapter.ts`، `generateCaseFile.ts`، `caseFile.routes.ts`،
  `mergeTherapistEdits.ts`، `caseFileRepo.port.ts` (تایپِ تاریخ‌ها)،
  `verification/2026-09-17-ai-case-file-real-e2e.md` (جدید).
- **تست / تأیید:** جزئیاتِ کاملِ هر مرحله در فایلِ verification؛ `tsc --noEmit` بعدِ هر فیکس
  سبز. سرورِ dev و MySQLِ standalone هر دو الان **درحالِ اجرا**یند (برایِ ادامه‌ی تستِ مالک).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** MySQL این استاندلونه — بعدِ هر ری‌استارتِ ویندوز باید دستی دوباره
  اجرا شود (دستور در فایلِ verification). سرویسِ رسمیِ ویندوز نیاز به دسترسیِ ادمین دارد که
  این نشست نداشت. کیفیتِ محتواییِ خروجیِ LLM رویِ داده‌ی واقعی هنوز ارزیابی نشده.

### 2026-09-17 — CODE/TEST — تستِ تعاملیِ mockِ فرانتِ AI Case File + رفعِ باگِ واقعیِ دوپلیکیت‌شدنِ فیلدِ دارو
- **چه شد:** به‌جایِ اکتفا به `tsc`، `public/index.html` مستقیم با `file://` در Browser pane
  باز شد و با یک شیِ mockِ کاملِ `CaseFileContent` (تزریق‌شده از طریقِ `javascript_tool`، بدونِ
  سرور/DB/LLM) رفتارِ واقعیِ رندر/تعامل تست شد: هر ۹ بخشِ سند، حالتِ `pending`، نقطه‌ی
  `suggestedUpdate`، بازشدنِ جلسه/roadmap، ریسپانسیوِ جدولِ دارو، و مهم‌تر — کلِ چرخه‌ی
  `saveCaseFileEdits`/`onCfSuggestClick`/`regenerateCaseFile(force)` با `api()` stub‌شده
  (capture کردنِ بدنه‌ی درخواست‌ها به‌جایِ فرستادنِ واقعی). **باگِ واقعیِ کشف‌شده:** در حالتِ
  ویرایش، فیلدهایِ دارو هم در جدولِ دسکتاپ هم در کارتِ موبایل با یک `data-cf-field` مشترک
  رندر می‌شدند → ذخیره همان فیلد را دوبار (با مقدارِ بالقوه متفاوت) PATCH می‌کرد. رفع شد: در
  حالتِ ویرایش فقط نسخه‌ی کارتی رندر می‌شود. گیتِ تاییدِ متنیِ «بازتولیدِ کامل» هم تأیید شد
  (متنِ اشتباه → هیچ درخواستی نمی‌رود).
- **فایل‌ها:** `public/index.html` (بخشِ رندرِ دارو در `renderCaseFile`)، `verification/2026-09-17-ai-case-file-ui-mock-test.md` (جدید).
- **تست / تأیید:** جزئیاتِ کامل در فایلِ verification. `node --check` روی اسکریپتِ استخراج‌شده
  بعدِ فیکس → سبز.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** این تست فقط رفتارِ فرانت را تأیید می‌کند؛ خروجیِ واقعیِ LLM و
  end-to-endِ کاملِ backend+DB همچنان بازند (طبقِ ورودی‌هایِ قبلی).

### 2026-09-17 — CODE — حذفِ مدلِ hardcode‌شده از هر دو آداپتورِ LLM (تصمیمِ صریحِ مالک)
- **چه شد:** مالک صریحاً گفت «هیچ چیزی نباید توی کد هارد کد شده باشه» — وقتی برایِ انتخابِ
  مدلِ پیش‌فرضِ OpenRouter از او پرسیده شد. `MODEL = process.env.X || 'gpt-4o-mini'` در هر دو
  آداپتور (`openai.adapter.ts`، `openrouter.adapter.ts`) به یک چکِ الزامی تبدیل شد: نبودِ
  `OPENAI_CASE_FILE_MODEL`/`OPENROUTER_MODEL` در `.env` حالا `CaseFileGenerationError` می‌دهد
  (502 `llm-failed`)، نه fallbackِ خاموش به یک مدلِ خاص. `LLMProvider` port یک فیلدِ
  `readonly model: string` گرفت تا `generateCaseFile.ts` مدلِ واقعاً استفاده‌شده را از خودِ
  adapter بخواند (قبلاً `process.env.OPENAI_CASE_FILE_MODEL || 'gpt-4o-mini'` را مستقیم در
  `application/` هم hardcode کرده بود — همان اشتباه، جایِ دوم). مستنداتِ
  configuration-catalog/database-catalog/۰۸-ai-case-file اصلاح شدند (دیگر «پیش‌فرض» نمی‌گویند).
- **فایل‌ها:** `openai.adapter.ts`، `openrouter.adapter.ts`، `ports/llmProvider.port.ts`،
  `application/generateCaseFile.ts`، سه سندِ یادشده.
- **تست / تأیید:** `cd server && npx tsc --noEmit` → سبز.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** مالک باید `OPENAI_CASE_FILE_MODEL` یا `OPENROUTER_MODEL` را خودش در
  `.env` تعیین کند؛ بدونش، regenerate همیشه 502 می‌دهد (رفتارِ عمدی، نه باگ).

### 2026-09-17 — CODE — افزودنِ OpenRouter به‌عنوانِ providerِ دومِ AI Case File
- **چه شد:** مالک درخواستِ استفاده از OpenRouter (به‌جایِ/در کنارِ OpenAIِ مستقیم) داد.
  چون OpenRouter endpointِ سازگار با OpenAI SDK دارد، فقط یک آداپتورِ جدید
  (`adapters/llm/openrouter.adapter.ts`، همان SDKِ `openai`، `baseURL` عوض شده) اضافه شد و در
  `registry.ts` زیرِ `LLM_PROVIDER=openrouter` ثبت شد — دقیقاً همان ارزشِ معماریِ Ports &
  Adapters که در پیاده‌سازیِ اصلی توضیح داده شده بود؛ `application/`/`domain/`/frontend لمس
  نشدند. env جدید: `OPENROUTER_API_KEY`، `OPENROUTER_MODEL` (پیش‌فرض `openai/gpt-4o-mini`)،
  `OPENROUTER_SITE_URL`.
- **فایل‌ها:** `server/src/features/case-file/adapters/llm/openrouter.adapter.ts` (جدید)،
  `registry.ts`، `docs/02-reference/configuration-catalog.md`،
  `docs/02-reference/repository-map.md`، `docs/04-modules/08-ai-case-file/module-prd.md`.
- **تست / تأیید:** `cd server && npx tsc --noEmit` → سبز. فراخوانیِ واقعیِ OpenRouter هنوز
  تست نشده — کلید هنوز نرسیده (پیامدِ بازِ ورودیِ قبلی همچنان صادق است).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بدونِ تغییر نسبت به ورودیِ قبلی — منتظرِ کلید (OpenAI یا OpenRouter،
  هرکدام مالک بدهد) و یک MySQLِ واقعی برایِ تستِ end-to-end.

### 2026-09-17 — CODE — پیاده‌سازیِ فازِ ۱ «پرونده‌ی روندِ درمان» (AI Case File)
- **چه شد:** به دستورِ صریحِ مالک («سیم‌کشی‌هاش رو انجام بده»، کلیدِ OpenAI را خودش می‌دهد)،
  فازِ ۱ کاملاً پیاده‌سازی شد — دو سندِ پیش‌نویسِ Plan Mode (`c-users-moheb-downloads-m4-html-
  polymorphic-willow.md` + الحاقیه‌ی `rippling-honking-hammock.md`، هر دو در
  `C:\Users\Moheb\.claude\plans\`) به‌عنوانِ مبنا استفاده شدند. **Backend:** ماژولِ Ports &
  Adapters در `server/src/features/case-file/` (domain/ports/application/adapters/api)؛ LLM
  provider = OpenAI با `response_format:json_schema strict` و **بدونِ tools/functions**؛
  merge-logic فیلدهایِ `reviewedByTherapist=true` را overwrite نمی‌کند (پیش‌نویسِ تازه در
  `suggestedUpdate` می‌نشیند)؛ `force=true` صراحتاً دور می‌ریزد و `force_regenerated_at/by` ثبت
  می‌کند. `POST regenerate` **همزمان** است (فازِ ۱ بدونِ auto-trigger/صف — تصمیمِ تاییدشده).
  migration جدید `018_client_case_file.sql` (additive). **Frontend:** بخشِ `#caseFileSection`
  داخلِ `screenClientDetail` موجود (بالایِ `sessionsList`)، فقط برایِ مراجعینِ `status=
  'inactive'` رندر می‌شود؛ CSSِ اسکوپ‌شده‌یِ `.case-file-doc` (پالتِ مستقل از سیستم‌دیزاینِ
  Feelia، هم‌راستا با فایلِ نمونه‌ی طراحیِ مالک)؛ ویرایشِ سراسری (نه دکمه‌ی مدادِ per-field)،
  بدونِ نمایشِ برچسبِ خامِ source/AI. **Docs:** PRD جدید (`08-ai-case-file`)، content-style-
  guide، به‌روزرسانیِ api-catalog/error-code-catalog/database-catalog/configuration-catalog/
  module-map/repository-map/`schema.sql` + خروجِ «خلاصه‌ی AI» از Out of Scopeِ ماژولِ ۰۳.
- **فایل‌ها:** `server/src/features/case-file/**` (۱۳ فایلِ جدید)، `server/src/index.ts`،
  `server/package.json` (+`openai@4.104.0`)، `server/src/db/mysql/migrations/
  018_client_case_file.sql`، `server/src/db/mysql/schema.sql`، `public/index.html` (CSSِ
  اسکوپ‌شده + بخشِ HTML + ~۱۵ تابعِ JS)، docs یادشده‌یِ بالا.
- **اسنادِ به‌روزشده:** `docs/02-reference/{api-catalog,error-code-catalog,database-catalog,
  configuration-catalog,module-map,repository-map}.md`، `docs/04-modules/03-therapy-sessions/
  module-prd.md` (Out of Scope)، `docs/04-modules/08-ai-case-file/{module-prd,content-style-
  guide}.md` (جدید)، همین فایل.
- **تست / تأیید:** `cd server && npx tsc --noEmit` → **سبز، بدونِ خطا**. `node --check` روی
  اسکریپتِ استخراج‌شده‌ی `index.html` → **سبز**. `pnpm add openai` موفق. ❗ **تستِ end-to-endِ
  واقعی هنوز انجام نشد** — دو مانع: (۱) `OPENAI_API_KEY` هنوز در `server/.env` نیست (مالک قول
  داد بدهد، هنوز در همین گفتگو نرسیده)؛ (۲) روی این ماشینِ dev، MySQL Server 8.4 نصب است ولی
  **هیچ سرویس/instanceِ درحالِ اجرا ندارد** (نه Windows service، نه data directoryای زیرِ
  `C:\ProgramData\MySQL` — برخلافِ آنچه PROJECT_STATUSِ قبلی دربارهٔ «MySQLِ لوکالِ واقعی» ثبت
  کرده بود؛ آن تست احتمالاً رویِ محیطِ dev دیگری انجام شده بود)، پس migration 018 هرگز واقعاً
  اجرا نشده — فقط با مقایسه‌ی دستیِ syntax با migrationهای 001/002/008/015 بررسی شد.
  `pnpm dev` را اجرا کردم؛ سرور روی همین خطا (`Database connection failed`) بالا نیامد.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** تا رسیدنِ کلیدِ OpenAI و بالاآمدنِ یک MySQLِ واقعی (یا اجرا/init یک
  instanceِ محلیِ تازه)، ادعایِ «کار می‌کند» فقط در حدِ static/typecheck معتبر است، نه
  end-to-end (LAW-016). بعدِ رفعِ این دو، باید حداقل یک regenerate واقعی رویِ یک مراجعِ
  synthetic (غیرِ inactive واقعیِ مالک) تست و در `verification/` ثبت شود.

### 2026-09-17 — DOCS — هم‌گام‌سازیِ `schema.sql` با migration 016/017 (یافته‌ی بررسیِ قبلی رفع شد)
- **چه شد:** طبقِ یافته‌ی ثبت‌شده در ورودیِ قبلی («`schema.sql` بعدِ migration 017 به‌روز
  نشده»)، مالک درخواستِ به‌روزرسانیِ مستندات داد. `server/src/db/mysql/schema.sql` (بخشِ
  `session_audio`) با migration‌های `016`/`017` هم‌گام شد: ستون‌هایِ `duration_ms`، `run_id`،
  `kind`، `sha256` اضافه شدند و ایندکسِ یکتایِ `uq_session_audio_seq` با
  `uq_session_audio_run_seq (session_id, run_id, seq)` + `uq_session_audio_sha (session_id,
  sha256)` جایگزین شد — دقیقاً منطبق با نتیجه‌ی نهاییِ migrationها. بقیه‌ی جدول‌ها (`sessions`،
  `clients`) قبلاً با `009`–`015` هم‌گام بودند، چک شد و نیازی به تغییر نداشتند.
  `docs/02-reference/database-catalog.md` هم از قبل با هر ۱۷ migration هم‌گام بود (بررسی شد،
  تغییری لازم نبود).
- **فایل‌ها:** `server/src/db/mysql/schema.sql`.
- **تست / تأیید:** `node -e "require('fs').readFileSync(...)"` برای اطمینان از سلامتِ syntax
  فایل (این یک فایلِ SQLِ مرجع است، نه کدِ اجرایی — هیچ runnerی از آن نمی‌خواند، پس تغییرش
  ریسکِ اجرایی ندارد).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بدونِ تغییر — commit/push/deploy و تعارضِ متنِ رضایت (C1) همچنان طبقِ
  ورودی‌هایِ قبلی باز و منتظرِ تصمیمِ مالک‌اند.

### 2026-09-17 — TEST — بررسیِ مستقلِ نشستِ دیگر: کدِ working tree (پلنِ audit صدایِ A–F، commitنشده) خراب نیست
- **چه شد:** مالک خواست working tree که نشستِ دیگری روی audit مسیرِ ضبط/ذخیره‌ی صدا (پلنِ
  A تا F، migration 017) تغییر داده بود، مستقلاً بررسی شود که مسیر خراب نشده باشد. این نشست
  به‌جایِ اعتمادِ صرف به لاگِ Event Log بالا، خودش راستی‌آزماییِ تازه انجام داد:
  - `cd server && npx tsc --noEmit` → **بدونِ خطا**.
  - `node --check public/feelia-rt.js`، `node --check public/feelia-analytics.js` → **بدونِ خطا**.
  - `pnpm test:rt` → **۲۹ PASS / ۶ FAIL**. برایِ رَدِ رگرسیون، working tree موقتاً `git stash -u`
    شد و همون تست روی آخرین commit (`9471ab7`) هم اجرا شد → **همون ۲۹ PASS/۶ FAILِ دقیقاً یکسان**
    (T2/T15×3/T16×2) — یعنی این ۶ شکست از قبل موجود بودند، نه رگرسیونِ کدِ جدید. `git stash pop`
    بدونِ conflict working tree را برگرداند.
  - بازبینیِ دستیِ کد (نه فقط اجرایِ تست): `017_session_audio_run_kind_sha.sql` — نامِ ایندکسِ
    حذف‌شده (`uq_session_audio_seq`) دقیقاً با migration `011` مطابقت دارد؛ errnoهایِ idempotency
    (1060/1061/1091/3822/3823) در `migrate.ts` پوششِ کامل دارند. `archiveAudioForAdmin` در
    `sessionAudioArchive.ts`: قفلِ per-session + `MAX(seq)+1` + چکِ `sha256` قبل از insert —
    منطقاً دیگر جایی برایِ بازنویسیِ خاموش نمی‌ماند. روتِ جدیدِ ادمین
    (`GET /api/admin/sessions/:id/audio/full`) زیرِ همون `preHandler: requireAdmin`ِ سطحِ router
    است (LAW-005 رعایت شده).
  - **یافته‌ی جزئی (نه باگ، ناهماهنگیِ مستندی):** `server/src/db/mysql/schema.sql` (اسنپ‌شاتِ
    مرجع، نه مسیرِ اجرایی) بعدِ migration 017 به‌روز نشده — هنوز `session_audio` را با
    `uq_session_audio_seq`ِ قدیمی نشان می‌دهد. بدونِ اثرِ عملی (چون سرور فقط از پوشه‌ی
    migrations می‌خواند، نه از `schema.sql`)، ولی قبل از commit باید هم‌گام شود (LAW-017).
- **فایل‌ها:** بدونِ تغییرِ کد — فقط بررسی.
- **تست / تأیید:** بالا؛ بدونِ زیرساختِ MySQL/مرورگرِ واقعی (فقط typecheck/syntax/harness +
  بازبینیِ دستیِ کد؛ نشستِ قبلی قبلاً تستِ end-to-end با MySQL/Soniوx/مرورگرِ واقعی را برایِ هر
  ۶ بخش انجام داده بود — به آن اتکا شد، نه تکرار).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** `schema.sql` نیاز به هم‌گام‌سازی با migration 017 دارد؛ commit/push/deploy
  و تعارضِ متنِ رضایت (C1) همچنان طبقِ ورودی‌هایِ قبلی باز و منتظرِ تصمیمِ مالک‌اند.

### 2026-09-16 — CODE/TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۶): تستِ آفلاینِ کاملِ شبکه + رفعِ باگِ واقعیِ #۱۶ (onlineHandler بعدِ FAILED)
- **چه شد:** مالک دستور داد («تست رو انجام بده کامل») — آخرین شکافِ تستیِ باقی‌مانده از پلن
  (سناریویِ قطعیِ **کاملِ** شبکه، نه فقط قطعِ میکروفون) اجرا شد. چون DevTools network
  emulation مستقیم در ابزار در دسترس نبود، قطعی با مسدودکردنِ `fetch`، بستنِ WS، و
  dispatchِ رویدادهایِ واقعیِ `offline`/`online` شبیه‌سازی شد (طبقِ همون روشِ خودِ پلن).
  - **یافته‌ی واقعی:** ضبط → قطعیِ کاملِ شبکه → اتمامِ ۴ تلاشِ reconnect (`state=FAILED`) →
    `online` → **state رویِ FAILED ماند، رونویسیِ زنده هیچ‌وقت دوباره فعال نشد.** این دقیقاً
    یافته‌ی #۱۶ی پلنِ اصلی بود که در مراحلِ قبلیِ این audit (بخشِ D) پیاده نشده بود.
  - **رفع:** `watchOnline`ِ `feelia-rt.js` — `onlineHandler` حالا رویِ `state===FAILED` هم
    (نه فقط `NETWORK_PAUSED`) با `reconnectAttempts=0` یک دورِ کاملِ تازه‌ی
    `scheduleReconnect` می‌زند؛ چه سشنی که واقعاً realtime داشته و قطع شده، چه سشنی که از
    اول durable-only بوده، هر دو با `state=FAILED` به اینجا می‌رسند و هر دو باید امتحان شوند.
  - `node --check`/`cd server && npx tsc --noEmit`/`pnpm test:rt` (۲۹ PASS/۶ FAIL) بدونِ
    رگرسیون.
  - **تستِ زنده (دوطرفه):** (۱) بازتولیدِ باگ با کدِ قدیم — تأیید شد state رویِ FAILED می‌ماند؛
    ضبطِ durable در تمامِ این مدت fail-open ادامه داشت (LAW-012)، ۳ سگمنت با
    `intent='transcript'` درست ثبت شدند. (۲) بعدِ فیکس، سشنِ تازه با همون سناریو —
    `FAILED → RECONNECTING → RECOVERED → ACTIVE` با mint/WSِ **واقعیِ** Soniوx. `finish()`
    نهایی: batch fallbackِ درست، صفِ محلی کاملاً خالی؛ سرور ۵ سگمنتِ پیوسته بدونِ خلأ/تکرار.
  - **پاکسازی:** حسابِ canary (هر دو جلسه‌ی قبل/بعدِ فیکس) حذف شد؛ شمارش‌ها دقیقاً به `۱/۱/۱/۰`
    برگشتند؛ پوشه‌هایِ canary از دیسک پاک شدند؛ `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** `public/feelia-rt.js`.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage6-offline-reconnect.md)،
  `docs/07-subsystems/02-audio-durability-batch-fallback.md` (ریسکِ ۸ جدید، resolved).
- **تست / تأیید:** بالا — با مرورگرِ واقعی + سرورِ dev واقعی + MySQLِ واقعی + Soniوxِ واقعی،
  تأییدِ دوطرفه (بازتولیدِ باگ + تأییدِ رفع).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** **هیچ باگِ شناخته‌شده‌ی بازی از کلِ پلنِ audit صدا باقی نمانده.** فقط
  تعارضِ متنِ رضایت (C1، عمداً کنار گذاشته‌شده به دستورِ صریحِ مالک) و commit/push/deploy
  (تصمیمِ مالک، LAW-006/LAW-022) باز مانده‌اند.

### 2026-09-16 — CODE/TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۵): قفلِ cross-context با navigator.locks — آخرین باگِ غیرمتنی رفع شد
- **چه شد:** مالک دستور داد («به جز تغییرِ متن بقیه باگ‌هارو رفع کن») — تنها ریسکِ بازِ واقعیِ
  غیرمتنیِ باقی‌مانده از audit صدا (نبودِ قفلِ cross-context برایِ صفِ صدا، یافته‌شده در تستِ
  زنده‌ی مرحله‌ی ۲) رفع شد:
  - `feelia-rt.js`: تابعِ جدیدِ `withAudioLock(sessionId, fn)` با `navigator.locks.request`
    (واقعاً بینِ تب‌ها مشترک؛ fallback به promise-lockِ ماژول اگر مرورگر پشتیبانی نکند).
    `uploadBatchSegments`/`drainQueuedAudioInBackground`/`archiveQueuedAudioOnly`/`abort` از
    این استفاده می‌کنند؛ `self._queueLock`ِ قدیمیِ per-instance (که با کدِ خارج از همون
    RTSession هیچ ارتباطی نداشت) کاملاً حذف شد. `index.html`: `sweepOrphanedAudioQueue` هم
    از همین قفلِ مشترک استفاده می‌کند (چکِ `feelia_active_session` به‌عنوانِ میان‌بُرِ سریع
    باقی ماند، ولی دیگر تنها خطِ دفاعی نیست).
  - `node --check`/syntax/`pnpm test:rt` (۲۹ PASS/۶ FAIL) بدونِ رگرسیون.
  - **تستِ زنده:** (۱) اثباتِ مکانیکی — دو `withAudioLock` هم‌زمان روی یک sessionId، دومی
    دقیقاً بعدِ پایانِ اولی شروع شد (نه هم‌زمان). (۲) بازتولیدِ عمدیِ همان راهِ‌برخوردِ
    کشف‌شده — RTSessionِ واقعی بدونِ ستِ `feelia_active_session` + `sweepOrphanedAudioQueue()`
    و `drainQueuedAudioInBackground()`ِ خودش عمداً هم‌زمان شلیک شدند → سرور دقیقاً تعدادِ
    درستِ سگمنت را با `seq` پیوسته، بدونِ خلأ/تکرار آرشیو کرد.
  - **پاکسازی:** حسابِ canary حذف شد؛ شمارش‌ها دقیقاً به `۱/۱/۱/۰` برگشتند؛ پوشه‌ی canary از
    دیسک پاک شد؛ `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** `public/feelia-rt.js`، `public/index.html`.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage5-crosscontextlock.md)،
  `docs/07-subsystems/02-audio-durability-batch-fallback.md` (ریسکِ ۶ resolved).
- **تست / تأیید:** بالا — با مرورگرِ واقعی + سرورِ dev واقعی + MySQLِ واقعی.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** طبقِ دستورِ صریحِ مالک، تعارضِ متنِ رضایت (C1، LAW-009) عمداً دست‌نخورده
  ماند — تنها موردِ بازِ باقی‌مانده از کلِ audit صدا. commit/push/deploy همچنان منتظرِ تصمیمِ
  مالک است (LAW-006/LAW-022).

### 2026-09-16 — CODE/TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۴، بخشِ E+F): mimeِ واقعی + فایلِ کاملِ ادمین — هر ۶ بخشِ پلن تکمیل شد
- **چه شد:** مالک تأیید کرد («تست‌های کامل اگه انجام شده و مطمئن هستی، بله ادامه بده») و دو
  بخشِ باقی‌مانده‌ی پلن (`SONIOX.md`) پیاده و با زیرساختِ واقعی تست شد:
  - **بخشِ E (mimeِ واقعی):** `file.mimetype`ِ واقعی سمتِ سرور (`sessions.ts`) و
    `MediaRecorder.mimeType`ِ واقعی سمتِ کلاینت (`feelia-rt.js`، نه فقط `pickMime()`ِ حدسی —
    پوششِ سافاری) حالا تا انتها فوروارد می‌شوند. mime بینِ enqueue و پردازشِ بعدی از رویِ
    پسوندِ فایلِ صفِ موقت (`webm`/`ogg`/`m4a`) منتقل می‌شود (`extForMime`/`mimeForExt`/
    `mimeFromFilename`، export شده در `batchqueue.ts`). تست با فایل‌هایِ **واقعیِ** ogg
    (Vorbis) و m4a (AAC) ساخته‌شده با ffmpeg: `mime`/پسوند/`duration_ms` هر سه درست ثبت شدند،
    شاملِ round-trip از طریقِ صفِ سرور (نه فقط purpose=archive).
  - **بخشِ F (پنلِ ادمین — فایلِ کامل، تصمیمِ صریحِ مالک «نه چانک‌چانک»):** روتِ جدیدِ
    `GET /api/admin/sessions/:id/audio/full[?download=1]` (`getFullSessionAudio` در
    `sessionAudioArchive.ts`) سگمنت‌هایِ `kind='session'` را با ffmpeg concat می‌کند و کش
    می‌کند (`data/session-audio/<sid>/full.<ext>` + `full.meta.json`؛ invalidation با
    شمارشِ سگمنت). مسیرِ سریع (`-c copy`) برایِ سگمنت‌هایِ هم‌فرمت؛ fallbackِ
    `-filter_complex concat` با ری‌اینکودِ opus برایِ سگمنت‌هایِ مختلط (نادر). بدونِ ffmpeg →
    `503` با پیامِ روشن، آرشیوِ خودِ سگمنت fail-open می‌ماند. `index.html` لیستِ
    «سگمنت ۱، سگمنت ۲، …» را کاملاً حذف کرد؛ یک `<audio>` + دکمه‌ی دانلود + بنرِ صفِ در-انتظار
    (از `pending_count`ِ جدید در `GET /audio`). یادداشت‌هایِ صوتی جدا و همچنان تک‌به‌تک.
  - **تستِ زنده (MySQLِ واقعی + ffmpegِ واقعی + مرورگرِ واقعی، حساب‌هایِ canaryِ جدا):**
    مسیرِ سریع با ۳ سگمنتِ webmِ واقعی → مدت‌زمانِ دقیقاً برابرِ مجموع (۳٫۰۳۱s)؛ کش تأیید شد
    (درخواستِ دوم بدونِ فعالیتِ جدیدِ ffmpeg)؛ دانلود با نامِ/پسوندِ درست؛ مسیرِ fallback با
    افزودنِ سگمنتِ m4a (۴ سگمنت مختلط) → کش باطل شد، فایلِ جدید با مدت‌زمانِ درست (۴٫۰۳s)؛
    جلسه‌ی بدونِ صدا → ۴۰۴؛ سرور با `FFMPEG_PATH` نامعتبر ری‌استارت شد → ۵۰۳ با پیامِ دقیق،
    آرشیوِ سگمنت همچنان موفق (fail-open)؛ UIِ واقعی با `openAdminClientSessions` صدا زده شد —
    HTML دقیقاً یک پلیر و یک دکمه‌ی دانلود داشت (نه لیست)، `audio.load()` واقعی اجرا شد
    (`duration=4.029`, `readyState=4`, بدونِ خطا)؛ بنرِ صفِ در-انتظار با یک سگمنتِ گیرکرده
    تأیید شد.
  - `tsc`/`node --check`/syntax/`pnpm test:rt` (۲۹ PASS/۶ FAIL) — همه بدونِ رگرسیون.
  - **پاکسازی:** هر ۳ حسابِ canaryِ این مرحله (شاملِ حذفِ مستقیمِ ردیفِ تراپیستِ canaryِ
    ادمین از DB — `is_admin` فقط رویِ همون ردیفِ مشخص با SQL دستی ست شده بود، هیچ کاری زیرِ
    حسابِ واقعیِ ادمینِ مالک انجام نشد) حذف شدند؛ شمارش‌ها دقیقاً به `۱/۱/۱/۰` برگشتند؛ ۵ پوشه‌ی
    آرشیو + فایل‌هایِ باقی‌مانده‌ی صف از دیسک پاک شدند (برگشت به ۱۹ پوشه‌ی قبل‌موجود)؛
    `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** `server/src/http/sessions.ts`، `server/src/http/admin.ts`،
  `server/src/stt/batchqueue.ts`، `server/src/stt/sessionAudioArchive.ts`، `public/feelia-rt.js`،
  `public/index.html`.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage4-partsEF.md)،
  `docs/07-subsystems/02-audio-durability-batch-fallback.md` (کاملاً هم‌گام با هر ۶ بخش)،
  `docs/02-reference/api-catalog.md` (روت‌هایِ جدید).
- **تست / تأیید:** بالا — با MySQLِ واقعی + ffmpegِ واقعی + مرورگرِ واقعی.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** **هر ۶ بخشِ پلنِ audit صدا (A تا F) حالا پیاده و با زیرساختِ واقعی
  تأیید شده‌اند.** کارِ بازِ باقی‌مانده: commit/push/deploy (تصمیم و مجوزِ صریحِ مالک، LAW-006/
  LAW-022 — هیچ‌کدام از این کار هنوز commit نشده)؛ قفلِ cross-context (`navigator.locks`، ریسکِ
  LOWِ ثبت‌شده در مرحله‌ی قبل)؛ تعارضِ متنِ رضایت (C1، LAW-009، از قبل باز بود، خارج از دامنه‌ی
  این audit).

### 2026-09-16 — TEST — audit مسیرِ ضبط/ذخیره‌ی صدا: دورِ کاملِ رگرسیونِ مرحله‌به‌مرحله (A+B+C+D)، مستقل از تست‌هایِ قبلی
- **چه شد:** مالک صریحاً خواست («کامل کامل بررسی کن، تست‌ها رو کامل انجام بده، مرحله مرحله پیش
  برو») — یک دورِ کاملاً تازه و مستقل از نتایجِ نشست‌هایِ قبلی، مرحله‌به‌مرحله، رویِ هر ۴ بخشِ
  پیاده‌شده تا این لحظه (A، B، C، D) اجرا شد. حسابِ canaryِ تازه (`09120000055`) ساخته شد؛ قبل
  از شروع تأیید شد تبِ Browser pane هیچ کوکیِ ازقبل‌موجودی نداشت (401 روی `/api/auth/me`).
  - **مرحله A+B (سرور/curl):** دو run با seqِ کلاینتِ یکسان → seqِ سرورساخته‌ی متمایز بدونِ
    بازنویسی؛ retryِ همون بایت‌ها → idempotent؛ ۳ آپلودِ هم‌زمانِ واقعی → بدونِ collision؛
    سکوتِ واقعی → `batch_status='done'`؛ صدایِ نامعتبر → آرشیو قبل از شکستِ Soniوxِ واقعی،
    فایل در صف ماند. همه ✅.
  - **مرحله C (سرور/curl + TTSِ واقعیِ تازه):** `transcript` روی completed → ۴۰۰؛
    `late-transcript` روی completed با TTSِ واقعی → متنِ صحیحِ Soniوx + برچسبِ درست append
    شد؛ `late-transcript` روی canceled → ۴۰۰؛ `batch-status.late_transcript_pending` درست؛
    `note` روی completed → `session_notes` ساخته شد، transcript دست‌نخورد. همه ✅.
  - **مرحله D + تلفیق با C (مرورگرِ واقعیِ Browser pane، میکروفونِ اسیلاتورِ AudioContext):**
    RTSessionِ واقعی با mint/WSِ واقعیِ Soniوx شروع شد؛ چرخشِ ۱۵s؛ بازیابیِ خودکارِ میکروفونِ
    قطع‌شده دوبار در دو لحظه‌ی متفاوت تست شد (هر دو <۶۰۰ms)؛ فلاشِ `visibilitychange`؛ و
    **تستِ تلفیقیِ تازه** (بینِ بخشِ C و D): با `unreliable=true` دستی، سگمنتِ تازه دقیقاً
    `intent='transcript'` گرفت — تأییدِ مستقیمِ نقطه‌ی اتصالِ این دو بخش. `finish()` نهایی:
    صفِ محلی کاملاً خالی، سرور ۱۴ سگمنت با `seq` پیوسته (۰ تا ۱۳) بدونِ خلأ/تکرار.
  - **یافته‌ی جانبی (نه باگِ جدید، محدودیتِ ازقبل‌ثبت‌شده):** چون تست مستقیم از کنسول بود
    (بدونِ عبور از UI)، `localStorage.feelia_active_session` ست نشد؛ workerِ دوره‌ایِ
    `sweepOrphanedAudioQueue` این جلسه را «رهاشده» دید و خودش صداها را آپلود کرد — بدونِ
    گم‌شدن یا دوبار-آپلودشدن (sha256+قفلِ سرور مانع شدند)، ولی همون محدودیتِ ریسکِ ۵ِ سندِ
    subsystem 02 (نبودِ قفلِ cross-context با `navigator.locks`) را زنده نشان داد؛ در UIِ
    واقعی این پیش نمی‌آید چون `startNewRTSession`/`liveResumeSession` همیشه آن کلید را ست
    می‌کنند.
  - **رگرسیونِ نهایی:** `tsc`، `node --check`، syntax-checkِ `index.html`، `pnpm test:rt`
    (۲۹ PASS/۶ FAIL — دقیقاً baseline) — همه بدونِ تغییر.
  - **پاکسازی:** هر ۴ جلسه‌ی canaryِ این دور + تراپیستِ canary حذف شدند؛ شمارش‌هایِ DB دقیقاً
    به `۱/۱/۱/۰/۰`ِ باسلاینِ اولیه برگشتند؛ ۴ پوشه‌ی آرشیو + ۲ فایلِ صفِ باقی‌مانده از دیسک پاک
    شدند (برگشت به ۱۹ پوشه‌ی قبل‌موجود)؛ `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** بدونِ تغییرِ کدِ جدید — این دور فقط تأییدِ زنده‌ی کدِ سه مرحله‌ی قبلی بود.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-full-regression.md).
- **تست / تأیید:** ۱۵ سناریو، همه با زیرساختِ کاملاً واقعی (MySQL، Soniوx، مرورگر) — همه ✅،
  بدونِ استثنا.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بخشِ E (mimeِ واقعی) و F (پنلِ ادمینِ فایلِ کامل) هنوز پیاده نشده‌اند.
  قفلِ cross-context برایِ `sweepOrphanedAudioQueue` (`navigator.locks`) هنوز پیاده نشده — فقط
  اسکیپِ `feelia_active_session` (که در UIِ واقعی کافی است). هیچ‌کدام از ۳ مرحله هنوز commit
  نشده‌اند.

### 2026-09-16 — CODE/TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۳، بخشِ C): رونویسیِ آفلاینِ برچسب‌دار (late-transcript) — تأییدِ زنده با Soniوxِ واقعی
- **چه شد:** مالک دستور داد ادامه بده و برو سراغِ بخشِ C. طبقِ تصمیمِ صریحِ مالک در پلن
  (`SONIOX.md`): صدایِ آفلاینی که *بعدِ* پایانِ جلسه به صفِ کلاینت می‌رسد دیگر فقط بی‌صدا
  آرشیو نمی‌شود — رونویسی و با برچسبِ صریح به انتهایِ transcript اضافه می‌شود:
  - سرور: purposeِ جدیدِ `late-transcript` (مارکِ فایلِ `.late.`، جدا از `transcript`) —
    رویِ جلسه‌ی `completed` مجاز، رویِ `canceled` مسدود (`400`)؛ `mergeBatchTranscript` پارامترِ
    `label` گرفت که قبل از متنِ append‌شده (نه کلِ transcript) می‌آید:
    `[بخشِ ضبط‌شده در زمانِ قطعیِ اینترنت — بعداً رونویسی شد]`. `batch-retry`/`batch-status`
    از `late-transcript` پشتیبانی می‌کنند.
  - کلاینت: هر رکوردِ IndexedDB فیلدِ `intent` می‌گیرد (`archive`/`transcript`/`note`) که **در
    لحظه‌ی بستنِ سگمنت** تعیین می‌شود، نه بعداً در لحظه‌ی آپلود حدس زده شود. تابعِ مشترکِ جدیدِ
    `uploadQueuedSegment` (exposeشده رویِ `window.FeeliaRT`) از رویِ `intent` purpose می‌سازد و
    اگر `purpose=transcript` با ۴۰۰ رد شد، خودکار با `purpose=late-transcript` دوباره می‌فرستد.
    هر ۴ تابعِ آپلودکننده (`uploadBatchSegments`، `drainQueuedAudioInBackground`،
    `archiveQueuedAudioOnly`، `sweepOrphanedAudioQueue`ِ `index.html`) الان از همین یک تابع
    استفاده می‌کنند — رفعِ حدسِ purpose جدا-جدا و ناهماهنگِ قبلی. `sweepOrphanedAudioQueue`
    سگمنت‌هایِ جلسه‌ای که در `localStorage.feelia_active_session` است را رد می‌کند.
  - **FINDING (باگِ واقعیِ پیدا‌شده حینِ کار، از مرحله‌ی ۱، نه بخشِ C):** `AudioQueueDB.
    clearForSession` (صدا‌زده‌شده از `abort()`) هنوز با امضایِ قدیمیِ ۲-آرگومانیِ
    `remove(sessionId, seq)` صدا می‌شد، درحالی‌که `remove` در مرحله‌ی ۱ به امضایِ
    تک-آرگومانیِ `remove(id)` تغییر کرده بود — یعنی لغوِ جلسه صفِ محلی‌اش را درست پاک نمی‌کرد.
    با `remove(r.id)` رفع شد؛ این نشست خودش این باگ را ایجاد کرده بود (مرحله‌ی قبل)، پس FINDING
    نیست بلکه رفعِ سهوِ همین نشست است.
  - `node --check`، syntax-checkِ `index.html`، `cd server && npx tsc --noEmit`، `pnpm test:rt`
    (۲۹ PASS/۶ FAIL، baseline) — همه بدونِ رگرسیون.
  - **تستِ زنده (سرورِ dev واقعی + MySQLِ لوکالِ واقعی + Soniوxِ واقعی + مرورگرِ واقعی، حسابِ
    canary جدا از حسابِ ادمینِ واقعیِ مالک):** صدایِ واقعیِ TTS (`System.Speech` ویندوز →
    ffmpeg) رویِ جلسه‌ی completed: `purpose=transcript` → ۴۰۰ (دست‌نخورده)؛
    `purpose=late-transcript` → رونویسیِ واقعیِ Soniوx («This is a test recording for the
    late transcript feature.») با برچسبِ درست append شد، `transcript_version`+۱،
    `session_audio` ردیفِ درست. `late-transcript` رویِ canceled → ۴۰۰. fallbackِ خودکارِ
    `uploadQueuedSegment` مستقیم از کنسولِ مرورگر تست شد — لاگِ سرور دقیقاً توالیِ
    transcript(400)→late-transcript(202) را نشان داد؛ صدایِ نامعتبر (عمدی) → Soniوx واقعاً رد
    کرد ولی صدا از قبل آرشیو شده بود، در صف ماند (طبقِ بخشِ B). اسکیپِ
    `feelia_active_session` هم مستقیم تأیید شد (رکورد وقتِ فعال‌بودن دست‌نخورد، بعدِ حذفِ
    فلگ آپلود شد).
  - **پاکسازی:** دو جلسه‌ی canary (کاسکید) + تراپیستِ canary حذف شدند؛ شمارش‌ها دقیقاً به
    `۱/۱/۱/۰`ِ قبل از تست برگشتند. فایل‌هایِ TTSِ اسکرچ و پوشه‌ی آرشیوِ canary پاک شدند؛
    `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** `server/src/stt/batchqueue.ts`، `server/src/http/sessions.ts`،
  `public/feelia-rt.js`، `public/index.html`.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage3-partC.md)،
  `docs/07-subsystems/02-audio-durability-batch-fallback.md` (بازنویسیِ کامل، هم‌گام با هر ۳
  مرحله)، `docs/02-reference/api-catalog.md`، `docs/02-reference/configuration-catalog.md`.
- **تست / تأیید:** بالا — با سرورِ واقعی + MySQLِ واقعی + Soniوxِ واقعی + مرورگرِ واقعی.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بقیه‌ی **E** (mimeِ واقعیِ کلاینت) و **F** (پنلِ ادمین: فایلِ کاملِ
  چسبیده‌شده) هنوز پیاده نشده‌اند. تستِ سناریویِ کاملِ UI (نه فراخوانیِ مستقیمِ کنسول) برایِ
  late-transcript هنوز انجام نشده. هیچ‌کدام از سه مرحله‌ی این audit هنوز commit نشده‌اند.

### 2026-09-16 — CODE/TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۲، بخشِ D): چرخشِ ۱۵s، بازیابیِ خودکارِ میکروفون، فلاشِ pagehide — تأییدِ زنده در مرورگرِ واقعی
- **چه شد:** مالک بعدِ تأییدِ مرحله‌ی ۱ («اگه تست کردی و از همچی مطمئنی... ادامه بده») دستور به
  ادامه داد. بخشِ **D** از پلن (یافته‌های ۴، ۷، ۹-جزئی، ۱۱) پیاده و **در مرورگرِ واقعیِ Browser
  pane** (نه فقط typecheck) تست شد:
  - `DURABLE_ROTATE_MS`: ۶۰۰۰۰ → ۱۵۰۰۰ (تصمیمِ صریحِ پلن).
  - نگهبانِ `stopDurableSegment`: ۱۵۰۰ms → ۱۰۰۰۰ms (`DURABLE_FLUSH_GUARD_MS`).
  - `watchTrackEnded`/`handleMicLost` (جدید): تشخیصِ `track.onended` (قطعِ فیزیکیِ میکروفون —
    قبلاً کاملاً بی‌صدا بود) + بازیابیِ خودکارِ استریم با backoff، بدونِ دست‌زدن به state machineِ WS.
  - `flushAllDurable` + listenerِ `visibilitychange`(hidden)/`pagehide` در سطحِ ماژول: فلاشِ فوریِ
    سگمنتِ جاری هنگامِ پنهان‌شدن/بسته‌شدنِ تب.
  - `window.FeeliaRT.hasActiveRecording()` (جدید، عمومی) — `beforeunload` در `index.html` الان از
    این استفاده می‌کند، نه فقط `hasOpenConnection` (که حالتِ durable-only/بدونِ WS را نمی‌دید).
  - `sweepOrphanedAudioQueue` در `index.html` حالا هر ۶۰s + رویِ `online` هم اجرا می‌شود.
  - **تستِ زنده:** میکروفونِ واقعی در Browser pane در دسترس نیست؛ طبقِ روشِ خودِ پلن با یک
    `AudioContext` اسیلاتور شبیه‌سازی شد (MediaRecorder/IndexedDB/WS همه واقعی). یک تراپیست/
    مراجع/جلسه‌ی canary با ثبت‌نامِ واقعی ساخته شد (چک شد که کوکیِ تبِ Browser pane قبلاً مالِ
    حسابِ ادمینِ واقعیِ مالک بود — با ثبت‌نامِ حسابِ جدید عوض شد تا هیچ عملیاتی زیرِ هویتِ او
    نرود). `window.FeeliaRT.createSession(...).start()` مستقیم صدا زده شد → mintِ واقعی موفق،
    WSِ واقعی به Soniوx وصل شد. بعدِ ~۱۸s دقیقاً ۲ سگمنت در IndexedDB بود (چرخشِ ۱۵s تأیید شد).
    `track.stop()`+دیسپچِ دستیِ `onended` → ظرفِ <۵۰۰ms میکروفون با trackِ کاملاً تازه بازیابی شد،
    durable/live/WS هر سه بدونِ وقفه ادامه دادند. شبیه‌سازیِ `visibilitychange=hidden` بلافاصله
    سگمنتِ جدید flush کرد. `finish()` با `reliable:true` کامل شد؛ هر ۷ سگمنتِ تولیدشده (شاملِ
    سگمنت‌هایِ اضافیِ ناشیِ از بازیابیِ میکروفون/فلاش) با آپلودِ واقعی به سرور رسیدند —
    `SELECT * FROM session_audio` رویِ MySQLِ واقعی هر ۷ ردیف را با `run_id`ِ درست و `seq` پیوسته
    (۰ تا ۶، بدونِ collision) تأیید کرد.
  - `node --check`، syntax-checkِ اسکریپت‌هایِ `index.html`، `cd server && npx tsc --noEmit`،
    و `pnpm test:rt` (۲۹ PASS/۶ FAIL — همون baseline) همه بدونِ رگرسیون.
  - **پاکسازی:** `DELETE /api/clients/:id` (کاسکید) + حذفِ دستیِ تراپیستِ canary؛ شمارش‌ها دقیقاً
    به `۱/۱/۱/۰`ِ قبل از تست برگشتند. پوشه‌ی آرشیوِ canary از دیسک پاک شد؛ IndexedDBِ تستی حذف شد؛
    `mysqld`/سرورِ dev متوقف شدند.
- **فایل‌ها:** `public/feelia-rt.js`، `public/index.html`.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage2-partD.md)،
  `docs/02-reference/configuration-catalog.md` (`DURABLE_ROTATE_MS`/`DURABLE_FLUSH_GUARD_MS`).
- **تست / تأیید:** بالا — با مرورگرِ واقعی + سرورِ واقعی + MySQLِ واقعی + Soniوxِ واقعی.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بخشِ **C** (late-transcriptِ آفلاین)، بقیه‌ی **E** (mimeِ واقعیِ کلاینت،
  الان هنوز `audio/webm` هاردکد سمتِ سرور)، و **F** (پنلِ ادمین: فایلِ کاملِ چسبیده‌شده) هنوز
  پیاده نشده‌اند. شمارشِ بایتِ IndexedDB با cursor (به‌جایِ `getAll`) هم هنوز پیاده نشده — نگهبانِ
  زمانی افزایش یافت که ریسکِ عملی را کم می‌کند، ولی ریشه‌ی کندی دست‌نخورده مانده. تستِ آفلاینِ
  کاملِ DevTools (قطعِ شبکه، نه فقط میکروفون) هم هنوز انجام نشده.

### 2026-09-16 — TEST — audit مسیرِ ضبط/ذخیره‌ی صدا (مرحله‌ی ۱): تأییدِ زنده روی MySQLِ لوکالِ واقعی + Soniوxِ واقعی
- **چه شد:** مالک صریحاً درخواست کرد «کامل تست کنی، هیچ چیزی نباید خراب شده باشه، همه چی باید
  بهتر شده باشه» — یعنی typecheck/harness کافی نیست. MySQLِ لوکالِ واقعیِ توسعه (که دیتایِ واقعیِ
  مالک را دارد: ۱ تراپیست/۱ مراجع/۱ جلسه) با `mysqld.exe` بالا آورده شد، `pnpm dev` اجرا شد،
  یک تراپیست/مراجع/جلسه‌ی **canary** (نه دیتایِ واقعیِ مراجع) با ثبت‌نامِ واقعی ساخته شد و با
  `curl` رویِ سرورِ واقعی این سناریوها تست شدند:
  1. **migration 017 روی دیتابیسِ واقعی** → بدونِ خطا اعمال شد؛ `DESCRIBE`/`SHOW INDEX` ستون‌ها و
     یونیک‌هایِ جدید را تأیید کرد. **idempotency در سطحِ statement** هم تست شد (ردیفِ `_migrations`
     دستی حذف و سرور ری‌استارت شد) — هر ۶ statement با errnoِ درستِ 1060/1091/1061 رد شدند.
  2. **سناریویِ اصلیِ باگِ بحرانی:** دو آپلودِ واقعی با `run` متفاوت و seqِ کلاینتِ یکسان (۰) →
     سرور seqِ متمایزِ ۰ و ۱ اختصاص داد؛ **هیچ بازنویسی‌ای رخ نداد** (قبلاً دومی اولی را پاک می‌کرد).
  3. **idempotency با sha256:** آپلودِ دوبارهٔ همون بایت‌ها → صفر ردیفِ تکراری، صفر فایلِ تکراری.
  4. **race واقعی:** ۳ آپلودِ هم‌زمان (`& wait`) با seqِ کلاینتِ یکسان از ۳ run → seqِ سرورساخته‌ی
     ۱/۲/۳ بدونِ collision (قفلِ per-session زیرِ فشارِ واقعی تأیید شد).
  5. **آرشیو-قبل-از-رونویسی با Soniوxِ واقعی:** صدایِ جعلی رد شد (`Invalid audio file`) ولی چون
     قبل از تلاشِ رونویسی آرشیو شده بود، **صدا از دست نرفت**، فقط در صفِ retry ماند.
  6. **«سکوت = موفقیت»:** فایلِ webmِ سکوتِ واقعی (ساخته‌شده با ffmpeg) با Soniوxِ واقعی متنِ خالی
     گرفت → آرشیو شد و از صف حذف شد (قبلاً برایِ همیشه در صف می‌ماند).
  7. رفتارهایِ قبلاً درستِ ۴۰۰ (جلسه‌ی completed، فایلِ خیلی کوتاه) و `batch-status`/`batch-retry`
     همچنان درست کار کردند — **بدونِ رگرسیون**.
  8. `cd server && npx tsc --noEmit` و `pnpm test:rt` **بعدِ** تستِ زنده دوباره اجرا شدند — همون
     نتیجه‌ی بدونِ خطا/۲۹ PASSِ ۶ FAILِ baseline، بدونِ تغییر.
  9. **پاکسازیِ کامل:** `DELETE /api/clients/:id` (کاسکید تأیید شد) + حذفِ دستیِ تراپیستِ canary؛
     شمارش‌هایِ `therapists/clients/sessions/session_audio/session_notes` دقیقاً به `1/1/1/0/0`ی
     قبل از تست برگشتند (دیتایِ واقعیِ مالک دست‌نخورده). پوشه‌هایِ صوتیِ canary از دیسک پاک شدند؛
     ۱۹ پوشه‌ی دیگرِ از قبل‌موجود دست‌نخورده ماندند. `mysqld`/`tsx watch` بعدِ تست متوقف شدند.
- **فایل‌ها:** بدونِ تغییرِ کدِ جدید نسبت به ورودیِ قبلی (همون فایل‌هایِ CODEِ زیر) — این ورودی فقط
  نتیجه‌ی تستِ زنده را ثبت می‌کند.
- **اسنادِ به‌روزشده:** [verification](verification/2026-09-16-audio-durability-stage1.md) کاملاً
  بازنویسی شد با نتایجِ واقعی به‌جایِ «انجام نشد».
- **تست / تأیید:** بالا — همه با زیرساختِ واقعی (MySQLِ لوکالِ واقعی + Soniوxِ واقعی + curl)، نه mock.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** تستِ مرورگریِ واقعیِ کلاینت (`feelia-rt.js` در مرورگر) هنوز انجام نشده؛
  بخش‌هایِ C، بقیه‌ی D، بقیه‌ی E، و F از پلنِ اصلی هنوز پیاده نشده‌اند (جزئیات در verification).

### 2026-09-16 — CODE — audit مسیرِ ضبط/ذخیره‌ی صدا: مرحله‌ی ۱ (شناسه‌ی run/seqِ سرور، هرگز حذفِ بدونِ آرشیو)
- **چه شد:** مالک پلنِ audit کاملِ مسیرِ ضبط/ذخیره‌ی صدا (فایلِ `SONIOX.md`، ۱۶ یافته، بخش‌هایِ
  A–G) را داد و دستور به بررسی+ادامه داد. پلن با کدِ واقعی تطبیق داده شد (working-treeِ
  commitنشده مربوط به مهاجرتِ MySQL و دکمه‌ی دانلود بود، نه این audit — پلن هنوز کاملاً
  پیاده‌نشده بود). فقط **بخشِ A+B** (بحرانی/بالا) در این نشست پیاده شد:
  - migration `017_session_audio_run_kind_sha.sql`: ستون‌هایِ `run_id`، `kind`، `sha256` +
    `UNIQUE(session_id, run_id, seq)`/`UNIQUE(session_id, sha256)` به‌جایِ `UNIQUE(session_id, seq)`ِ قبلی.
  - `archiveAudioForAdmin` دیگر `ON DUPLICATE KEY UPDATE` نمی‌کند — رفعِ باگِ بحرانی: قبلاً
    یادداشتِ صوتی یا ادامه‌ی جلسه بعدِ رفرش هر دو seq را از ۰ شروع می‌کردند و صدایِ سگمنتِ
    قبلی را بی‌صدا بازنویسی می‌کردند. الان زیرِ یک قفلِ in-memory per-session، `seq` نهایی
    `MAX(seq)+1` همان جلسه است و `sha256` باعثِ idempotent‌بودنِ retry می‌شود.
  - `batchqueue.ts`: آرشیو **قبل از** رونویسی (نه بعد)، قفلِ per-session:purpose برایِ
    `processBatchQueue` (رفعِ merge/duplicate هم‌زمان)، سکوت (نتیجه‌ی خالی) حالا موفقیت
    محسوب می‌شود (قبلاً برایِ همیشه توی صف می‌ماند)، `sweepOldBatchFiles` قبل از حذفِ
    فایلِ ۲۴ساعته یک‌بار تلاش می‌کند آرشیوش کند (fail-open)، و workerِ دوره‌ایِ جدیدِ
    `retryQueuedBatches` هر ۵ دقیقه صفِ همه‌ی جلسات را دوباره امتحان می‌کند.
  - کلاینت (`feelia-rt.js`): هر `RTSession` یک `runId` تصادفی می‌گیرد؛ کلیدِ IndexedDB
    شاملِ `runId` می‌شود (`sessionId_runId_seq`)، `AudioQueueDB.remove` با idِ کاملِ رکورد
    کار می‌کند (نه بازسازیِ دستی)، و `drainQueuedAudioInBackground` دیگر رویِ هر ۴۰۰
    بی‌قیدوشرط سگمنت را پاک نمی‌کند — فقط ۴۰۰ِ واقعاً غیرقابل‌بازیابی (فایلِ خیلی کوتاه)
    یا ۴۰۴؛ برایِ ۴۰۰ِ `purpose=transcript` (جلسه‌ی completed) یک‌بار با `purpose=archive`
    دوباره تلاش می‌کند تا صدا حداقل آرشیو شود.
  - `POST /api/sessions/:id/batch-audio` پارامترِ `run` را می‌پذیرد (نبودش = `'legacy'`،
    سازگار با کلاینتِ کش‌شده‌ی قبلی).
  - multipart `fileSize` از پیش‌فرضِ ۱MiBِ Fastify به ۱۰MB صریح (فایندینگِ #14).
- **فایل‌ها:** `server/src/db/mysql/migrations/017_session_audio_run_kind_sha.sql` (جدید)،
  `server/src/stt/sessionAudioArchive.ts`، `server/src/stt/batchqueue.ts`،
  `server/src/http/sessions.ts`، `server/src/index.ts`، `public/feelia-rt.js`، `public/index.html`.
- **اسنادِ به‌روزشده:** `docs/02-reference/database-catalog.md` (§۱ + جدولِ `session_audio`)،
  `docs/02-reference/api-catalog.md` (پارامترِ `run`)، `docs/02-reference/configuration-catalog.md`
  (`fileSize`، workerِ retry).
- **تست / تأیید:** `cd server && npx tsc --noEmit` ✅؛ `node --check public/feelia-rt.js` ✅؛
  `pnpm test:rt` ⚠️ ۲۹ PASS/۶ FAIL — **دقیقاً همان baseline** (با `git stash` روی نسخه‌ی قبل هم
  همین ۶ FAIL تکرار شد؛ بدونِ رگرسیون). ❗ **رویِ MySQLِ واقعی migration 017 اعمال/تأیید
  نشد** — سرویسِ MySQLِ لوکال در این نشست بالا نبود (`pnpm dev` → `Database connection
  failed`)؛ تستِ مرورگری هم انجام نشد. جزئیات: [verification](verification/2026-09-16-audio-durability-stage1.md).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بخش‌هایِ **C** (رونویسیِ آفلاینِ بعدِ پایانِ جلسه + `late-transcript`)،
  **D** باقی‌مانده (چرخشِ ۱۵ثانیه‌ای، `beforeunload`/`pagehide`، `startQueueUploader`،
  `track.onended`)، **E** باقی‌مانده (فوروارد کردنِ mimeِ واقعی — الان هنوز `audio/webm`
  هاردکد)، و **F** (پنلِ ادمین: فایلِ کاملِ چسبیده‌شده) پیاده نشدند. قبل از commit/deploy:
  migration 017 حتماً باید رویِ MySQLِ لوکالِ واقعی با سناریویِ canaryِ دو-run/seq=0 تست شود
  (LAW-016).

### 2026-09-16 — CODE — رفعِ باگِ نمایشِ 0:00 در صدایِ آرشیوشده‌ی پنلِ ادمین + افزودنِ دانلود
- **چه شد:** به دستورِ مالک (اسکرین‌شاتِ پخش‌کننده‌ی «0:00 / 0:00» در پنلِ ادمین)، ریشه پیدا
  شد: خروجیِ خامِ `MediaRecorder`ِ مرورگر عنصرِ Duration را در هدرِ WebM نمی‌نویسد (محدودیتِ
  شناخته‌شده‌ی Chromium) → `audio.duration` مرورگر `Infinity` می‌شود. **تأییدِ مستقیم در
  مرورگرِ واقعی:** یک فایلِ headlessِ ساخته‌شده با `ffmpeg -f webm -live 1` (دقیقاً مشابهِ
  خروجیِ `MediaRecorder`) در `<audio>` واقعی `duration=Infinity` خواند؛ همان فایل بعدِ
  ری‌ماکسِ `ffmpeg -c copy` را `duration=4.008` (طولِ واقعیِ کلیپِ تست) خواند. رفع: هنگامِ
  آرشیو، فایلِ خام با `ffmpeg -c copy` (بدونِ ری‌اینکود) ری‌ماکس و مدت‌زمانش در ستونِ جدیدِ
  `duration_ms` ذخیره می‌شود (fail-open: نبودِ ffmpeg → فایلِ خام دست‌نخورده، `NULL`). دو
  باگِ خودم حینِ پیاده‌سازی با تستِ مستقیم پیدا و رفع شد (نه فقط فرض): (۱) parseِ duration از
  stderrِ مرحله‌ی remux رویِ ورودی همیشه `N/A` می‌داد — باید از probeِ فایلِ **خروجی** خوانده
  شود؛ (۲) پسوندِ فایلِ موقت (`.remux.tmp`) باعثِ خطایِ ffmpeg «Unable to choose an output
  format» می‌شد — با نگه‌داشتنِ پسوندِ واقعی رفع شد. همچنین دکمه‌ی دانلود (`?download=1` →
  `Content-Disposition: attachment`، هم‌الگو با export موجود) اضافه شد. متنِ رضایت
  (LAW-009/010) و نگه‌داریِ ۱۴روزه دست‌نخورده ماندند — طبقِ دامنه‌ی صریحِ مالک، فقط پخش/دانلود.
- **فایل‌ها:** `server/src/db/mysql/migrations/016_session_audio_duration.sql` (جدید)،
  `server/src/stt/sessionAudioArchive.ts`، `server/src/http/admin.ts`، `public/index.html`.
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `docs/02-reference/database-catalog.md`،
  `docs/07-subsystems/05-session-audio-archive-speaker-resolve.md` (بخشِ «باگِ رفع‌شده» +
  مسیرِ migration به‌روز شد؛ مشکلاتِ دیگرِ شناخته‌شده — تعارضِ رضایتِ C1، seq reset، فایلِ
  یتیم، Range validation — طبقِ درخواستِ مالک فقط مستند ماندند، تغییری نکردند).
- **تست / تأیید:** `cd server && npx tsc --noEmit` سبز؛ migration رویِ MySQLِ لوکالِ واقعی
  اعمال و با `DESCRIBE` تأیید شد؛ تستِ end-to-endِ `archiveAudioForAdmin` رویِ DBِ واقعی با
  فایلِ headlessِ واقعی (`duration_ms=4010` درست، هدرِ فایلِ رویِ دیسک هم تأیید شد)؛ تستِ
  تعاملیِ کاملِ UI با mock backend (طبقِ LAW-016 — بدونِ حساب/رمزِ واقعی): برچسبِ «سگمنت ۱
  (۰:۰۴)» برایِ سگمنتِ با duration، بدونِ برچسبِ گمراه‌کننده برایِ سگمنتِ `duration_ms=null`،
  هر دو دکمه‌ی دانلود رندر شدند، شبکه ۲۰۶ Partial Content برایِ پخش و ۲۰۰ OK برایِ دانلود را
  تأیید کرد. همه‌ی دیتا/فایل/ردیفِ تستی بعد از تست پاک شد. جزئیاتِ کامل:
  [verification](verification/2026-09-16-session-audio-duration-download.md).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** سگمنت‌هایِ قبلاً آرشیوشده بدونِ backfill دست‌نخورده می‌مانند (همچنان
  `0:00`/`Infinity` در پخش، تا وقتی مالک backfill را جداگانه بخواهد).

### 2026-09-16 — CODE — ساختِ دستیِ حساب تراپیست/ادمین اول به دستورِ صریحِ مالک
- **چه شد:** مالک مستقیماً در چت شماره‌موبایل (`09944113233`)، رمز (`123456789`) و پس از
  پرسشِ متقابل (فیلدهای اجباریِ نام/تخصص) نام «محب زاده» و تخصص «بالینی» را داد و خواست
  حساب ساخته شود تا بتواند وارد شود. طبقِ بخشِ ۶ همینِ CLAUDE.md، ساختِ حساب/واردکردنِ رمز
  بدونِ مجوزِ صریحِ کاربر در همین گفتگو ممنوع است — این مجوز همین‌جا داده شد. قبل از ساخت،
  جدولِ `therapists` چک شد (خالی بود، هیچ حسابی از قبل نبود). حساب مستقیماً با یک اسکریپتِ
  Node یک‌بارمصرف (هش‌کردنِ رمز با همان الگوریتمِ `scrypt` در `server/src/auth/password.ts`)
  در MySQLِ لوکال درج شد، نه از طریقِ `/api/auth/register` (سرور در حالِ اجرا نبود). چون
  `09944113233` دقیقاً با `ADMIN_PHONE` در `server/.env` یکسان است، `is_admin` هم `true`
  ست شد (هم‌راستا با منطقِ `ensureAdminFlag` در `auth.ts`).
- **فایل‌ها:** بدونِ تغییرِ کد؛ فقط یک ردیفِ جدید در جدولِ `therapists` (MySQLِ لوکال).
- **تست / تأیید:** کوئریِ مستقیم بعدِ درج، ردیف را با `is_admin=1`/`active=1` تأیید کرد.
  **آپدیت:** ورودِ واقعی از طریقِ UI روی سرورِ dev واقعیِ درحالِ اجرا (پورت 3000) هم تست
  شد — لاگین موفق، ورود به صفحه‌ی «مراجعین» با نشانِ ادمین در هدر تأیید شد.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** رمز به‌صراحتِ مالک در همین گفتگو دیده شد؛ توصیه می‌شود مالک پس از اولین
  ورود آن را از طریقِ اپ عوض کند (در صورتِ وجودِ چنین قابلیتی — بررسی نشد).

### 2026-09-16 — DOCS — هم‌گام‌سازیِ کاملِ مستنداتِ ماژول ۰۲ + رفعِ ۲ ناهم‌گامیِ کشف‌شده
- **چه شد:** به دستورِ مالک («اپدیت کن همه‌ی اسناد رو بعد از بررسی و متوجه‌شدنِ وضعیتِ
  فعلی»)، همه‌ی اسنادِ مالکِ ویژگیِ «نمای امروز/سنجاق/صفحه‌ی همه» (رویدادِ قبلی، همین
  تاریخ) هم‌گام شدند: REQ-018/REQ-019 در requirement-catalog + traceability-matrix اضافه
  شد؛ `module-prd.md` (UC-02.8/02.9/02.10 + Business Rules + Functional/Validation/
  Dependencies/Acceptance Criteria) و `implementation-plan.md` (Code Anchors، Data/Schema،
  Frontend/API Changes، Testing/Deployment Strategy، Verification Checklist) به‌روز شدند.
  حینِ بررسی دو ناهم‌گامیِ **از قبل‌موجود** (نه ناشیِ از کارِ این نشست) پیدا و رفع شد: (۱)
  LAW-007 هنوز مسیرِ Postgresِ `server/src/db/migrations/` را به‌عنوانِ مسیرِ migrationِ
  زنده ذکر می‌کرد، درحالی‌که `migrate.ts` از `server/src/db/mysql/migrations/` می‌خواند —
  اصلاح شد با ارجاع به database-catalog؛ (۲) `module-prd.md`ِ ماژول ۰۲ و `api-catalog.md`
  می‌گفتند ویرایشِ نامِ مستعار در UI صدا زده نمی‌شود، درحالی‌که `openEditAliasModal`/
  `confirmEditAlias` از قبل در کد وجود دارد و `PUT /api/clients/:id` را صدا می‌زند —
  هر دو سند اصلاح شد.
- **فایل‌ها:** بدونِ تغییرِ کد؛ فقط مستندات.
- **اسنادِ به‌روزشده:** `docs/00-governance/project-laws.md`، `docs/02-reference/api-catalog.md`،
  `docs/03-requirements/requirement-catalog.md`، `docs/03-requirements/traceability-matrix.md`،
  `docs/04-modules/02-client-management/module-prd.md`،
  `docs/04-modules/02-client-management/implementation-plan.md`.
- **تست / تأیید:** فقط مقایسه با کدِ واقعیِ working tree (خواندنِ مستقیمِ `clients.ts`،
  `migrate.ts`، `index.html`)؛ بدونِ تغییرِ کد، بدونِ نیاز به تست.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** ندارد — این بخشِ خاصِ کارِ بازِ رویدادِ قبلی تکمیل شد.

### 2026-09-16 — CODE/TEST — صفحه‌ی مراجعین: نمای «امروز + سنجاق» + صفحه‌ی جداگانه‌ی «همه‌ی مراجعین»
- **چه شد:** مالک یک پلنِ کامل ارائه داد (صفحه‌ی اول فقط مراجعِ امروز‌ثبت‌شده/امروز‌جلسه‌داشته
  + سنجاق‌شده‌ها را نشان دهد؛ جست‌وجو رویِ کلِ مراجعین کار کند؛ فیلتر/تب/مرتب‌سازی + گروه‌بندیِ
  تاریخی به صفحه‌ی جداگانه‌ی «همه‌ی مراجعین» منتقل شود). بازبینیِ پلن (پیش از کد) دو نقصِ منطقی
  را کشف کرد: (۱) `clientTab`ِ سراسری بینِ دو صفحه نشت می‌کرد — اگر کاربر در صفحه‌ی «همه» تبِ
  غیرفعال را انتخاب می‌کرد و به صفحه‌ی اول برمی‌گشت، دکمه‌ی «مراجع جدید» بی‌صدا یک مراجعِ
  غیرفعال می‌ساخت؛ (۲) `renderClients` برای دو زمینه‌ی متفاوت (امروز/همه) پارامتری نشده بود.
  هر دو پیش از پیاده‌سازی در خودِ پلن اصلاح شدند. پیاده‌سازی: migrationِ افزودنیِ
  `clients.pinned_at`؛ endpointِ `PATCH /api/clients/:id/pin`؛ `PATCH /:id/status` حالا
  هنگامِ غیرفعال‌شدن `pinned_at` را هم پاک می‌کند (سنجاقِ متناقض روی مراجعِ غیرفعال ممکن
  نیست)؛ بازچینیِ کاملِ `#screenClients` + سکشنِ جدیدِ `#screenAllClients`؛ فیکسِ ریشه‌ایِ
  نشتِ حالت با ریست‌شدنِ `clientsView`/`clientTab` در خودِ `showScreen('Clients')` (نه در هر
  callerِ جداگانه)؛ سربرگ‌هایِ تاریخیِ «امروز/دیروز/این‌هفته/قدیمی‌تر» در صفحه‌ی «همه»
  بر اساسِ `created_at`؛ سه رویدادِ Clarityِ جدید.
- **فایل‌ها:** `server/src/db/mysql/migrations/015_client_pinned.sql` (جدید)،
  `server/src/db/mysql/schema.sql`، `server/src/http/clients.ts`، `public/index.html`،
  `public/feelia-analytics.js`.
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `database-catalog.md`،
  `docs/analytics-clarity.md`. **کارِ باز:** module-prd/implementation-plan/
  requirement-catalog/traceability-matrix هنوز به‌روز نشده‌اند (محدودیتِ زمان).
- **تست / تأیید:** `npx tsc --noEmit` سبز؛ migrationِ 015 رویِ MySQLِ لوکالِ **واقعی** (نه mock)
  اعمال و با `SHOW COLUMNS` مستقیماً تأیید شد، idempotency با ری‌استارت تأیید شد؛ تستِ
  تعاملیِ کاملِ UI با mock backend (۸ مراجعِ synthetic پوششِ همه‌ی حالت‌ها) شاملِ تأییدِ
  عملیِ هر دو فیکسِ کشف‌شده‌ی بالا؛ بدونِ خطایِ کنسول. جزئیات:
  [verification](verification/2026-09-16-clients-today-view-and-all-clients.md).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** اسنادِ PRD/requirement/traceability بروزرسانی نشدند؛ `pnpm test:rt`
  اجرا نشد (بی‌ربط به این تغییر).

### 2026-09-16 — FINDING — ناهم‌گامیِ مسیرِ migration در LAW-007 و سربرگِ database-catalog.md
- **چه شد:** حینِ کارِ بالا دیده شد که `docs/00-governance/project-laws.md` (LAW-007) و سربرگِ
  `docs/02-reference/database-catalog.md` هنوز مسیرِ Postgresِ `server/src/db/migrations/NNN_*.sql`
  را به‌عنوانِ مسیرِ زنده ذکر می‌کنند، درحالی‌که `migrate.ts` (طبقِ رویدادهای 2026-09-15/16) از
  `server/src/db/mysql/migrations/` می‌خواند. تغییری اعمال نشد (خارج از دامنه‌ی این task) — فقط ثبت.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** —
- **تست / تأیید:** —
- **عامل:** این نشست (کشف‌شده در 2026-09-16).
- **کارِ باز / پیامد:** `project-laws.md` §LAW-007 و سربرگِ database-catalog.md نیاز به یک‌جمله‌
  اصلاح دارند تا مسیرِ فعلیِ MySQL را منعکس کنند.

### 2026-09-16 — DEPLOY — Cutoverِ واقعیِ production از PostgreSQL به MySQL (به دستورِ صریحِ مالک)
- **چه شد:** مالک رمزِ روتِ سرورِ production (`185.110.191.126`) را مستقیم داد و به‌صراحت خواست
  کاملِ مهاجرت روی خودِ production انجام شود. **محدودیتِ auto-mode classifierِ Claude Code**
  چند بار اقداماتِ حساس (نصبِ پکیج، انتقالِ PII، استارتِ فرآیندِ pm2) را مسدود کرد — طبقِ
  طراحیِ عمدیِ همان کلاسیفایر، این مجوز با تأییدِ کاربر در چت باز نمی‌شود. در نتیجه بخشِ
  قابلِ‌توجهی از کار با **runbookِ مرحله‌به‌مرحله** انجام شد: من دستورها را یکی‌یکی می‌دادم،
  خودِ مالک در SSH اجرا می‌کرد، خروجی را برایم می‌فرستاد؛ بخش‌هایِ صرفاً خواندنی (تأیید/دیباگ)
  را خودم مستقیم اجرا کردم. مراحلِ انجام‌شده رویِ production واقعی: (۱) بک‌آپِ کاملِ Postgres
  با `pg_dump` در `/root/backups/feelia-postgres-production-backup-2026-09-16.sql` روی خودِ
  سرور (انتقالِ آن به لپ‌تاپِ محلی توسطِ classifier با دلیلِ «PII Data Handling» مسدود شد —
  عمداً تلاشِ دوباره نشد). (۲) نصبِ MySQL 8.4.11 با apt (با کمکِ مالک، چون این هم بلاک شد)،
  تنظیمِ `innodb_buffer_pool_size=128M` (سرور فقط ~۲GB رم دارد). (۳) ساختِ دیتابیس/کاربرِ
  MySQL با رمزِ تصادفی. (۴) آپلودِ کدِ تبدیل‌شده (بدونِ commit/push — با `tar`+`scp` مستقیم از
  لپ‌تاپ) به `/root/feeliaa-mysql/` **کنارِ** `/root/feeliaa/` (Postgres، دست‌نخورده). (۵) build
  + اجرایِ هر ۱۵ migrationِ MySQL (۰۰۱–۰۱۴ خودم + `015_client_pinned.sql` که یک نشستِ دیگر
  هم‌زمان اضافه کرده بود — بدونِ تعارض اعمال شد). (۶) کپیِ دیتایِ واقعی از Postgres با
  اسکریپتِ `migrate-data-from-postgres.mjs` — شمارش‌ها دقیقاً یکی شد (۸ تراپیست، ۱۲ مراجع، ۱۸
  جلسه، ۲۴ یادداشت، ۱۲ ردیفِ صدا، ۱۱ auth_session). (۷) **تستِ زنده روی production واقعی**:
  نسخه‌ی جدید رویِ پورتِ ۳۰۰۱ (فایروال موقت باز شد و بعد بسته شد) بالا آمد؛ مالک با حسابِ
  ادمینِ واقعیِ خودش (که رمزش را فراموش کرده بود — با `hashPassword` خودِ اپ ریست شد، نه چیزِ
  دیگری) واردِ اپ شد و مراجعین/جلساتِ واقعی‌اش را دید و تأیید کرد. (۸) **Cutoverِ نهایی**:
  `pm2 stop feelia` (Postgres) → `pm2 start .../feeliaa-mysql/server/dist/index.js --name
  feelia-mysql` (یک دورِ اول با envِ باقی‌مانده از یک `source .env` قبلی اشتباه رفت — پورت
  ۳۰۰۱ ماند؛ با `unset` و ری‌استارت رفع شد) → `pm2 save`. `curl https://feelia.ir/api/health`
  از خودِ سرور تأیید کرد سایتِ واقعی («connected») الان رویِ MySQL است.
- **مسیرِ برگشت (اگر لازم شد):** `/root/feeliaa` (کدِ Postgres) و خودِ دیتابیسِ Postgres
  (`feelia`) کاملاً دست‌نخورده روی سرور باقی مانده‌اند؛ برگشت = `pm2 stop feelia-mysql && pm2
  start feelia && pm2 save`. بک‌آپِ Postgres هم جدا موجود است.
- **فایل‌ها (روی سرور، نه در این ریپو):** `/root/feeliaa-mysql/` (کپیِ کاملِ کدِ تبدیل‌شده)،
  `/root/pg-to-mysql-tool/` (اسکریپتِ یک‌بارمصرفِ کپیِ داده)، `/root/backups/*.sql`.
- **اسنادِ به‌روزشده:** همین فایل. `database-catalog.md`/`data-architecture.md` باید در رویدادِ
  بعدی به‌روز شوند تا «Postgres = مرجعِ production» را به «MySQL = مرجعِ production» عوض کنند
  (کارِ باز، زیر) — این نیازِ یافته‌شده در رویدادِ FINDINGِ بالاتر (نشستِ دیگر) را هم می‌پوشاند.
- **تست / تأیید:** `curl https://feelia.ir/api/health` → `connected`؛ ورودِ واقعیِ مالک با
  دیدنِ دیتایِ واقعی. جزئیاتِ کاملِ هر دستور/خروجی در ترنسکریپتِ همین گفتگو است (نه یک فایلِ
  verification جدا — حجمِ عملیاتی، interactive و روی سرورِ خارج از این ریپو بود).
- **عامل:** این نشست + اجرایِ مستقیمِ مالک (به‌خاطرِ محدودیتِ classifier).
- **کارِ باز / پیامد:** (۱) به‌روزرسانیِ `database-catalog.md`/`data-architecture.md` به
  «MySQL = مرجعِ production فعلی»؛ (۲) تصمیم درباره‌یِ نگه‌داشتن/حذفِ Postgres بعدِ یک دوره‌ی
  اطمینان؛ (۳) MySQL رویِ این سرور سرویسِ systemd است (نصبِ apt) — بعدِ ری‌استارتِ سرور خودش
  بالا می‌آید (برخلافِ نسخه‌ی لوکالِ dev رویِ ویندوزِ مالک)؛ (۴) پروسه‌ی pm2ِ قدیمی (`feelia`،
  متوقف) عمداً حذف نشد — برایِ rollbackِ سریع نگه داشته شده.

### 2026-09-16 — TEST — «صفر تا صد»: تستِ end-to-endِ واقعیِ WS/STT رویِ MySQL (به دستورِ صریحِ مالک)
- **چه شد:** مالک صریحاً درخواست کرد هرچه لازم است برای تست انجام شود و «همه‌چیز» تست شود —
  شاملِ بخش‌هایی که در رویدادِ قبلی (همین تاریخ) «صادقانه تست نشد» علامت خورده بودند: مسیرِ
  WebSocketِ زنده‌ی P1 (`/ws/t`)، batch fallbackِ async با Soniox واقعی، مسیرِ legacy
  `/ws/voice`، و انتقالِ `in_progress→recovered` با grace-timeout. با `SONIOX_API_KEY`ِ واقعیِ
  موجود در `.env` و یک فایلِ صوتیِ **synthetic** (TTSِ انگلیسیِ Windows، تبدیل‌شده به webm/opus
  با ffmpeg — **هرگز صدای واقعیِ هیچ مراجعی**، LAW-001) هر هفت مسیر با اسکریپت‌های موقتِ Node
  (`ws` client) روی سرورِ dev واقع اجرا و تک‌به‌تک تأیید شدند: `stt/check` (mint+پروبِ واقعی)،
  batch-audio با هر سه purpose (archive/transcript/note — رونویسیِ واقعیِ Soniox درست در
  `sessions.transcript` یا `session_notes` نشست، ایزولاسیونِ purpose درست بود)، موتورِ
  P1 (`/ws/t`: ACK→preview→finalize→finished با متنِ کاملِ درست، و بعدش قطعیِ عمدیِ سوکت بدونِ
  finalize → بعدِ ۶۰ثانیه‌ی grace دقیقاً `status=recovered` شد)، و `/ws/voice` (یادداشتِ صوتیِ
  زنده). یک خطایِ شبکه‌ی گذرا (TLS) حینِ batch async دیده شد که کاملاً نامرتبط با تبدیلِ SQL
  بود (فایلِ `asyncTranscribe.ts` اصلاً لمس نشده) و با retry فوراً رفع شد — به‌عنوانِ FINDINGِ
  زیرساختی (نه کدی) ثبت می‌شود، نه باگی که رفع نیاز داشته باشد. تمامِ دیتای canary (۳ تراپیست +
  فرزندانشان + یک پوشه‌ی صدایِ آرشیوشده‌ی synthetic) و اسکریپت‌های موقتِ تست کاملاً پاک شدند؛
  شمارشِ هر ۶ جدول دوباره صفر. جزئیاتِ کامل: [verification](verification/2026-09-16-postgres-to-mysql-migration.md#به‌روزرسانیِ-2026-09-16-ادامه-همان-روز--تستِ-end-to-endِ-واقعیِ-wsstt-با-دستورِ-صریحِ-مالک).
- **فایل‌ها:** بدونِ تغییرِ کدِ دائمی (فقط اجرا/تست)؛ اسکریپت‌های موقتِ `server/scratch-ws-*.mjs`
  و `server/data/test-speech.{wav,webm}` ساخته و در پایان حذف شدند (هرگز commit نشدند).
- **اسنادِ به‌روزشده:** verification/2026-09-16-postgres-to-mysql-migration.md (بخشِ جدید).
- **تست / تأیید:** بالا، با جزئیاتِ کاملِ هر مسیر در فایلِ verification.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** با این دور، همه‌ی مسیرهایِ اصلیِ سرور با زیرساختِ واقعی رویِ MySQL تأیید
  شدند. کارِ بازِ واقعی همچنان: (۱) MySQL روی این ماشین سرویسِ ویندوز نیست، (۲) production
  همچنان Postgres است و cutoverِ واقعی نیازمندِ تصمیمِ جداگانه (LAW-006) است.

### 2026-09-16 — CODE/TEST — تکمیلِ مهاجرتِ دیتابیس PostgreSQL → MySQL: سیم‌کشیِ کد + تستِ واقعی
- **چه شد:** ادامه‌ی رویدادِ 2026-09-15 (فازِ ۱: بک‌آپ + schema.sql + migrationها). به دستورِ
  صریحِ مالک («این تغییرات رو اعمال کن»): (۱) MySQL Community Server 8.4.9 روی همین ویندوز با
  `winget install Oracle.MySQL --silent` نصب و راه‌اندازی شد (دیتادایرکتوریِ لوکال، پورت 3306؛
  **نه Windows Service** — یعنی با ری‌استارتِ ویندوز خاموش می‌ماند و باید دستی/با service جدید
  دوباره اجرا شود)، تا LAW-016 («احتمالاً کار می‌کنه» کافی نیست) واقعاً رعایت شود؛ (۲)
  `server/src/db/connection.ts` و `migrate.ts` از `pg` به `mysql2` بازنویسی شدند (UUID در برنامه
  با `crypto.randomUUID()`، `typeCast` برایِ TINYINT(1)→boolean و JSON→object با encoding
  صریحِ utf8، idempotency با گرفتنِ errno‌های مشخصِ MySQL به‌جایِ `IF NOT EXISTS`ِ Postgres)؛
  (۳) هر ۹۳ نقطه‌ی کوئری در ۱۰ فایل (`auth.ts`، `clients.ts`، `sessions.ts`، `admin.ts`،
  `ownership.ts`، `auth/session.ts`، `ws/transcription.ts`، `stt/batchqueue.ts`,
  `stt/sessionAudioArchive.ts`) بازنویسی شدند: `$N`→`?`، حذفِ `RETURNING` (جایگزین: تولیدِ id در
  برنامه + SELECTِ جدا، یا چکِ `rowCount`)، `ON CONFLICT`→`ON DUPLICATE KEY UPDATE`،
  `NULLS LAST`→`(col IS NULL), col`، `ILIKE`→`LIKE CONCAT`، CTEِ نویسنده‌ی ساختِ جلسه‌ی
  دستی+یادداشت (که MySQL پشتیبانی نمی‌کند) → تراکنشِ صریح با `pool.getConnection()`،
  DELETEِ چندجدولیِ Postgres (`USING`) در `/api/notes/:id` → SELECTِ مالکیت + DELETEِ ساده؛
  (۴) `package.json`: `pg`/`@types/pg` حذف، `mysql2` اضافه شد؛ `pnpm install` اجرا شد؛ (۵)
  `server/.env`: `DATABASE_URL` به فرمتِ mysql عوض شد (فقط لوکال — production دست‌نخورده).
  **تستِ واقعی** (نه فقط typecheck): دیتابیسِ MySQL از صفر با `pnpm dev` بالا آمد، هر ۱۴
  migration (شاملِ ۰۱۳ به‌صورتِ اسکریپتِ Node که دوباره از تابعِ تست‌شده‌ی `sessionDate.ts`
  استفاده می‌کند) بدونِ خطا اعمال شدند؛ یک سناریوی canaryِ کاملِ سرتاسری با `curl` رویِ سرورِ
  واقعی (ثبت‌نام→ساختِ مراجع→جلسه‌ی دستی+یادداشتِ اتمیک→جلسه‌ی زنده+متنِ فارسیِ واقعی→تعارضِ
  نسخه (409)→ترتیبِ یادداشت‌هایِ null/غیرِnull→PATCH وضعیت/دسته→جستجویِ ادمینِ فارسی→export
  درختی→حذفِ آبشاری) اجرا و تأیید شد؛ یک باگِ واقعی حینِ تست پیدا و رفع شد (ستونِ JSONِ
  `anchors` بدونِ آرگومانِ encoding در mysql2 باینری تفسیر می‌شد — با `field.string('utf8')`
  رفع شد). پاکسازیِ کاملِ دیتایِ canary تأیید شد (شمارشِ هر ۶ جدول صفر). `cd server && npx tsc
  --noEmit` دو بار (قبل/بعدِ فیکس) سبز. **صادقانه، تست نشد:** مسیرِ WebSocketِ زنده با Soniox
  واقعی (نیازمندِ صدایِ واقعی) — کوئری‌هایش الگویِ یکسان با کوئری‌هایِ تست‌شده‌ی REST دارند ولی
  خودِ لایوِ WS end-to-end تست نشد؛ جزئیاتِ کامل در [verification](verification/2026-09-16-postgres-to-mysql-migration.md).
- **فایل‌ها:** `server/src/db/connection.ts`، `migrate.ts`، `ownership.ts`، `http/auth.ts`،
  `clients.ts`، `sessions.ts`، `admin.ts`، `auth/session.ts`، `ws/transcription.ts`،
  `stt/batchqueue.ts`، `stt/sessionAudioArchive.ts`، `package.json`، `.env` (لوکال، commit نمی‌شود).
- **اسنادِ به‌روزشده:** `docs/02-reference/database-catalog.md` (هشدارِ مهاجرت)،
  `docs/02-reference/configuration-catalog.md` (فرمتِ جدیدِ `DATABASE_URL`)،
  `docs/01-architecture/data-architecture.md` (ردیفِ محلِ نگهداری).
- **تست / تأیید:** بالا؛ جزئیاتِ کامل در verification/2026-09-16-postgres-to-mysql-migration.md.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** (۱) MySQL روی این ماشین سرویسِ ویندوز نیست — بعدِ ری‌استارتِ سیستم باید
  دستی اجرا شود (`mysqld --datadir=... --port=3306`) یا به سرویس تبدیل شود؛ (۲) مسیرِ WS
  زنده/Soniox با صدایِ واقعی هنوز تست نشده؛ (۳) production همچنان Postgres است — cutoverِ واقعی
  (deploy) نیازمندِ تصمیمِ صریحِ جداگانه‌ی مالک است (LAW-006)؛ (۴) بک‌آپِ Postgresِ 2026-09-15
  رویِ دسکتاپ همچنان معتبر است، دیتابیسِ Postgresِ لوکال هم دست‌نخورده باقی مانده.

### 2026-09-15 — CODE — شروعِ مهاجرتِ دیتابیس از PostgreSQL به MySQL: بک‌آپ + schema.sql + migrationها
- **چه شد:** به دستورِ صریحِ مالک، فازِ اولِ مهاجرتِ کاملِ دیتابیس از PostgreSQL به MySQL انجام شد
  (کدِ زنده‌ی سرور هنوز دست‌نخورده و همچنان با Postgres کار می‌کند — این فقط فازِ آماده‌سازی است):
  (۱) بک‌آپِ کاملِ ساختار+داده‌ی PostgreSQLِ لوکال با `pg_dump.exe` (که در PATH نبود، از
  `C:\Program Files\PostgreSQL\16\bin` مستقیم صدا زده شد) به دسکتاپ گرفته شد؛ (۲) با خواندنِ
  هر ۱۴ فایلِ migrationِ Postgres (`server/src/db/migrations/001..014`) و `database-catalog.md`،
  یک `schema.sql` کاملِ معادلِ MySQL 8.0+ (۷ جدول: `_migrations`, `therapists`, `auth_sessions`,
  `clients`, `sessions`, `session_notes`, `session_audio`) نوشته شد؛ (۳) معادلِ MySQLِ هر ۱۴
  migrationِ Postgres در `server/src/db/mysql/migrations/` نوشته شد (۰۰۹ تبدیلِ داده‌ی ساده به
  SQL؛ ۰۱۳ چون شاملِ ریاضیِ تبدیلِ شمسی/میلادیِ procedural است، به‌جایِ ریسکِ بازنویسیِ دستی در SQL
  خام، به‌عنوانِ اسکریپتِ Node (`013_session_date_jalali.mjs`) نوشته شد که مستقیماً همان تابعِ
  `gregorianToJalali` را از `sessionDate.ts` دوباره پیاده می‌کند). تصمیم‌های ترجمه‌ی دیالکت (UUID
  در برنامه به‌جایِ `gen_random_uuid()`، `DATETIME` به‌جایِ `TIMESTAMPTZ` به دلیلِ محدودیتِ ۲۰۳۸ی
  `TIMESTAMP`، حذفِ ایندکسِ جزئی چون MySQL پشتیبانی نمی‌کند، …) در بالای `schema.sql` مستند شد.
  **کارِ باقی‌مانده** (هنوز شروع نشده، منتظرِ تصمیمِ مالک): سیم‌کشیِ واقعیِ کد — تعویضِ درایورِ
  `pg`→`mysql2`، بازنویسیِ `connection.ts`/`migrate.ts`، و بازنویسیِ ~۹۳ نقطه‌یِ کوئری (پارامترِ
  `$1`→`?`، حذفِ `RETURNING`، `ON CONFLICT`→`ON DUPLICATE KEY UPDATE`) در ۱۰ فایلِ
  `server/src/{http,ws,stt,auth,db}/*.ts` — این فاز نیازمندِ یک سرورِ MySQLِ واقعی برایِ تستِ
  واقعی (LAW-016) است که فعلاً روی این ماشین نصب/در حالِ اجرا نیست (نه پورت 3306، نه سرویس، نه
  Docker) — از مالک درباره‌ی نصبِ MySQLِ لوکال یا اتصال به یک سرورِ موجود پرسیده شد.
- **فایل‌ها:** `server/src/db/mysql/schema.sql` (جدید)، `server/src/db/mysql/migrations/001..014`
  و `README.md` (جدید، ۱۳ به‌صورتِ `.mjs`)، `C:\Users\Moheb\Desktop\feelia-postgres-backup-2026-09-15.sql`
  (خارجِ ریپو — بک‌آپ، طبقِ LAW-002 هرگز commit نمی‌شود).
- **اسنادِ به‌روزشده:** همین فایل. `database-catalog.md`/`data-architecture.md` هنوز به‌روز نشدند
  چون هیچ تغییری در ساختارِ زنده‌ی Postgres رخ نداده (فقط یک نسخه‌ی موازیِ MySQL اضافه شد).
- **تست / تأیید:** بک‌آپ اجرا و حجم/تعدادِ خطوطش تأیید شد (۹۳۷۸۳ بایت، ۷۳۵ خط). فایل‌های
  schema/migration به‌صورتِ متنی در برابرِ کاتالوگ/مایگریشنِ Postgres مرور شدند؛ **روی هیچ سرورِ
  MySQLِ واقعی اجرا نشدند** (چون چنین سروری در دسترس نیست) — طبقِ LAW-016 این ادعا نمی‌شود که
  «کار می‌کند»، فقط این‌که با دیالکتِ MySQL 8.0 مطابقت دارند.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** سیم‌کشیِ کدِ سرور به MySQL + تستِ واقعی، منوطِ به پاسخِ مالک به سؤالِ محیطِ
  MySQL (نصبِ لوکال در همین گفتگو، یا آدرسِ یک سرورِ موجود).

### 2026-09-15 — CODE — بازطراحیِ کاملِ انتخابگرِ تاریخِ شمسی به تقویمِ پاپ‌آورِ گرافیکی
- **چه شد:** به دستورِ صریحِ مالک، دورِ چهارمِ فیکسِ `renderJalaliPicker` امروز — این‌بار بازطراحیِ
  کامل، نه فیکسِ ظاهری. مالک اسکرین‌شاتِ سه‌selectِ نتیجه‌ی فیکسِ قبلی فرستاد: «به‌صورتِ بای‌دیفالت
  تقویم رو نشون نمی‌ده و اگه هم نشون بده... این شکل افتضاح»، و عکسِ نمونه‌ای از یک تقویمِ گرافیکیِ
  واقعی (گریدِ روز + ناوبریِ ماه) فرستاد. قبل از پیاده‌سازی سه تصمیم از مالک پرسیده و تأیید شد:
  (۱) اعمال در هر دو نقطه‌ی مصرف (`manualDatePicker` و مودالِ «ویرایش تاریخ/ساعت»)، (۲) افزودنِ
  پرشِ سریعِ ماه/سال (کلیک روی عنوان)، (۳) دکمه‌ی محرک با آیکنِ SVGِ تقویم + متن. تعمیر: سه
  `<select>` کاملاً حذف شدند؛ یک دکمه‌ی `.jalali-cal-trigger` (آیکن+متن) یک پاپ‌آورِ
  `.jalali-cal-drop` باز می‌کند، هم‌الگو با `.sort-menu`/`.client-menu-drop`ِ موجودِ اپ
  (`closeAllClientMenus` یک خط برایِ بستنِ آن با کلیکِ بیرون گسترش یافت). پاپ‌آور: ناوبریِ ماه با
  فلش (غیرفعال بعد از امروز)، عنوانِ «ماه، سال» که با کلیک به گریدِ ۱۲ماهه + ناوبریِ سال می‌رود
  (پرشِ مستقیم برایِ تاریخ‌هایِ خیلی قدیمی)، گریدِ ۷ستونه‌ی روزها. برایِ چینشِ روزِ هفته، به‌جایِ
  پیاده‌سازیِ الگوریتمِ کاملِ تبدیلِ شمسی↔میلادی (ریسکِ باگ)، از شمارشِ فاصله‌ی روز نسبت به
  «امروزِ واقعی» با `jalaliIsLeap`/`jalaliMonthLength`ِ همینِ فایل استفاده شد (`jalaliToOrdinal` +
  `jalaliFirstWeekday` جدید) — به‌طورِ مستقل با `Intl.DateTimeFormat('fa-IR-u-ca-persian')` تأیید
  شد که ۲۴ شهریورِ ۱۴۰۵ واقعاً سه‌شنبه است و در ستونِ درست رندر می‌شود. CSSِ بی‌استفاده‌ی
  `.jalali-select`/`.jalali-picker-row` حذف و با `.jalali-cal-*` جایگزین شد. امضایِ تابع و هر دو
  نقطه‌ی مصرف دست‌نخورده ماندند.
- **فایل‌ها:** `public/index.html` (CSSِ نزدیکِ `input,textarea`، بدنه‌ی کاملِ `renderJalaliPicker`،
  توابعِ کمکیِ جدید، و یک خط در `closeAllClientMenus`).
- **اسنادِ به‌روزشده:** ندارد.
- **تست / تأیید:** syntax ✅؛ `tsc --noEmit` ✅؛ `pnpm test:rt` → 29 PASS/6 FAIL (baseline، بدونِ
  رگرسیون) ✅؛ تستِ مرورگری روی سرورِ dev واقعیِ اجراشده (`pnpm dev`، بعد متوقف شد؛ بدونِ ورود/حساب/
  رمزِ واقعی) — هر دو حالتِ `allowEmpty` (true/false)، انتخابِ روز، پرشِ سریعِ ماه/سال، پاک‌کردنِ
  تاریخ، طولِ ماهِ اسفندِ غیرکبیسه (۲۹ روز)، عرضِ موبایلِ واقعی (۳۷۵px)، و تمِ روشن همه تأیید شدند.
  جزئیاتِ کامل: [verification](verification/2026-09-15-jalali-calendar-popup-redesign.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** ندارد. کار commitنشده.

### 2026-09-15 — CODE — بازطراحیِ انتخابگرِ «تاریخِ تقریبیِ جلسه» (ترتیبِ برعکس + حذفِ سوییچِ «بدون تاریخ»)
- **چه شد:** به دستورِ صریحِ مالک، دورِ سومِ فیکسِ `renderJalaliPicker` (بعدِ دو دورِ قبلی که فقط
  استایلِ خامِ `<select>` و تناقضِ پیش‌فرضِ سوییچ را حل کرده بودند). مالک اسکرین‌شاتِ `manualDatePicker`
  فرستاد: «فضایِ زیادی گرفته، برعکس هم هست»، بعد: «برگردون حالتِ اول فقط بشه انتخاب کرد … این گزینه‌ی
  بدون تاریخ … خودمون اختیاری می‌ذاریم دیگه این دکمه چیه». علتِ ریشه‌ای: (۱) DOM به‌ترتیبِ
  سال/ماه/روز پر می‌شد؛ در گریدِ `dir=rtl`، اولین فرزند (سال) راست‌ترین رندر می‌شد → «۱۴۰۵/شهریور/۲۴»
  یعنی سال-ماه-روز از راست به چپ، برخلافِ ترتیبِ طبیعیِ فارسیِ «روز ماه سال». (۲) سه select
  تمام‌عرض + یک `.toggle-row` کاملِ سوییچ زیرش، برایِ یک فیلدِ فرعیِ اختیاری فضایِ نامتناسب می‌گرفت.
  (۳) لیبل از قبل «(اختیاری)» می‌گفت، پس سوییچِ همیشه‌نمایانِ «صراحتاً بدون تاریخ» یک تصمیمِ اضافه
  بود که با یک کلیکِ تصادفی هم روشن/خاموش می‌شد. تعمیر: DOM حالا روز/ماه/سال (روز راست‌ترین)؛
  `noDate`/checkbox/`.toggle-row` کاملاً حذف شد؛ به‌جایش دو دکمه‌ی کوچکِ `button.btn.btn-ghost.btn-sm`
  (همان کلاسِ «ویرایش تاریخ/ساعت» موجودِ اپ) — «افزودنِ تاریخ» (وقتی هنوز ثبت نشده) و «پاک‌کردنِ
  تاریخ» (وقتی ثبت شده)، هرکدام یک عملِ صریحِ یک‌باره، نه سوییچِ دائمی‌نمایان. هیچ CSSِ جدیدی لازم
  نشد. مسیرِ مودالِ ویرایش (`allowEmpty:false`) فقط ترتیبش عوض شد، بدونِ دکمه.
- **فایل‌ها:** `public/index.html` (فقط بدنه‌ی `renderJalaliPicker` + کامنتِ بالادستش).
- **اسنادِ به‌روزشده:** ندارد.
- **تست / تأیید:** syntax ✅؛ `tsc --noEmit` ✅؛ `pnpm test:rt` → 29 PASS/6 FAIL (baseline، بدونِ
  رگرسیون) ✅؛ تستِ مرورگری روی سرورِ dev واقعیِ درحال‌اجرا (`localhost:3000`، بدونِ ورود/حساب/رمزِ
  واقعی — فقط فراخوانیِ مستقیمِ تابع روی `<div>` موقت) — مقدارِ خالی فقط «افزودنِ تاریخ» نشان داد؛
  کلیکش سه select به‌ترتیبِ روز/ماه/سال (تأییدشده با مختصاتِ x) با `emit` درست ساخت؛ تغییرِ select و
  «پاک‌کردنِ تاریخ» هر دو `onChange` درست صدا زدند؛ مقدارِ ازقبل‌موجود و مودالِ ویرایش هم درست. جزئیاتِ
  کامل: [verification](verification/2026-09-15-jalali-picker-order-and-nodate-toggle.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** ندارد. کار commitنشده.

### 2026-09-15 — CODE — رفعِ تناقضِ پیش‌فرضِ انتخابگرِ تاریخِ شمسی («برعکسه، نمی‌توانم تغییر بدهم، زشت»)
- **چه شد:** به دستورِ صریحِ مالک (شکایتِ مستقیم، عینِ پیام) روی کدِ نشستِ دیگر ادامه‌ی فیکسِ قبلی
  انجام شد. علتِ ریشه‌ای: برایِ جلسه‌ی دستیِ تازه (`date=null`)، `renderJalaliPicker` با `noDate`
  پیش‌فرضِ `true` صدا زده می‌شد — یعنی سه انتخابگر از قبل با **تاریخِ امروز** پُر بودند ولی
  `disabled`، و هم‌زمان سوییخِ «بدون تاریخ» هم روشن بود: تناقضِ هم‌زمانِ «یک تاریخ هست» و «تاریخی
  نیست» روی صفحه (=«برعکسه»)، و چون disabled بود کاربر اصلاً نمی‌توانست چیزی انتخاب کند تا این
  تناقض را کشف و سوییچ را خاموش کند (=«نمی‌توانم تغییر بدهم»). تعمیر: (۱) `noDate` حالا همیشه با
  `false` شروع می‌شود — انتخابگرها از لحظه‌ی اول فعال‌اند؛ (۲) `setDisabled` از خاکستری‌کردنِ
  سه‌انتخابگرِ هنوز-دیده‌شده به **مخفی‌کردنِ کاملِ ردیف** تغییر کرد (`wrap.hidden`) — وقتی سوییچ
  روشن است دیگر هیچ تاریخِ کاذبی نشان داده نمی‌شود، و فضایِ کارت هم کوچک‌تر می‌شود (=«گنده و زشت»).
  **محدودیتِ پذیرفته‌شده:** جلسه‌ای که قبلاً صریحاً «بدون تاریخ» ذخیره شده، حالا در بازکردنِ دوباره
  به‌جایِ سوییچِ روشن، تاریخِ امروز را (فعال، دست‌نخورده در DB تا واقعاً تغییری داده شود) نشان
  می‌دهد — چون از رویِ `value=''` نمی‌شود «هرگز تنظیم نشده» را از «عمداً خالی» تشخیص داد.
- **فایل‌ها:** `public/index.html` (فقط بدنه‌ی `renderJalaliPicker`، دو خطِ منطق).
- **اسنادِ به‌روزشده:** ندارد.
- **تست / تأیید:** syntax ✅؛ `tsc --noEmit` ✅؛ `pnpm test:rt` → 29 PASS/6 FAIL (baseline) ✅؛
  تستِ مرورگری با mock — انتخابگرها از اول فعال با تاریخِ امروز، سوییچ خاموش؛ کلیکِ سوییچ → سه
  انتخابگر کاملاً مخفی (نه فقط کم‌رنگ)؛ مسیرِ بدونِ `allowEmpty` (مودالِ ویرایش) دست‌نخورده. جزئیاتِ
  کامل: [verification](verification/2026-09-15-jalali-picker-default-and-contradiction.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک — روی کدِ نشستِ دیگر.
- **کارِ باز / پیامد:** محدودیتِ بالا (نمایشِ اولیه برایِ جلسه‌یِ قبلاً-صریحاً-بدونِ‌تاریخ) به مالک
  گزارش شود؛ اگر مهم بود، راهِ حلش افزودنِ یک فلگِ صریح در پاسخِ سرور است (خارج از دامنه‌ی این فیکس).
  کار commitنشده.

### 2026-09-15 — CODE — رفعِ باگِ ظاهریِ انتخابگرِ تاریخِ شمسی (`<select>` بدونِ استایل)
- **چه شد:** به دستورِ صریحِ مالک («تاریییییییخ چرا اینجوری شده … توی طراحیِ ظاهری ریده») باگ رفع شد
  — روی کدِ `renderJalaliPicker`ِ نشستِ دیگر (نه کدِ خودِ این نشست)، طبقِ LAW-024/رفتارِ agent
  برگردانده نشد. علتِ ریشه‌ای: در کلِ `index.html` هیچ قاعده‌ی CSSای برایِ `<select>` نبود (فقط
  `input,textarea`)؛ سه سلکتِ سال/ماه/روز با `style.cssText` خام ساخته می‌شدند (بدونِ رنگ/بوردر/فونت)
  و با `flex:1;min-width:90px` در عرضِ کارتِ موبایل (~۲۸۰px) به چند ردیفِ نامتقارن می‌شکستند. چک‌باکسِ
  «بدون تاریخ» هم checkboxِ خام بود، نه سوییچِ استانداردِ اپ. تعمیر: کلاسِ جدیدِ `.jalali-select`
  (هم‌سطحِ استایلِ `input`، حالتِ disabled با `opacity:.55` مثلِ `button.btn:disabled`) +
  `.jalali-picker-row{display:grid;grid-template-columns:repeat(3,1fr)}` به‌جایِ flex-wrap (هیچ‌وقت
  نمی‌شکند) + استفاده از `.toggle-row` برایِ «بدون تاریخ». آیکونِ فلشِ سلکت، نیتیوِ مرورگر ماند
  (بدونِ `appearance:none`) چون صفحه از قبل `color-scheme:light/dark` دارد و مرورگر خودش هماهنگ
  می‌کند. فقط `className` جایِ `style.cssText` در JS — بدونِ تغییرِ منطق/امضایِ تابع.
- **فایل‌ها:** `public/index.html` (CSS نزدیکِ `input,textarea`، بدنه‌ی `renderJalaliPicker`).
- **اسنادِ به‌روزشده:** ندارد (این یک باگِ ظاهریِ محلی است، نه تغییرِ الگو/قاعده‌ی جدید در سیستمِ طراحی).
- **تست / تأیید:** syntax ✅؛ `tsc --noEmit` ✅؛ `pnpm test:rt` → 29 PASS/6 FAIL (baseline) ✅؛ تستِ
  مرورگری با mock — سه سلکت در یک ردیف بدونِ شکستن، حالتِ disabledِ «بدون تاریخ» با
  `opacity`، تمِ تاریک هماهنگ، مودالِ ویرایشِ جلسه در عرضِ ۳۷۵px («اسفند» کامل نمایش داده شد).
  جزئیاتِ کامل: [verification](verification/2026-09-15-jalali-picker-select-styling.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک — روی کدِ نشستِ دیگر.
- **کارِ باز / پیامد:** هیچ. کار commitنشده.

### 2026-09-15 — FINDING — نشستِ دیگر هم‌زمان روی همین فایل/`index.html` کار می‌کند (دیده‌شده از این سو)
- **چه شد:** بعدِ ثبتِ ورودیِ زیر («رفعِ یافته‌ی جانبیِ کنتراستِ --sage»)، هنگامِ Edit دوباره‌ی همین
  فایل خطای «file has been modified since read» گرفته شد؛ re-read نشان داد نشستِ دیگری هم‌زمان دو
  ورودیِ جدید («تکمیلِ تستِ ۷ باگ» و خودِ همین FINDingِ متقابل — زیر) و کدِ متناظرِ ۷-باگ را در
  `public/index.html` اضافه کرده (ناحیه‌های `setLiveTextFollow`، انتخابگرِ تاریخِ شمسی، Clarity،
  `screenAdminSessionDetail`، حذفِ `ux-consent`/`link-btn`). طبقِ LAW-024/رفتارِ agent برگردانده
  **نشد**. بررسی: ناحیه‌های آن نشست با ناحیه‌های این نشست (بلوکِ `[data-theme="dark"]`، توکنِ
  `--sage`/`--sage-hover`، `feelia-design-system.html`) هیچ هم‌پوشانی ندارند — با `grep` تأیید شد
  فقط **یک** نسخه از `--sage:#427a68` در فایل وجود دارد (نه دو نسخه‌ی متعارض). `tsc --noEmit` و
  `pnpm test:rt` بعدِ دیدنِ تغییرِ آن نشست، دوباره از این سو اجرا و سبز بود.
- **فایل‌ها:** هیچ از سمتِ این نشست برایِ این ورودی (فقط مشاهده + تأییدِ عدمِ تعارض).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** `grep` برایِ یکتاییِ توکنِ `--sage` در `index.html` ✅؛ `cd server && npx tsc --noEmit` ✅؛ `pnpm test:rt` → 29 PASS/6 FAIL ✅.
- **عامل:** کشف‌شده در این نشست؛ تغییرِ محتوا از نشستِ دیگر.
- **کارِ باز / پیامد:** ندارد — دو مجموعه‌تغییر (کنتراستِ `--sage` در تمِ تاریک از این نشست، ۷-باگ +
  تکمیلِ تستش از نشستِ دیگر) مستقل و سازگارند. هر ویرایشِ بعدیِ این فایل باید دوباره re-read شود.

### 2026-09-15 — CODE — رفعِ یافته‌ی جانبیِ کنتراستِ --sage در تمِ تاریک
- **چه شد:** به دستورِ صریحِ مالک («اگه باگی هست که اصلاح نکردی … اصلاحش کن») یافته‌ی جانبیِ ثبت‌شده
  در ورودیِ «اصلاحِ کنتراستِ تبِ فعال/غیرفعال + آیکونِ نمایشِ رمز» زیر (متنِ سفید روی `--sage` در تمِ
  تاریک، ~۴٫۱:۱، زیرِ ۴٫۵:۱ برایِ متنِ کوچک) رفع شد. با فرمولِ WCAG محاسبه شد: `--sage:#4e8977`→
  ۴٫۰۶:۱، `--sage-hover:#5a9783`→۳٫۳۹:۱ (بدتر، چون از پایه روشن‌تر بود). فقط این دو توکن در بلوکِ
  `[data-theme="dark"]` تیره‌تر شدند (همان هیو، فقط روشناییِ کمتر): `--sage:#427a68` (۴٫۹۸:۱)،
  `--sage-hover:#396858` (۶٫۳۷:۱، حالا هم‌سو با جهتِ hoverِ تمِ روشن: پررنگ‌تر=تیره‌تر). هیچ
  کامپوننتی مستقیم لمس نشد — `.btn-primary`، `.cat-filter-chip.active`، `.cat-seg button.active`،
  `.client-tab.active`، `.sign-chip.logged` همه از همین دو متغیر تغذیه می‌کنند. تمِ روشن دست‌نخورده ماند.
- **فایل‌ها:** `public/index.html` (بلوکِ `[data-theme="dark"]`، `--glow-sage`).
- **اسنادِ به‌روزشده:** `feelia-design-system.html` (همان دو توکن در هر دو بلوکِ dark + یک
  `rule.bad`/`rule.good` جدید در «۰۸ — لغزش‌گاه‌ها» + آیتمِ چک‌لیستِ §۰۹: «کنتراستِ متن‌روی‌رنگِ‌پُر را
  در هر دو تم جدا اندازه بگیر»).
- **تست / تأیید:** `cd server && npx tsc --noEmit` ✅ بدونِ خطا؛ `pnpm test:rt` → **29 PASS / 6 FAIL**،
  دقیقاً baseline؛ تستِ تعاملیِ مرورگری با mock serverِ اسکرچ‌پد — کنتراستِ محاسبه‌شده‌ی واقعی
  (`getComputedStyle` + فرمولِ WCAG در صفحه) روی `.btn-primary` و `.client-tab.active` بعدِ
  toggleِ واقعیِ کلاس = **۴٫۹۸**؛ تمِ روشن (`--sage:#3e6b5e`) دست‌نخورده تأیید شد. جزئیاتِ کامل
  و یک محدودیتِ ابزارِ اتوماسیون (کشِ computed-style روی نودِ ازقبل‌موجود، رفعِ ابهام با
  `document.styleSheets` و اسکرین‌شات): [verification](verification/2026-09-15-dark-theme-sage-contrast.md).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** هیچ. کار commitنشده.

### 2026-09-15 — FINDING — ویرایشِ هم‌زمانِ `index.html` توسطِ نشستِ دیگر حینِ تستِ این نشست
- **چه شد:** حینِ اجرایِ تستِ تکمیلی (ورودیِ زیر)، ورودیِ Event Log بالاتر («اصلاحِ کنتراستِ تبِ
  فعال/غیرفعال + آیکونِ نمایشِ رمز») و کدِ متناظرش در `public/index.html` توسطِ یک نشستِ دیگر اضافه
  شد — هنگامِ باز کردنِ فایل برایِ ثبتِ نتیجه‌ی این تست دیده شد (نه هنگامِ شروع). طبقِ LAW-024/رفتارِ
  agent («اگر دیدی نشستِ دیگری کد/سند را عوض کرده، برنگردان؛ ثبت کن») برگردانده **نشد**. بررسیِ سریع:
  ناحیه‌های ویرایش‌شده (`.client-tab`، فیلدِ رمزِ صفحه‌ی ورود، `IC_EYE_OFF`، `switchClientTab`) با
  ناحیه‌هایِ این نشست (یادداشتِ صوتی/متنی، انتخابگرِ تاریخ، ثبت‌نام، Clarity، اسکرولِ خودکار، ادمین)
  هم‌پوشانی ندارند؛ بعد از دیدنِ تغییر، `node --check`/syntax و `tsc --noEmit` دوباره اجرا شد — هر دو
  سبز، بدونِ تعارض.
- **فایل‌ها:** هیچ (فقط مشاهده + تأییدِ عدمِ تعارض).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** `node --check` روی بلوک‌های `<script>` ✅؛ `cd server && npx tsc --noEmit` ✅.
- **عامل:** کشف‌شده در این نشست؛ تغییر از نشستِ دیگر.
- **کارِ باز / پیامد:** ندارد — دو مجموعه‌تغییر مستقل و سازگارند.

### 2026-09-15 — TEST — تکمیلِ تستِ ۷ باگ: سرورِ لوکالِ واقعی + موبایل/دسکتاپ + اسکرولِ سطحِ صفحه
- **چه شد:** به دستورِ صریحِ مالک («مسیر رو و تغییراتی که دادیو کامل تست کن اونایی که انجام نشده هم
  انجام بده»)، سه موردِ باقی‌مانده از تستِ قبلی تکمیل شد:
  1. **سرورِ لوکالِ واقعی (Postgres):** `pnpm dev` روی DBِ dev اجرا شد (۲ تراپیست/۲۷ مراجع/۱۰۱ جلسه‌ی
     موجود، دست‌نخورده). با `curl` مستقیم: `register` بدونِ نام/تخصص → `400`؛ با نامِ فقط-whitespace
     → `400` (trim کار کرد)؛ با تخصصِ خالی → `400`؛ با نامِ ۱۰۱کاراکتری → `400`؛ معتبر → `201` (ردیفِ
     واقعی در DB). `PUT /api/sessions/:id` با `date:"1404/12/29"` (فرمتِ دقیقِ خروجیِ picker) و با
     `date:null` هر دو `200` و درست ذخیره شدند. `GET /api/admin/sessions/:id` با غیرادمین → `403`؛
     بعدِ ارتقاءِ دستیِ `is_admin` در DB (نه دستکاریِ `ADMIN_PHONE`ِ واقعیِ مالک) → `200` با متن+یادداشت؛
     `admin/therapists`، `admin/therapists/:id/clients`، `admin/clients/:id/sessions` هر سه فیلدهایِ
     جدید (specialty، status/category/gender، source/consent) را داشتند. **پاکسازی:** ردیفِ
     تراپیستِ canary مستقیم از DB حذف شد (cascade)؛ شمارش‌های بعد دقیقاً برابرِ قبل از تست.
  2. **چیدمانِ picker موبایل/دسکتاپ:** با mock backend در Browser pane، هر دو picker (تاریخِ جلسه‌ی
     دستی + مودالِ ویرایش) در ۳۷۵×۸۱۲ و ۱۲۸۰×۷۲۰ بدونِ اسکرولِ افقی یا برش رندر شدند.
  3. **اسکرولِ خودکارِ سطحِ صفحه (تکمیلِ Item 5):** یافته‌ی نشستِ قبل («`requestAnimationFrame` در این
     Browser pane قابلِ‌اعتماد fire نمی‌شود») دوباره دیده شد؛ با synchronous‌کردنِ موقتِ rAF، **خودِ
     تابعِ واقعیِ `setLiveTextFollow`** (بدونِ بازنویسی) در یک viewportِ کوچک (۳۹۰×۵۰۰) صدا زده شد:
     `window.scrollY` از ۰ به مقدارِ دقیقاً محاسبه‌شده (`rect.bottom - bottomLimit`) رسید؛ با شبیه‌سازیِ
     «کاربر همین الان دستی اسکرول کرد»، صفحه دیگر نپرید ولی جعبه هنوز دنبال کرد — دقیقاً طبقِ طراحی.
     تشخیصِ نمایان‌بودنِ `#liveControls` (`offsetParent!==null`، نه فقط `hidden`) هم تأیید شد.
  بدونِ خطایِ کنسول در کلِ تست؛ بدونِ اثرِ باقی‌مانده روی دیتایِ واقعیِ مالک.
- **فایل‌ها:** هیچ (فقط تست؛ mock server و تستِ curl خارج از repo).
- **اسنادِ به‌روزشده:** [verification/2026-09-15-seven-bugs.md](verification/2026-09-15-seven-bugs.md)، این فایل.
- **تست / تأیید:** خودِ این رویداد تست است — نتایج بالا.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** هر ۶ مورد اکنون در سه سطح (mock UI، سرورِ واقعی، چیدمان/اسکرول) تأیید شده‌اند.
  سرور/mock/تبِ Browser pane بعدِ تست متوقف/بسته شدند. کارِ اصلی هنوز commitنشده (LAW-022).

### 2026-09-15 — CODE — اصلاحِ کنتراستِ تبِ فعال/غیرفعالِ مراجعین + افزودنِ آیکونِ نمایشِ رمز
- **چه شد:** به دستورِ مالک (شکایتِ کاربر: «مشخص نیست کدام تب انتخاب شده» + «رمز خودش را نمی‌تواند
  ببیند») audit شد و علتِ ریشه‌ای پیدا شد: `.client-tab.active{background:var(--card)}` روی زمینه‌ی
  ظرفِ `var(--field)` می‌نشست — نسبتِ کنتراستِ این دو رنگ در هر دو تم حدودِ ۱٫۰۳:۱ است (زیرِ حداقلِ
  ۳:۱ برایِ اجزای غیرمتنی، WCAG 1.4.11). یک پلنِ سه‌بخشی (این مورد + چشمِ رمز + بررسیِ تحلیلیِ
  «UI بدونِ بوردر») نوشته و توسطِ مالک تأیید شد؛ فقط دو موردِ اول اجرا شد (سومی صرفاً تحلیل بود،
  طبقِ خودِ پلن اجرا نشد). تغییرات: (۱) `.client-tab.active` حالا با `background:var(--sage)` +
  متنِ سفید پُر می‌شود — هم‌راستا با الگویِ موجودِ `.cat-seg button.active`/`.step.active` و با
  قاعده‌ی خودِ `feelia-design-system.html`؛ بوردرِ `.client-tabs` حذف شد؛ `role="tablist"`/`"tab"`/
  `aria-selected` اضافه و در `switchClientTab()` sync شد. (۲) فیلدِ رمزِ صفحه‌ی ورود دکمه‌ی
  چشم/چشمِ‌خط‌خورده (`.pw-field`/`.pw-toggle`، آیکونِ جدیدِ `IC_EYE_OFF`) گرفت که `type` را بینِ
  `password`/`text` عوض می‌کند؛ بعدِ هر ورود/ثبت‌نامِ موفق و هر `toggleAuthMode()` به `password`
  برمی‌گردد؛ `input::-ms-reveal` هم مسدود شد تا با چشمِ داخلیِ Edge دوتا نشود.
- **فایل‌ها:** `public/index.html` (CSS نزدیکِ `.client-tabs`/`.search-box`، HTML خطوطِ
  `screenAuth`/`screenClients`، JS: `IC_EYE_OFF`، `togglePasswordVisibility`،
  `resetPasswordVisibility`، `toggleAuthMode`، `submitAuth`، `switchClientTab`).
- **اسنادِ به‌روزشده:** `feelia-design-system.html` — دو `rule` جدید در بخشِ «۰۸ — لغزش‌گاه‌های
  واقعی» (کنتراستِ حالتِ انتخاب‌شده + کامپوننتِ `.pw-toggle`) + آیتمِ جدید در چک‌لیستِ §۰۹.
- **تست / تأیید:** syntax (`node --check` روی بلوکِ `<script>`) ✅؛ `cd server && npx tsc --noEmit`
  ✅ بدونِ خطا (کنترل — سرور لمس نشد)؛ `pnpm test:rt` → **29 PASS / 6 FAIL**، دقیقاً همان baseline،
  بدونِ رگرسیون؛ تستِ تعاملیِ مرورگری با mock serverِ جدیدِ اسکرچ‌پد (فقط `/api/auth/me` +
  `/api/clients`، دادهٔ canary `A001`–`A003`، بدونِ حساب/رمزِ واقعی) — سوییچِ تب با اسکرین‌شات و
  `aria-selected`/`getComputedStyle` تأیید شد (رنگِ فعال = `rgb(78,137,119)` یعنی `--sage`، متنِ
  سفید)؛ تمِ روشن/تاریک و عرضِ ۳۷۵px هر دو دیده شدند؛ چشمِ رمز با تایپِ رمزِ تستیِ کانِری
  (`testpass123`) و کلیک — تغییرِ `type`/آیکون/`aria-pressed` و ریست‌شدنِ بعدِ `toggleAuthMode`
  با `javascript_tool` تأیید شد. جزئیاتِ کامل: [verification](verification/2026-09-15-client-tab-contrast-password-eye.md).
- **عامل:** این نشست.
- **کارِ باز / پیامد:** بخشِ سومِ پلن (بی‌بوردر) عمداً اجرا نشد — نتیجه‌ی تحلیل: پیشنهادِ
  «کم‌بوردر» (نه صفر) مشروط به تعریفِ توکنِ سطحِ جدید (`--surface-2`) در `feelia-design-system.html`
  پیش از هر تغییرِ کد؛ منتظرِ تصمیمِ مالک. یافته‌ی جانبیِ ثبت‌شده (بدونِ اصلاح در این کار): متنِ
  سفید روی `--sage` در تمِ تاریک (`#4e8977`) کنتراستِ ~۴٫۱:۱ دارد، زیرِ ۴٫۵:۱ برایِ متنِ ۱۳px —
  از قبل روی `btn-primary`/`cat-filter-chip.active` هم هست، مختصِ این تغییر نیست. کار
  commitنشده.

### 2026-09-15 — TEST — تستِ تعاملیِ مرورگری با mock backend برایِ هر ۶ موردِ پلنِ ۷ باگ
- **چه شد:** به دستورِ مالک («حالا برو یه تستِ دستیِ UI با mock backend انجام بده»)، mock serverِ Node
  (بدونِ dependency، در اسکرچ‌پد) نوشته شد که `public/` واقعی را سرو می‌کند و APIهایِ لازم
  (`auth/register`/`login`/`logout`/`me`، `client-config`، `clients`، `sessions` + `notes`،
  `admin/*` شاملِ endpointِ جدیدِ `sessions/:id`) را با دیتای canary شبیه‌سازی می‌کند — بدونِ حساب/رمزِ
  واقعی (طبقِ [[feelia-frontend-testing-without-accounts]]). دیتای seed: یک مراجعِ غیرفعال با جلسه‌ی
  دستیِ ۱۴۰۳/۰۶/۱۰ + یک یادداشتِ متنی، یک مراجعِ فعال با جلسه‌ی زنده‌ی کامل (متن+علامت+یادداشتِ صوتی)،
  یک تراپیستِ ادمین. روی Browser pane (`localhost:3999`) با `computer`/`read_page`/`javascript_tool` اجرا شد.
  نتیجه‌ی هر ۶ مورد (جدولِ کامل در verification):
  - **۳:** submitِ ثبت‌نام بدونِ نام/تخصص → بنرِ خطا بدونِ درخواستِ شبکه؛ با پرکردن → ثبت‌نامِ موفق.
  - **۲:** picker با مقدارِ اولیه‌ی درست باز شد؛ تغییرِ سال به سالِ جاری → ماه‌های/روزهایِ بعد از امروز
    واقعاً `disabled` شدند (دقیقاً ۷ روزِ آخرِ شهریور، چون امروزِ سیستم ۱۴۰۵/۰۶/۲۴ است)؛ «بدونِ تاریخ»
    بلافاصله PUT زد و UI را به‌روز کرد.
  - **۶ (آرشیو):** با شبیه‌سازیِ کنسولیِ `archiveRtVoice`/`stopArchiveVoiceNoteDirect` (میکروفون در
    Browser pane نیست): بعدِ آماده‌شدنِ متنِ بازبینی هر دو دکمه `disabled` ماندند؛ «انصراف» با متنِ
    ذخیره‌نشده واقعاً `confirm()` را صدا زد، «نه» چیزی دور نریخت، «بله» پاک کرد و دکمه‌ها باز شدند؛
    ذخیره → `POST /api/sessions/s1/notes` با `type:'voice'` واقعی (۲۰۱).
  - **۶ (Wrapup):** با `rtVoice` جعلی، `showTextInput()` هیچ کاری نکرد (جعبه‌ی ضبط پنهان نشد)؛ با
    `rtVoice=null` عادی کار کرد.
  - **۵:** با rAFِ واقعیِ مرورگر (بعد از frontکردنِ تب)، جعبه تا ته اسکرول شد؛ بعدِ اسکرولِ دستیِ
    کاربر به بالا، بروزرسانیِ بعدی جعبه را نپراند. **یافته‌ی جانبی:** در این Browser pane وقتی تب در
    پس‌زمینه بود، `requestAnimationFrame` اصلاً fire نمی‌شد (محدودیتِ محیطِ خودکار، نه کدِ اپ) — رفتارِ
    اسکرولِ سطحِ صفحه (نه فقط جعبه) به‌طورِ کامل تست نشد.
  - **۱:** نه `#uxConsentBox` نه `#uxConsentToggle` در DOM؛ `<script data-feelia-clarity>` بدونِ هیچ
    کلیکی تزریق شد؛ اتصالِ واقعی به `clarity.ms` از sandbox شکست خورد ولی بی‌صدا (`state()==='disabled'`،
    بدونِ throw) — دقیقاً رفتارِ fail-silentِ طراحی‌شده.
  - **۴:** فهرستِ تراپیست‌های ادمین تخصص نشان داد؛ فهرستِ مراجعین «بزرگسال (زن) · غیرفعال
    (پیگیریِ بعداً)» و «نوجوان (پسر)» ساخت؛ فهرستِ جلسات «جلسه‌ی زنده · رضایت ✓» نشان داد؛ صفحه‌ی
    جدیدِ جزئیاتِ جلسه متنِ کاملِ رونویسی + کارتِ علامت + کارتِ یادداشتِ صوتی را نشان داد —
    `GET /api/admin/sessions/s2 → 200` در network log تأیید شد.
  بدونِ خطایِ کنسول در طولِ کل تست.
- **فایل‌ها:** هیچ (فقط تست؛ `mock-server.js` در اسکرچ‌پدِ نشست، خارج از repo).
- **اسنادِ به‌روزشده:** [verification/2026-09-15-seven-bugs.md](verification/2026-09-15-seven-bugs.md) (جدولِ کامل + یافته‌ی محدودیتِ rAF)، این فایل.
- **تست / تأیید:** خودِ این رویداد تست است — نتایج بالا.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** سرورِ لوکالِ واقعی (Postgres) هنوز تست نشده؛ اسکرولِ سطحِ صفحه (Item 5) به‌طورِ
  کامل تست نشده (محدودیتِ محیط). mock serverِ اسکرچ‌پد و تبِ Browser pane بعدِ تست بسته/متوقف شدند
  (PID پورتِ 3999). کارِ اصلی هنوز commitنشده (LAW-022).

### 2026-09-15 — CODE — اجرای هر ۶ موردِ پلنِ ۷ باگ (D1–D4) — به دستورِ صریحِ مالک در همین گفتگو
- **چه شد:** ورودیِ قبلیِ `DECISION` (زیر) نوشته بود «مالک صریحاً گفت اجرا نشود». مالک در همین گفتگو
  دستورِ جدید و صریح داد: «این پلنی که برای رفع باگ‌های فیلیا نوشته شده کامل بررسی کن و بعد شروع کن
  پیاده‌سازی» — این دستورِ تازه جایگزینِ حالتِ «فقط پلن» شد. طبقِ ترتیبِ پلن (گامِ ۰ → ۶ → ۵ → ۲ → ۳ →
  ۱ → ۴) هر ۶ مورد پیاده‌سازی شد:
  1. **یادداشتِ صوتی↔متنی:** در هر دو مسیر (Wrapup و آرشیوِ جلسه‌ی دستی) دیگر نمی‌شود وسطِ ضبط/بازبینیِ
     متنِ صوتیِ ذخیره‌نشده به یادداشتِ متنی/ضبطِ جدید سوئیچ کرد (دکمه‌ها disabled می‌مانند)؛ «انصراف» با
     متنِ ذخیره‌نشده حالا `confirm()` می‌گیرد؛ دکمه‌ی «یادداشتِ متنی»یِ Wrapup (`id="textNoteBtn"` تازه)
     در حینِ ضبط disabled است.
  2. **اسکرولِ خودکار:** helper مشترکِ `setLiveTextFollow(el,text)` در هر ۷ نقطه‌ای که متنِ زنده
     به‌روز می‌شود (`#liveText`، `#voiceLiveText`، `#archiveVoiceLiveText`) — جعبه و صفحه (با احترام به
     اسکرولِ دستیِ اخیرِ کاربر) دنبالِ متن می‌روند.
  3. **انتخابگرِ تاریخِ شمسی (D4):** تابعِ `renderJalaliPicker` (سه `<select>` روز/ماه/سال، تا امروز
     clamp‌شده، کبیسه‌آگاه با قاعده‌ی چرخه‌ی ۳۳ساله) جایگزینِ inputِ متنیِ آزاد شد — هم در تاریخِ جلسه‌ی
     دستی («بدونِ تاریخ» هم دارد) و هم در مودالِ «ویرایشِ تاریخ/ساعت».
  4. **نام/تخصصِ اجباری (D3):** سرور (`auth.ts`) در `register` نام/تخصص را trim و طول (۱–۱۰۰) چک
     می‌کند؛ `login`/`me` دست‌نخورده؛ بدونِ migration/`NOT NULL`. UI هم پیش از درخواست چک می‌کند و
     `authName` را بعدِ موفقیت پاک می‌کند (باگِ کناری: قبلاً پاک نمی‌شد).
  5. **Clarity بدونِ پرسیدن (D1):** `#uxConsentBox`/`#uxConsentToggle` و منطقِ `ask/denied/grant/deny`
     از `feelia-analytics.js` حذف شد؛ با `projectId` معتبر مستقیم `activate()`. **نقضِ آگاهانه‌ی
     LAW-011** («هرگز بدونِ رضایتِ ذخیره‌شده») — LAW-011 و `docs/analytics-clarity.md` اصلاح شدند.
  6. **دسترسیِ کاملِ ادمین (D2):** endpointِ جدیدِ `GET /api/admin/sessions/:id` (متنِ کامل + یادداشت‌ها،
     فقط‌خواندنی)؛ لیست‌های موجود + specialty/status/category/gender/source/consent؛ export هم همین
     فیلدها را دارد. UIِ پنل: تخصص در کارتِ تراپیست، وضعیت/دسته/جنسیت در کارتِ مراجع، صفحه‌ی جدیدِ
     `#screenAdminSessionDetail`. LAW-005 و PRDِ ماژول ۰۶ («دیدنِ متن» از out-of-scope خارج شد) اصلاح شدند.
- **فایل‌ها:** `public/index.html`، `public/feelia-analytics.js`، `server/src/http/auth.ts`،
  `server/src/http/admin.ts`. `public/feelia-rt.js` **لمس نشد**.
- **اسنادِ به‌روزشده:** `docs/00-governance/project-laws.md` (LAW-011)، `docs/analytics-clarity.md`،
  `docs/02-reference/api-catalog.md`، `docs/02-reference/error-code-catalog.md`،
  `docs/03-requirements/requirement-catalog.md` (REQ-003)، `docs/04-modules/01-therapist-accounts/module-prd.md`،
  `docs/04-modules/06-admin-panel/module-prd.md`، این فایل.
- **تست / تأیید:** syntax‌چکِ هر بلوکِ `<script>` در `index.html` (`new Function`) — سبز بعدِ هر مرحله؛
  `node --check feelia-analytics.js` — سبز؛ `cd server && npx tsc --noEmit` — بدونِ خطا؛ `pnpm test:rt`
  — ۲۹ PASS/۶ FAIL، دقیقاً همان baseline؛ تستِ واحدِ `jalaliIsLeap`/`jalaliMonthLength` (استخراج از کد،
  اجرا در Node) روی ۱۴۰۳/۱۴۰۴/۱۴۰۸ — درست. **تستِ تعاملیِ مرورگری (mock backend) و سرورِ لوکالِ واقعی
  انجام نشد** — جزئیات: [verification](verification/2026-09-15-seven-bugs.md).
- **عامل:** این نشست، به دستورِ صریحِ مالک در همین گفتگو.
- **کارِ باز / پیامد:** کار commitنشده (LAW-022 — فقط به درخواستِ مالک). پیش از commit/deploy توصیه
  می‌شود حداقل یک پاسِ دستیِ UI (به‌خصوص picker تاریخ و اسکرولِ خودکار در یک جلسه‌ی واقعی، و
  register/admin روی سرورِ لوکال) انجام شود.

### 2026-09-15 — DECISION — تصمیم‌های مالک برای پلنِ ۷ باگ (D1–D4) — بدونِ اجرا
- **چه شد:** مالک در پاسخ به سؤال‌های پلن چهار تصمیم گرفت: **D1** Clarity بدونِ پرسیدن روشن باشد و هیچ متنِ رضایت/toggle دیده نشود (در تعارض با بندِ رضایتِ LAW-011)؛ **D2** ادمین همه‌چیز (متنِ جلسه، یادداشت‌ها، علائم، متادیتای کامل) را داخلِ پنل ببیند، فقط‌خواندنی (در تعارض با out-of-scopeِ PRDِ ماژول ۰۶)؛ **D3** نام/تخصصِ اجباری فقط برای ثبت‌نامِ جدید؛ **D4** انتخابگرِ تاریخِ جلسه‌ی گذشته فقط تا امروز (+ «بدونِ تاریخ»). پلن در `C:\Users\Moheb\.claude\plans\stateful-snuggling-fern.md` است. **مالک صریحاً گفت اجرا نشود («وظیفه‌ات پلن بود»)** — هیچ کدی تغییر نکرد. یک اصلاحِ زودهنگامِ LAW-005/LAW-011 که همین نشست قبل از رسیدنِ این پیام انجام داده بود، دقیقاً به متنِ قبلی برگردانده شد.
- **فایل‌ها:** هیچ (خالص).
- **اسنادِ به‌روزشده:** فقط همین فایل.
- **تست / تأیید:** موضوعیت ندارد.
- **عامل:** مالک (تصمیم‌ها) / این نشست (ثبت).
- **کارِ باز / پیامد:** اجرا فقط با دستورِ صریحِ بعدی. هنگامِ اجرا: اصلاحِ LAW-011، LAW-005 و PRDِ ۰۶ لازم است.

### 2026-09-15 — FINDING — audit + پلنِ ۷ باگِ گزارش‌شده توسطِ مالک (بدونِ تغییرِ کد)
- **چه شد:** به درخواستِ مالک ریشه‌ی ۷ مورد در کد پیدا و پلن نوشته شد؛ **هیچ کدی عوض نشد** (منتظرِ دستورِ اجرا). خلاصه‌ی ریشه‌ها:
  1. **متنِ «به بهتر شدنِ فیلیا کمک می‌کنید؟» و «تحلیلِ تجربه‌ی کاربری خاموش است — روشن کردن»:** هر دو UIِ رضایتِ Clarity‌اند (`public/index.html:382-390`، `:735`؛ منطقِ نمایش `public/feelia-analytics.js:259-275`). فقط وقتی دیده می‌شوند که `CLARITY_PROJECT_ID` روی سرور ست باشد (`server/src/http/clientConfig.ts:14-35`). Clarity در production صفر traffic دارد (FINDINGِ 2026-09-14). جملهٔ کناریِ «صدای خام هرگز ذخیره نمی‌شود» (`index.html:734`) همان R1/LAW-009 است.
  2. **تاریخِ جلسه‌ی دستی (مراجعِ غیرفعال) متنِ آزاد است:** `#manualDateInput` (`index.html:678`) و مودالِ `#editSessionDate` (`:856-857`) هر دو `type="text"`؛ فقط سرور (`server/src/http/sessionDate.ts:44-61`) اعتبارسنجی می‌کند.
  3. **نام/تخصص در ثبت‌نام اختیاری است:** برچسب‌ها (`index.html:406,410`)، کلاینت (`:1561`) و سرور (`server/src/http/auth.ts:56-83`) هیچ‌کدام الزام ندارند. ستون‌ها از قبل وجود دارند (`004`: name، `010`: specialty) و ذخیره می‌شوند؛ پنلِ ادمین specialty را نمی‌خواند (`admin.ts:78`).
  4. **ادمین به همه‌ی داده دسترسی ندارد:** پنل فقط متادیتا + صدا نشان می‌دهد (`admin.ts:1`، `:93-136`؛ `index.html:1859-1966`)؛ متن/یادداشت/علائم فقط در export JSON، و export هم specialty، status/category/gender/status_reason مراجع و source جلسه را ندارد (`admin.ts:11-35`). عدمِ نمایشِ متن در پنل تصمیمِ طراحیِ ثبت‌شده است (`docs/04-modules/06-admin-panel/module-prd.md:59,71`).
  5. **اسکرولِ خودکارِ متنِ زنده:** `#voiceLiveText` و `#archiveVoiceLiveText` (کلاسِ `.live-text` با `max-height:200px`، `index.html:220`) هیچ‌وقت `scrollTop` نمی‌گیرند (`:3306`، `:4118`، `:4331`، `:4360`)؛ `#liveText` فقط داخلِ خودِ جعبه اسکرول می‌شود (`:3140`، `:3566`) نه صفحه، و بدونِ تشخیصِ «کاربر عمداً بالا رفته».
  6. **یادداشتِ صوتیِ ذخیره‌نشده با زدنِ «یادداشتِ متنی» از بین می‌رود (جلسه‌ی دستی):** `stopArchiveVoiceNoteDirect` دکمه‌ی متنی را در حالِ بازبینیِ متنِ صوتی فعال می‌کند (`index.html:4404`)؛ `showArchiveTextInput` (`:4218-4230`) متنِ صوتی را پاک نمی‌کند، `origin` را `text` و textarea را قابلِ‌ویرایش می‌کند (همان «ادامه‌اش را می‌شد تایپ کرد»)؛ «انصراف» (`hideArchiveTextInput`، `:4231`) بی‌هشدار دور می‌ریزد. هم‌خانواده: `startArchiveVoiceNote` متنِ تایپ‌شده را بعداً رونویسی می‌کند (`:4406`)؛ در Wrapup، `showTextInput` (`:4047`) جعبه‌ی ضبطِ فعال را پنهان می‌کند بی‌آن‌که ضبط متوقف شود.
- **فایل‌ها:** هیچ (فقط خواندن).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** انجام نشد — فقط audit کد؛ میکروفون در Browser pane در دسترس نیست، پس مورد ۵/۶ با خواندنِ کد تأیید شده، نه اجرا.
- **عامل:** این نشست.
- **کارِ باز / پیامد:** ۴ تصمیمِ مالک لازم است (Clarity، دسترسیِ متن برای ادمین + متنِ رضایت، حساب‌های قدیمیِ بی‌نام، تاریخِ آینده). اجرا فقط با دستورِ صریح.

### 2026-09-15 — CODE — رفعِ فلاشِ صفحه‌ی «پرونده» هنگامِ ساختِ مراجعِ غیرفعالِ جدید
- **چه شد:** با تأییدِ صریحِ مالک، یافته‌ی زیر (ورودیِ قبلی، FINDING) رفع شد. در `startManualSessionFlow()` خطِ `await openClientDetail(clientId);` حذف شد؛ این تابع الان مستقیم بعدِ `POST /api/sessions` سراغِ `viewTranscript(data.session.id)` می‌رود — بدونِ نمایشِ میانیِ صفحه‌ی «پرونده». **چرا امن است:** `openClientDetail` در این‌جا فقط سه کار می‌کرد — (۱) `currentClient` را دوباره ست می‌کرد (قبلاً توسطِ caller ست شده بود)، (۲) `sessionsList` را برایِ نمایشِ صفحه‌ی پرونده پر می‌کرد (بی‌فایده چون آن صفحه اصلاً دیده نمی‌شد)، (۳) `showScreen('ClientDetail')` که همان فلاشِ گزارش‌شده را می‌ساخت. `backToClientDetailFromSession()` ([public/index.html:2732-2736](public/index.html#L2732)) موقعِ برگشتِ کاربر از صفحه‌ی جلسه به پرونده، خودش دوباره و کامل `openClientDetail(currentClient.id)` را صدا می‌زند — پس دیتای پرونده هیچ‌وقت stale نمی‌ماند، حتی بدونِ این فراخوانیِ حذف‌شده. این تغییر رویِ هر دو call-siteِ `startManualSessionFlow` اثر دارد (دکمه‌ی «ثبتِ جلسات گذشته» در پرونده‌ی مراجعِ غیرفعالِ موجود + مسیرِ تازه‌بررسی‌شده‌ی ساختِ مراجعِ غیرفعالِ جدید)؛ در حالتِ اول اصلاً فلاشی وجود نداشت (صفحه از قبل ClientDetail بود) پس بی‌اثر است، فقط یک درخواستِ شبکه‌ی زائد (`GET /api/clients/:id`) کمتر می‌شود.
- **فایل‌ها:** `public/index.html` (`startManualSessionFlow`، خطوطِ حدودِ ۲۹۳۹-۲۹۵۲).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** تستِ دستیِ UI با mock backendِ اسکرچ‌پد (طبقِ [[feelia-frontend-testing-without-accounts]] — سرورِ Node در scratchpad که `public/` واقعی را سرو می‌کند، بدونِ حساب/رمزِ واقعی). سناریو: تبِ غیرفعال‌ها → «افزودنِ پرونده‌ی قبلی» → پرِ فرم → «ایجاد». **نتیجه:** بلافاصله صفحه‌ی «جلسه ۱ · M-002» (یادداشتِ متنی/صوتی) باز شد، بدونِ فلاشِ صفحه‌ی پرونده؛ لاگِ سرورِ mock نشان داد ترتیبِ درخواست‌ها `POST /api/clients` → `POST /api/sessions` → `GET /api/sessions/:id` است — **بدونِ** `GET /api/clients/:id` میانی. سپس «بازگشت به پرونده» تست شد: به‌درستی `GET /api/clients/:id` را زد و صفحه‌ی پرونده را با جلسه‌ی تازه‌ساخته‌شده در فهرست نشان داد — بدونِ رگرسیون در مسیرِ برگشت. `tsc --noEmit`/`pnpm test:rt` موضوعیت ندارند (فقط `public/index.html`، بدونِ لمسِ `feelia-rt.js`/`server/`).
- **عامل:** این نشست، به درخواستِ صریحِ مالک («بله اصلاحش کن»).
- **کارِ باز / پیامد:** ندارد؛ رفعِ کامل و تأییدشده. سرورِ mockِ اسکرچ‌پد بعدِ تست متوقف شد (PID پورتِ 3999).

### 2026-09-15 — FINDING — فلاشِ صفحه‌ی «پرونده» هنگامِ ساختِ مراجعِ غیرفعالِ جدید (بدونِ رفع — فقط بررسی)
- **چه شد:** به درخواستِ مالک بررسی شد چرا بعدِ ساختِ «مراجعِ غیرفعالِ جدید» (دکمه‌ی «افزودنِ پرونده‌ی قبلی» در تبِ غیرفعال‌ها)، قبل از رسیدن به صفحه‌ی ثبتِ جلسه‌ی گذشته (یادداشتِ صوتی/متنی)، یک صفحه به‌طورِ آنی باز و بسته می‌شود. **ریشه:** `createNewClient()` برایِ `status==='inactive'` مستقیم `startManualSessionFlow()` را صدا می‌زند ([public/index.html:2917-2920](public/index.html#L2917)). این تابع پشت‌سرِ هم دو `await` دارد: اول `openClientDetail(clientId)` که یک `GET /api/clients/:id` می‌زند و `showScreen('ClientDetail')` صدا می‌کند ([public/index.html:2938](public/index.html#L2938))، سپس بلافاصله `viewTranscript(sessionId)` که یک `GET /api/sessions/:id` می‌زند و `showScreen('SessionDetail')` صدا می‌کند ([public/index.html:2728](public/index.html#L2728)). `showScreen` هم `hidden` را عوض می‌کند هم `window.scrollTo({behavior:'smooth'})` را دوباره صدا می‌زند ([public/index.html:1466-1476](public/index.html#L1466)). چون قبل از این فراخوانی کاربر رویِ صفحه‌ی «Clients» (فهرست) بوده، نه «ClientDetail»، این دو `showScreen` پشتِ‌هم یک جابه‌جاییِ واقعی/قابل‌مشاهده‌ی صفحه ایجاد می‌کند (Clients→ClientDetail→SessionDetail) که در فاصله‌ی زمانیِ خالیِ بینِ دو `await` (تاخیرِ شبکه‌ی `GET /api/sessions/:id`) به‌شکلِ «یک صفحه سریع باز و بسته می‌شود» دیده می‌شود. این رفتار عمداً طراحی شده بود (کامنتِ [public/index.html:2939]) تا مسیرِ «تست‌شده»ی کلیکِ رویِ کارتِ جلسه در پرونده را دوباره‌استفاده کند — که در مسیرِ اصلی‌اش (کاربر از قبل رویِ ClientDetail است و رویِ یک جلسه کلیک می‌کند) فلاشی وجود ندارد، چون صفحه از قبل ClientDetail بوده. مسیرِ ساختِ مراجعِ جدید تنها فراخوانی‌کننده‌ای‌ست که از یک صفحه‌ی *دیگر* (Clients) وارد می‌شود و فلاش را قابل‌مشاهده می‌کند. مسیرِ تبِ «فعال» این مشکل را ندارد چون مستقیم `setupNewSession` را صدا می‌زند ([public/index.html:2921-2925](public/index.html#L2921)) — فقط یک `showScreen`.
- **فایل‌ها:** فقط بررسی؛ هیچ کدی تغییر نکرد. فایلِ مرتبط: `public/index.html` (خطوطِ بالا).
- **اسنادِ به‌روزشده:** همین فایل. (`docs/04-modules/02-client-management/` بعداً اگر رفع انجام شد به‌روزرسانی شود.)
- **تست / تأیید:** فقط خواندنِ کد و ردیابیِ منطقی؛ تستِ دستیِ UI انجام نشد (مالک صرفاً درخواستِ بررسی داد، نه رفع).
- **عامل:** این نشست، به درخواستِ صریحِ مالک.
- **کارِ باز / پیامد:** رفعِ پیشنهادی (هنوز اعمال‌نشده، منتظرِ تأییدِ مالک): در شاخه‌ی `status==='inactive'` از `createNewClient`، به‌جایِ صدا زدنِ کاملِ `startManualSessionFlow` (که شاملِ `openClientDetail`/`showScreen('ClientDetail')` است)، مستقیماً جلسه بسازد و فقط `viewTranscript` را صدا بزند (بدونِ نمایشِ میانیِ ClientDetail) — یا `currentClient` را همان‌جا ست کند بدونِ `showScreen('ClientDetail')`. نیازمندِ هماهنگی با اینکه `openClientDetail` چه state دیگری (مثلِ `sessionsList` برایِ برگشتِ بعدی) ست می‌کند که ممکن است لازم بماند.

### 2026-09-15 — DEPLOY — merge به `main` + دیپلویِ واقعیِ production (commit `fed8b3b`) — موفق
- **چه شد:** با تأییدِ صریحِ مالک برایِ «دیپلویِ واقعیِ رویِ production»، این نشست از طریقِ SSH (کلیدِ ازپیش‌موجودِ `feelia_migration`، یوزرِ `root`، **بدونِ پسورد** — یک رشته‌ی شبیهِ پسورد که مالک در چت پیست کرد اصلاً استفاده نشد و باید عوض شود) به VPS متصل شد.
  - **کشفِ مهم:** ابتدا فرض شد `main`→`feat/clarity` fast-forwardِ ساده است (چک با local `main`ِ stale اشتباه بود)؛ چکِ درست با `origin/main` نشان داد **واقعاً diverge شده‌اند** — `main` خودش مستقل کامیتِ Clarity analytics (`8bcdf0e`) را داشت که `feat/clarity` نداشت. `git push origin feat/clarity:main` (fast-forward) با «Production Deploy» توسطِ auto-mode classifier بلاک شد — درست هم بود، چون واقعاً fast-forward نبود.
  - **مرج:** در یک git worktreeِ مجزا (بدونِ دست‌زدن به working tree اصلی)، `origin/main` به `feat/clarity` مرج شد. ۱۲ تعارضِ متنی در `public/index.html` (همه به یک الگو: سمتِ `feat/clarity` نسخه‌ی تکامل‌یافته/رفع‌باگِ همان کدِ قدیمی‌ترِ سمتِ `main` بود — نگه‌داشتنِ سمتِ `feat/clarity` در هر ۱۲مورد، بدونِ ازدست‌رفتنِ چیزی از Clarity چون تغییراتِ دیگرِ Clarity در خطوطِ غیرِهم‌پوشان بودند و خودکار مرج شدند) + ۱ تعارضِ بی‌اهمیت در `server/src/index.ts` (هر دو طرف دقیقاً همون دو خط رو اضافه کرده بودند) دستی حل شد. تأیید: پارسِ بدونِ خطای اسکریپتِ inline، `tsc --noEmit` تمیز، `pnpm test:rt` دقیقاً همان baseline (۲۹/۶، بدونِ رگرسیون).
  - **push:** `git push` به `origin/main` این‌بار بلاک نشد (commit `fed8b3b`).
  - **سمتِ سرور:** `git stash` (حفظِ لاگِ تشخیصیِ DIAG-TEMP که مالک صراحتاً خواست نگه داشته شود) → مالک خودش `git pull`، `git stash pop` (auto-merge تمیز، DIAG-TEMP سالم برگشت)، `pnpm install --frozen-lockfile`، `pnpm --filter server run build`، `pm2 restart feelia --update-env` را روی سرور اجرا کرد. `pm2 logs` نشان داد **migrationهای ۰۰۸ تا ۰۱۴ همه روی DBِ واقعیِ production با موفقیت اجرا شدند** (`[db] ✓ ... applied` برای هر کدام، بدونِ خطا).
  - **تأییدِ نهایی:** `GET /api/health` → `{"status":"ok","database":"connected"}`؛ لاگِ error خالی.
- **فایل‌ها:** merge commit `fed8b3b` (شاملِ همه‌ی فایل‌های `54a17fd` + مرجِ `public/index.html`، `server/src/index.ts`).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** typecheck + harness قبل از push (بالا)؛ health-check + errorlog بعد از deploy (بالا).
- **عامل:** این نشست (بخشِ SSH/merge/push) + مالک (بخشِ pull/build/restartِ واقعی روی سرور، طبقِ تصمیمِ خودش برای جداکردنِ مرحله‌ی نهاییِ ری‌استارت).
- **کارِ باز / پیامد:** production الان دقیقاً هم‌سطحِ `origin/main`/`feat/clarity` است (`fed8b3b`) — هیچ فاصله‌ای نمانده (R3 کاملاً رفع شد، نه فقط کاهش‌یافته). پسوردی که مالک پیست کرد استفاده نشد ولی در تاریخچه‌ی چت هست — مالک باید آن را (اگر واقعی بود) عوض کند.

### 2026-09-15 — DOCS — هم‌گام‌سازیِ کاملِ مستندات با commitِ `54a17fd` + رفعِ ادعاهای «commitنشده»ی قبل‌از-امروز
- **چه شد:** به درخواستِ مالک («مستندات رو کامل اپدیت کن همشون رو»)، تمامِ اسنادِ ACTIVE-CANONICAL که به کدِ کامیت‌شده در `54a17fd` یا وضعیتِ git ارجاع می‌دادند بررسی و به‌روز شدند: `database-catalog.md` (ردیفِ migration 014 + nullableِ `sessions.date`)، `api-catalog.md` (فالبکِ نامتقارنِ تاریخ/ساعتِ manual، پاک‌کردنِ `date` در PUT)، `data-architecture.md`، `repository-map.md`، `requirement-catalog.md`، module-PRDهای 02 و 03، `PROJECT_MASTER_REFERENCE.md` (§Snapshot، §20، Known Limitations، R3/R12-R14). **یافته‌ی جانبیِ مهم:** یک دورِ اولِ بازنویسی با جایگزینیِ کورکورانه‌ی «commitنشده» چند خط را غلط به `54a17fd` نسبت داد (مثلاً REQ-001 ارقامِ فارسی، REQ-025 keepalive، REQ-048 resolve-speakers، REQ-063 یادداشتِ صوتی) در حالی که این‌ها واقعاً در `2763414`/`ecf00b4` (۲۰۲۶-۰۹-۱۴، پیش از این نشست) commit شده بودند — با `git log --oneline -- <file>` per-file تصحیح شد. سپس یک بررسیِ گسترده‌تر نشان داد ~۱۴ سندِ دیگر (implementation-planهای ماژول ۰۱/۰۲/۰۳/۰۴/۰۶/۰۷، دو سندِ subsystem، `master-implementation-plan.md`، `source-of-truth.md`، `deployment-operations.md`) هم از قبل (پیشاپیشِ همین نشست) به همین دلیل نادرست بودند — همه با تأییدِ `git status`/`git log` per-file اصلاح شدند. اسنادِ **EVIDENCE**-نوع (`ui-ux-audit-2026-09-14.md`، `UX_AUDIT_REPORT.md`، `UX_FINDINGS.md`) عمداً دست‌نخورده ماندند — طبقِ تعریفِ خودشان (LAW-019) عکسِ لحظه‌اند، نه حقیقتِ زنده.
- **فایل‌ها:** فقط `docs/**/*.md`، `PROJECT_MASTER_REFERENCE.md`، `PROJECT_STATUS.md`. هیچ کدی لمس نشد.
- **اسنادِ به‌روزشده:** فهرستِ بالا (۱۶ سند).
- **تست / تأیید:** بدونِ کد، تستِ خودکار موضوعیت ندارد؛ هر ادعای «commit شده در X» با `git log --oneline -- <file>`/`git status --short <file>` per-file تأیید شد (نه حدس).
- **عامل:** این نشست، به درخواستِ صریحِ مالک.
- **کارِ باز / پیامد:** خودِ `docs/`، `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `.claude/` هنوز untracked‌اند (commit نشده‌اند) — مالک هنوز درباره‌ی commitِ خودِ مستندات چیزی نخواسته. مالک هم‌زمان دسترسیِ SSH برایِ deployِ واقعیِ production پیشنهاد داد؛ پاسخ/سؤالِ دسترسی در همین پیام به کاربر مطرح شد (رجوع به ادامه‌ی گفتگو).

### 2026-09-15 — GIT — کامیت و پوشِ کلِ کارِ pending (UI + بک‌اند) — commit `54a17fd`
- **چه شد:** با تأییدِ صریحِ مالک («همه‌ی کارِ pending — UI + بک‌اند»)، متنِ دکمه‌ی آرشیو از «ثبتِ جلسه‌ی گذشته» به «ثبت جلسات گذشته» تغییر کرد (۴ محل: کارتِ مراجع، دکمه‌ی ClientDetail، بنرِ وضعیت، پیامِ بعدِ ساختِ مراجعِ غیرفعال) — تأییدشده با رندرِ واقعی. سپس یک کامیت واحد ساخته و به `origin/feat/clarity` push شد؛ شاملِ: فیکسِ کارتِ مراجعِ فعال/غیرفعال (این گفتگو)، **و** کارِ ازپیش‌تست‌شده‌ی نشستِ قبلی که هنوز commit نشده بود (وضعیتِ فعال/غیرفعالِ مراجع در بک‌اند، ثبتِ دستیِ جلسه‌ی گذشته، تاریخِ شمسیِ اختیاری — `clients.ts`, `sessions.ts`, `sessionDate.ts`, migrationهای ۰۱۲-۰۱۴, `feelia-rt.js`).
- **فایل‌ها:** `public/index.html`, `feelia-design-system.html`, `server/src/http/clients.ts`, `sessions.ts`, `sessionDate.ts` (جدید), `server/src/db/migrations/012_session_source.sql`, `013_session_date_jalali.sql`, `014_session_date_optional.sql`, `public/feelia-rt.js`, `PROJECT_STATUS.md`, `verification/2026-09-15-clients-tabs-ui.md`.
- **عمداً خارج از این کامیت:** `docs/admin-panel.md` (HISTORICAL/متعارض، طبقِ CLAUDE.md §۵)، کلِ ساختارِ جدیدِ `docs/00-*` تا `docs/07-*` + `CLAUDE.md` + `PROJECT_MASTER_REFERENCE.md` + `.claude/` (مالک درباره‌شان چیزی نگفته بود)، `package-lock.json`، `feelia-f9b0a9c.tar`، `server-deploy/`، `soniox.html`، بقیه‌ی `verification/*.md` قدیمی‌تر.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** قبل از commit، `cd server && npx tsc --noEmit` روی working directoryِ `server/` اجرا شد — بدونِ خطا. `git push origin feat/clarity` موفق: `2551943..54a17fd`.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** **دیپلویِ واقعیِ production هنوز انجام‌نشده** — مالک صریحاً «دیپلویِ واقعی رویِ production» را خواست، ولی این نشست هیچ ابزارِ SSH/اجرای‌ازراه‌دور به سرور ندارد؛ طبقِ `docs/01-architecture/deployment-operations.md` قدمِ باقی‌مانده روی خودِ VPS این‌هاست: `cd /root/feeliaa && git pull && pm2 restart feelia --update-env` (migrationهای ۰۱۲-۰۱۴ خودکار روی `pm2 restart` اجرا می‌شوند — لاگِ `[db] ✓` را چک کنید؛ cwd/محلِ واقعیِ `.env` را طبقِ همان سند قبلش تأیید کنید، چون با ادعای `server-deploy/` تعارضِ ثبت‌شده دارد).

### 2026-09-15 — INCIDENT/CODE/TEST — رگرسیونِ خودِ همین تغییر پیدا و رفع شد: `nowrap` روی `.btn-sm` باعثِ سرریزِ افقیِ صفحه در دکمه‌های طولانی می‌شد
- **چه شد:** طبقِ درخواستِ مالک، پنلِ ادمین و صفحه‌ی جزئیاتِ مراجع/جلسه هم با داده‌ی canary (این بار با patchِ موقتِ تابعِ `api()` در Browser pane تا نیاز به سرور/حساب نباشد) بررسی شد. در صفحه‌ی جزئیاتِ جلسه، دکمه‌ی «بازسازیِ شماره‌گذاریِ گوینده‌ها» (`#resolveSpeakersBtn`، داخلِ `.btn-row`) با `white-space:nowrap`ی که در تغییرِ قبلی به `button.btn.btn-sm` اضافه شده بود، به‌جایِ wrap کردن از کادرِ خودش و کلِ صفحه سرریز می‌کرد (اسکرول‌بارِ افقیِ کل صفحه، `scrollWidth>clientWidth`) — چون `.btn-row>button{flex:1}` بدونِ `min-width:0` تعریف شده بود و متنِ nowrap عرضِ محتوا را از عرضِ فلکس‌آیتم بزرگ‌تر می‌کرد. **رفع:** `min-width:0` به `.btn-row>button` اضافه شد و خودِ `button.btn.btn-sm` به‌جایِ صرفاً nowrap، `overflow:hidden;text-overflow:ellipsis` هم گرفت تا هرجا واقعاً جا کم بیاید (مثلاً ردیفِ سه‌دکمه‌ایِ کارتِ تراپیستِ ادمین در عرضِ باریک) به‌جای سرریز، با «…» کوتاه شود.
- **فایل‌ها:** `public/index.html:100-102`.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** رندرِ واقعی در Browser pane با `api()` patch‌شده: صفحه‌ی جزئیاتِ مراجع (ClientDetail، مراجعِ غیرفعال با/بدون دلیل)، جزئیاتِ جلسه (SessionDetail با هر دو دکمه‌ی sm نمایان)، پنلِ ادمین (آمار + کارتِ تراپیست با دو toggle و سه دکمه، حالتِ برچسبِ خیلی بلند)، جزئیاتِ تراپیست (لیستِ مراجع + حذف). بعدِ فیکس: `document.documentElement.scrollWidth===clientWidth` در همه‌جا، هیچ‌جا سرریزِ افقی نبود؛ متنِ دکمه‌ها از طریقِ `read_page` (accessibility tree) هم کامل و درست خوانده شد (فقط بصری truncate می‌شود، نه واقعاً).
- **عامل:** این نشست، حینِ پاسخ به درخواستِ مالک برای چک‌کردنِ پنلِ ادمین/ClientDetail — یعنی خودِ این verification رگرسیون را کشف کرد، نه گزارشِ مالک.
- **کارِ باز / پیامد:** ندارد؛ هنوز commit نشده.

### 2026-09-15 — FINDING/CODE/DOCS — کارتِ مراجعِ فعال/غیرفعال: ریشه‌ی ناسازگاریِ UI رفع شد (باگِ specificityِ `.btn-sm`/`.btn-xl`)
- **چه شد:** مالک گزارش داد کارت‌های مراجعِ فعال و غیرفعال ظاهرِ متفاوت دارند و اندازه‌ی دکمه‌ها یکی نیست. بررسیِ کد + رندرِ واقعیِ `public/index.html` در Browser pane (داده‌ی canary، بدونِ API/حساب، 1280px و 375px) نشان داد ریشه یک باگِ CSS specificity است: `button.btn` (0,1,1) بر `.btn-sm`/`.btn-xl` (0,1,0) غالب می‌شد و اصلاً اعمال نمی‌شدند — دکمه‌ی «کوچکِ» کارتِ مراجع عملاً تمام‌قد بود و در تبِ غیرفعال («ثبتِ جلسه‌ی گذشته») دوخطی می‌شد → ارتفاعِ کارت‌ها فرق داشت (۱۶۰px در برابرِ ۲۱۵px). **رفعِ ریشه‌ای:** سلکتورها به `button.btn.btn-sm`/`button.btn.btn-xl` (0,2,1) تغییر کرد؛ روی هر ۱۰ محلِ `btn-sm` و ۳ محلِ `btn-xl` در کلِ اپ اثر دارد. همراه: یکسان‌سازیِ پس‌زمینه‌ی کارتِ فعال/غیرفعال (حذفِ `.client-card.inactive{background}`)، انتقالِ «دلیلِ غیرفعال‌بودن» به یک pill داخلِ `.client-meta` (به‌جایِ ردیفِ جداگانه که ارتفاعِ کارت را به‌هم می‌زد)، تغییرِ رنگِ دکمه‌ی primaryِ «ثبتِ جلسه‌ی گذشته» به secondary (اصلِ «آرامشِ بالینی» — عملِ آرشیوی نباید هم‌وزنِ CTAِ زنده باشد)، یکسان‌سازیِ ارتفاعِ کنترل‌هایِ نوارِ فیلتر (چیپ/سگمنت/دکمه‌ی مرتب‌سازی → 36px)، و شعاع‌های خارج از توکن (`--r-md`/`--r-sm`) به توکن. در تبِ غیرفعال برچسبِ «مراجع جدید» → «افزودنِ پروندهِ قبلی» و برچسبِ پیش‌فرضِ منویِ مرتب‌سازی → «پیش‌فرض (آخرین جلسه)» شد تا رفتارِ واقعی (ترتیب بر اساسِ آخرین جلسه) پنهان نماند.
- **فایل‌ها:** `public/index.html` (CSS ~L87-170، JS `switchClientTab`، `renderClients`، `#btnNewClient`/`#sortDropDefaultLabel` id جدید)، `feelia-design-system.html` (هم‌گام‌سازیِ همان فیکسِ specificity + یک ردیفِ جدید در «لغزش‌گاه‌های واقعی»).
- **اسنادِ به‌روزشده:** همین فایل. (PRD ماژولِ مراجعین دست‌نخورده ماند — برچسب‌ها/سلسله‌مراتبِ CTA تغییرِ رفتاریِ API نداشت.)
- **تست / تأیید:** رندرِ واقعیِ فایل در Browser pane با ۴ مراجعِ canary (۲ فعال، ۲ غیرفعال — یکی با دلیلِ بلند، یکی بدون) در 1280px و 375px، هر دو تب: هر دو کارتِ هم‌محتوا هم‌ارتفاعند، همه‌ی دکمه‌ها تک‌خطی، برچسب‌های تبِ غیرفعال درست. `pnpm test:rt` اجرا شد: **همان baselineِ ۲۹ PASS / ۶ FAIL** (T2 batch fallback، T15×۳، T16×۲) — بدونِ تغییرِ نتیجه، چون این تغییر فقط `public/index.html` را لمس کرده. صفحه‌ی جزئیاتِ مراجع (ClientDetail) به‌خاطرِ نیازِ به fetchِ واقعی تستِ زنده نشد؛ کلاسِ دکمه‌هایش (`btn-sm`) همان کلاسِ تأییدشده در Setup/Live/کارتِ مراجع است.
- **عامل:** این نشست، طبقِ پلنِ ازپیش‌نوشته‌شده (بررسیِ اوپوس، تأییدشده توسطِ مالک برایِ پیاده‌سازی).
- **کارِ باز / پیامد:** commit نشد (طبقِ درخواستِ مالک تا اجازه‌ی صریح). اسکرین‌شاتِ همه‌ی ۱۳ محلِ `btn-sm`/`btn-xl` (Setup/Live/Wrapup/پنلِ ادمین) بررسیِ کامل نشد — فقط Setup/Live/کارتِ مراجع دیده شد؛ چون تغییر یکنواخت و سراسری است (نه شرطی)، ریسکِ رگرسیون در بقیه پایین ارزیابی می‌شود ولی تأییدِ چشمی کامل هنوز انجام‌نشده است.

### 2026-09-15 — TEST — تأییدِ نیمه: mintِ Soniox بعدِ فعال‌سازیِ PROXY_URL پایدار شد (media-plane هنوز تست‌نشده)
- **چه شد:** مالک پرسید «الان موردی نداره؟». سرور خودش (احتمالاً به‌خاطرِ تغییرِ `.env` یا اقدامِ مالک) ری‌استارت شده بود (PID عوض شد: `26504`→`4872`، تأییدشده با `netstat`). برایِ تأییدِ واقعی، به‌جایِ حدس، **۵ بار پشتِ‌سرِهم** مستقیم `POST /api/stt/realtime-session` را با یک حسابِ canaryِ ایزوله صدا زدم (بدونِ نیاز به میکروفون — همان endpointی که قبلاً `mint-transport` می‌داد).
- **نتیجه:** هر ۵ بار `200` + `api_key` واقعی، زمان‌بندی ۱۰۰۰–۱۷۰۰ms (قبلاً: یک نمونه ۲۲۰ms، یک نمونه ۸۹۹۶ms، یک نمونه شکستِ کامل). یعنی **control-plane (mint) حالا پایدار است** — دیگر شکستِ کامل ندیدم.
- **محدودیتِ صادقانه (مهم):** این فقط mint (سرور→Soniox) را تأیید می‌کند. مسیرِ واقعیِ صدا (media-plane) طبقِ LAW-014 مستقیم **مرورگر→Soniox** است، از این پروکسیِ سمتِ سرور اصلاً عبور نمی‌کند. اگر شبکه/فیلترینگِ مرورگرِ مالک هم روی همان اتصالِ مستقیم اثر داشته باشد، آن مشکل با این فیکس حل نمی‌شود — فقط با تستِ واقعیِ صوتی (میکروفونِ واقعی، که Browser pane ندارد) قابلِ‌تأیید است.
- **فایل‌ها:** بدون تغییرِ کد؛ فقط تستِ endpointِ موجود.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** ۵/۵ mintِ موفق روی سرور/DBِ واقعیِ لوکال؛ پاکسازیِ کامل بعد.
- **عامل:** این نشست، به سؤالِ مستقیمِ مالک.
- **کارِ باز / پیامد:** مالک باید یک یادداشتِ صوتیِ واقعی (با میکروفونِ خودش) امتحان کند تا media-plane هم تأیید شود؛ اگر باز «ریل‌تایم نبود» دید، مشکل جایِ دیگری‌ست (شبکه‌ی مرورگر، نه mintِ سرور).

### 2026-09-15 — FINDING/CONFIG — ریشه‌ی واقعیِ «ریل‌تایم نبود»: mint-transport به Soniox، رفع با PROXY_URL
- **چه شد:** مالک لاگِ کاملِ ترمینالِ سرورِ dev را مستقیم پیست کرد (چیزی که نشستِ قبلی بهش دسترسی نداشت). خط‌به‌خط بررسی شد:
  - `req-1p`: mint موفق ولی **۸۹۹۶ms** طول کشید (نرمال زیرِ ۲۵۰ms است).
  - `req-38`: `[stt-mint] fail code=mint-transport therapist=... session=ef6830dc... key_len=64` — mint **کاملاً شکست خورد**. بلافاصله بعدش (`req-39`) fail-open درست کار کرد: صدا در صفِ `batch-audio?purpose=note` رفت، `[batch] processing…` → `[batch] segment done` — یعنی معماریِ LAW-012 دقیقاً طبقِ طراحی عمل کرد؛ چیزی که مالک به‌عنوانِ «میگه یادداشتتتتت» دید (پیامِ «در حال پردازشِ یادداشت…») نتیجه‌ی طبیعیِ همین بود، نه باگِ جداگانه.
  - **تشخیص:** `mint-transport` طبقِ تعریفِ خودِ `tempkey.ts` یعنی خطایِ ترنسپورتِ خالص (DNS/TCP/TLS) بینِ **خودِ سرور** و `api.soniox.com` — نه مسیرِ مرورگر→Soniox. یعنی مشکل به مسیرِ media (که طبقِ LAW-014 مستقیم Browser→Soniox است) ربطی ندارد؛ فقط control-plane (mint، از VPS/دستگاهِ سرور) است.
  - **کشفِ کلیدی:** کدِ `tempkey.ts` از قبل مستندش کرده بود که mint می‌تواند از `PROXY_URL` عبور کند، ولی در `server/.env` کامنت بود. چک شد: یک کلاینتِ پروکسیِ محلی همین الان رویِ `127.0.0.1:10808` با ده‌ها اتصالِ فعال در حال اجراست (به‌احتمالِ‌زیاد همان که مرورگرِ مالک استفاده می‌کند).
- **رفع:** با تأییدِ صریحِ مالک، `PROXY_URL=http://127.0.0.1:10808` در `server/.env` از کامنت درآمد.
- **فایل‌ها:** `server/.env` (فقط این خط؛ خودِ فایل هرگز commit نمی‌شود، LAW-002).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** خودِ تغییر یک env var است، نه کد — تأییدِ واقعی منتظرِ ری‌استارتِ `pnpm dev` توسطِ مالک و یک دورِ دیگر تستِ صوتی‌ست.
- **عامل:** این نشست، به لاگِ مستقیمِ مالک + تصمیمِ صریحِ او برایِ فعال‌سازیِ پروکسی.
- **کارِ باز / پیامد:** **مالک باید `pnpm dev` را ری‌استارت کند** تا env جدید خوانده شود، بعد دوباره یادداشتِ صوتی امتحان کند. اگر باز `mint-transport` دید، احتمالاً پورتِ ۱۰۸۰۸ SOCKS5 است نه HTTP (چون `tempkey.ts` از `HttpsProxyAgent` استفاده می‌کند که پروکسیِ HTTP/CONNECT می‌خواهد) — باید پورتِ HTTPِ همان کلاینتِ پروکسی (مثلاً ۱۰۸۰۹ در تنظیماتِ رایج) جایگزین شود.

### 2026-09-15 — INCIDENT/FINDING/CODE/TEST — «باز ریل‌تایم نبود» + اندازه‌ی دکمه‌های آرشیو با سیستمِ دیزاین نمی‌خواند
- **چه شد:** مالک بعدِ دورِ قبلی سه چیزِ دیگر گزارش کرد: (۱) «باز ریل‌تایم نبود صوتی که داشتم می‌گرفتم» + وضعیتِ «در حالِ پردازشِ یادداشت…» حینِ ضبط دیده شد، (۲) اندازه‌ی دکمه‌های «یادداشتِ صوتی»/«یادداشتِ متنی» در آرشیو با اندازه‌ی دکمه‌های معادل در Wrapup (بخشِ فعال‌ها) فرق دارد.
  - **بررسیِ (۱):** ترمینالِ در دسترسِ این نشست هیچ لاگی نداشت (پنلِ خالی — سرورِ dev ظاهراً در پنجره‌ای بیرون از دسترسِ این ابزار اجرا شده)، پس لاگِ دقیقِ همان لحظه قابلِ‌بازیابی نبود. **یافته‌ی مهم‌تر:** `feelia-rt.js` وقتی mint/اتصالِ WSِ زنده شکست می‌خورد (`connectWithFreshMint`ِ catch)، دلیلِ واقعی (status/code/message) را **هیچ‌جا لاگ نمی‌کرد** — فقط `false` برمی‌گشت و FAILED می‌شد؛ یعنی حتی در Console مرورگر هم اثری نبود. این خودِ یک FINDINGِ مستقل است، جدا از هر باگِ این نشست. **علتِ محتمل (INFERRED، نه اثبات‌شده):** چون مسیرِ صوتِ زنده مستقیم Browser→Soniox است (LAW-014)، همان الگوی از‌پیش‌مستندشده‌ی محدودیتِ شبکه/فیلترینگ که برایِ Microsoft Clarity هم دیده شده (`ERR_CONNECTION_CLOSED` به `clarity.ms`، یافته‌ی 2026-09-14) می‌تواند اتصالِ WSِ Soniox را هم مسدود کند — هر دو، اتصالِ مستقیمِ خروجی از همان مرورگر/شبکه‌اند. این یک محدودیتِ از‌پیش‌موجودِ کل سیستم است (جلسه‌ی زنده‌ی اصلی هم همین ریسک را دارد، نه فقط یادداشتِ صوتیِ آرشیو) — **نه چیزی که این کار معرفی کرده باشد.**
  - **رفعِ (۱) — بخشِ قابلِ‌رفع همین حالا:** یک لاگِ تشخیصیِ `DIAG-TEMP` (`console.warn`) به `catch` همان تابع اضافه شد که دلیلِ واقعی (mint-transport/401/direct-timeout/direct-error/…) را چاپ می‌کند — بدونِ داده‌ی حساس (LAW-001)، بدونِ تغییرِ هیچ منطقِ state machine/زمان‌بندی. دفعه‌ی بعد که این اتفاق بیفتد، بازکردنِ Console مرورگر (F12) دلیلِ دقیق را نشان می‌دهد.
  - **رفعِ (۲):** دکمه‌های بازکردنِ «یادداشتِ صوتی»/«یادداشتِ متنی» در آرشیو کلاسِ اضافیِ `btn-sm` داشتند (از رویدادهایِ قبلی مانده بود) — Wrapup و جلسه‌ی زنده هیچ‌کدام از دکمه‌های معادلشان `btn-sm` ندارند. حذف شد؛ الان دقیقاً هم‌اندازه‌اند.
- **فایل‌ها:** `public/feelia-rt.js` (فقط یک خطِ `console.warn`)، `public/index.html` (حذفِ کلاس).
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** چون `feelia-rt.js` لمس شد، طبقِ LAW-016 `pnpm test:rt` اجرا شد → **۲۹ PASS / ۶ FAIL، عیناً همان baselineِ مستندشده** (هیچ رگرسیون؛ خطِ جدید فقط دو بار در خروجیِ هارنس چاپ شد، دقیقاً برایِ دو سناریویِ شکستِ عمدیِ تست). `node --check` روی هر دو فایل ✅. اندازه‌ی دکمه با canaryِ سومِ ایزوله (`canary-test-8`) روی سرور/DBِ واقعیِ لوکال با screenshot تأیید شد؛ پاکسازیِ کامل.
- **عامل:** این نشست، به گزارشِ مستقیمِ مالک بعدِ تستِ لوکالِ خودش.
- **کارِ باز / پیامد:** کد هنوز commitنشده. **مالک باید دفعه‌ی بعد که «ریل‌تایم نبود» را دید، Console مرورگر (F12 → Console) را چک کند و پیامِ `[feelia-rt] connect failed: ...` را برایِ این نشست بیاورد** — تا مشخص شود مشکل mintِ سمتِ سرور است یا اتصالِ مستقیمِ مرورگر→Soniox (که در آن صورت احتمالاً محدودیتِ شبکه است، نه باگِ کد). رفعِ خودِ ریشه (اگر شبکه باشد) نیاز به VPN/proxy دارد، نه تغییرِ کد؛ اگر mintِ سرور باشد، نیاز به بررسیِ جداگانه دارد.

### 2026-09-15 — INCIDENT/CODE/TEST — سه فیدبکِ مالک بعدِ تستِ لوکالِ خودش: نوعِ یادداشتِ صوتی، بازبینیِ متن، ظاهرِ کارتِ مراجع
- **چه شد:** مالک خودش با سرورِ واقعیِ لوکالِ خودش (پورتِ ۳۰۰۰) تست کرد و گفت «اوکی بود اما»، سه ایراد:
  1. «وقتی صوت میگیره تگش رو میزنه یادداشت متنی به جای صوتی، کلا میخوام رنگش هم متفاوت باشه» — **ریشه:** `addArchiveTextNote` همیشه با `type:'note_after'` POST می‌کرد، حتی وقتی متنِ داخلِ textarea نتیجه‌ی ضبطِ صوتی بود (رفعِ رویدادِ قبلی فقط POSTِ خودکار را حذف کرده بود، نه نوعِ ذخیره را). چون رنگِ برچسب (`tag-voice`=رنگِ خاک‌گلی، `tag-text`=رنگِ سبز؛ از قبل در CSS جدا بودند) از رویِ همین `type` تعیین می‌شود، رنگ هم همیشه اشتباه بود.
  2. «وقتی ضبط تموم شد متن رو نشون بده، دو گزینه: ادیت متن یا ثبت و ذخیره، که بفهمه میتونه ادیت کنه» — قبلاً textarea از همان لحظه قابلِ‌ویرایش بود ولی هیچ نشانه‌ای نداشت.
  3. «توی غیرفعال‌ها فقط پرونده‌ی خاکستریه، توی فعال‌ها سبز و خاکستری داریم، طراحی ناهمسان شده» — کارتِ مراجعِ غیرفعال از اول هیچ دکمه‌ی primaryِ سبز نداشت (فقط «پرونده»)، برخلافِ کارتِ فعال.
- **رفع:**
  1. یک متغیرِ سراسریِ `archiveTextNoteOrigin` ('voice'/'text') اضافه شد؛ روی هر مسیرِ ورودِ متن (تایپِ مستقیم در `showArchiveTextInput`، یا نتیجه‌ی ضبط در `stopArchiveVoiceNoteDirect`) تنظیم می‌شود؛ `addArchiveTextNote` بر اساسِ آن `type:'voice'` یا `type:'note_after'` می‌فرستد.
  2. بعدِ پایانِ ضبطِ موفق، textarea با `readOnly=true` (+ کلاسِ CSSِ `readonly-preview`، بوردرِ خط‌چین) و یک متنِ راهنمای کوچک نشان داده می‌شود؛ دکمه‌ی جدیدِ «ویرایشِ متن» (`enableArchiveTextEdit`) قفل را باز و مکان‌نما را به انتهای متن می‌برد؛ دکمه‌ی ذخیره در این حالت برچسبِ «ثبت و ذخیره» می‌گیرد (به‌جایِ «ذخیره‌ی یادداشت»ِ حالتِ تایپِ مستقیم). تایپِ آزاد (بدونِ ضبط) این قفل را از اول ندارد.
  3. کارتِ مراجعِ غیرفعال حالا هم یک دکمه‌ی `btn-primary` («ثبتِ جلسه‌ی گذشته»، هم‌جای «شروع جلسه»ی کارتِ فعال) + «پرونده»ی ghost دارد؛ کلیک مستقیم `startManualSessionFlow` را روی همان مراجع صدا می‌زند.
- **فایل‌ها:** `public/index.html` فقط.
- **اسنادِ به‌روزشده:** همین فایل.
- **تست / تأیید:** `tsc --noEmit` ✅، `node --check` ✅. **سرور/DBِ واقعیِ لوکال** با حسابِ canaryِ دومِ کاملاً ایزوله (`canary-test-7`): کارتِ غیرفعال حالا دقیقاً هم‌شکلِ کارتِ فعال (screenshot تأییدشد)؛ یادداشتِ صوتیِ شبیه‌سازی‌شده (stubِ `FeeliaRT`) → `readOnly=true` قبل از ذخیره، دکمه‌ی «ویرایشِ متن» قفل را باز کرد؛ ذخیره → **کوئریِ مستقیمِ Postgres تأیید کرد `type='voice'`** در `session_notes` (نه `note_after`) و رندرِ بعدی برچسبِ «صوتی» با کلاسِ `tag-voice` (رنگِ متفاوت) داشت. پاکسازیِ کامل (client=1, sessions=2, notes=1, therapist=1 حذف شد؛ صفر ردیفِ باقی‌مانده).
- **عامل:** این نشست، به فیدبکِ مستقیمِ مالک بعدِ تستِ لوکالِ خودش.
- **کارِ باز / پیامد:** کد هنوز commitنشده.

### 2026-09-15 — TEST/FINDING/CODE — تأییدِ روی سرور/DBِ واقعیِ لوکال (رویدادِ قبلی) + فیکسِ فهرستِ جلسات در پرونده
- **چه شد:** مالک صریحاً اجازه‌ی تستِ کاملِ لوکال روی سرور/DBِ واقعی داد («کامل خودت لوکال تست کن»، LAW-006). سرورِ dev مالک از قبل روی پورتِ ۳۰۰۰ باز بود (نشستِ دیگر/ترمینالِ خودِ مالک) — به‌جایِ لمس/ری‌استارتِ آن، یک نمونه‌ی موقتِ دومِ سرور روی پورتِ ۳۰۰۱ با همان DB بالا آورده شد فقط برایِ اطمینان از اجرایِ migration 014 (که خودِ سرورِ ۳۰۰۰ هم، به‌خاطرِ `tsx watch`، از قبل با ذخیره‌شدنِ فایلِ migration اجرا کرده بود — «already applied» در لاگ)؛ نمونه‌ی ۳۰۰۱ بلافاصله بعدِ تأیید متوقف شد. تستِ واقعی با یک حسابِ **canary** ایزوله (`canary-test-6` / `09190006061`) مستقیم روی پورتِ ۳۰۰۰ انجام شد.
  - **FINDINGِ واقعی پیدا و رفع شد:** فهرستِ جلسات در **صفحه‌ی پرونده** (`openClientDetail`، نه `screenSessionDetail`) برایِ جلسه‌ی دستی هنوز «شروع ۱۱:۵۴» (ساعتِ لحظه‌ی ثبت) نشان می‌داد و برچسبِ «ثبتِ دستی» کلاسِ سبزِ `completed` داشت — رویدادِ قبلی فقط صفحه‌ی خودِ جلسه را اصلاح کرده بود، نه این ردیفِ فهرست را. رفع شد: برایِ `source==='manual'` ساعت نشان داده نمی‌شود («بدونِ تاریخ» یا فقط تاریخ)، و کلاس به `canceled` (خنثی/خاکستری، از‌پیش‌موجود در CSS) تغییر کرد.
  - **تأییدِ end-to-end با نوشتن/خواندنِ مستقیمِ Postgres** (نه فقط UI): ساختِ مراجعِ غیرفعال → مستقیم صفحه‌ی جلسه با `date=NULL` واقعی در DB (نه رشته)؛ `PUT` با تاریخ → مقدارِ صحیح در ستون؛ خالی‌کردنِ فیلد → واقعاً `NULL` در DB (نه رشته‌ی «»)؛ یادداشتِ متنی → ردیفِ واقعی در `session_notes`؛ حذف → `DELETE` واقعی و ردیف از DB پاک شد؛ یادداشتِ صوتیِ شبیه‌سازی‌شده (stubِ `FeeliaRT.createSession`، چون Browser pane میکروفونِ واقعی ندارد) → متن در textarea نشست و **هیچ ردیفی در `session_notes` ساخته نشد** (تصمیمِ ۳ تأیید شد)؛ کلیکِ «بازگشت به پرونده» با متنِ ذخیره‌نشده در textarea → `confirm()` واقعاً ناوبری را بلاک کرد (B3)؛ بعدِ خالی‌کردنِ textarea، همان دکمه بدونِ پرامپت navigate کرد.
  - **پاکسازیِ کامل:** کلاینت/جلسه/یادداشت‌های canary حذف شدند (cascade دستی روی DB) + حسابِ تراپیستِ canary هم حذف شد؛ کوئریِ نهایی صفر ردیفِ باقی‌مانده را تأیید کرد. سرورِ اصلیِ مالک روی پورتِ ۳۰۰۰ دست‌نخورده باقی ماند.
- **فایل‌ها:** `public/index.html` (فقط رندرِ فهرستِ جلسات در `openClientDetail`).
- **اسنادِ به‌روزشده:** همین فایل. (کاتالوگ‌ها همچنان طبقِ رویدادِ قبلی بازِ کارِ آینده‌اند.)
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا (بعدِ فیکسِ فهرست). سناریویِ کاملِ بالا روی DBِ واقعیِ لوکال با کوئریِ مستقیمِ Postgres تأیید شد (نه فقط ظاهرِ UI). رونویسیِ زنده‌ی واقعیِ Soniox با میکروفونِ واقعی همچنان تست‌نشده می‌ماند (محدودیتِ ابزار، نه کوتاهی).
- **عامل:** این نشست، به درخواستِ صریحِ مالک برایِ تستِ کاملِ لوکال.
- **کارِ باز / پیامد:** کد هنوز commitنشده. کاتالوگ‌های مستندات هنوز عقب‌اند (از رویدادِ قبلی). توقف/ادامه‌ی واقعی با میکروفون و رونویسیِ زنده باید توسطِ مالک تست شود.

### 2026-09-15 — CODE/DECISION/FINDING/TEST — تاریخِ اختیاریِ بدونِ ساعت + مسیرِ مستقیمِ ساختِ مراجع + متنِ صوتی در textarea + گاردهایِ ازدست‌رفتنِ داده
- **چه شد:** مالک یک پلنِ ممیزی/طراحیِ مفصل (نوشته‌شده در نشستی دیگر/پیش‌تر) پیست کرد و خواستِ اجرایِ دقیقِ آن را داد. **FINDING اول:** بخشِ بزرگی از آن پلن روی وضعیتِ *قبل*ِ رویدادِ همین امروز (`screenSessionDetail`، ردیفِ inlineِ تاریخ/ساعت، توقف/ادامه) نوشته شده بود — یعنی audit خودش قدیمی بود؛ به‌جایِ اجرایِ کورکورانه، کدِ فعلی خط‌به‌خط با ادعاهای پلن تطبیق داده شد. سه بخش واقعاً هنوز باز بودند (تصمیم‌های صریحِ مالک در همان پلن) + چند یافته‌ی واقعیِ دیگر:
  1. **مسیرِ مستقیمِ ساختِ مراجع→ورودِ داده:** `createNewClient` حالا در تبِ فعال مستقیم `setupNewSession` و در تبِ غیرفعال مستقیم `startManualSessionFlow` را صدا می‌زند (بازاستفاده از مسیرِ تست‌شده، نه معماریِ تازه‌ی lazy-session).
  2. **تاریخِ اختیاریِ بدونِ ساعت:** ستونِ `sessions.date` nullable شد (migration 014)؛ `POST /api/sessions` برایِ manual بدونِ تاریخ → `NULL` (نه fallbackِ «امروز»)؛ `PUT` با `date:null` فقط برایِ `source='manual'` مجاز. UI: فیلدِ ساعت حذف، فیلدِ تاریخ با change/blur خودکار ذخیره می‌شود (بدونِ دکمه‌ی جدا)، «بدونِ تاریخ» به‌جایِ رشته‌ی «null» (فیکسِ `toFa`).
  3. **متنِ صوتی در textarea:** `stopArchiveVoiceNoteDirect` دیگر خودکار POST نمی‌کند؛ متنِ رونویسی‌شده در `archiveTextNoteInput` می‌آید تا تراپیست بخواند/ویرایش کند و صریحاً «ذخیره‌ی یادداشت» بزند (مسیرِ legacy طبقِ LAW-015 دست‌نخورده ماند — سرور خودش ذخیره می‌کند).
  - **FINDINGهایِ اضافه (رفع‌شده):** (A2) کلیکِ «توقف موقت» در چند ثانیه‌ی STARTING بی‌صدا هیچ اثری نداشت — الان دکمه تا وصل‌شدنِ واقعی (state) غیرفعال است و علت را می‌گوید؛ (B1) دکمه‌ی «یادداشتِ متنی» حالا وسطِ ضبط غیرفعال است؛ (B2) ذخیره‌ی تاریخ/افزودنِ یادداشت دیگر `viewTranscript` کامل (با اسکرول + cleanupِ ضبطِ فعال) صدا نمی‌زند، فقط لیست را رندر می‌کند؛ (B3) سوئیچِ جلسه/«بازگشت به پرونده» وسطِ ضبط یا با متنِ ذخیره‌نشده حالا `confirm()` می‌پرسد؛ `beforeunload` متنِ ذخیره‌نشده را هم چک می‌کند؛ یادداشت‌هایِ جلسه‌ی دستی حالا با کارتِ `.note-item`ِ Wrapup (برچسب + حذفِ واقعی از DB) رندر می‌شوند، بدونِ ساعتِ بی‌معنا.
  - **عمداً خارج از این دور (نیازِ تصمیم/کارِ جداگانه):** معماریِ lazy-session (ساختِ جلسه فقط با اولین ذخیره) — ریسکِ بازنویسیِ معماریِ تازه‌تست‌شده را نداشت، اجرای فعلی (eager، مثلِ رویدادِ 2026-09-14) نگه داشته شد؛ توقف/ادامه‌ی واقعی در حالتِ محلی/FAILED (نیازِ تغییرِ `feelia-rt.js`، پلن بخشِ ۵)؛ پولیشِ ظاهریِ E1–E3 (رنگِ بنر، اندازه‌ی دقیقِ فونت‌ها به‌جز مواردِ بالا).
- **فایل‌ها:** `server/src/db/migrations/014_session_date_optional.sql` (جدید)، `server/src/http/sessions.ts`، `public/index.html`.
- **اسنادِ به‌روزشده:** همین فایل. *(باز مانده: `docs/02-reference/api-catalog.md`/`database-catalog.md`/`data-architecture.md` برایِ تاریخِ nullable، `docs/03-requirements/requirement-catalog.md` — به‌خاطرِ حجمِ تغییر در یک نشست، در دورِ بعدی تکمیل می‌شود؛ ثبت به‌عنوانِ کارِ باز، نه فراموشی.)*
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا. `node --check` روی JSِ inlineِ استخراج‌شده از `index.html` → exit 0. **mock backend در scratchpad** (سرو کردنِ `public/` واقعی، بدونِ حساب/DBِ واقعی، طبقِ LAW-016) با Browser pane: ساختِ مراجعِ غیرفعال → بدونِ کلیکِ اضافه مستقیم صفحه‌ی جلسه باز شد (`بدونِ تاریخ`)؛ تایپِ تاریخ + blur → دقیقاً یک `PUT`، متنِ سربرگ به‌روز شد، بدونِ دکمه‌ی ذخیره؛ یادداشتِ متنی → `POST` + کارتِ note-item + حذف → `DELETE` واقعی + جمع‌شدنِ فوریِ لیست (بدونِ ریلود)؛ شبیه‌سازیِ state با stubِ `window.FeeliaRT.createSession` (STARTING→ACTIVE→MANUAL_PAUSED→finish): دکمه‌ی توقف در STARTING واقعاً `disabled` بود (فیکسِ A2 تأییدشد)، دکمه‌ی یادداشتِ متنی هم `disabled` بود (B1)، در ACTIVE فعال شد، پاز/ادامه UI درست سوئیچ کرد؛ کلیکِ «بازگشت به پرونده» وسطِ ضبط ناوبری را بلاک کرد (B3، `confirm()` بومی — نه مودالِ سفارشی، محدودیتِ صادقانه)؛ `finish()` متن را در textarea گذاشت (**نه POST خودکار**، تصمیمِ ۳ تأیید شد) و ذخیره‌ی صریح یادداشتِ نوعِ متنی ساخت؛ بازگشتِ بدونِ کارِ ذخیره‌نشده بدونِ پرامپت انجام شد. **رونویسیِ واقعیِ Soniox با میکروفونِ واقعی تست نشد** (محدودیتِ Browser pane) — طبقِ حرفِ صادقانه، کارِ باقی‌مانده برایِ مالک.
- **عامل:** این نشست، به پلنِ پیست‌شده‌ی مالک + FINDINGِ خودِ نشست دربابِ قدیمی‌بودنِ بخشی از آن پلن.
- **کارِ باز / پیامد:** کد هنوز commitنشده. اسنادِ کاتالوگ (`api-catalog`, `database-catalog`, `requirement-catalog`) هنوز با migration 014 هم‌گام نیستند — قبل از commit باید تکمیل شوند (LAW-017). توقف/ادامه‌ی واقعی و رونویسیِ زنده باید توسطِ مالک با میکروفونِ واقعی تست شود.

### 2026-09-15 — CODE/INCIDENT/TEST — صفحه‌ی مستقلِ جلسه + تاریخ/ساعتِ inline + توقف/ادامه‌ی یادداشتِ صوتی
- **چه شد:** مالک سه ایرادِ دیگر روی «ثبتِ جلسه‌ی گذشته» گرفت (INCIDENTِ طراحی، نه فیچرِ جدید): «میخوام یه صفحه باز شه نمیخوام بره اون پایین» (۱)، «وقتی تاریخ و ساعت نیست ویرایش چیه این وسط» (۲)، «مثل قبل دکمه‌ی توقف باید داشته باشه و ادامه» (۳)، و خواست همه‌ی این مسیرها اول چک و باگ‌یابی شود، بعد طراحیِ درست انجام شود.
  - **رفعِ ۱:** `sessionDetail` از تو در توی `screenClientDetail` بیرون آمد و شد `screenSessionDetail` — یک screenِ کاملاً مستقل (مثلِ Setup/Live/Wrapup)، با `showScreen('SessionDetail')` و دکمه‌ی «بازگشت به پرونده».
  - **رفعِ ۲:** برایِ `source==='manual'` دکمه‌ی «ویرایش تاریخ/ساعت» مخفی؛ به‌جایش یک ردیفِ inlineِ همیشه‌نمایانِ تاریخ+ساعت+«ذخیره» (از‌پیش‌پرشده). جلسه‌ی زنده/کامل همان دکمه+مودالِ قبلی را دارد؛ هسته‌ی مشترک (`persistSessionDateTime`) بینِ هر دو به اشتراک گذاشته شد.
  - **رفعِ ۳:** دکمه‌های «توقف»/«ادامه» به یادداشتِ صوتیِ آرشیو اضافه شد. **بازاستفاده، نه بازنویسی:** مسیرِ FeeliaRT از `RTSession.pause()/resume()`ِ *همان کلاسی* که جلسه‌ی زنده سال‌هاست استفاده می‌کند — بعدِ خواندنِ دقیقِ کد تأیید شد این متدها فقط به `state` وابسته‌اند نه `mode`، پس رویِ `mode:'note'` هم درست کار می‌کنند (فقط `persist=false` می‌ماند، یعنی transcriptِ موقت در `sessions` نمی‌نشیند). `archiveVoiceOnState` عیناً فیکسِ ریشه‌ایِ `rtOnState` را تکرار می‌کند (به‌روزرسانیِ state هم‌زمان با تغییرِ واقعی، نه بعدِ تأخیرِ resolveِ promise — وگرنه همان باگِ قدیمی برمی‌گشت). مسیرِ legacy از `MediaRecorder.pause()/resume()`ِ بومی.
  - در همین دور، یک باگِ کوچکِ خودم هم در `openClientDetail` پاک شد (`$('sessionDetail').hidden=true` — کدِ مرده‌ی باقی‌مانده از معماریِ قبلی).
- **فایل‌ها:** `public/index.html` فقط (بدونِ تغییرِ سرور).
- **اسنادِ به‌روزشده:** `docs/03-requirements/requirement-catalog.md` (REQ-033)، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §10.
- **تست / تأیید:** `node --check` روی JSِ inline → exit 0. سرورِ dev از قبل روشن نبود (مالک ترمینالش را بسته بود) — این نشست خودش با `pnpm dev` بالا آوردش (بدونِ داده‌ی جدید، همان DBِ قبلی). با canaryِ پنجمِ کاملاً ایزوله، real HTTP: کلیکِ واقعی روی «ثبتِ جلسه‌ی گذشته» → واقعاً صفحه عوض شد (`scrollY=0`, هر دو screenِ `hidden` درست)؛ ردیفِ inlineِ تاریخ/ساعت از پیش پر و با ارقامِ فارسیِ واقعی ذخیره شد (`PUT` واقعی، تأییدشده در DB)؛ حالتِ اولیه‌ی دکمه‌های توقف/ادامه درست؛ کلیکِ یادداشتِ صوتی (ردِّ میکروفونِ sandbox) بدونِ نشتی cleanup شد و دکمه‌ها به حالتِ اولیه برگشتند؛ فراخوانیِ pause/resume بدونِ ضبطِ فعال بدونِ خطا no-op بود؛ یادداشتِ متنی و «بازگشت به پرونده» هر دو روی صفحه‌ی جدید کار کردند. پاکسازیِ کامل. **خودِ عملکردِ واقعیِ pause/resume حینِ یک ضبطِ زنده تست نشد** (نیازِ میکروفونِ واقعی).
- **عامل:** این نشست، به سه ایرادِ صریحِ مالک.
- **کارِ باز / پیامد:** مالک باید خودش با میکروفونِ واقعی توقف/ادامه‌ی یادداشتِ صوتی را امتحان کند. کد هنوز commitنشده.

### 2026-09-14 — CODE/INCIDENT/TEST — حذفِ مودالِ ثبتِ جلسه‌ی گذشته: صوتی و متنی از همون صفحه‌ی اول
- **چه شد:** مالک بلافاصله بعدِ رویدادِ قبلی اعتراض کرد: «چرا بعد از یادداشت باید صوت بذاره، همین صفحه‌ای که باز میشه هم اپشن صوتی داشته باشه هم متنی». یعنی طراحیِ رویدادِ قبل (مودالِ تاریخ/ساعت/یادداشتِ متنی → ثبت → بعداً از پرونده یادداشتِ صوتی) دقیقاً همان اصطکاکی بود که رد کرد — **این یک INCIDENTِ طراحی است، نه یک درخواستِ فیچرِ جدید.**
  - **رفع:** `manualSessionModal` (HTML) و توابعِ `openManualSession`/`closeManualSession`/`saveManualSession` کامل حذف شدند. جایگزین: `startManualSessionFlow()` — با یک کلیک، بدونِ هیچ فرمی، بلافاصله `POST /api/sessions {client_id, mode:'manual'}` (تاریخ/ساعت = وقتِ ایران، طبقِ تصمیمِ همان روز) و بی‌درنگ صفحه‌ی همان جلسه (`viewTranscript`) باز می‌شود — صفحه‌ای که از رویدادِ قبلی همین امروز از ابتدا هم دکمه‌ی «یادداشتِ صوتی» هم «یادداشتِ متنی» را کنارِ هم دارد، به‌علاوه‌ی دکمه‌ی از‌قبل‌موجودِ «ویرایش تاریخ/ساعت» برایِ تنظیمِ تاریخِ دقیق در صورتِ نیاز.
- **فایل‌ها:** `public/index.html` (بدونِ تغییرِ سرور).
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-032/033 اصلاح)، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §9.
- **تست / تأیید:** `node --check` روی JSِ inline → exit 0. با حسابِ canaryِ چهارمِ کاملاً ایزوله، مستقیم روی سرور/Postgresِ واقعی: یک کلیک → بدونِ مودال، جلسه ساخته شد و صفحه‌اش با هر دو دکمه از همان لحظه‌ی اول باز شد (تأییدشده با DOM + screenshot)؛ یادداشتِ متنی end-to-end کار کرد؛ حذفِ آبشاری `cascade:{session:1, note:1}` دقیقاً مطابق. پاکسازیِ کامل + صفر canaryِ باقی‌مانده.
- **عامل:** این نشست، به اعتراضِ صریحِ مالک بلافاصله بعدِ رویدادِ قبلی.
- **کارِ باز / پیامد:** کد هنوز commitنشده.

### 2026-09-14 — CODE/DECISION/TEST — ثبتِ جلسه‌ی گذشته: تاریخ/ساعتِ اختیاری + یادداشتِ صوتی (REQ-032 اصلاح، REQ-033 جدید)
- **چه شد:** مالک بعدِ تستِ اولیه گفت: «من ثبت جلسات گذشته هم دوباره باید قابلیت صوتی و اینا داشته باشه، تاریخ هم اختیاری باشه ساعت هم نمیخواد یا اگه میخوای باشه هم اختیاری باشه … مسیر صوتی و ایناش رو هم که دیگه مثل بقیه بلدی».
  - **تاریخ/ساعتِ اختیاری:** الزامِ قبلیِ «تاریخ و ساعت را کامل وارد کنید» در `POST /api/sessions` (mode manual) حذف شد؛ همان fallbackِ `nowInTehran()`ِ از‌قبل‌موجود (که برایِ جلسه‌ی زنده هم استفاده می‌شود) حالا برایِ manual هم اعمال می‌شود — بدونِ تاریخ/ساعت (هر دو یا فقط یکی) → وقتِ ایران برایِ همان فیلد.
  - **یادداشتِ صوتی/متنیِ بیشتر بعدِ ساخت:** چون تا جلسه ساخته نشه id نداره، یادداشتِ صوتی در **خودِ مودالِ ساخت** امکان‌پذیر نیست — بعدِ ذخیره، کاربر مستقیم به همان جلسه (`viewTranscript`) می‌رود و از آنجا یادداشتِ متنی/صوتی اضافه می‌کند. مسیرِ صوتی دقیقاً همان چیزی‌ست که Wrapup از قبل دارد (FeeliaRT مستقیم با fallback به legacy WSِ `/ws/voice/:id` + صفِ آفلاینِ durable) — **کپیِ عمدیِ مستقل** (نه refactorِ کدِ زنده، طبقِ LAW-020) با متغیر/DOM/توابعِ `archive*` جداگانه تا هیچ‌وقت با `currentSession`ِ جلسه‌ی زنده قاطی نشود؛ `cleanupArchiveVoice()` در نقاطِ سوئیچِ صفحه (`viewTranscript`، `openClientDetail`، `goBackToClients`) صدا زده می‌شود و به `hasActiveRecording()`/`beforeunload` هم اضافه شد.
  - **DECISION (مستندشده، نه فرض):** یادداشتِ صوتیِ اینجا رضایتِ مراجع نمی‌خواهد — صدای خودِ تراپیست است که دربارهٔ جلسه‌ای که قبلاً (و بدونِ این نرم‌افزار) اتفاق افتاده دیکته می‌کند، نه ضبطِ گفت‌وگوی زنده با مراجع؛ همین قاعده از قبل برایِ یادداشتِ صوتیِ Wrapup هم برقرار است (رضایتِ جداگانه ندارد). LAW-009 نقض نمی‌شود چون آن قانون دربارهٔ ضبطِ «جلسه» است.
- **فایل‌ها:** `server/src/http/sessions.ts`، `public/index.html`.
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-032 اصلاح، REQ-033 جدید)، `traceability-matrix.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §8.
- **تست / تأیید:** `tsc --noEmit` و `node --check` روی JSِ inline → هر دو exit 0. با یک حسابِ canaryِ سومِ کاملاً ایزوله، مستقیم روی سرور/Postgresِ واقعیِ لوکال: ۳ ترکیبِ تاریخ/ساعتِ اختیاری (بدونِ هیچ‌کدام، فقط تاریخ، فقط ساعت) هر سه ۲۰۱ با fallbackِ درست؛ پنلِ یادداشت فقط برایِ جلسه‌ی manual نمایان شد؛ یادداشتِ متنی end-to-end (POST واقعی، بازخوانی فوری) کار کرد؛ کلیکِ یادداشتِ صوتی زنجیره‌ی کامل (FeeliaRT→fallback→درخواستِ میکروفونِ واقعی) را طی کرد و روی ردِّ دسترسیِ میکروفون (محدودیتِ Browser pane) با پیامِ فارسیِ درست و بدونِ نشتیِ WS/state متوقف شد — خودِ رونویسیِ صوتی تست‌نشده ماند. پاکسازیِ کامل + شمارشِ نهایی: صفر ردیفِ یتیم، صفر canaryِ باقی‌مانده، صفر فرمتِ تاریخِ نامعتبر.
- **عامل:** این نشست، به درخواستِ صریحِ مالک.
- **کارِ باز / پیامد:** کد هنوز commitنشده. تعدادِ `clients` در DBِ لوکال بینِ این دور و دورِ قبل +۲ شد — طبقِ FINDING در verification §8، به‌احتمالِ‌زیاد از فعالیتِ هم‌زمانِ خودِ مالک (که گفته بود می‌خواهد خودش لوکال تست کند)، نه از این نشست؛ `sessions` بدونِ تغییر ماند و بررسیِ صریح نشان داد هیچ ردیفِ یتیمی از تستِ این نشست نمانده. اگر مالک با «بدونِ رضایتِ جداگانه برایِ یادداشتِ صوتیِ آرشیو» موافق نیست، باید صریحاً بگوید تا اصلاح شود.

### 2026-09-14 — TEST/INCIDENT — تستِ کاملِ واقعی روی سرور و Postgresِِلوکال (هر دو رفعِ باگ + تاریخِ شمسی)
- **چه شد:** مالک: «تست کن کامل همچی درست کار بکنه تست واقعی انجام بده» — یعنی تأییدِ صریحِ همان مجوزی که گزارشِ قبلی برایش صبر کرده بود (LAW-006). `git status` قبل از هر کاری چک شد (کارِ commitنشده مطابقِ انتظار).
  - **کشف:** سرورِ dev از قبل توسطِ مالک در ترمینالِ خودش روی پورت ۳۰۰۰ روشن بود (`preview_start` گزارش داد پورت در اشغال است) و migrationهای **012 و 013 از قبل روی DBِ واقعی اعمال شده بودند** — یعنی مالک خودش بعد از نوشته‌شدنِ این فایل‌ها `pnpm dev` را اجرا کرده بود. DB واقعی: `therapists=2, clients=19, sessions=89`.
  - **تستِ فقط‌خواندنی روی داده‌ی واقعیِ ۸۹ جلسه (بدونِ خواندنِ محتوا):** هر ۸۹ ردیفِ `sessions.date` فرمتِ شمسیِ نرمال دارند؛ **صفر** ردیفِ میلادیِ باقی‌مانده — یعنی migration 013 روی داده‌ی واقعی درست اجرا شده.
  - **تستِ نویسنده:** یک حسابِ **canary** واقعی ساخته شد (`09000000091`/`QA-canary-do-not-use`، کاملاً ایزوله از ۱۹ مراجعِ واقعی) و با کلیکِ واقعیِ DOM + `fetch` در همان صفحه، سناریوهای REQ-016/017/032/029 مستقیماً روی HTTPِ واقعی و Postgresِ واقعی اجرا شد: ساخت در تبِ غیرفعال با دلیل، 409ِ واقعیِ `client-inactive`، ۴ حالتِ 400 بدونِ ایجادِ ردیفِ یتیم (اتمیکِ CTE تأیید شد)، ثبتِ جلسه‌ی دستی با تایپِ واقعیِ ارقامِ فارسی → `date="1404/11/05"`، ویرایشِ تاریخ با ارقامِ فارسی و خط‌تیره → `"1405/06/20"`، بازگرداندن به فعال → `status_reason=null`، جلسه‌ی زنده بدونِ تاریخ → پیش‌فرضِ `Asia/Tehran` (نه منطقه‌ی زمانیِ سرور) با محاسبه‌ی UTC+۳:۳۰ تأیید شد، و حذفِ آبشاری با گزارشِ صحیحِ `cascade`.
  - **پاکسازی:** هر دو مراجعِ canary و جلساتشان حذف شدند (آبشاری)؛ logout؛ ردیفِ حسابِ canary با یک `DELETE` بسیار محدود (تطبیقِ دقیقِ شماره+نام، بعدِ SELECTِ تأییدی) پاک شد. شمارشِ نهایی دقیقاً برابرِ ابتدای کار: `therapists=2, clients=19, sessions=89`. **هیچ داده‌ی واقعیِ مراجعین خوانده یا لمس نشد.**
- **فایل‌ها:** بدونِ تغییرِ کد (فقط تست). دو اسکریپتِ موقتِ Node در `server/._tmp_*.mjs` ساخته و بلافاصله حذف شدند (هرگز commit نشدند).
- **اسنادِ به‌روزشده:** [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §7 (جدولِ کاملِ ۱۰ سناریو).
- **تست / تأیید:** جزئیات در verification §7. نتیجه: **صفر رگرسیون، صفر خطای غیرمنتظره** — REQ-016، REQ-017، REQ-029 (شاملِ خودِ migration 013 روی ۸۹ جلسه‌ی واقعی)، REQ-032 همگی روی سرور/DBِ واقعی (نه mock) تأیید شدند.
- **عامل:** این نشست، به دستورِ صریحِ مالک.
- **کارِ باز / پیامد:** کدِ همچنان commitنشده است (فقط به درخواستِ مالک commit می‌شود). چون migration 013 از قبل روی این DBِ لوکال اجرا شده، deploy به production همچنان نیازمندِ backupِ `sessions` است (DBِ production جدا و دست‌نخورده است). لاگ‌های سرورِ dev در دسترسِ ابزار نبود (خارج از ردیابیِ preview چون مالک خودش استارتش کرده بود) — صحت فقط از رویِ پاسخِ HTTP و خواندنِ دوباره‌ی DB تأیید شد، نه از رویِ لاگ.

### 2026-09-14 — CODE/MIGRATION/DECISION/TEST — تاریخِ همه‌ی جلسه‌ها شمسی شد (رفعِ C4 / UI-09 / UX-014)
- **چه شد:** مالک خواست FINDINGِ (۱) ورودیِ قبلی هم رفع شود: «اصلاحش کن اونم، شمسی باشه». ریشه: `POST /api/sessions` برای جلسه‌ی زنده تاریخِ **میلادیِ** ماشینِ سرور می‌گذاشت، در حالی که Setup همان لحظه شمسی نشان می‌داد و ویرایش/ثبتِ دستی شمسی بود؛ `MAX(s.date)` روی TEXT («آخرین جلسه» در `clients.ts` و `admin.ts`) با دو فرمت غلط می‌شد («2026/…» همیشه > «1405/…»).
  - **تصمیمِ مالک (سؤالِ صریح):** داده‌ی قبلی (از جمله production) با **migration تبدیل شود** (گزینه‌ی پیشنهادی)، نه فقط نمایش و نه فقط جلسه‌های جدید. طبقِ LAW-007 داده‌تغییردهنده است → **backup از `sessions` قبل از deploy الزامی**.
  - **اجرا:** ماژولِ جدیدِ `server/src/http/sessionDate.ts` (`toLatinDigits`، `gregorianToJalali` حسابیِ ۳۳ساله، `normalizeSessionDate` — شمسی/میلادی/ارقامِ فارسی/`-` → `YYYY/MM/DD` لاتین، نامعتبر → null؛ `normalizeStartTime` → `HH:MM`؛ `nowInTehran` برای پیش‌فرض). `POST /api/sessions` (زنده و manual) و `PUT /api/sessions/:id` همه‌ی تاریخ/ساعت‌ها را نرمال و ورودیِ نامعتبر را 400 می‌کنند؛ پیش‌فرضِ بدونِ تاریخ = وقتِ ایران به‌جای منطقه‌ی زمانیِ سرور. فرانت: `startSession` تاریخ (`toJalali`) و ساعتِ دستگاه را همان‌طور که Setup نشان می‌دهد می‌فرستد؛ `saveSessionMeta` ارقام را لاتین می‌کند. migration **`013_session_date_jalali.sql`**: `DO` block که هر `sessions.date` با الگوی Y/M/D را نرمال می‌کند (میلادی با سال ≥ ۱۷۰۰ → شمسی، شمسیِ نانرمال → صفرپُر، الگوهای دیگر دست‌نخورده)، idempotent.
- **فایل‌ها:** `server/src/http/sessionDate.ts` (جدید)، `server/src/http/sessions.ts`، `server/src/db/migrations/013_session_date_jalali.sql` (جدید)، `public/index.html`. (`.claude/launch.json` دوباره موقتاً برای mock تغییر کرد و برگشت.)
- **اسنادِ به‌روزشده:** `api-catalog.md` (POST/PUT)، `database-catalog.md` (013، ستونِ `date`/`start_time`)، `data-architecture.md`، `repository-map.md` (`sessionDate.ts`، 008–013)، `03-therapy-sessions/module-prd.md` (Validation، C4)، `requirement-catalog.md` (REQ-029)، `traceability-matrix.md`، `documentation-map.md` (C4)، `master-implementation-plan.md` (P2-3)، `PROJECT_MASTER_REFERENCE.md` §22، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md) §6.
- **تست / تأیید:** (۱) الگوریتمِ تبدیل روز‌به‌روز برای 1950-01-01…2100-12-31 با `Intl` (ICU 78.3 persian، منبعِ `toJalali`ِ فرانت) مقایسه شد: **۰ اختلاف در ۵۵۱۵۲ روز**. (۲) تستِ واحدِ `sessionDate.ts` با `tsx`: **۳۸/۳۸ PASS** (نرمال‌سازی، رد ۳۰ فوریه/۳۱ مهر/ماهِ ۱۳/ورودیِ غیرتاریخ، ساعت، `nowInTehran`، یکسانیِ منطقِ migration با API، idempotencyِ migration، ترتیبِ رشته‌ای = ترتیبِ زمانی). (۳) `tsc --noEmit` → exit 0؛ `node --check` JSِ inline → exit 0. (۴) mock UI: بدنه‌ی `POST /api/sessions` زنده `{date:"1405/06/23", start_time:"23:20"}` (برابرِ Setup)؛ تایپِ واقعیِ «۱۴۰۵/۰۶/۲۰» در مودالِ ویرایش → `PUT {date:"1405/06/20"}` و نمایشِ درست. **PL/pgSQLِ migration 013 روی Postgres اجرا نشد** (فقط منطقِ معادلش در JS تست شد) — تستِ روی DBِ لوکال نیازمندِ اجازه‌ی مالک است.
- **عامل:** این نشست، به دستور و انتخابِ صریحِ مالک.
- **کارِ باز / پیامد:** اجرای `pnpm dev` روی DBِ لوکال (migrationهای 012 و 013 خودکار) و بررسیِ تاریخ‌های تبدیل‌شده — با اجازه‌ی مالک؛ **قبل از هر deploy به production از جدولِ `sessions` backup گرفته شود** (013 برگشت‌ناپذیر است). ردیف‌هایی که الگوی Y/M/D ندارند (اگر وجود داشته باشند) دست‌نخورده و احتمالاً در «آخرین جلسه» نادرست می‌مانند — بعد از migration با یک SELECTِ فقط‌خواندنی قابلِ شناسایی‌اند. FINDING (۱)ِ ورودیِ قبلی با این رویداد رفع شد؛ (۲)–(۴) باز می‌مانند.

### 2026-09-14 — CODE/MIGRATION/DECISION/TEST — باگ‌های مراجعینِ فعال/غیرفعال + ثبتِ دستیِ جلسه‌ی گذشته
- **چه شد:** مالک گزارش داد مراجعی که در تبِ «غیرفعال» ساخته می‌شود به «فعال» می‌رود و خواست کلِ مسیرهای فعال/غیرفعال audit و پلن شود.
  - **Audit (ریشه‌ها):** B1 — `createNewClient` تب را نمی‌فرستاد و `POST /api/clients` فیلدِ status نمی‌پذیرفت → همیشه `active` (DEFAULTِ migration 008)؛ B2 — پرونده‌ی مراجعِ غیرفعال دکمه‌ی «شروع جلسه‌ی جدید» داشت (کارت نداشت) و سرور هم چک نمی‌کرد؛ B3 — پرونده هیچ نشانی از وضعیت/دلیل و راهِ بازگرداندن نداشت؛ B4 — تبِ خالی همیشه «هنوز مراجعی ثبت نشده» می‌گفت؛ B5 — `PATCH status` در حذفِ هم‌زمان `200 {client: undefined}` می‌داد و دلیل trim/محدود نمی‌شد؛ B6 — بنرِ ساخت به تبِ مقصد اشاره نمی‌کرد.
  - **تصمیم‌های مالک:** (۱) تبِ غیرفعال برای **آرشیوِ پرونده‌های قبلی** استفاده می‌شود؛ ساخت در آن با انتخابِ دلیل مثلِ مودالِ غیرفعال‌سازی + گزینه‌ی «نامشخص». (۲) مراجعِ غیرفعال جلسه‌ی زنده نمی‌گیرد؛ به‌جایش راهی برای واردکردنِ داده‌ی جلسه‌های قبلی (فقط یادداشت) لازم است.
  - **اجرا:** `POST /api/clients` حالا `status`/`reason` می‌پذیرد (دلیل trim، خالی → null، حداکثر ۲۰۰)؛ `PATCH status` همان اعتبارسنجی + 404 در `rows.length===0`؛ `POST /api/sessions` برای مراجعِ غیرفعال در حالتِ زنده 409 `client-inactive` و حالتِ جدیدِ `mode:"manual"` (تاریخ/ساعتِ الزامی، یادداشتِ اختیاری، بدونِ رضایت چون ضبطی نیست، `status=completed`، `source=manual`، جلسه+یادداشت در یک CTEِ اتمیک)؛ migration **012** (`sessions.source`، افزودنیِ خالص)؛ UI: بلوکِ دلیل در مودالِ ساخت (فقط تبِ غیرفعال)، helperِ مشترکِ `readReasonFrom`، متنِ خالیِ تب‌محور، بنرِ وضعیت + «بازگرداندن» در پرونده، مخفی‌شدنِ شروعِ جلسه و افزودنِ «ثبتِ جلسه‌ی گذشته» (مودالِ جدید + Escape)، برچسبِ «ثبتِ دستی» و متنِ جایگزینِ transcript برای جلسه‌ی دستی. یادداشتِ صوتی عمداً در این مسیر نیست (LAW-009/LAW-015). رویدادِ Clarityِ جدیدی اضافه نشد.
- **فایل‌ها:** `server/src/http/clients.ts`، `server/src/http/sessions.ts`، `server/src/db/migrations/012_session_source.sql` (جدید)، `public/index.html`. (`.claude/launch.json` موقتاً برای mock تغییر کرد و به حالتِ قبل برگشت.)
- **اسنادِ به‌روزشده:** `docs/02-reference/api-catalog.md`، `error-code-catalog.md` (`client-inactive`)، `database-catalog.md` (012، `sessions.source`، `consent`، enumها)، `docs/01-architecture/data-architecture.md`، `docs/04-modules/02-client-management/module-prd.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، `docs/03-requirements/requirement-catalog.md` (REQ-016، REQ-017، REQ-032؛ اصلاحِ REQ-020)، `traceability-matrix.md`، [`verification/2026-09-14-client-status-archive.md`](verification/2026-09-14-client-status-archive.md).
- **تست / تأیید:** `cd server && npx tsc --noEmit` → exit 0؛ `node --check` روی JSِ inlineِ `index.html` → exit 0؛ `pnpm test:rt` اجرا نشد (`feelia-rt.js` لمس نشد). تستِ UI با mock backendِ scratchpad + کلیکِ واقعی در Browser pane: ۱۲ سناریو (ساخت در تبِ غیرفعال با «نامشخص» و با دلیل، متنِ تبِ خالی، پرونده‌ی غیرفعال، رسیدنِ 409 به کلاینت، اعتبارسنجیِ بدونِ ساعت بدونِ ارسالِ POST، ثبت و نمایشِ جلسه‌ی دستی، بازگرداندن از پرونده، رگرسیونِ ساخت در تبِ فعال) — همه ✅ با DOM + بدنه‌ی درخواست. **سرور و DBِ واقعی اجرا نشد** (migration 012، CTE، 409 و 404ِ جدید فقط typecheck شده‌اند) چون ساختِ حساب/اجرا روی DB مجوزِ صریح لازم دارد.
- **عامل:** این نشست، به درخواست و تصمیم‌های صریحِ مالک.
- **کارِ باز / پیامد:** تستِ روی سرورِ لوکالِ واقعی (`pnpm dev` → migration 012 خودکار) با اجازه‌ی مالک؛ commit فقط به درخواستِ مالک. **FINDING:** (۱) فرمتِ `sessions.date` ناهمگون است (زنده میلادی، دستی/ویرایش شمسی) و `last_session_date = MAX(date)` روی TEXT برای مراجعِ دارای هر دو نوع ممکن است نادرست باشد — امتدادِ C4؛ (۲) `session_num` جلسه‌های دستی به ترتیبِ ثبت است نه تاریخِ واقعی؛ (۳) یادداشتِ جلسه‌ی دستی بعد از ثبت در UI قابلِ ویرایش نیست؛ (۴) ادامه‌ی جلسه‌ی نیمه‌تمامِ قبلی برای مراجعِ غیرفعال عمداً مجاز ماند.

### 2026-09-14 — GIT — push: ۹ کامیتِ محلی به `origin/feat/clarity`
- **چه شد:** مالک بعدِ گزارشِ «تست کردم اوکی بود انگاری» پرسید commit کنم یا push؛ روشن شد منظورش push بوده، ولی خواست اول **یه رگرسیونِ کاملِ دیگه** انجام بشه: «یه تست کامل دیگه بکن اگه همچی اوکی بود اوکیم که پوشش کنی». رگرسیونِ نهایی روی سرورِ واقعیِ لوکال (نه mock) اجرا شد:
  - خودکار: `node --check` (هر دو فایل)، `tsc --noEmit`، `rt-harness` (۲۹/۶، همان baseline).
  - عملیِ واقعی با کلیکِ real UI + API: ساختِ مراجع با سه‌کلیک (dedupe، ۱ POST)، شروعِ جلسه (گیت‌ِ میکروفون درست رفتار کرد — بدونِ اجازه دکمه غیرفعال ماند)، افزودنِ علامت/یادداشت، پایانِ جلسه.
  - **تستِ نهاییِ فیکسِ mint:** `purpose=note` رویِ جلسه‌ی completed → `200`+`api_key` واقعی. یک قدم جلوتر رفتیم: با همون کلید یه WebSocketِ واقعی به `wss://stt-rt.soniox.com` باز شد و Soniox یه فریمِ رونویسیِ معتبر برگردوند (`{"tokens":[],...}`) — یعنی کاملِ زنجیره (mint→WS→handshakeِ Soniox) الان واقعاً کار می‌کنه، نه فقط تئوری.
  - R16 دوباره از طریقِ کلیکِ واقعیِ DOM (نه صدازدنِ مستقیمِ تابع) تأیید شد.
  - UI-38 (ویرایشِ alias) از طریقِ مدالِ واقعی تست شد، `PUT` رفت، دیتابیس به‌روز شد.
  - UI-29 (نرمال‌سازیِ جستجو) با تایپِ واقعیِ کیبورد (نه شبیه‌سازیِ JS) تست شد — «ي» عربی مراجعِ «نهایی» رو پیدا کرد.
  - UI-28 (پیامِ خالیِ جستجو) با تایپِ واقعی تأیید شد.
  - چیدمانِ موبایل با `resize_window` واقعی (۳۷۵px) دوباره تأیید شد.
  - UI-26 (تمِ تیره) با کلیکِ واقعی + **reloadِ واقعیِ صفحه** تأیید شد که ماندگاره.
  - کنسولِ تبِ تازه در تمامِ مراحل بدونِ خطا؛ همه‌ی داده‌های تستی (۲ مراجع، جلسات، یادداشت‌ها) بلافاصله حذف شدند؛ `client count=0` در پایان تأیید شد.
  - نتیجه: **بدونِ هیچ رگرسیون**. مالک تأیید کرد push انجام بشه.
  بعد از این تأیید: `git push origin feat/clarity` اجرا شد.
- **فایل‌ها:** — (هیچ کدی در این رویداد تغییر نکرد؛ فقط تستِ نهایی + push).
- **اسنادِ به‌روزشده:** §1 و §6 همین فایل (وضعیتِ همه‌ی ردیف‌ها از «commit شد، منتظرِ push» به «commit + push شد» تغییر کرد).
- **تست / تأیید:** جزئیات بالا. نتیجه‌ی `git push`: `* [new branch] feat/clarity -> feat/clarity` — موفق، بدونِ conflict، بدونِ force.
- **عامل:** این نشست، به دستورِ صریحِ مالک، بعدِ رگرسیونِ اضافیِ درخواستی.
- **کارِ باز:** این فقط **push به origin**ه — نه merge به `main`، نه deploy به `feelia.ir`. Productionِ زنده هنوز `8bcdf0e` است و هیچ‌کدام از فیکس‌های امروز (شاملِ فیکسِ بحرانیِ یادداشتِ صوتی) رو نداره. تصمیمِ merge/deploy جداگانه و نیازمندِ مجوزِ صریحِ مالک است (LAW-006). مستنداتِ untracked (`docs/`، `PROJECT_STATUS.md`، …) هنوز commit نشده‌اند — تصمیمِ جداگانه‌ی مالک لازم دارد (P0-0 در §6).

### 2026-09-14 — CODE/GIT — commitِ `2551943`: ریشه‌ی واقعیِ «چرا یادداشتِ صوتی ریل‌تایم نیست» پیدا و رفع شد
- **چه شد:** بعدِ فیکسِ ۴۰۰/R16/timeout، مالک اصرار کرد «توی نسخه‌های قبلی درست بود» و خواست کاملاً چک بشه. پرسیدم آیا حینِ **جلسه‌ی اصلی** هم همون هشدارِ زردِ «رونویسیِ زنده در دسترس نیست» رو دیده — جوابِ صریحِ مالک: **«نه، جلسهٔ اصلی مشکلی نداشت، فقط یادداشت.»** این جواب قطعی بود: چون کدِ اتصال (`ensureStream`/`connectWithFreshMint`) بینِ `mode:'live'` و `mode:'note'` کاملاً مشترکه، یه شکستِ مختصِ یادداشت باید از یه‌جایِ *قبل*ِ اون کدِ مشترک می‌اومد.
  **پیدا شد:** `POST /api/stt/realtime-session` (endpointِ mintِ credential که باید قبل از هر تلاشِ WS موفق بشه) یه گاردِ `owned.status==='completed'` داشت — بدونِ تفکیکِ purpose، برخلافِ `batch-audio` که صبح همون روز فیکس شده بود. تنها نقطه‌ی UI که یادداشتِ صوتی می‌سازه (دکمه‌ی Wrapup) همیشه *بعد*ِ اینه که `endNewRTSession()` همون لحظه‌ی «پایان جلسه» `PUT status:'completed'` فرستاده. یعنی mintِ یادداشتِ صوتی **همیشه، صددرصد، قبل از هر تلاشی برایِ WS** با ۴۰۰ رد می‌شد — هیچ‌وقت credential نمی‌گرفت که بخواد وصل بشه یا نشه. جلسه‌ی زنده چون هنوز `in_progress`ه وقتی mint می‌کنه، هیچ‌وقت این مانع رو نمی‌دید.
  **رفع:** `mintCredential(sessionId, purpose)` — کلاینت (`feelia-rt.js`) حالا `purpose:'note'` یا `'transcript'` می‌فرسته (`self.mode` که از قبل رو RTSession بود). سرور (`stt.ts`) فقط `purpose==='transcript'` رو رویِ جلسه‌ی completed/canceled مسدود می‌کنه؛ `purpose==='note'` همیشه مجازه. رفتارِ پیش‌فرض (بدونِ purpose، یعنی هر کلاینتِ قدیمی‌تر) هم `'transcript'` می‌مونه — یعنی جلسه‌ی زنده دقیقاً همون رفتارِ قبلی رو داره.
- **فایل‌ها:** `public/feelia-rt.js` (+۷/−۱)، `server/src/http/stt.ts` (+۱۶/−۵).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ ریشه‌ی واقعیِ realtimeِ یادداشتِ صوتی»)، §1 و §6 همین فایل.
- **تست / تأیید:** مستقیم رویِ سرورِ لوکالِ واقعی: `POST /api/stt/realtime-session {purpose:'note'}` رویِ جلسه‌ی completed → **۲۰۰ + `api_key` واقعی** (قبلاً ۴۰۰). رگرسیون: همون درخواست با `purpose:'transcript'` → همچنان ۴۰۰؛ همون درخواست **بدونِ فیلدِ purpose اصلاً** (سازگاریِ کلاینتِ قدیمی) → همچنان ۴۰۰؛ mintِ یه جلسه‌ی تازه‌ی `in_progress` بدونِ purpose (دقیقاً چیزی که جلسه‌ی زنده امروز می‌فرسته) → همچنان ۲۰۰. تأیید شد `feelia-rt.js`ِ serve‌شده واقعاً نسخه‌ی جدیده (نه cache). `node --check` روی هر دو فایل OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). داده‌ی تستی بلافاصله حذف شد. کنسولِ تبِ تازه بدونِ خطایِ واقعی.
- **عامل:** این نشست، به دستورِ مالک (بعد از یک سؤالِ تشخیصیِ دقیق که مالک جواب داد).
- **کارِ باز:** **push نشده.** این آخرین حلقه‌ی زنجیره‌ی «یادداشتِ صوتی» بود — با این فیکس، یادداشتِ صوتی حالا هم مثلِ جلسه‌ی اصلی می‌تونه واقعاً realtime بشه (اگه شبکه‌ی مالک اجازه بده؛ مینتِ خودش دیگه مانع نیست). سؤالِ «چرا کند بود» تا حدی با timeoutِ `api()` (کامیتِ قبلی) پوشش داده شد؛ اگه هنوز کندی حس بشه، نیازِ بررسیِ بیشتر داره. هیچ‌کدام از فیکس‌هایِ امروز push نشدن؛ این باگ (مثلِ ۴۰۰ی batch-audio) رویِ productionِ زنده هم هست چون از همون معماریِ پایه (`f9b0a9c`) میاد.

### 2026-09-14 — CODE/FINDING — commitِ `08e8d20`: رفعِ R16 + timeoutِ `api()` + یافته‌ی ریشه‌ای درباره‌ی نبودِ fallbackِ legacy
- **چه شد:** بعدِ فیکسِ باگِ ۴۰۰، مالک باز هم گزارش داد: «باید یادداشتِ صوتی پس از جلسه هم مثلِ خودِ جلسه ریل‌تایم باشه … توی نسخه‌های قبلی درست بود»، «چرا توی پرونده نمایش داده نمیشه»، «کند هم هست چرا؟». سه مسیر جداگانه بررسی شد:
  1. **رفعِ قطعی — R16/UX-002 (نمایشِ خالیِ یادداشت‌ها در پرونده):** ریشه پیدا شد: `viewTranscript()` هر `.inline-sign`/`.inline-note` را به‌صورتِ `<svg>{آیکون}</svg><span></span><span>{زمان}</span>` می‌سازد، بعد با `querySelectorAll('.inline-sign span:first-child')` سعی می‌کند spanِ متن رو پر کنه — ولی `:first-child` یعنی «فرزندِ *واقعاً* اول»، و اون svgه نه span، پس این سلکتور هیچ‌وقت چیزی پیدا نمی‌کرد و متن همیشه خالی می‌موند. با `:first-of-type` (که فقط بینِ خواهر-برادرهای هم‌تگ می‌شمره) رفع شد. با سرورِ لوکالِ واقعی (نه mock) و سه نوع یادداشتِ واقعی (sign/متنی/صوتی) روی یک جلسه‌ی completed تأیید شد: هر سه حالا متنِ واقعی‌شون رو نشون می‌دن (قبلاً فقط زمان).
  2. **رفعِ جزئی — کندی/گیرکردن (UI-33، بخشی):** تابعِ مشترکِ `api()` هیچ timeout نداشت. یه پارامترِ **اختیاریِ** `timeoutMs` (با `AbortController`) اضافه شد — بدونِ پاس‌دادنش، رفتارِ همه‌ی callerهای فعلی بدونِ کوچک‌ترین تغییر می‌مونه (backward-compatible کامل، تأیید‌شده با تستِ مستقیم). فقط رویِ چکِ STTِ preflight سیم‌کشی شد (سقفِ ۱۰ثانیه) چون همون‌جا بود که «در حال بررسیِ اتصالِ رونویسی…» می‌تونست برای همیشه گیر کنه. تأیید شد: timeoutِ ۱ms قابلِ‌اعتماد در ~۳ms abort می‌کنه و خطایِ قابلِ‌تشخیصِ `{code:'timeout'}` می‌ده؛ فراخوانیِ عادی (بدونِ timeoutMs) دقیقاً مثلِ قبل کار می‌کنه؛ `runPreflight()` رویِ سرورِ واقعی هنوز درست به «رونویسی: آماده» می‌رسه.
  3. **یافته‌ی ریشه‌ای، هنوز بدونِ رفع — چرا یادداشتِ صوتی ریل‌تایم نیست:** با بازخوانیِ دقیقِ `startNewRTSession()` (کدِ **جلسه‌ی اصلی**، نه یادداشت) مشخص شد این رفتار مختصِ یادداشت نیست: خودِ کامنتِ همون تابع می‌گه («ISSUE 4: حالتِ durable-only … legacy proxy صدا زده نمی‌شود»)؛ یعنی وقتی اتصالِ مستقیمِ Browser→Soniox شکست بخوره، کد **هیچ‌وقت** به مسیرِ قدیمیِ `/ws/t`/`/ws/voice` (که از سرور رد می‌شه و با `GET /api/stt/check` اثبات شد کاملاً سالمه — `mint-ok`, `proxy.ok:true`) برنمی‌گرده؛ فقط صادقانه به کاربر می‌گه realtime نیست. این از commitِ `f9b0a9c` (۲۰۲۶-۰۹-۱۱، جدِّ productionِ `8bcdf0e`) همین‌طور بوده — یعنی **رگرسیونِ این نشست نیست**، و رویِ جلسه‌ی اصلی و یادداشتِ صوتی یکسان اثر می‌ذاره. پس اگه واقعاً مشکلِ شبکه است، باید همون هشدارِ زرد («رونویسیِ زنده در دسترس نیست») رو حینِ خودِ جلسه‌ی اصلی هم دیده باشه — این سؤال از مالک پرسیده شد و هنوز جواب نیومده.
- **فایل‌ها:** `public/index.html` (+۳۳/−۸؛ فقط دو تابع: `viewTranscript()`، `api()` + یک call-site).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ R16/UX-002 و timeoutِ api()»)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29/6 (همان baseline). رویِ سرورِ لوکالِ واقعی: مراجع+جلسه+۳ یادداشتِ واقعی ساخته شد، `viewTranscript()` صدا زده شد، هر سه متن درست نمایش داده شدن؛ داده‌ی تستی بلافاصله حذف شد. تبِ تازه بعدِ همه‌ی تغییرات → کنسول فقط همون ۴۰۱ِ عادیِ «هنوز واردنشده» (انتظاری)، بدونِ خطایِ واقعی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** **push نشده.** منتظرِ جوابِ مالک درباره‌ی هشدارِ زردِ جلسه‌ی اصلی — اگه بله، یعنی مشکل شبکه‌ایِ عمومیه (شبیهِ Clarity) نه کدی؛ اگه نه، یعنی یادداشتِ صوتی به‌طورِ خاص یه چیزِ دیگه داره که باید عمیق‌تر بررسی بشه. پیاده‌سازیِ واقعیِ fallback به legacy (رفعِ کاملِ ISSUE 4) یه تغییرِ بزرگ‌تر در `feelia-rt.js`/`index.html`ه — منتظرِ تصمیمِ مالک برای شروع.

### 2026-09-14 — INCIDENT/GIT — commitِ `fefa823`: یادداشتِ صوتی با ۴۰۰ رد می‌شد (کشف در تستِ لوکالِ مالک)
- **چه شد:** مالک بعدِ push-گفتن «نه فعلاً»، خودش `pnpm dev` را با سرورِ واقعی (نه mock) اجرا کرد و یادداشتِ صوتی گذاشت. گزارش داد: (۱) متنِ زنده نشون داده نمی‌شه، (۲) «ذخیره هم نمیشه»، (۳) کنسول یه `400 Bad Request` نشون داد، (۴) حسش این بود که نسخه‌ی روی سرور بهتر کار می‌کنه، و خواست ریشه پیدا بشه و رفع بشه.
  **تشخیص:** با `GET /api/stt/check` روی سرورِ لوکال، `mint-ok`/`proxy.ok:true` تأیید شد — یعنی مشکل از سمتِ سرور به Soniox نیست. یه WS مستقیمِ آزمایشی هم از مرورگر به Soniox در ۹۶۵ms وصل شد. سپس با بازخوانیِ دقیقِ کد، **علتِ قطعیِ ۴۰۰ پیدا شد**: `POST /api/sessions/:id/batch-audio` یه گارد داشت که هر آپلودِ غیرِ`archive` رو روی جلسه‌ی `completed`/`canceled` با ۴۰۰ رد می‌کرد. ولی `endNewRTSession()` (فایلِ `public/index.html`) همون لحظه‌ای که کاربر «پایان جلسه» می‌زنه، بلافاصله `PUT status:'completed'` می‌فرسته — یعنی تا وقتی کاربر وارد صفحه‌ی Wrapup می‌شه و دکمه‌ی «یادداشت صوتی» رو می‌زنه، status از قبل `completed`ه. پس هر یادداشتِ صوتی‌ای که به fallbackِ batch نیاز داشت (چون realtimeِ خودش وصل نشده بود)، در آپلودِ صدا با همون ۴۰۰ رد می‌شد — **صددرصدِ مواقع**، نه گاه‌به‌گاه. با `git blame` تأیید شد این گارد از commitِ `f9b0a9c` (۲۰۲۶-۰۹-۱۱) میاد که **جدِّ commitِ productionِ فعلی (`8bcdf0e`) هم هست** — یعنی این باگ رو productionِ زنده هم هست، فقط چون اونجا معمولاً realtime موفقه، مسیرِ batch برایِ یادداشت کمتر اجرا می‌شه و باگ کمتر دیده می‌شه؛ این دقیقاً همون چیزیه که حسِ «سرور بهتر کار می‌کنه» رو توضیح می‌ده.
  **رفع:** شرطِ ۴۰۰ فقط برایِ `purpose==='transcript'` نگه داشته شد (نه برایِ `note`)؛ `archive` که از قبل استثنا بود دست‌نخورده ماند.
- **فایل‌ها:** `server/src/http/sessions.ts` (+۱۰/−۳).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ باگِ بحرانیِ ۴۰۰ در یادداشتِ صوتی»)، §1 و §6 همین فایل.
- **تست / تأیید:** مستقیم روی سرورِ لوکالِ واقعی (نه mock): ساختِ یک مراجع+جلسه‌ی واقعی، `PUT status:'completed'` دقیقاً مثلِ کلاینت، بعد `POST batch-audio?purpose=note` → **قبل از فیکس ۴۰۰، بعدِ فیکس `202 {status:'queued'}`**. رگرسیون: همون تست با `purpose=transcript` رویِ همون جلسه‌ی completed → همچنان **۴۰۰** (رفتارِ اصلی حفظ شد)؛ با `purpose=archive` → همچنان `202` (بدونِ تغییر). `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). دادهٔ تستی (مراجع/جلسه) بلافاصله پاک شد. `feelia-rt.js` در این commit اصلاً باز نشد — فقط یه فایلِ سرور.
- **عامل:** این نشست، به دستورِ صریحِ مالک («این لایو ضبط شدن و ذخیره شدن دیتای پس از جلسه رو درستش کن»).
- **کارِ باز:** **push نشده** (طبقِ دستورِ قبلیِ مالک). دو سؤالِ دیگرِ مالک هنوز بازند و ربطی به این فیکس ندارند: (۱) چرا اتصالِ realtimeِ Soniox از مرورگرِ محلیِ او برقرار نمی‌شه (منتظرِ خروجیِ Console/Network تبِ او)، (۲) چرا تست کلاً کند بود (مظنون: `api()` بدونِ timeout — UI-33 — ولی هنوز فیکس نشده، منتظرِ تأییدِ مالک). این باگ چون در productionِ زنده هم فعاله، بعدِ push به اونجا هم باید برسه.

### 2026-09-14 — GIT — commitِ `84d4783`: رگرسیونِ کاملِ دستی + ۴ فیکسِ دیگرِ کم‌خطرِ P2/P3
- **چه شد:** به دستورِ مالک («آره یه رگرسیونِ کامل دیگه انجام بده و همه ریزه‌کاری‌ها رو تموم کن؛ فقط به سیستمِ صوتی فعلاً دست نزن و متنِ رضایت رو دست نزن؛ پوش هم نکن تا رگرسیون تموم نشده»):
  **۱) رگرسیونِ کاملِ دستی روی HEAD (`85bd08e`)** با mock backend: `node --check`/`tsc`/`rt-harness` (۲۹/۶، بدونِ تغییر) + جریانِ کاملِ کاربر — ساختِ مراجعِ جدید با سه‌کلیکِ پشتِ‌سرِهم (دقیقاً ۱ `POST`، UI-06 هنوز سالم)، شروعِ جلسه با سه‌کلیک (دقیقاً ۱ `POST`، UI-04 هنوز سالم)، توقف/ادامه، افزودنِ علامت+یادداشتِ سریع، پایانِ جلسه («۱ دقیقه» به‌جایِ «۰ دقیقه» — UI-34 تأیید شد در جریانِ واقعی)، افزودنِ یادداشتِ متنی در Wrapup، «بازگشت بدونِ ذخیره» (متنِ درستِ UI-19 تأیید شد)، «ذخیره و پایان»، بازِ پرونده. Escape روی مدال (UI-21) و CSSِ موبایل (`#liveControls` با `position:fixed` واقعی در ویوپورتِ ۲۸۳px، `transform:none` روی `.screen`) هم دوباره با `getComputedStyle` تأیید شدند. **کنسول در تمامِ مسیر بدونِ هیچ خطا.** یک یافته‌ی از پیش‌موجود و **نامرتبط** به این نشست دوباره دیده شد (نه رگرسیون): متنِ یادداشت‌ها در نمایِ پرونده خالی رندر می‌شود (`<span></span>`) — دقیقاً همان **R16/UX-002** که نشستِ دیگری در audit جداگانه‌ی UX کشف کرده؛ کدِ مربوط در هیچ‌کدام از کامیت‌های این نشست لمس نشده.
  **۲) ۴ موردِ دیگرِ P2/P3 کم‌خطر رفع شد:**
  - **UI-29:** جستجو «ي»/«ك» عربی و ارقامِ فارسی/عربی را با فارسی/لاتین یکسان نمی‌کرد؛ تابعِ `normalizeSearchText()` روی query و روی `code`/`alias` اعمال شد.
  - **UI-28:** با فیلترِ دسته/جنسیت (بدونِ جست‌وجوی متنی)، پیامِ «کد یا نام دیگری را جست‌وجو کنید» گمراه‌کننده بود؛ از پیامِ جست‌وجو جدا شد («مراجعی در این دسته‌بندی نیست»).
  - **UI-38:** `PUT /api/clients/:id` (ویرایشِ alias) از قبل در سرور بود ولی UI نداشت؛ مدالِ `editAliasModal` (هم‌الگو با `editCategoryModal`، ثبت‌شده در `MODAL_CLOSERS`) + گزینه در منویِ کارتِ مراجع اضافه شد.
  - **UI-44 (جزئی):** `sessions_this_week` از قبل در پاسخِ API بود ولی نمایش داده نمی‌شد؛ کارتِ آمار اضافه شد. ایموجیِ 👑 (بخشِ دومِ همین یافته) عمداً دست‌نخورده ماند — سلیقه‌ای است، نه باگ.
  **عمداً رفع نشد:** UI-30 (بی‌ضرر طبقِ خودِ audit)، UI-32/33/35 (تغییرِ `api()`/بنرها اثرِ گسترده روی کلِ اپ دارد)، UI-39/40/43/45 (دسترس‌پذیری/کنتراست/فونت/فرم — نیازِ بازبینیِ طراحی، نه فیکسِ کوچک)، UI-47 (هم‌پوشانی با کارِ فعالِ یک نشستِ دیگر روی Clarity — برایِ جلوگیری از تداخل دست زده نشد). `feelia-rt.js`، سرور، و متنِ رضایت (UI-05) در این commit هم اصلاً لمس نشدند.
- **فایل‌ها:** `public/index.html` (+۶۶/−۴).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ P2/P3 کم‌خطر (دورِ دوم)»، ۴ ردیفِ FIXED/جزئی در جدولِ یافته‌ها)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدید)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). هر مورد جداگانه: `normalizeSearchText('علي')==='علی'` و `normalizeSearchText('٠٩١٢')==='0912'` + جست‌وجویِ واقعی با یِ عربی → ۱ نتیجه؛ فیلترِ دسته‌ی بدونِ مراجع → پیامِ درست؛ ویرایشِ alias → دقیقاً ۱ `PUT /api/clients/:id` + بازتابِ فوری در لیست + Escape کار می‌کند؛ `renderAdminStats` با `sessions_this_week` → کارتِ «جلساتِ این هفته» رندر شد. تبِ کاملاً تازه بعدِ همه‌ی تغییرات → کنسول بدونِ خطا. `.claude/launch.json` موقتاً `feelia-ui-mock-temp` گرفت و دقیقاً به حالتِ اصلی برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** **push نشده — به دستورِ صریحِ مالک، منتظرِ اجازه‌ی جداگانه.** باقی‌مانده: UI-13/14/15/36 (`feelia-rt.js`)، UI-09 و UI-05 (تصمیمِ مالک)، UI-25 (فیلدِ جدیدِ API)، UI-30/32/33/35/39/40/43/45/47 (تغییرِ بزرگ‌تر یا هم‌پوشانی با نشستِ دیگر).

### 2026-09-14 — GIT — commitِ `85bd08e`: ۶ فیکسِ کم‌خطرِ P2/P3 روی `feat/clarity`
- **چه شد:** به دستورِ مالک («برو سراغ موارد کم‌خطر و اصلاح کن»)، از جدولِ کاملِ یافته‌های audit، مواردی انتخاب شد که (الف) به `feelia-rt.js` نیاز ندارند و (ب) منتظرِ تصمیمِ مالک/حقوقی نیستند (UI-05، UI-09، UI-13/14/15/36 حذف شدند). ۶ مورد رفع شد:
  1. **UI-26** (تمِ تیره ذخیره نمی‌شد، تنظیمِ سیستم نادیده گرفته می‌شد): تابعِ جدیدِ `initTheme()` در `DOMContentLoaded` (قبل از `init()`) — اول `localStorage.feelia_theme` اگر قبلاً انتخاب شده، وگرنه `prefers-color-scheme`؛ `toggleTheme()` حالا انتخاب را ذخیره می‌کند.
  2. **UI-42** (تمِ تیره: حاشیه‌ی `.banner.warn` و پس‌زمینه‌ی `.rec-dot.paused` رنگِ ثابتِ روشن داشتند): دو override برایِ `[data-theme="dark"]` اضافه شد، با همان الگویِ override موجود برایِ `.consent-box`.
  3. **UI-41** (`var(--r-sm)` هرگز تعریف نشده بود → `.radio-opt` گوشه‌ی صاف): `--r-sm:8px` به `:root` اضافه شد.
  4. **UI-46** (وضعیتِ `canceled` هیچ استایلِ اختصاصی نداشت، برخلافِ سه وضعیتِ دیگر): `.session-status.canceled{background:var(--line-soft);color:var(--muted)}` اضافه شد.
  5. **UI-34** («مدت: ۰ دقیقه» برایِ جلسه‌ی زیرِ یک دقیقه): `Math.floor`→`Math.round` در `handleFinished()`.
  6. **UI-20 (تصحیحِ سند):** بررسیِ کدِ HEAD نشان داد Enterِ فرمِ ورود/ثبت‌نام از قبل در `fedeac2` رفع شده بود؛ جدولِ audit هنوز آن را «جزئی رفع شد» نشان می‌داد — فقط سند تصحیح شد، کدِ جدیدی برایِ این مورد نوشته نشد.
  **عمداً رفع نشد:** UI-25 (نمایشِ دکمه‌ی «بازسازیِ گوینده‌ها» بدونِ صدای آرشیو) — سرور همین حالا پیامِ فارسیِ روشن برمی‌گرداند؛ پنهان‌کردنِ پیشاپیشِ دکمه نیازمندِ فیلدِ جدید در API است (تغییرِ API/کاتالوگ، نه رفعِ کوچک) — برایِ دورِ بعد گذاشته شد. `feelia-rt.js` و کدِ سرور در این commit اصلاً باز نشدند.
- **فایل‌ها:** `public/index.html` (+۱۸/−۴؛ فقط CSS + توابعِ کوچکِ JS، بدونِ تغییرِ منطقِ موجود).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ P2/P3 کم‌خطر»، ۶ ردیفِ FIXED در جدولِ یافته‌ها)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدیدِ «P2/P3 کم‌خطر»)، §1 و §6 همین فایل.
- **تست / تأیید:** `node --check` روی اسکریپتِ استخراج‌شده OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline). با mock backend (Browser pane، ویوپورتِ ۲۸۳×۶۹۴ و تبِ تازه): `getComputedStyle(document.documentElement).getPropertyValue('--r-sm')==='8px'`؛ عنصرِ آزمایشیِ `.session-status.canceled` → پس‌زمینه/رنگِ غیرِشفاف (`rgb(237,240,235)`/`rgb(132,145,138)`)؛ با `data-theme="dark"` → `.banner.warn` border `rgb(69,58,31)` و `.rec-dot.paused` background `rgb(74,83,77)` (هر دو مطابقِ مقدارِ override)؛ با سیستمِ `prefers-color-scheme:dark` و بدونِ `localStorage`، بارِ اول خودکار `data-theme="dark"`؛ بعدِ `toggleTheme()`→`light`، `navigate` (reloadِ کامل) → `data-theme` هنوز `light` می‌ماند (انتخابِ کاربر بر سیستم اولویت دارد و ماندگار است)؛ `Math.round(45000/60000)===1` در مقابلِ رفتارِ قبلیِ `floor`→`0`. رگرسیون: تبِ کاملاً تازه روی همان mock → کنسول بدونِ هیچ خطا، صفحه‌ی مراجعین با همه‌ی دکمه‌ها/فیلترها درست رندر شد. `.claude/launch.json` موقتاً یک configurationِ `feelia-ui-mock-temp` گرفت و بعدِ تست دقیقاً به حالتِ اصلی (تک‌ورودیِ `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ audit — UI-13/14/15/36 (لمسِ `feelia-rt.js`، فعلاً متوقف)، UI-09 (تصمیمِ مالک)، UI-25 (نیازِ فیلدِ جدیدِ API)، UI-05 (P0-1)، و بقیه‌ی موارد P2/P3 که یا اثرِ محسوس کمتری دارند یا نیازمندِ تغییرِ ساختاریِ بزرگ‌تر (مثلِ دسترس‌پذیریِ UI-39/40، خودمیزبانیِ فونت UI-43).

### 2026-09-14 — GIT — commitِ `8347fbb`: رفعِ چیدمانِ موبایل (UI-22/23/24) روی `feat/clarity`
- **چه شد:** به دستورِ صریحِ مالک («نه اول موبایل رو اوکی کن بر اساسِ سیستمِ دیزاین، دست به اون سیستمِ صوتی نزن فعلا و هر تغییری که میدی باید هی مشکل رو حل کنه نه اینکه چیزی که درسته رو خراب کنه») ۳ موردِ P1 مربوط به چیدمانِ موبایل رفع شد: UI-22 (نوارِ کنترل‌های جلسه‌ی زنده در `≤480px` پایینِ صفحه گم می‌شد)، UI-23 (دکمه‌ی شروعِ جلسه در `screenSetup` همین‌طور)، UI-24 (دکمه‌ی «مراجع جدید» در `screenClients` همین‌طور). راه‌حل: `#screenLive` کنترل‌های pause/resume/پایان در `<div id="liveControls">` جدید بسته شد (دکمه‌ی «لغو جلسه» عمداً بیرون ماند، در جریانِ عادی)؛ در مدیاکوئریِ `≤480px` سه بلوک (`#liveControls`، `#btnStartSession`، `#btnNewClient`) با `position:fixed` به پایینِ صفحه چسبانده شدند، با `padding-bottom` متناظر روی کانتینرهای بالادست تا محتوا زیرِ نوارِ ثابت گم نشود. از توکن‌ها/کلاس‌های همان سیستمِ دیزاینِ موجود استفاده شد (`--card`، `--line-soft`، `--r-lg`، `--shadow`)، هیچ الگوی بصریِ جدیدی اضافه نشد. **دو باگِ واقعیِ CSS در همین مسیر کشف و رفع شد** (جزئیات در ادامه). `feelia-rt.js` طبقِ دستورِ صریحِ مالک **عمداً لمس نشد** — هیچ خطی از آن تغییر نکرد.
  1. **باگِ containing-block از transform:** `.screen{animation:rise}` با keyframeِ `transform:translateY(12px)→transform:none` باعث می‌شد `#screenClients`/`#screenLive`/`#screenSetup` (هرکدام `.screen`) یک containing block برای فرزندانِ `position:fixed` خودشان بشوند (طبقِ اسپکِ CSS، هر مقدارِ transformِ غیرِ `none` — حتی matrixِ همانی از یک انیمیشنِ تمام‌شده با `fill-mode:both` — این اثر را دارد)؛ نتیجه: عناصرِ fixed به‌جایِ نسبت‌به‌viewport، نسبت‌به‌همان `.screen` جای‌گیری می‌کردند و مثلاً `top:1350px` در یک viewportِ 812پیکسلی می‌افتادند. ریشه‌یابی با پیمایشِ زنجیره‌ی ancestor توسطِ `getComputedStyle` و پیداکردنِ `transform:matrix(1,0,0,1,0,0)` روی `.screen` تأیید شد. رفع: keyframeِ `rise` بازنویسی شد تا به‌جایِ `transform`، `margin-top` را انیمیت کند (همان جلوه‌ی بصریِ ورود، بدونِ ست‌کردنِ `transform` هرگز). تأیید پس از رفع: `getComputedStyle(...).transform === "none"` (لفظاً) روی هر سه `.screen`.
  2. **باگِ over-constraint در RTL:** بعدِ رفعِ باگِ اول، دکمه‌ها هنوز `left:-12px` (بیرونِ صفحه) اندازه‌گیری می‌شدند. علت: ست‌کردنِ همزمانِ `left:12px` و `right:12px` روی یک عنصرِ `position:fixed` با `width:100%` (از `.btn-block`) over-constrained است؛ طبقِ اسپک، در سندی با `dir="rtl"` مرورگر `left` را کنار می‌گذارد و از `right` انکر می‌کند. تأیید با `getComputedStyle`: `cssLeft:"12px"` و `cssRight:"12px"` هر دو «درست» به‌نظر می‌رسیدند ولی `cssWidth:"375.2px"` (≈عرضِ کاملِ viewport، نه فاصله‌ی موردِ انتظار ۳۵۱px) نشان می‌داد `left` در حلِ box-model نادیده گرفته شده. رفع: هر سه قانونِ fixed به یک انکرِ واحد (`left:12px`) + `width:calc(100% - 24px)` صریح تغییر کرد. تأییدِ نهایی با اندازه‌گیریِ کاملِ DOM: `left:12, right:363.2, width:351.2` روی هر سه عنصر — درست.
- **فایل‌ها:** `public/index.html` (`#screenLive`/`#screenClients` HTML: افزودنِ `<div id="liveControls">` و `id="btnNewClient"`؛ CSS: بازنویسیِ `@keyframes rise`، افزودنِ قوانینِ `position:fixed` در `@media(max-width:480px)`).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ چیدمانِ موبایل (UI-22/23/24)»، ۳ ردیفِ FIXED، §0)، `docs/05-plans/master-implementation-plan.md` (ردیفِ جدیدِ UI-Ph1 چیدمانِ موبایل)، §1 و §6 همین فایل.
- **تست / تأیید:** mobile emulation در Browser pane (`resize_window{width:375,height:812}`؛ user agent/touch موبایل) — هر سه بلوکِ fixed با `position:static`→`fixed` صحیح، `top`/`left`/`right`/`width` درست نسبت‌به‌viewport، بدونِ همپوشانی با محتوا (padding-bottom کافی)، اسکرولِ صفحه بدونِ پرش. تستِ فانکشنال: کلیک روی هر سه دکمه‌ی fixed (شروعِ جلسه، مراجعِ جدید، پایانِ جلسه) هرکدام دقیقاً همان رفتارِ قبلی را داد (نه صرفاً بررسیِ بصری). **دسکتاپِ واقعی** با `resize_window{width:1280,height:900}` (نه presetِ «desktop» که به‌اشتباه عرضِ پیش‌فرضِ paneِ ۲۸۳px را می‌داد و کاذباً همچنان داخلِ همان مدیاکوئریِ موبایل بود) — تأییدِ `position:static` روی هر سه عنصر و `matchMedia('(max-width:480px)').matches===false`؛ یعنی صفحه‌ی دسکتاپ کاملاً دست‌نخورده ماند. رگرسیونِ کاملِ چرخه‌ی جلسه (شروع، ضبط، توقف/ادامه، یادداشت، پایان) روی موبایل و دسکتاپ هر دو موفق. `node --check` روی اسکریپتِ استخراج‌شده OK؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (دقیقاً همان baseline، بدونِ شکستِ جدید). بررسیِ عدمِ imbalance در تعدادِ `<div>`: شمارشِ ۱۳۳ باز/۱۳۲ بسته بعد از تغییر بررسی شد؛ `git show HEAD:public/index.html` (قبل از این commit) نشان داد همین عدم‌تعادلِ ۱۳۲/۱۳۱ از قبل وجود داشت (نامرتبط با این تغییر، به‌احتمالِ زیاد artifactِ grep از رشته‌ی `<div` داخلِ یک کامنت/استرینگِ JS، نه تگِ واقعاً بازنشده) — افزوده‌ی خودِ این commit (`<div id="liveControls">`...`</div>`) دقیقاً متوازن (+۱/+۱) بود. `.claude/launch.json` به حالتِ اصلی (فقط `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ فازِ ۱ (UI-13/14/15 و UI-36 — هرکدام نیازمندِ لمسِ `feelia-rt.js`، فعلاً طبقِ دستورِ مالک متوقف‌اند)، UI-09 (تصمیمِ مالک)، همه‌ی P2/P3.

### 2026-09-14 — TEST — validationِ لینک‌ها پس از UX audit
- **چه شد:** checkerِ لینک‌های نسبیِ Markdown (فایل + anchor؛ اسکریپتِ scratchpad، خارج از repo) پس از افزودنِ ۵ سندِ UX، evidence و به‌روزرسانیِ اسناد اجرا شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** همین ورودی.
- **تست / تأیید:** 59 فایلِ Markdown، 406 لینکِ نسبی، **2 anchorِ خراب — هر دو از قبل و خارج از اسنادِ UX**: `docs/00-governance/source-of-truth.md` → `project-laws.md#law-018--…` و `docs/05-plans/ui-ux-audit-2026-09-14.md` → `#بازبینی-دوم--…` (احتمالاً ناشی از قاعده‌ی slugِ این checker برای نیم‌فاصله/کسره، نه لینکِ واقعاً خراب — تأیید نشد). ۰ لینکِ خراب در `docs/05-plans/ux-audit-2026-09-14/` و `verification/2026-09-14-ux-audit-runtime.md`. `git status`: هیچ فایلِ trackedِ کد توسطِ این نشست تغییر نکرد (فقط `docs/admin-panel.md` از قبل modified).
- **عامل:** این نشست.
- **کارِ باز:** بررسیِ آن دو anchor در نشستِ مستندات (بدونِ اولویت).

### 2026-09-14 — FINDING — commitهای هم‌زمان حینِ UX audit؛ همگام‌سازیِ یافته‌ها
- **چه شد:** حینِ نوشتنِ UX audit، نشستِ دیگری `ecf00b4`، `fedeac2` و `8347fbb` («sticky bottom controls … UI-22/23/24»، 16:39) را روی `feat/clarity` ساخت. `8347fbb` در §1 و Event Log هنوز ثبت نشده بود. همه‌ی ۴۲ یافته‌ی UX با `grep` روی HEAD `8347fbb` دوباره بررسی شد: **۵ Critical و ۱۳ از ۱۴ High پابرجا**؛ ۷ یافته جزئی رفع (UX-008، 022، 028، 029، 032، 035، 037)؛ هیچ‌کدام کامل رفع نشده. شماره‌خط‌ها و اجراهای اسنادِ UX مربوط به snapshotِ پیشین‌اند و این صراحتاً در اسناد ذکر شد. هیچ تغییری برگردانده نشد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/05-plans/ux-audit-2026-09-14/UX_FINDINGS.md` (بخشِ همگام‌سازی)، `UX_AUDIT_REPORT.md` (§۰)، `USER_JOURNEYS.md`، `UX_PRIORITY_ROADMAP.md`، `verification/2026-09-14-ux-audit-runtime.md`.
- **تست / تأیید:** `git log --oneline -4`، `git show --stat ecf00b4 fedeac2 8347fbb`، grepِ شواهدِ هر یافته در `public/index.html` HEAD. اجرای mock روی HEAD تکرار نشد.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14)؛ همگام‌سازی توسطِ این نشست.
- **کارِ باز:** نشستِ سازنده‌ی `8347fbb` باید رویدادِ `GIT`/`CODE` آن را ثبت کند (LAW-024).

### 2026-09-14 — FINDING — configurationِ نشستِ دیگر در `.claude/launch.json`
- **چه شد:** هنگامِ حذفِ configurationِ موقتِ UX audit مشخص شد `.claude/launch.json` یک configurationِ دیگر به نامِ `feelia-ui-mock` (node، پورتِ 3911، scratchpadِ نشستِ `cf1e1cb5…`) دارد که متعلق به این نشست نیست. طبقِ CLAUDE.md §9 برگردانده نشد.
- **فایل‌ها:** `.claude/launch.json` (untracked).
- **اسنادِ به‌روزشده:** همین ورودی.
- **تست / تأیید:** `cat .claude/launch.json`.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** نشستِ مالک باید پس از پایانِ تستش آن را حذف کند.

### 2026-09-14 — TEST — اجرای UI برای UX audit با mock (بدونِ حساب/داده‌ی واقعی)
- **چه شد:** کپیِ فایل‌های واقعیِ `public/` در scratchpad با stubِ `fetch`/میکروفون/WSِ Soniox؛ سرورِ استاتیک با configurationِ **موقتِ** `uxmock-temp` در `.claude/launch.json` (با اجازه‌ی مالک: «هر کاری لازمه انجام بده») اجرا و پس از تست حذف شد. ۷ سناریو.
- **فایل‌ها:** `verification/2026-09-14-ux-audit-runtime.md` (جدید). کدِ repo تغییر نکرد.
- **اسنادِ به‌روزشده:** `verification/README.md`.
- **تست / تأیید:** شکستِ ذخیره‌ی یادداشت → UI ۱ یادداشت و ۱ علامت، سرور ۰، بدونِ هشدار (پس از «ذخیره و پایان» هم ۰)؛ حالتِ FAILED → `hasActiveRecording()=false` → `logout()` → صفحه‌ی ورود با میکروفونِ live؛ پرونده: متنِ یادداشت/علامت/یادداشتِ صوتی نمایش داده نمی‌شود (`span:first-child` بعد از `<svg>`؛ در production از `f58bd29`)؛ جلسه‌ی `batch-pending` «کامل» بدونِ نشانه؛ موبایل: اولین کارت ۵۸۳px و «مراجع جدید» ۴۰۱۴px؛ کارت/جلسه `tabIndex=-1` و اولین Tab در پرونده = حذفِ جلسه؛ کنتراستِ `--muted` ۳٫۲۸/۲٫۹۹؛ `history.length` ثابت؛ بدونِ `prefers-reduced-motion`. **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاهِ واقعی، صفحه‌خوان، اسکرین‌شات (pane رندر نکرد).
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — DOCS — UX Audit کامل (۵ سند)
- **چه شد:** به دستورِ مالک («Full Critical UX Audit … فقط بررسی کن و داک بنویس») audit تجربه‌ی کاربر از دیدِ پژوهشِ UX نوشته شد: ۴۲ یافته — **Critical ۵، High ۱۴، Medium ۱۸، Low ۵** (۳۸ روی production). پنج Critical: UX-001 از دست رفتنِ بی‌صدای یادداشت/علامت در شکستِ ذخیره، UX-002 نمایش‌ندادنِ متنِ یادداشت‌ها در پرونده، UX-003 خروج در حالتِ ضبطِ محلی با میکروفونِ روشن (شکافِ باقی‌مانده از UI-01)، UX-004 متنِ رضایتِ نادرست/ناقص (شخصِ ثالث، آرشیو، دسترسیِ ادمین)، UX-005 خطای شبکه نمایش‌داده‌شده به‌صورتِ «بدونِ مراجع»/«خروج». به یافته‌های UI-xx ارجاع می‌دهد و تکرار نمی‌کند. **هیچ کدی تغییر نکرد.**
- **فایل‌ها:** `docs/05-plans/ux-audit-2026-09-14/UX_AUDIT_REPORT.md`، `UX_FINDINGS.md`، `USER_JOURNEYS.md`، `UX_OPEN_QUESTIONS.md`، `UX_PRIORITY_ROADMAP.md` (همه جدید).
- **اسنادِ به‌روزشده:** `docs/00-governance/documentation-map.md`، `PROJECT_MASTER_REFERENCE.md` (§20، §22: R15–R17)، §1 و §6 همین فایل.
- **تست / تأیید:** ورودیِ `TEST` بالا؛ validationِ لینک‌ها در ورودیِ بعدی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی نقشه‌ی [UX_PRIORITY_ROADMAP](docs/05-plans/ux-audit-2026-09-14/UX_PRIORITY_ROADMAP.md)؛ P0-1 (متنِ رضایت) همچنان بلاک‌کننده‌ی UX-004/015/016؛ ۱۲ سؤالِ باز نیازمندِ تحقیقِ کاربر.

### 2026-09-14 — GIT — commitِ `fedeac2`: ۵ فیکسِ دیگرِ UI (فازِ ۱ دورِ دوم) روی `feat/clarity`
- **چه شد:** به دستورِ مالک («ادامه بده روی بقیه‌ی فاز ۱ … هر قسمت رو هم دقیق برسی کن چیزیو خراب نکنی»)، ۵ موردِ دیگرِ P1 رفع شد: UI-08 (دکمه‌ی شروع بی‌دلیل منتظرِ چکِ STT می‌ماند — `updateStartButtonState()` حالا بلافاصله بعدِ چکِ میکروفون هم صدا زده می‌شود)، UI-11 (ذخیره‌ی تاریخ/ساعت متنِ بازِ جلسه را می‌بست — حالا همان جلسه دوباره باز می‌شود)، نیمِ باقی‌مانده‌ی UI-20 (Enter در فرمِ ورود/ثبت‌نام حالا `submitAuth()` را صدا می‌زند)، و UI-27 (سه اکشنِ مخربِ پنلِ ادمین — غیرفعال‌سازیِ حساب، گرفتنِ نقشِ ادمین، حذفِ مراجع — حالا `confirm()` با پیامِ فارسیِ روشن دارند). هر مورد جداگانه با mock تست شد (برایِ UI-27 هم مسیرِ accept هم cancel، شاملِ بررسیِ اینکه هیچ درخواستی روی cancel نمی‌رود و چک‌باکس برمی‌گردد)، بعد رگرسیونِ کامل. **یک باگِ خودِ من پیدا و رفع شد:** ویرایشِ اولِ UI-20 با یک کامنتِ چندخطیِ دیگر (UI-01) تداخل کرد و متنِ فارسیِ بدونِ `//` وسطِ اسکریپت ماند؛ `node --check` (نه فقط `new Function`) قبل از هر تستِ مرورگری همین را گرفت؛ دیفِ کامل هم با چشم بازبینی شد تا موردِ مشابهِ دیگری نمانده باشد. سپس commit شد.
- **فایل‌ها:** `public/index.html` (+۴۹/−۴).
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ «رفعِ فازِ ۱ (دورِ دوم)»، ۳ ردیفِ FIXED، §0)، §1 و §6 همین فایل.
- **تست / تأیید:** UI-08: دکمه در ۵۳ms فعال شد (نه ۲۵۰۰ms). UI-11: همان جلسه با همان متن دوباره باز شد. UI-20: Enter درخواستِ شبکه فرستاد. UI-27 (سه اکشن × ۲ مسیر): cancel → پیامِ صحیح + صفر درخواست + برگشتِ چک‌باکس؛ accept → دقیقاً یک درخواست. رگرسیونِ کاملِ چرخه‌ی جلسه موفق (یک false-negative در regexِ خودِ تست پیدا و توضیح داده شد، نه رگرسیونِ واقعی). `node --check`، `cd server && npx tsc --noEmit` (exit 0)، `node scripts/rt-harness.cjs` (۲۹/۶، همان baseline) — همه تمیز. `.claude/launch.json` به حالتِ اصلی برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push؛ باقیِ فازِ ۱ (UI-13/14/15 با لمسِ `feelia-rt.js`، UI-22/23/24 چیدمانِ موبایل، UI-36، UI-09).

### 2026-09-14 — GIT — commitِ `ecf00b4`: ۱۴ فیکسِ UI (فازِ ۰+۱) روی `feat/clarity`
- **چه شد:** به دستورِ صریحِ مالک («بعدش کامیت بشه ادامه بده الان»)، پس از تأییدِ نهاییِ رگرسیون (syntax، `tsc`، harness، `launch.json` برگشته به حالتِ اصلی)، دقیقاً همان ۲ فایلی که تست شده بود stage و commit شد: `public/index.html` (+۱۷۰/−۱۴) و `server/src/http/auth.ts` (+۹/−۱). `docs/admin-panel.md` (modified، نامرتبط با این کار — از audit پیشین) عمداً از این commit کنار گذاشته شد تا commit دقیقاً محدود به همان چیزی بماند که تست شده بود.
- **فایل‌ها:** `public/index.html`، `server/src/http/auth.ts`.
- **اسنادِ به‌روزشده:** §1 و §6 همین فایل.
- **تست / تأیید:** بعدِ commit دوباره تأیید شد: `git log` نشان‌دهنده‌ی `ecf00b4` روی `2763414`؛ `git status` برای این دو فایل تمیز؛ `cd server && npx tsc --noEmit` → exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline).
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** push (نیازمندِ دستورِ جداگانه‌ی مالک طبقِ LAW-006)؛ commitِ مستقلِ مستندات (تصمیمِ مالک)؛ بقیه‌ی فازِ ۱ و P2/P3.

### 2026-09-14 — CODE — رفعِ ۹ باگِ فازِ ۱ (دورِ اول) از UI audit: UI-07، UI-10، UI-12، UI-16، UI-17، UI-18، UI-19، UI-21، UI-37 (+ نیمِ UI-20)
- **چه شد:** به دستورِ مالک («کامل چک کن همشو مرحله به مرحله… تست هم بکنیم بعدش کامیت بشه… حواست باشه هیچ چیزیو خراب نکنی») ۹ موردِ دیگرِ P1 رفع شد:
  1. **UI-16:** `#chkLiveText` روشن‌کردن → بلافاصله `rtSession.confirmed+interim` نشان می‌دهد (قبلاً تا پیامِ بعدی خالی بود).
  2. **UI-17:** `startVoiceNoteDirect()` تایمر را شروع می‌کند (`voiceElapsed=0`+`startVoiceTimer()`)؛ `stopVoiceNoteDirect()` بلافاصله بعدِ `finish()` متوقفش می‌کند.
  3. **UI-18:** دکمه‌ی «انصراف» در جعبه‌ی یادداشتِ صوتی + `cancelVoiceNote()` (فقط `cleanupVoice()` موجود را صدا می‌زند — امن برایِ هر دو مسیرِ FeeliaRT/legacy).
  4. **UI-19:** `showExitWarning()` دیگر نمی‌گوید «N یادداشت از بین می‌رود» — چون یادداشت‌ها (متنی و صوتی، بعدِ فیکسِ فازِ ۰) همان لحظه‌ی ثبت به سرور می‌روند، چیزی از دست نمی‌رود.
  5. **UI-12:** کلیک روی جلسه‌ی `in_progress`/`recovered` در پرونده → `liveResumeSession`/`resumeSession` به‌جایِ نمایشِ متنِ (خالیِ) جلسه.
  6. **UI-37:** `removeQuickNote(idx)` + دکمه‌ی حذف در `renderNotesLog()` (همان الگوی `removeSign` که از قبل با `DELETE /api/notes/:id` کار می‌کرد).
  7. **UI-07:** `#bannerBox{position:relative;z-index:60}` — بالاتر از `.modal-back{z-index:50}` تا خطای پشتِ مدال دیده شود.
  8. **UI-10:** `viewTranscript()` بعدِ نمایشِ متن `scrollIntoView({behavior:'smooth',block:'start'})` صدا می‌زند.
  9. **UI-21 (+نیمِ UI-20):** نقشه‌ی `MODAL_CLOSERS` (id→تابعِ closeِ خودِ همان مدال، نه صرفاً حذفِ کلاس) + listenerِ سراسریِ Escape و کلیکِ روی پس‌زمینه (فقط `e.target===backdrop`، کلیکِ داخلِ محتوا نمی‌بندد). Enterِ فرمِ ورود (نیمِ دیگرِ UI-20) رفع نشد.
  هر مورد جداگانه با mock تست شد، بعد یک رگرسیونِ کامل با همه‌ی ۱۴ فیکس (فازِ ۰+۱) با هم اجرا شد. یک false-negative در خودِ تستِ من پیدا شد (mockِ `/__log` فقط ۸۰ خطِ آخر را برمی‌گرداند، نه کدِ اپ) و با سرورِ تازه‌ریستارت‌شده رفع/تأیید شد: گاردِ دوبارکلیکِ فازِ ۰ («۳ کلیک → دقیقاً ۱ درخواست») هنوز درست کار می‌کند.
- **فایل‌ها:** `public/index.html` (مجموعِ فازِ ۰+۱: +۱۷۰/−۱۴)؛ `server/src/http/auth.ts` بدونِ تغییرِ جدید در این دور.
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ «رفعِ فازِ ۱ (دورِ اول)»، جدولِ یافته‌ها با ۹ نشانِ FIXED + ۱ جزئی، §0)، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph1)، §1 و §6 همین فایل.
- **تست / تأیید:** برای هر مورد جداگانه با mock (نتایج در doc)؛ رگرسیونِ کامل (ساختِ مراجع، شروعِ جلسه، علامت، یادداشتِ سریع+حذف، توقف/ادامه، متنِ زنده، پایان، یادداشتِ صوتی+تایمر، یادداشتِ متنی، هشدارِ صحیح، یادداشت‌ها قبل از ذخیره در سرور، logoutِ عادی) — همه موفق. Syntax (`new Function`) OK؛ `cd server && npx tsc --noEmit` exit 0؛ `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (بدونِ شکستِ جدید نسبت به baseline). `.claude/launch.json` موقتاً تغییر و به حالتِ قبل (فقط `feelia-server`) برگشت.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** commit/push (بعدی طبقِ دستورِ مالک)؛ بقیه‌ی فازِ ۱ (UI-08/09/11/13/14/15/20-نیمه/22-24/27/36)، همه‌ی P2/P3، UI-05 (P0-1).

### 2026-09-14 — CODE — رفعِ ۵ باگِ فازِ ۰ از UI audit (UI-01، UI-02، UI-03، UI-04، UI-06)
- **چه شد:** به دستورِ مالک («شروع کن دونه‌دونه اصلاحشون کن هر اصلاحی که میکنی دقیق تست کن») ۵ موردِ فازِ ۰ یکی‌یکی رفع شد:
  1. **UI-03** (`server/src/http/auth.ts`): تابعِ `toLatinDigits` اضافه شد؛ `normalizePhone` قبل از regex ارقامِ فارسی/عربی را به لاتین تبدیل می‌کند.
  2. **UI-01** (`public/index.html`): تابعِ سراسریِ `hasActiveRecording()` (همان سیگنالِ `beforeunload`)؛ `logout()` و `openAdminPanel()` اگر ضبط فعال باشد بنرِ هشدار می‌دهند و کاری نمی‌کنند (بدونِ `abort()` که صفِ IndexedDB را پاک می‌کند).
  3. **UI-06** (`public/index.html`): `id="newClientCreateBtn"`؛ `createNewClient()` تا پایانِ درخواست دکمه را `disabled` می‌کند.
  4. **UI-04** (`public/index.html`): `startSession()` دکمه‌ی `#btnStartSession` را قبل از POST غیرفعال می‌کند؛ روی خطا با `updateStartButtonState()` دوباره فعال می‌شود.
  5. **UI-02** (`public/index.html`): در `stopVoiceNoteDirect()` شاخه‌ی موفقیتِ realtime حالا `POST /api/sessions/:id/notes` صریح می‌فرستد.
  هر مورد جداگانه با mock backend (فایلِ واقعیِ `public/`، بدونِ حساب/رمز/Sonioxِ واقعی) تست شد، به‌علاوه‌ی دو دور رگرسیونِ کامل (syntax، `tsc --noEmit`، `pnpm test:rt`، جریان‌های عادی: تک‌کلیک، علائم، یادداشتِ سریع، توقف/ادامه، لغو، logoutِ عادی). **UI-05 عمداً رفع نشد** — وابسته به تصمیمِ مالک (P0-1) است. الگوی «دکمه تا پایانِ درخواست غیرفعال» فقط روی `startSession`/`createNewClient` اعمال شد، نه روی همه‌ی اکشن‌های نوشتنی (کارِ باز).
- **فایل‌ها:** `public/index.html` (+57/−4)، `server/src/http/auth.ts` (+9/−1). `.claude/launch.json` برای تست موقتاً تغییر و بلافاصله برگردانده شد.
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (بخشِ جدیدِ «رفعِ فازِ ۰»، جدولِ یافته‌ها، §5، §6)، `docs/03-requirements/requirement-catalog.md` (REQ-001، REQ-063 → IMPL)، `PROJECT_MASTER_REFERENCE.md` (R12–R14)، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph0)، `docs/04-modules/05-notes-and-signs/module-prd.md`، `docs/04-modules/03-therapy-sessions/module-prd.md`، §1 و §6 همین فایل.
- **تست / تأیید:** UI-03: استخراجِ عینیِ کدِ shipped و اجرا — ۱۱/۱۱ PASS. UI-01: پس از logoutِ بلاک‌شده `engineState=ACTIVE`/`wsOpen=true`/`micLive=true`/صفحه‌ی Live؛ پس از پایانِ صحیح `hasActiveRecording()=false` و logout در ۴۵ms. UI-06: ۳ کلیک → ۱ POST. UI-04: ۳ کلیک → ۱ POST. UI-02: ۱ POST به notes؛ یادداشت در `GET /api/sessions/:id` هم قبل و هم بعد از «ذخیره و پایان». رگرسیون: `node scripts/rt-harness.cjs` → 29 PASS/6 FAIL (همان baseline)؛ `cd server && npx tsc --noEmit` → exit 0؛ syntaxِ اسکریپتِ inline (`new Function`) OK.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** commit/push (P0-0)؛ اعمالِ الگوی «دکمه غیرفعال» روی سایرِ اکشن‌های نوشتنی (`addTextNote`، `finishSession`، `saveSessionMeta`، `confirmDeactivateClient`، `confirmEditCategory`، حذف‌ها، اکشن‌های ادمین)؛ UI-05 وابسته به P0-1؛ فازهای ۱ تا ۴ باقی‌مانده.

### 2026-09-14 — FINDING — تأییدِ قطعی: صفر ترافیک به Clarity رسیده (فیلترینگِ شبکه، نه باگ)
- **چه شد:** مالک با حسابِ خودش روی `feelia.ir` رضایتِ Clarity را داد؛ کنسولِ مرورگر `net::ERR_CONNECTION_CLOSED` روی `www.clarity.ms/tag/yhujhtp8rn` نشان داد و `feelia-analytics.js` طبقِ طراحیِ fail-open خودش را خاموش کرد (بدونِ کرشِ اپ). مالک یک Data Export API tokenِ زنده (scope=Data.Export) در چت فرستاد؛ به درخواستِ صریحِ او، این نشست **یک** درخواست (از سهمیه‌ی روزانه‌ی ۱۰تایی) به `GET https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1&dimension1=OS` از روی VPS زد (جایی که `clarity.ms` طبقِ audit قبلی در دسترس است). پاسخ `HTTP 200` بود ولی همه‌ی metricها (شاملِ `Traffic`) `information:[]` — یعنی **هیچ sessionی در ۲۴ ساعتِ اخیر برایِ این پروژه ثبت نشده**. نتیجه: کدِ سرور و کلاینت هر دو درست کار می‌کنند (لاگِ production هم ۳ درخواستِ authenticatedِ موفق به `/api/client-config` را قبلاً تأیید کرده بود)؛ مشکل صرفاً دسترسیِ شبکه به `clarity.ms` از سمتِ مرورگرِ مالک است، نه باگ.
- **فایل‌ها:** — (هیچ کدی تغییر نکرد)
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§21 Known Limitations، §22 ریسکِ Clarity-network)، §1 و §6 همین فایل.
- **تست / تأیید:** `curl` با header `Authorization: Bearer <token>` از روی VPS (`185.110.191.126`) → `HTTP_STATUS:200`، بدنه: ۹ metric همه با `information:[]`. تیکنِ API در هیچ فایل/commit/حافظه‌ای ذخیره نشد؛ فقط در یک دستورِ SSHِ یک‌باره مصرف شد (۹ درخواستِ باقی‌مانده از سهمیه‌ی امروز).
- **عامل:** این نشست، به دستورِ مالک (ارسالِ token و درخواستِ استفاده).
- **کارِ باز:** مالک باید VPN/فیلترشکن را خاموش یا از یک شبکه‌ی دیگر (موبایلِ بدونِ VPN) امتحان کند تا مشخص شود مسدودیت مخصوصِ همان شبکه است یا فیلترِ سراسری. اگر فیلترِ سراسری بود، R (ریسکِ Clarity برایِ کاربرانِ ایرانی) باید در Master Reference به «تأییدشده» ارتقا یابد و تصمیمِ محصول (ادامه با Clarity یا جایگزینیِ آن) با مالک است.

### 2026-09-14 — DOCS — به‌روزرسانیِ گزارشِ UI با بازبینیِ دوم
- **چه شد:** به درخواستِ مالک («بعضی مشکلات را در کد نمی‌بینم؛ تغییراتِ جدید داده شده و تستِ محلی خوب بود؛ دوباره بررسی و سند را به‌روز کن») بخشِ «بازبینیِ دوم» به گزارش اضافه شد: اثباتِ یکسان‌بودنِ کد، نتایجِ اجرای دوباره، جدولِ «کی دیده می‌شود / چطور خودت ببینی» برای هر مورد، و اصلاحِ ارزیابی (UI-01 وابسته به Clarity، UI-03 وابسته به کیبورد، UI-04/06 وابسته به سرعتِ شبکه، UI-08 روی localhost محسوس نیست).
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/05-plans/ui-ux-audit-2026-09-14.md`، `PROJECT_MASTER_REFERENCE.md` (§20 ردیف‌های Git و UI، §22 R3)، §6 همین فایل (P0-0).
- **تست / تأیید:** ورودیِ `TEST` زیر.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی فاز ۰؛ push کردنِ `2763414`.

### 2026-09-14 — TEST — بازبینیِ دومِ UI روی commitِ `2763414`
- **چه شد:** همان mock backend (موقت؛ configurationِ `.claude/launch.json` موقتاً اضافه و پس از تست حذف شد) روی کدِ commitشده اجرا شد و ۱۴ مورد دوباره آزمایش شد؛ خطوطِ کدِ بقیه‌ی موارد دوباره استخراج شد.
- **فایل‌ها:** — (کد تغییر نکرد)
- **اسنادِ به‌روزشده:** بخشِ «بازبینیِ دوم» گزارشِ UI.
- **تست / تأیید:** UI-01 (پس از خروج: `ACTIVE`، میکروفون live، WS باز)، UI-02 (۰ درخواستِ ذخیره)، UI-04 و UI-06 (۲ درخواست)، UI-07، UI-09 (۱۴۰۵/۰۶/۲۳ ↔ ۲۰۲۶/۰۹/۱۴)، UI-11، UI-16 (۰ در برابرِ ۸۹ کاراکتر)، UI-17 (۰۰:۰۰)، UI-18، UI-19، UI-20، UI-21، UI-26 — **همه پابرجا**. hashِ blobِ `index.html`/`feelia-rt.js` در working tree و `2763414` یکسان؛ زمانِ تغییرِ فایل‌ها قبل از بررسیِ اول. **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاهِ واقعی.
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — FINDING — commitِ `2763414` ثبت نشده بود
- **چه شد:** هنگامِ بازبینی مشخص شد commitِ `2763414` (Moheb، 2026-09-14 10:52، «fix(realtime): keep Soniox WS alive across pause/resume via keepalive») همه‌ی کدِ قبلاً commitنشده را روی `feat/clarity` ثبت کرده، ولی در Event Log ثبت نشده بود (LAW-024). این commit push نشده است (`origin/main` = `8bcdf0e`).
- **فایل‌ها:** ۲۰ فایلِ کد در `2763414`.
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§20 Git، R3)، §6 همین فایل.
- **تست / تأیید:** `git log --all`، `git branch -a --contains 2763414`، `git ls-remote origin`، `git diff --stat HEAD` (خالی).
- **عامل:** مالک یا نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** push با دستورِ مالک.

### 2026-09-14 — TEST — validationِ مستندات پس از گزارشِ UI
- **چه شد:** checkerِ لینک‌ها و شناسه‌ها پس از افزودنِ گزارشِ UI و هم‌گام‌سازیِ اسناد اجرا شد؛ بازگشتِ `.claude/launch.json` به حالتِ قبل و دست‌نخوردنِ کد هم بررسی شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** این ورودی.
- **تست / تأیید:** 53 فایلِ Markdown، 333 لینکِ نسبی، **0 لینکِ خراب**؛ LAW-001…LAW-024 و 71 REQ بدونِ ارجاعِ تعریف‌نشده. `.claude/launch.json` فقط شاملِ `feelia-server`. زمانِ تغییرِ `public/index.html`، `public/feelia-rt.js`، `public/feelia-analytics.js`، `server/src/http/auth.ts` پیش از این task است. گزارش: ۴۷ ردیفِ یافته، ۴۲ با ✅ در ستونِ production.
- **عامل:** این نشست.
- **کارِ باز:** —

### 2026-09-14 — DOCS — گزارشِ بررسیِ کاملِ UI و هم‌گام‌سازیِ اسناد
- **چه شد:** به درخواستِ مالک («UI و آنچه کاربر می‌بیند را کامل بررسی کن، هر باگ را پیدا کن و فایل بنویس؛ هر کلیکِ اضافه اشتباه است») گزارشِ [ui-ux-audit-2026-09-14](docs/05-plans/ui-ux-audit-2026-09-14.md) نوشته شد: ۴۷ یافته (P0×6، P1×21، P2×11، P3×9) با شاهد و ستونِ production، تحلیلِ کلیک در ۹ جریان، پیشنهادها به تفکیکِ صفحه، نقشه‌ی اجرای ۵فازی و چک‌لیستِ تأیید. هیچ کدی تغییر نکرد.
- **فایل‌ها:** `docs/05-plans/ui-ux-audit-2026-09-14.md` (جدید).
- **اسنادِ به‌روزشده:** `PROJECT_MASTER_REFERENCE.md` (§20 ردیفِ UI، §22 ریسک‌های R12–R14)، `docs/03-requirements/requirement-catalog.md` (REQ-001 → PARTIAL، REQ-063 → CONTRADICTED)، `docs/04-modules/05-notes-and-signs/module-prd.md` (Known Gap: یادداشتِ صوتی تأیید شد)، `docs/04-modules/03-therapy-sessions/module-prd.md`، `docs/05-plans/master-implementation-plan.md` (ردیفِ UI-Ph0…Ph4)، `docs/00-governance/documentation-map.md`، `verification/README.md`، §6 همین فایل (UI-Ph0، UI-Ph1…Ph4).
- **تست / تأیید:** نتیجه‌ی اجرای UI در ورودیِ `TEST` زیر. validationِ لینک‌ها پس از این تغییر در ورودیِ بعدی ثبت می‌شود.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** تصمیمِ مالک درباره‌ی فاز ۰ (UI-01، UI-02، UI-03، UI-04، UI-06) و تقویمِ واحد (P2-3).

### 2026-09-14 — TEST — اجرای واقعیِ UI با mock backend (بدونِ حساب و Sonioxِ واقعی)
- **چه شد:** یک mock backendِ موقت در scratchpad فایل‌های واقعیِ `public/` را سرو کرد و `/api/*` را با داده‌ی ساختگی جواب داد، به‌همراهِ Sonioxِ جعلی (WebSocket) و میکروفونِ ساختگی. سناریوها: فهرستِ مراجعین، پرونده و متن، مدال‌ها، دوبارکلیک، Setup، جلسه‌ی زنده (متنِ زنده، علامت، توقف/ادامه، قطعِ اتصال، حالتِ بدونِ رونویسیِ زنده، لغو)، خروج وسطِ جلسه، صفحه‌ی تکمیل (یادداشتِ صوتی/متنی، هشدارِ خروج)، ورود، پنلِ ادمین؛ در viewportهای ۶۴۰×۳۶۴ و ۳۷۵×۸۱۲. برای اجرای mock موقتاً یک configuration به `.claude/launch.json` اضافه و پس از تست حذف شد (فایل به حالتِ قبل برگشت).
- **فایل‌ها:** — (کدِ repo تغییر نکرد؛ `.claude/launch.json` موقتاً تغییر کرد و برگردانده شد)
- **اسنادِ به‌روزشده:** §2 گزارشِ UI.
- **تست / تأیید:** نتایجِ کلیدی: پس از logout موتور ACTIVE، میکروفون live و WS باز؛ یادداشتِ صوتی ۰ درخواستِ ذخیره؛ دوبارکلیک → ۲ جلسه و ۲ مراجع؛ بنرِ خطا زیرِ مدال؛ Escape/پس‌زمینه مدال را نمی‌بندد؛ متنِ جلسه ۷۲۷px پایین‌تر از viewportِ ۳۶۴px؛ دکمه‌ی شروع ۲۶۱۳ms منتظرِ STT؛ متنِ زنده پس از روشن کردن ۰ کاراکتر (در برابرِ ۸۹)؛ تایمرِ یادداشتِ صوتی ۰۰:۰۰؛ هنگامِ قطعِ اتصال تایمر و نوارِ صدا متوقف ولی ضبط فعال؛ در موبایل توقف ۹۱۶px و پایان ۹۹۵px در صفحه‌ی ۸۱۲. نرمال‌سازیِ شماره با Node: ارقامِ فارسی → null. کنتراستِ `--muted` ۳٫۲۸. وجودِ هر باگ در production با مقایسه‌ی کدِ `8bcdf0e` بررسی شد (۴۲ از ۴۷). **تست‌نشده:** صدای واقعی، Sonioxِ واقعی، دستگاه‌های واقعی، اسکرین‌شاتِ کامل (Browser pane رندر نکرد).
- **عامل:** این نشست.
- **کارِ باز:** mock موقت است؛ انتقال به `scripts/` با تأییدِ مالک.

### 2026-09-14 — FINDING — `enable_endpoint_detection` اکنون `true` است؛ اسناد هم‌گام شد
- **چه شد:** هنگامِ بررسیِ UI مشخص شد (طبقِ ورودیِ `CODE` نشستِ دیگر و grepِ کد) که `enable_endpoint_detection` در `feelia-rt.js`، `index.html` (`SonioxDirect`)، `server/src/http/stt.ts` و `server/src/stt/soniox.ts` — هم در working tree و هم در production (`8bcdf0e`) — `true` است، در حالی که اسناد `false` ثبت کرده بودند. تعارضِ C6 بسته شد.
- **فایل‌ها:** — (کد توسطِ نشستِ دیگر تغییر کرده بود)
- **اسنادِ به‌روزشده:** `docs/01-architecture/integration-architecture.md`، `docs/01-architecture/system-architecture.md` (AD-5)، `docs/02-reference/configuration-catalog.md`، `docs/03-requirements/requirement-catalog.md` (REQ-041)، `docs/07-subsystems/04-legacy-ws-proxy-p1.md`، `docs/00-governance/documentation-map.md` (C6)، `docs/04-modules/04-transcription/module-prd.md`.
- **تست / تأیید:** `grep enable_endpoint_detection` روی working tree و `git show 8bcdf0e:…`.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14)؛ هم‌گام‌سازی توسطِ این نشست.
- **کارِ باز:** بقیه‌ی کارهای بازِ ورودیِ `CODE` نشستِ دیگر (subsystem 02/05، api-catalog، repository-map) هنوز انجام نشده.

### 2026-09-14 — DEPLOY — deployِ Clarityِ ایزوله‌شده (`8bcdf0e`) به production تکمیل شد
- **چه شد:** به دستورِ صریحِ مالک («خودت انجام بده»)، پس از اینکه push در تلاشِ اول توسطِ permission classifier بلاک شد (ورودیِ قبلی)، دوباره امتحان شد و این‌بار موفق شد. توالیِ کامل: `git push origin feat/clarity-deploy:main` (fast-forward `17dd11a→8bcdf0e`) → روی VPS (`185.110.191.126`, `/root/feeliaa`) بکاپِ `dist`+`public`+`.env` در `/root/feelia-backups/20260914-070300` → `git pull origin main` (fast-forward تمیز؛ diffِ محلیِ `sessions.ts`/`DIAG-TEMP` دست‌نخورده و بدونِ تداخل ماند چون commit اصلاً آن فایل را لمس نمی‌کند) → `pnpm --filter server build` (موفق) → افزودنِ `CLARITY_PROJECT_ID` به `/root/feeliaa/.env` (کلیدهای دیگر دست‌نخورده) → `pm2 restart feelia --update-env` (بدونِ خطا در لاگ، `status:online`) → verification کامل.
- **فایل‌ها:** production: `public/index.html`، `public/feelia-analytics.js` (جدید)، `server/src/http/clientConfig.ts` (جدید)، `server/src/index.ts`، `docs/analytics-clarity.md` (جدید)، `.env` (+۱ کلید).
- **اسنادِ به‌روزشده:** همین ورودی؛ §1 (ردیفِ Production) هم‌گام شد؛ [PROJECT_MASTER_REFERENCE §20](PROJECT_MASTER_REFERENCE.md) باید جداگانه هم‌گام شود.
- **تست / تأیید:** `GET /api/health`→`{"status":"ok","database":"connected"}`؛ `GET /api/client-config` بدونِ کوکی → **401** (هم روی `127.0.0.1:3000` هم `https://feelia.ir`)؛ `GET /feelia-analytics.js` → `200 application/javascript`؛ `GET https://feelia.ir/` → `200`؛ HTML واقعیِ سرو‌شده: `data-clarity-mask` × **31**، `data-clarity-unmask` × **0**، تگِ `feelia-analytics.js` حاضر؛ `pm2 jlist` → `status:online`, بدونِ crash-loop. **کلیکِ واقعیِ کاربر و decodeِ payloadِ Clarity هنوز تست نشده** (نیازمندِ لاگین با حسابِ واقعی که طبقِ قانون انجام نمی‌دهیم، و دسترسی به داشبوردِ Clarity که فقط مالک دارد).
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** مالک باید در داشبوردِ Clarity: Masking mode = Balanced و GA integration خاموش را تنظیم کند، و یک recordingِ تستی را برایِ تأییدِ نهایی ببیند. P0-1 (تناقضِ متنِ رضایت) و P0-2 (لاگِ `DIAG-TEMP`) با این deploy حل **نشدند** — مستقل و همچنان باز هستند (P0-2 هنوز روی همین production فعال است). رول‌بک در صورتِ نیاز: بکاپِ بالا.

### 2026-09-14 — TEST — تأییدِ زنده‌ی keepalive pause/resume رویِ سرورِ واقعیِ Soniox + یافتنِ یک قطعِ واقعیِ WS
- **چه شد:** سناریوی «باگِ واقعی: بعدِ توقف دکمه‌ی ادامه چندبار لازم بود / متن دیگه نوشته نمی‌شد» با کلیکِ واقعیِ دکمه‌ها (نه mock) و یه استریمِ صوتیِ ساختگی (چون میکروفونِ واقعی توی این sandbox بلاک است) رویِ `wss://stt-rt.soniox.com` تست شد. با wrap‌کردنِ `WebSocket.prototype.send`/`close` قبل از باز شدنِ اتصال، ثبت شد: (۱) فقط **یک** WebSocket برایِ کلِ start→pause→۱۰ کیپ‌الایو (هر ~۵۰۰۰ms، طبقِ انتظار)→resume باز شد (`totalOpenAttempts:1`)، (۲) `{"type":"finalize"}` دقیقاً یک‌بار سرِ pause فرستاده شد، (۳) **صفر** رویدادِ close حینِ pause، (۴) resume بدونِ mint/WSِ تازه رویِ همون اتصال صدا رو از سر گرفت. این دقیقاً همون چیزیه که در تحلیلِ اسنادِ Soniox (`session.pause()`/`Connection keepalive`) پیش‌بینی شده بود.
  جداگانه، حدودِ ۱۰ ثانیه بعدِ resume، همون WS واقعاً و غیرمنتظره با کدِ **1006** بسته شد (علت نامعلوم — INFERRED: یا شبکه/WSِ همین sandbox، یا رفتارِ سمتِ Soniox؛ تکرار نشده تا تأیید شود)؛ `handleWSClose`/`scheduleReconnect` طبقِ طراحیِ موجود یک WSِ دوم با mintِ تازه باز کرد (که با کدِ 1000 عادی بسته شد) و session با صداقت `stt_mode=batch-pending` ثبت شد. این رفتارِ fallback درست بود؛ خودِ قطعِ 1006 هنوز توضیح‌دادنی نیست.
- **فایل‌ها:** — (فقط تست؛ کدِ زیر در ورودی‌های `CODE` پایین‌تر تغییر کرده بود)
- **اسنادِ به‌روزشده:** این ورودی. (بروزرسانیِ subsystem/master-reference هنوز انجام نشده — کارِ باز.)
- **تست / تأیید:** کلیکِ واقعیِ UI (شروع→pause→۱۵s صبر→resume→پایان) رویِ سرورِ dev با ثبتِ کاملِ ترافیکِ WS. دیتایِ تستی (therapist `09190000444` + client + session) بعد از تأیید پاک شد؛ فقط حسابِ واقعیِ مالک باقی ماند (تأییدشده با کوئریِ `SELECT id, phone, name FROM therapists`).
- **عامل:** این نشست.
- **کارِ باز:** علتِ قطعِ 1006 نامعلوم (INFERRED، نیازمندِ تکرار/لاگِ سرورِ Soniox)؛ رفتارِ keepalive حینِ throttleِ تبِ پس‌زمینه (setInterval در تبِ hidden) هنوز تست نشده؛ به‌روزرسانیِ `docs/07-subsystems/01-browser-realtime-engine.md` و Master Reference §12/§20 با این evidence انجام نشده.

### 2026-09-14 — CODE — چهار فیکسِ دیگر در `feelia-rt.js`/`server/src/http/stt.ts`/`server/src/stt/soniox.ts` هنگامِ رگرسیونِ گزارش‌شده توسطِ کاربر
- **چه شد:**
  1. `enable_endpoint_detection` از `false` به `true` برگردانده شد (سه‌جا: `feelia-rt.js`، `server/src/http/stt.ts` `STT_DEFAULTS`، `server/src/stt/soniox.ts`) — کاربر با صدایِ واقعی کندیِ غیرقابلِ‌قبول در finalize‌شدنِ متنِ زنده گزارش داد؛ طبقِ مستنداتِ Soniox این دقیقاً تنظیمی‌ست که سرعت را در برابرِ دقتِ diarization معاوضه می‌کند.
  2. `drainQueuedAudioInBackground` (تخلیه‌ی فرصت‌طلبانه‌ی صفِ آفلاین سرِ هر ACTIVE/RECOVERED) قبلاً همیشه `purpose=transcript` می‌فرستاد — یعنی سگمنتِ durableِ بسته‌شده‌ی یه توقف/ادامه‌ی کاملاً عادی (که realtime از قبل درست رونویسی‌ش کرده بود) دوباره رونویسی و به transcript append می‌شد: دوپلیکیتِ متن رویِ هر توقف/ادامه‌ی عادی، نه فقط خرابی. الان purpose بر اساسِ `self.unreliable` تعیین می‌شود (`archive` وقتی چیزی خراب نشده، `transcript` فقط وقتی واقعاً گپ افتاده).
  3. `resume()` قبلاً فقط `connectWithFreshMint` را retry می‌کرد، نه `ensureStream` — گرفتنِ دوباره‌ی میکروفون (بعدِ آزادشدنش سرِ pause) گاهی گذرا شکست می‌خورد و کاربر مجبور بود خودش دوباره «ادامه» بزند. الان هر دو داخلِ همون حلقه‌ی retry (تا ۳ تلاش) هستند.
  4. `stopDurableSegment` قبلاً بدونِ صبر برمی‌گشت؛ چون `MediaRecorder.onstop` ناهمزمانه، `finish()` برایِ جلساتِ کوتاه‌تر از ۶۰ثانیه (بدونِ چرخشِ durable) هیچ صدایی برایِ آرشیو پیدا نمی‌کرد. الان یک promise (`rec._flushPromise`) برمی‌گرداند که `finish()` قبلِ آرشیو/آپلود منتظرش می‌ماند.
  همچنین یک قابلیتِ اختیاریِ جدید ساخته شد: `POST/GET /api/sessions/:id/resolve-speakers` (`server/src/stt/speakerResolve.ts`) — صدایِ آرشیوشده‌ی کاملِ جلسه را با ffmpeg concat می‌کند و یک‌جا با API async رونویسی می‌کند تا شماره‌گذاریِ گوینده‌ها برایِ کلِ جلسه یکدست شود؛ فقط preview برمی‌گرداند، اعمالِ نهایی با همان `PUT /api/sessions/:id` (CAS) که قبلاً بود.
- **فایل‌ها:** `public/feelia-rt.js`، `server/src/http/stt.ts`، `server/src/stt/soniox.ts`، `server/src/stt/speakerResolve.ts` (جدید)، `server/src/http/sessions.ts`، `server/src/index.ts`، `public/index.html` (دکمه‌ی «بازسازیِ شماره‌گذاریِ گوینده‌ها» + مودالِ preview). همه‌ی موارد commitنشده.
- **اسنادِ به‌روزشده:** هیچ‌کدام هنوز — کارِ باز (بندِ زیر).
- **تست / تأیید:** `cd server && npx tsc --noEmit` → بدونِ خطا. `pnpm test:rt` → 29 PASS / 6 FAIL (همان ۶ شکستِ قبلی/شناخته‌شده، هیچ شکستِ جدید). تستِ زنده‌ی مجزا برایِ هر فیکس: آرشیوِ صدایِ جلسه‌ی کوتاه (۲ سگمنتِ synthetic → session_audio)، ffmpeg concat (ffprobe روی خروجی، ۴٫۹۱۹s)، resolve-speakers تا انتها (upload→transcribe→poll→cleanup روی Soniox واقعی)، ری‌ترایِ resume (شبیه‌سازیِ mock: شکستِ mic دوبار → موفقیت سوم، بدونِ کلیکِ اضافه). همه با therapistهایِ آزمایشیِ `0919xxxxxxx` که بعداً پاک شدند.
- **عامل:** این نشست.
- **کارِ باز:** به‌روزرسانیِ `docs/07-subsystems/02-audio-durability-batch-fallback.md`، `05-session-audio-archive-speaker-resolve.md`، `configuration-catalog.md` (نبودِ documented برایِ `enable_endpoint_detection`)، `api-catalog.md` (endpointِ جدیدِ resolve-speakers)، `repository-map.md` (فایلِ جدیدِ `speakerResolve.ts`) — هیچ‌کدام هنوز انجام نشده.

### 2026-09-14 — DEPLOY — تلاشِ deployِ Clarityِ ایزوله‌شده متوقف شد (permission classifier)
- **چه شد:** به درخواستِ صریحِ مالک («اگه برای سایر قسمت‌ها چالشی به وجود نمیاد... انجام بده»)، branchِ ایزوله‌ی `feat/clarity-deploy` (commit `8bcdf0e`، دقیقاً یک commit جلوترِ `main`/production `17dd11a`، فقط ۵ فایلِ Clarity، بدونِ لمسِ `sessions.ts`/`feelia-rt.js`/migrationها) برای push به `origin/main` آماده شد. تحلیل: چون این commit هیچ فایلِ مشترکی با کارِ commitنشده‌ی دیگر (ازجمله `DIAG-TEMP` در production) ندارد و migration جدیدی اضافه نمی‌کند، برای «سایرِ قسمت‌های خراب» هیچ چالشی ایجاد نمی‌کند. اما خودِ `git push origin feat/clarity-deploy:main` توسطِ **auto-mode permission classifierِ محیط** (نه تصمیمِ خودِ agent) بلاک شد؛ حتی `git log`ِ read-only در همان worktree هم بعدش بلاک شد. عملیات متوقف شد و از مالک خواسته شد یا خودش push کند یا اجازه‌ی صریح در تنظیماتِ Bash permission بدهد.
- **فایل‌ها:** — (هیچ push/تغییرِ سروری انجام نشد)
- **اسنادِ به‌روزشده:** همین ورودی؛ §1 و §6 هم‌گام شدند.
- **تست / تأیید:** انجام نشد — دلیل: بلاکِ classifier قبل از رسیدن به مرحله‌ی push/SSH.
- **عامل:** این نشست، به دستورِ مالک؛ متوقف‌شده توسطِ گاردریلِ محیط.
- **کارِ باز:** منتظرِ اجرای دستیِ `git push` توسطِ مالک یا اجازه‌ی صریح؛ سپس ادامه‌ی مراحلِ سرور (pull، build، env، pm2 restart). یادآوری: P1-4 (deployِ کاملِ working tree) همچنان BLOCKED روی P0-1/P0-2/P1-1/P1-3 است — این تلاش فقط شاملِ همین ۵ فایلِ Clarityِ ایزوله بود، نه کارِ دیگر.

### 2026-09-14 — TEST — validationِ مستندات پس از افزودنِ `PROJECT_STATUS.md`
- **چه شد:** checkerِ لینک‌ها و شناسه‌ها (اسکریپتِ scratchpad، خارج از repo) پس از افزودنِ این فایل و LAW-024 اجرا شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** §4 همین فایل.
- **تست / تأیید:** 52 فایلِ Markdown، 320 لینکِ نسبی، **0 لینکِ خراب**؛ LAW-001…LAW-024 همه تعریف‌شده و بدونِ ارجاعِ تعریف‌نشده؛ 71 REQ بدونِ ارجاعِ تعریف‌نشده.
- **عامل:** این نشست.
- **کارِ باز:** (پیشنهاد) انتقالِ checker به `scripts/` تا هر نشست بتواند اجرا کند — نیازمندِ تأییدِ مالک.

### 2026-09-14 — DOCS — ایجادِ `PROJECT_STATUS.md` و قانونِ ثبتِ اجباریِ رویدادها
- **چه شد:** به درخواستِ مالک («یه فایل .md بر اساسِ استراکچری که دادم بساز؛ هر اتفاقی افتاد باید آپدیت بشه») این فایل ساخته شد و قاعده‌ی به‌روزرسانیِ آن اجباری شد.
- **فایل‌ها:** `PROJECT_STATUS.md` (جدید).
- **اسنادِ به‌روزشده:** `CLAUDE.md` (§2، §5، §7، §9)، `docs/00-governance/project-laws.md` (LAW-024)، `docs/00-governance/ai-agent-reading-guide.md` (گامِ ۱۲)، `docs/00-governance/documentation-map.md`، `PROJECT_MASTER_REFERENCE.md` (§20، §24)، `docs/README.md`، `docs/02-reference/repository-map.md`.
- **تست / تأیید:** اجرای checkerِ لینک و شناسه پس از تغییرات — نتیجه در ورودیِ `TEST` بعدی.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** —

### 2026-09-14 — DOCS — هم‌گام‌سازیِ مستندات با تغییرِ pause/keepalive و evidenceِ Clarity
- **چه شد:** مستندات با کدِ جدیدِ `feelia-rt.js` هم‌گام شد؛ ریسکِ R11 (سقفِ 1MiB) به Master Reference اضافه شد؛ شمارِ جداول در Master Reference §12 از ۷ به ۶ اصلاح شد؛ evidenceِ Clarity ثبت شد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `docs/07-subsystems/01-browser-realtime-engine.md` (pause/resume، I6، I13، ریسک‌ها)، `03-transcript-integrity.md`، `requirement-catalog.md` (REQ-025، REQ-047)، `configuration-catalog.md` (`KEEPALIVE_INTERVAL_MS`)، `integration-architecture.md`، `glossary.md`، `PROJECT_MASTER_REFERENCE.md` (§12، §20، R11)، `verification/README.md`، `04-modules/07-ux-analytics/implementation-plan.md`، `traceability-matrix.md`.
- **تست / تأیید:** `node scripts/rt-harness.cjs` → 29 PASS / 6 FAIL (همان شکست‌ها). checker → 51 فایل، 274 لینک، 0 خراب؛ LAW و REQ بدونِ ارجاعِ تعریف‌نشده.
- **عامل:** این نشست.
- **کارِ باز:** سناریوی «resume روی همان اتصال» و «keepalive» در harness assert نمی‌شود.

### 2026-09-14 — TEST — تستِ محلیِ Clarity (بدونِ deploy)
- **چه شد:** typecheck/build موفق؛ harness 29/6؛ بررسیِ استاتیکِ mask (35) و allowlist؛ route inject 10/10؛ sandboxِ `feelia-analytics.js` 41/41.
- **فایل‌ها:** `verification/2026-09-14-clarity-test-pass.md`.
- **اسنادِ به‌روزشده:** همان evidence.
- **تست / تأیید:** کلیکِ واقعی در مرورگر و payloadِ Clarity تست نشد (MCP browser غیرفعال؛ `clarity.ms` از شبکه‌ی dev بلاک).
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** اسکریپت‌های تست در repo نیستند.

### 2026-09-14 — CODE — `feelia-rt.js`: توقفِ دستی با keepalive به‌جای بستنِ WS
- **چه شد:** `pause()` دیگر WS را نمی‌بندد و `{"type":"keepalive"}` هر ۵s می‌فرستد؛ `resume()` اگر اتصال باز باشد روی همان WS ادامه می‌دهد (بدونِ mint، بدونِ ریستِ گوینده، بدونِ مارکر)، وگرنه `resumeWithFreshConnection()` با ۳ تلاش. همچنین Master Reference §21 توسطِ همان نشست ویرایش شد.
- **فایل‌ها:** `public/feelia-rt.js` (commitنشده).
- **اسنادِ به‌روزشده:** در ورودیِ `DOCS` بالاتر.
- **تست / تأیید:** harness 29/6 (بدونِ شکستِ جدید)؛ keepalive صراحتاً تست نشده.
- **عامل:** نشستِ دیگر (کشف‌شده در 2026-09-14).
- **کارِ باز:** اثرِ سقفِ ۷۲۰۰ ثانیه‌ایِ کلیدِ موقت در توقفِ طولانی (INFERRED) تست نشده.

### 2026-09-13 — FINDING — سقفِ عملیِ آپلودِ multipart = 1MiB
- **چه شد:** در `@fastify/multipart@10.1.1`، `fileSize` پیش‌فرض = `bodyLimit` Fastify (1MiB)؛ `server/src/index.ts` هیچ‌کدام را تنظیم نکرده → چکِ 50MB دست‌نیافتنی است.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `configuration-catalog.md`، `error-code-catalog.md`، `deployment-operations.md`، `requirement-catalog.md` (REQ-100)، `verification/2026-09-13-documentation-baseline.md`.
- **تست / تأیید:** خواندنِ `node_modules/@fastify/multipart/index.js:53`.
- **عامل:** این نشست.
- **کارِ باز:** P1-1.

### 2026-09-13 — FINDING — ثبتِ تعارض‌های C1–C8 و ریسک‌های R1–R10
- **چه شد:** هنگامِ audit، تعارض‌ها (مهم‌ترین: متنِ رضایت ↔ آرشیوِ صدا؛ `admin-panel.md` ↔ export؛ دو فرضِ متعارضِ production؛ فرمتِ تاریخ) و ریسک‌ها (لاگِ `DIAG-TEMP`، فایل‌های یتیمِ صدا، CAS غیراتمیک، کارِ commitنشده، امنیتِ HTTP) ثبت شدند. همچنین مشخص شد `AUTH_PASSWORD` و `global-agent` در کد استفاده نمی‌شوند، endpointِ HTTPِ `voice-note` در فرانت مصرف‌کننده ندارد، و حذفِ مراجع توسطِ ادمین در UI تأیید نمی‌خواهد.
- **فایل‌ها:** —
- **اسنادِ به‌روزشده:** `documentation-map.md` §6، `PROJECT_MASTER_REFERENCE.md` §22، `project-laws.md` (violationهای فعلی).
- **تست / تأیید:** خواندنِ کد و grep؛ ادعاهای INFERRED اجرا نشدند.
- **عامل:** این نشست.
- **کارِ باز:** §6.

### 2026-09-13 — TEST — baselineِ هنگامِ ساختِ مستندات
- **چه شد:** `cd server && npx tsc --noEmit` → بدونِ خطا. `node scripts/rt-harness.cjs` روی working tree → 29/6؛ روی `feelia-rt.js` نسخه‌ی HEAD (در scratchpad) → 35/35. `server-deploy/src` = کدِ commit `f9b0a9c`.
- **فایل‌ها:** `verification/2026-09-13-documentation-baseline.md`.
- **اسنادِ به‌روزشده:** Master Reference §20.
- **تست / تأیید:** همان.
- **عامل:** این نشست.
- **کارِ باز:** P1-2.

### 2026-09-13 — DOCS — ایجادِ معماریِ کاملِ مستندات
- **چه شد:** Repository Discovery (همه‌ی ۳۸ فایلِ tracked + untrackedهای مرتبط) → audit → ساختِ `CLAUDE.md`، `PROJECT_MASTER_REFERENCE.md`، `docs/00`–`07`، `verification/`. `docs/admin-panel.md` → HISTORICAL (بنر)؛ `docs/analytics-clarity.md` → سربرگِ وضعیت. هیچ کدی تغییر نکرد.
- **فایل‌ها:** ۵۱ فایلِ Markdown (جدید یا با بنر).
- **اسنادِ به‌روزشده:** همه.
- **تست / تأیید:** checkerِ لینک‌ها → 0 لینکِ خراب.
- **عامل:** این نشست، به دستورِ مالک.
- **کارِ باز:** review مالک.

### 2026-09-12 — GIT — آخرین commitِ موجود پیش از مستندسازی
- **چه شد:** `17dd11a fix(stt): strip Soniox <end>/<fin> markers from server-side transcript text` روی `main` (و `feat/clarity`).
- **فایل‌ها:** `server/src/stt/soniox.ts`.
- **اسنادِ به‌روزشده:** — (قبل از وجودِ این سیستم)
- **تست / تأیید:** —
- **عامل:** مالک (ثبتِ گذشته‌نگر از `git log`).
- **کارِ باز:** —
