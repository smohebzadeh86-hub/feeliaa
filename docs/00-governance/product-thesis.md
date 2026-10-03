# Product Thesis — ارزش، Core Functional Job و مسیرِ ساختِ محصول

> **وضعیت:** ACTIVE (جهتِ محصول، نوشته‌ی مالک) · **اعتبار:** HIGH برای «چه بسازیم و چه نسازیم»؛ **نه** مرجعِ وضعیتِ فعلیِ کد · تاریخ: 2026-10-02
> **جایگاه:** زیرِ [Laws](project-laws.md) و تصمیمِ صریحِ مالک؛ بالای backlog/planها. وضعیتِ واقعیِ پیاده‌سازی را [PROJECT_STATUS](../../PROJECT_STATUS.md) و کد تعیین می‌کنند ([source-of-truth](source-of-truth.md)).
> **کاربرد برای Agent:** قبل از پیشنهاد/ساختنِ هر feature جدید، **فیلترِ §۱۲** را اجرا کن و نسبتِ آن را با Core Loop (§۱۱) بگو. فعلاً وسواسِ اصلی = **Capture + Preserve**.

**خلاصه‌ی یک‌خطی:** جلسه را درست ثبت کن؛ داده را از دست نده؛ حافظه بساز.
*(Capture the session. Preserve the truth. Build the memory.)*

> اصلِ بنیادین: **Feature is not the product. The job the product reliably gets done is the product.**

---

## ۱. فیلیا چیست؟

- ❌ «یک ابزار AI برای تراپیست‌ها» — بیش از حد عمومی.
- ❌ «ابزارِ رونویسیِ جلساتِ روان‌درمانی» — فیلیا را به تکنولوژیِ فعلی محدود می‌کند.
- ✅ **فیلیا زیرساختِ دیجیتالِ قابل‌اعتماد برای ثبت، حفظ و تبدیلِ دادهٔ واقعیِ جلساتِ درمان به یک حافظه‌ی قابل‌استفاده برای درمانگر است.**

ابتدا باید اطمینان بدهد آنچه واقعاً در جلسه رخ داده تا حدِ ممکن **کامل، درست، قابل‌تفکیکِ گوینده و قابل‌دسترس** می‌ماند. بعد روی همین داده می‌توان ساخت: گزارش، مرورِ جلسه، روندِ درمان، پروندهٔ درمان، الگوها، تغییرات، ابهام‌ها، leverage pointها، supervision/formulation.

نقطه‌ی شروعِ تعریفِ فیلیا **AI نیست؛ Data Fidelity است.**

## ۲. کاربرِ اصلی و تضادِ مرکزی

**Primary user:** درمانگر / روان‌شناس / روان‌درمانگر — اما نه «درمانگری که نرم‌افزار می‌خواهد»؛ بلکه درمانگری که در جلسه باید **حاضر** باشد (گوش بدهد، رابطه بسازد، مداخله کند) و هم‌زمان بعداً به **حافظه و مستندسازیِ قابل‌اعتماد** نیاز دارد.

> Present باشد ↔ Remember & document باشد. فیلیا باید اصطکاکِ بین این دو را کم کند.

## ۳. مسئله (چهار لایه)

| لایه | مسئله |
|---|---|
| Cognitive Load | درمانگر هم‌زمان نمی‌تواند گوش بدهد، رابطه را نگه دارد، سؤالِ بعد را فکر کند، الگو ببیند، زمان را مدیریت کند **و** همه‌چیز را ثبت کند. هر ثبتِ دستی بخشی از توجه را می‌خورد. |
| Information Loss | بخشِ بزرگی از گفته‌ها فراموش، خلاصه، حذف یا به برداشتِ لحظه‌ای تقلیل می‌یابد. |
| Fragmentation | داده بین ذهن، کاغذ، فایل، پیام، note، transcript و report پخش می‌شود. |
| Longitudinal Loss | ارزشِ اصلیِ درمان در «تغییر در طولِ جلسات» است؛ بدونِ داده‌ی باکیفیت، لایه‌ی طولی ساخته نمی‌شود. |

## ۴. Core Functional Job

> در طول و بلافاصله پس از جلسه، دادهٔ واقعیِ جلسه را با **کمترین بارِ شناختی** برای درمانگر، **کامل، قابل‌اعتماد، قابل‌تفکیکِ گوینده و پایدار** جمع‌آوری و حفظ کن؛ تا بعداً برای مستندسازی، مرور و ساختنِ حافظه‌ی طولیِ درمان قابل‌استفاده باشد.

ترتیبِ اولویت: **۱) Capture** ← ۲) Preserve ← ۳) Structure ← ۴) Understand (تحلیل/AI) ← ۵) Assist.
**AI insight بدونِ data fidelity، محصولِ ناقص است.**

## ۵. Core چیست؟

**Best-in-class session data capture and preservation** — و مهم‌ترین تجلی‌اش: رونویسی با بیشترین completeness و speaker accuracy.

```
Audio/Input → Reliable Capture → High-quality Transcription → Correct Speaker Separation
            → Persistence → Recovery → Accessible Session Data
```

اگر این زنجیره خراب باشد، همه‌ی لایه‌های بعدی روی داده‌ی خراب ساخته می‌شوند.

### Core نیست (دائماً حفظ شود)
زیبایی UI · تعدادِ زیادِ AI feature · چت‌باتِ درمانگر · تولیدِ متنِ قشنگ · داشبوردِ پیچیده · نمودارِ زیاد · قابلیت‌های مدیریتیِ عمومی · automationهای جانبی · featureهای سرگرم‌کننده · هر چیزی که demo را جذاب می‌کند ولی کیفیتِ داده‌ی جلسه را بالا نمی‌برد. ممکن است مهم شوند، ولی خودشان Core نیستند.

### Feature Map (طبقه‌بندی)

| سطح | شامل |
|---|---|
| **Core** | ثبتِ صدا/جلسه، رونویسیِ realtime، رونویسیِ batch/fallback، speaker separation، multi-speaker context، persistence، recovery، transcript integrity، ذخیره‌ی داده‌ی جلسه |
| **Near-Core** | گزارشِ جلسه، داده‌ی ساختاریافته‌ی جلسه، بازبینیِ درمانگر، یادداشت‌ها، ورودی‌های پروندهٔ درمان |
| **Higher-order Intelligence** | پروندهٔ درمان، trajectory، الگوها، تم‌ها، عدم‌قطعیت، formulation، leverage points، supervision |
| **Operational** | ادمین، دیدِ کاربر/جلسه/ذخیره‌سازی، activity، مدیریتِ حساب — مهم است ولی Value Thesis نیست |

## ۶. Supporting Jobs

1. **Reduce Documentation Burden** — درمانگر مجبور نباشد همه‌چیز را دستی از حافظه بازسازی کند.
2. **Maintain Session Continuity** — بداند در جلساتِ قبل چه گذشت.
3. **Preserve Clinical Context** — اطلاعاتِ مهم گم نشود و قابل‌رجوع باشد.
4. **Transform Raw Data** — گزارش، نکاتِ مهم، خلاصه‌ی ساختاریافته، موضوعات، تغییرات، ابهام‌ها، پروندهٔ درمان.
5. **Support Longitudinal Thinking** — فقط جلسه‌ی امروز نه؛ روند را ببیند.

**Emotional Job:** «مطمئن باشم چیزِ مهمی را از دست نمی‌دهم»، «لازم نیست برای ثبت از مراجع فاصله بگیرم»، «پرونده‌ام حافظه‌ی قابل‌اعتمادِ کارم است نه مشتی متنِ پراکنده». بخشِ بزرگی از ارزش = **کاهشِ ترسِ فراموش‌کردن**.

**Social/Professional Job:** «کارم مستند، منظم و قابل‌مرور باشد بدونِ اینکه مستندسازی کیفیتِ رابطه‌ی درمانی را خراب کند.» (آینده: supervision، quality review، case continuity، research، team workflows — ولی فعلاً Core را متورم نکنند.)

## ۷. Value Creation و چرا کیفیتِ داده راهبردی است

```
Before: Session → therapist remembers selected parts → manual notes → partial documentation → information loss → weak longitudinal memory
With:   Session → captured → transcript + speaker attribution → reliable persistence → structured info
        → session memory → longitudinal case memory → AI assistance → better access for the therapist
```

فیلیا ابتدا «AIِ تولیدکننده‌ی insight» نیست؛ **سیستمِ حافظه‌ی قابل‌اعتمادِ جلسه** است.

زنجیره‌ی شکست: transcript ناقص ⇒ AI خراب · speaker separation خراب ⇒ معنا خراب · ذخیره‌سازی خراب ⇒ history خراب ⇒ case file خراب ⇒ longitudinal intelligence خراب.

> Data quality یک نگرانیِ مهندسیِ زیرِ محصول نیست؛ **خودش بخشی از ارزشِ محصول است.**

## ۸. تجربه‌ی ایده‌آل (Chesky lens — ابزارِ فکری، نه roadmap)

| ستاره | تجربه |
|---|---|
| 5 | شروعِ جلسه، رونویسیِ روشن، پایان، transcript، report. خوب، ولی غیرمعمولی نیست. |
| 7 | بدونِ نوشتنِ تقریباً هیچ‌چیز: transcript کامل، speaker درست، timestamp، چیزی گم نشده، قطعِ اینترنت/reconnect داده را خراب نکرده، نیازی به «نجاتِ transcript» نیست، report آماده. *«جلسه را زندگی کردم؛ فیلیا حافظه‌اش را نگه داشت.»* |
| 8–9 | خروجی شاملِ: What happened · What changed · What remains unresolved · What became clearer · What needs attention · Possible leverage points — همه **traceable به داده‌ی خامِ جلسه**. |
| 11 | درمانگر بعد از ماه‌ها به پرونده نگاه می‌کند: «این سیستم حافظه‌ی درمانِ من شده.» می‌بیند: Session → Evidence → Pattern → Change → Formulation → Leverage Point، بدونِ بازخوانیِ همه‌ی جلسات. |

**هشدار:** 11-star یعنی «۳۰ feature فردا» نه. پرسش: *کوچک‌ترین بخشِ واقعیِ این تجربه که امروز می‌توانیم فوق‌العاده بسازیم چیست؟* پاسخِ فعلی: **Perfect the session data layer.**

### جایگاهِ Leverage Points
Summary می‌گوید «چه شد»؛ Case formulation می‌پرسد «چه الگویی شکل می‌گیرد»؛ Leverage point می‌پرسد «کجا می‌توان روی الگو اثر گذاشت». مسیر: `Session Data → Pattern → Formulation → Leverage Point`. آینده‌ی بسیار طبیعیِ فیلیاست ولی **نباید با Core Data Capture اشتباه شود.**

## ۹. Paul Graham lens: Make something people want

- سؤالِ درست «چه AI featureِ دیگری اضافه کنیم؟» نیست؛ این است: **«کدام دردِ درمانگر آن‌قدر واقعی است که اگر حل شود هر هفته از فیلیا استفاده کند؟»**
- **Start narrow:** فعلاً نه clinic management، billing، CRM، scheduling، telehealth، research platform، full AI therapist. فقط: *جلسه‌ی درمان را از نظرِ داده‌ای به بهترین شکل capture کنیم.*
- **Do things that don't scale:** درمانگرِ واقعی فقط «کاربرِ تست» نیست؛ منبعِ حقیقتِ یادگیریِ محصول است. «اینجا speaker را اشتباه کرد» / «این بخشِ مهم را جا انداخت» / «report چیزی نوشته که transcript پشتیبانی نمی‌کند» = آموزشِ Core.

### Feedback Loop واقعی
```
Real Session → Captured Data → Transcript → Therapist Feedback → Error/Failure Identification
→ Engineering Improvement → Better Capture → More Trust → More Usage → More Real Data → Better Product
```
این loop مهم‌تر از هر feature roadmapی است.

## ۱۰. Moat بالقوه

«ما هم AI داریم» moat نیست. ترکیبِ این‌ها است: **۱)** Session Data Quality (شناختِ failure modeهای رونویسیِ فارسیِ واقعی) · **۲)** Speaker Attribution در محیطِ واقعیِ درمان · **۳)** Reliability (قطعِ اینترنت، reconnect، fallback، persistence، recovery بدونِ از دست دادنِ داده) · **۴)** Longitudinal Data Structure · **۵)** Therapist Feedback Data (مهم/نامهم/اشتباه) · **۶)** Product Understanding (آنچه درمانگر در عمل می‌خواهد، نه فقط آنچه در مصاحبه می‌گوید).

## ۱۱. North Star، Promise و Core Loop

- **North Star:** *The highest-fidelity digital memory of a therapy session, transformed into useful longitudinal context for the therapist.* — قابل‌اعتمادترین حافظه‌ی دیجیتال از جلسه‌ی درمان، که به مرور به حافظه‌ی طولیِ قابل‌استفاده‌ی درمانگر تبدیل می‌شود.
- **Promise:** تو روی جلسه تمرکز کن؛ فیلیا حافظه‌ی آن را نگه می‌دارد.
- **نسخه‌ی یک‌جمله‌ای:** فیلیا کمک می‌کند درمانگر بدونِ قربانی‌کردنِ حضورش در جلسه، حافظه‌ای کامل و قابل‌اعتماد از جلساتِ درمان داشته باشد و آن را به مرور به اطلاعاتِ قابل‌استفاده درباره‌ی روندِ درمان تبدیل کند.
- **Core Loop (قلبِ محصول):**

```
Session starts → Capture → Transcribe → Separate speakers → Persist reliably → Recover if needed
→ Structure → Review → Add to longitudinal memory → Next session starts with better context
```

سه چیز قاطی نشوند: **Core Functional Job** (کارِ کاربر: ثبت و حفظِ اطلاعاتِ مهم) · **Product Core** (آنچه باید exceptional ساخت: reliable high-fidelity capture) · **Future Value Layer** (آنچه بعداً روی داده انجام می‌شود: longitudinal intelligence).

## ۱۲. اصولِ تصمیم

### آنچه هرگز نباید بشکند (What Must Never Break)
| اصل | معنا |
|---|---|
| Data Integrity | دادهٔ واقعیِ جلسه silently overwrite نشود |
| Completeness | transcript تا حدِ ممکن کامل |
| Speaker Accuracy | identityِ گوینده تصادفی جابه‌جا نشود |
| Persistence | داده با refresh، reconnect یا state transition ناپدید نشود |
| Recoverability | Failure ≠ data loss |
| Traceability | AI چیزی را fact معرفی نکند که در داده‌ی اصلی پشتوانه ندارد |
| Therapist Control | تفسیرِ AI جای قضاوتِ درمانگر را نگیرد |

### فیلترِ هر feature
۱) کیفیتِ session data را بهتر می‌کند؟ ۲) بارِ شناختیِ therapist را کم می‌کند؟ ۳) ارزشِ longitudinal memory را بالا می‌برد؟ ۴) به Core Loop کمک می‌کند؟
**اگر هیچ‌کدام: احتمالاً الان نباید ساخته شود.**

### Decision rule برای ۶–۱۲ ماه
`Capture → Preserve → Understand → Assist` — و در مرحله‌ی فعلی **Capture + Preserve وسواسِ اصلی‌اند**؛ زودتر از موعد سراغِ Understand/Assist نرویم وقتی دادهٔ پایه هنوز perfect نیست.

### فیلیا نباید چه بشود
«هر چیزی که یک therapist ممکن است روزی لازم داشته باشد» ⇒ EHR + CRM + Calendar + AI Chat + Notes + Billing + Dashboard + Analytics و محوِ Core. پرسشِ همیشگی: *What are we uniquely obsessed with?* پاسخ: **Getting the therapy-session data right.**

## ۱۳. تکاملِ محصول

| فاز | تمرکز |
|---|---|
| 1 — Session Assistant | کمک قبل/بعد جلسه، report، مرورِ اطلاعات، AI assistance |
| 2 — Session Intelligence | transcription، speaker separation، داده‌ی ساختاریافته، report generation |
| 3 — **Reliable Session Memory** | آنچه در جلسه رخ داده نباید به‌سادگی از بین برود؛ reliability خودش محصول است |
| 4 — Longitudinal Clinical Memory | patterns، changes، themes، unresolved questions، trajectory، case file |
| 5 — Therapist Intelligence | «در طولِ زمان چه در حال رخ دادن است؟» و «کجا ممکن است leverage point باشد؟» |

**موقعیتِ فعلی (جهتِ مالک):** ورودِ فاز 3 با بخشِ بزرگی از زیرساختِ Core ساخته‌شده؛ Case File = یکی از *اولین مصرف‌کننده‌های* دادهٔ باکیفیتِ Core، نه جانشینِ Core.

## ۱۴. Metrics و Evidence Ladder

**Metrics (باید مستقیماً به Core وصل باشند):** Capture Reliability (٪ جلسه بدونِ data loss) · Transcript Completeness · Speaker Accuracy · Recovery Success · Therapist Correction Rate · Trust (٪ که دوباره استفاده می‌کنند) · **Repeat Usage** (مهم‌ترین).

**Evidence Ladder** (با «دمو خوب بود» یا «AI باحال جواب داد» خودمان را گول نزنیم):
1. therapist می‌گوید useful است → 2. دوباره استفاده می‌کند → 3. جلساتِ بیشتری ثبت می‌کند → 4. workflow خودش را حولِ آن تغییر می‌دهد → 5. به therapistِ دیگر معرفی می‌کند → 6. حاضر است پول بدهد.

## ۱۵. Thesis و Final Statement

> اگر بتوانیم دادهٔ واقعیِ جلسه‌ی درمان را بهتر از ابزارهای موجود capture، transcribe، speaker-separate و preserve کنیم، می‌توانیم روی آن یک لایه‌ی longitudinal intelligence بسازیم که ارزشمندتر از یک transcript ساده است.

`High-fidelity capture → Reliable session memory → Structured clinical context → Longitudinal case memory → Therapist intelligence`

| | |
|---|---|
| What we build | سیستمِ قابل‌اعتماد برای ثبت و حفظِ دادهٔ جلسه‌ی درمان |
| Why it matters | درمان «حضور» می‌خواهد؛ مراقبتِ خوب «حافظه» هم |
| What makes it valuable | حافظه‌ی کامل، قابل‌اعتماد و speaker-aware |
| What it enables | report، case file، فهمِ طولی و در نهایت therapist intelligence |
| Obsess over now | کیفیتِ دادهٔ جلسه |
| Earn the right to build later | Longitudinal therapeutic intelligence |

**رونویسی پایانِ فیلیا نیست؛ دروازه‌ی فیلیاست.** داده‌ی بهتر → حافظه‌ی بهتر → intelligence بهتر. نه «AI بیشتر»، نه «feature بیشتر»، نه «dashboard بیشتر».

---

## ۱۶. نگاشت به ساختارِ فعلیِ repo (بازبینی‌شده 2026-10-02)

> این بخش **تفسیرِ نگارنده‌ی سند** است (نه بخشی از متنِ مالک) تا thesis با اسنادِ مالکِ fact وصل شود. هر ادعای وضعیتی را از سندِ مالکش تأیید کن.

| مفهومِ thesis | مالکِ فنی در repo |
|---|---|
| Reliable Capture / realtime | [01-browser-realtime-engine](../07-subsystems/01-browser-realtime-engine.md) |
| Persistence / Recovery / batch fallback | [02-audio-durability-batch-fallback](../07-subsystems/02-audio-durability-batch-fallback.md)، [06-audio-upload-pipeline](../07-subsystems/06-audio-upload-pipeline.md) |
| Transcript integrity («silently overwrite نشود») | [03-transcript-integrity](../07-subsystems/03-transcript-integrity.md) (CAS) |
| Speaker separation / نقشِ گوینده | [05-session-audio-archive-speaker-resolve](../07-subsystems/05-session-audio-archive-speaker-resolve.md)، [08-session-record](../07-subsystems/08-session-record.md) |
| Structure / «متنِ نهایی» | [07-final-transcript](../07-subsystems/07-final-transcript.md) |
| Longitudinal memory (Case File) | [08-ai-case-file](../04-modules/08-ai-case-file/module-prd.md)، [09-treatment-unit](../04-modules/09-treatment-unit/module-prd.md) |
| Traceability / Therapist Control | [content-style-guide](../04-modules/08-ai-case-file/content-style-guide.md)، [llm-provider-layer](../06-platform/llm-provider-layer.md) |

**شکاف‌هایِ مشاهده‌شده (برای تصمیمِ مالک، بدونِ اقدام):**
1. **Metricهای §۱۴ سیستماتیک اندازه‌گیری نمی‌شوند** — فقط معیارهای کیفیتِ per-sessionِ transcript (coverage/gaps/speakers، commit `061d0ca`) دیده شد؛ Capture Reliability، Recovery Success، Correction Rate و Repeat Usage به‌عنوانِ متریکِ محصولی **UNVERIFIED/غایب** است.
2. **«Therapist Feedback Data» (moat §۱۰)** مکانیزمِ ثبتِ ساختاریافته‌ی بازخوردِ درمانگر (مهم/نامهم/اشتباه) در این سند به‌عنوان feature تعریف نشده؛ اگر قرار است Core Loop را تغذیه کند، نیازمندِ PRD و هماهنگی با [LAW-001/009](project-laws.md) (حریم/رضایت) است.
3. **Supporting layerهای فعلی** (ادمین، analytics/Clarity) طبقِ §۵ «Operational»‌اند؛ هر توسعه‌ی بیشترِ آن‌ها باید فیلترِ §۱۲ را رد کند.
4. «Leverage Points / Supervision» (§۸، §۱۳ فاز 5) صراحتاً **Future Value Layer**‌اند؛ تا زمانِ perfect شدنِ Capture+Preserve، شروعِ آن‌ها خلافِ Decision Rule است.
