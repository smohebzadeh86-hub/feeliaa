# Requirement Catalog

> **وضعیت سند:** ACTIVE-CANONICAL · **همه‌ی REQها در 2026-09-13 = `DERIVED`** (از کدِ working tree استخراج شده‌اند؛ هیچ‌کدام توسطِ مالک APPROVED نشده). قاعده‌ی تعارض: [source-of-truth §2.1](../00-governance/source-of-truth.md).
> IDها پایدارند؛ بلوک‌ها با فاصله شماره‌گذاری شده‌اند (01x حساب، 01x…). REQِ حذف‌شده `RETIRED` می‌شود، نه پاک.

**Impl:** `IMPL` = کد موجود و خوانده شد · `PARTIAL` = ناقص · `CONTRADICTED` = رفتار با قانون/متنِ دیگری تعارض دارد · `LEGACY`.
**Test/Verification:** جزئیات در [traceability-matrix](traceability-matrix.md).

## 01 — Therapist Accounts ([PRD](../04-modules/01-therapist-accounts/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-001 | ثبت‌نام با موبایلِ ایران؛ نرمال‌سازی به `09XXXXXXXXX` (پذیرشِ `+98`، `0098`، `98`، فاصله/خط‌تیره، ارقامِ فارسی/عربی)؛ شماره‌ی تکراری → 409 | `http/auth.ts` (`normalizePhone`، `toLatinDigits`) | IMPL — رفعِ ارقامِ فارسی/عربی 2026-09-14، commit شده در `ecf00b4`؛ ۱۱/۱۱ تست ([UI-03](../05-plans/ui-ux-audit-2026-09-14.md)) |
| REQ-002 | رمز ≥ ۸ کاراکتر؛ ذخیره فقط به‌صورتِ scrypt با salt تصادفی | `http/auth.ts`، `auth/password.ts` | IMPL |
| REQ-003 | نام و تخصص الزامی (فقط ثبت‌نامِ جدید، D3، 2026-09-15)؛ ایمیل اختیاری، اعتبارسنجی و lowercase | `http/auth.ts` | IMPL |
| REQ-004 | ورود با موبایل+رمز؛ پیامِ خطای یکسان؛ زمانِ پاسخ برای شماره‌ی ناموجود با هشِ ساختگی یکسان‌سازی می‌شود | `http/auth.ts` | IMPL |
| REQ-005 | حسابِ غیرفعال: login → 403؛ نشست‌های موجود از درخواستِ بعدی بی‌اعتبار | `auth/guard.ts`، `auth/session.ts` | IMPL |
| REQ-006 | نشست: کوکیِ httpOnly، sameSite=lax، ۳۰ روز؛ فقط SHA-256 توکن در DB | `auth/guard.ts`، `auth/session.ts` | IMPL |
| REQ-007 | خروج: حذفِ نشستِ سرور و پاک‌کردنِ کوکی | `http/auth.ts` | IMPL |
| REQ-008 | شماره‌ی `ADMIN_PHONE` در register/login خودکار ادمین می‌شود | `http/auth.ts` | IMPL |

## 02 — Client Management ([PRD](../04-modules/02-client-management/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-010 | تراپیست فقط مراجعینِ خودش را می‌بیند/تغییر می‌دهد؛ غیرمالک → 404 | `http/clients.ts`، `db/ownership.ts` | IMPL |
| REQ-011 | کدِ یکتای خودکار `CL-XXXX` بدونِ کاراکترهای مبهم؛ نام مستعار اختیاری | `http/clients.ts` | IMPL |
| REQ-012 | دسته‌ی اختیاری `child/teen/adult`؛ جنسیت `f/m` فقط برای teen/adult و در غیرِ این صورت پاک | `http/clients.ts`، migration 008/009 | IMPL (commit شده در `2763414`) |
| REQ-013 | وضعیت فعال/غیرفعال فقط دستی؛ دلیل فقط برای غیرفعال و با فعال‌سازی پاک | `http/clients.ts` | IMPL (پایه در `2763414`؛ trim/۲۰۰کاراکتر/404-بعدِ-حذف در `54a17fd`، 2026-09-15) |
| REQ-014 | حذفِ مراجع آبشاری (جلسات/یادداشت‌ها) با شمارشِ اثر | `http/clients.ts` | IMPL (فایلِ صدا: نگاه کنید REQ-093) |
| REQ-015 | فهرستِ مراجعین با تعدادِ جلسه و تاریخِ آخرین جلسه؛ تبِ فعال/غیرفعال، فیلترِ دسته/جنسیت، جستجوی کد/نام، مرتب‌سازی | `http/clients.ts`، `index.html` | IMPL |
| REQ-016 | «مراجع جدید» وضعیتِ تبِ جاری را می‌گیرد؛ در تبِ غیرفعال دلیل (پیش‌فرض «نامشخص» → null) انتخاب می‌شود و مراجع در همان تب می‌ماند | `http/clients.ts` POST، `index.html` `showNewClientModal`/`createNewClient` | IMPL (2026-09-14، commit شده در `54a17fd` (2026-09-15)، هنوز deploy نشده) |
| REQ-017 | پرونده با وضعیت یکدست است: مراجعِ غیرفعال وضعیت/دلیل و «بازگرداندن» را می‌بیند و جلسه‌ی زنده‌ی جدید نمی‌گیرد (سرور 409 `client-inactive`) | `http/sessions.ts` POST، `index.html` `openClientDetail` | IMPL (2026-09-14، commit شده در `54a17fd` (2026-09-15)، هنوز deploy نشده) |
| REQ-018 | صفحه‌ی اولِ مراجعین فقط مراجعِ فعالِ «امروزِ شمسیِ تهران ثبت‌شده یا امروز جلسه‌داشته» + سنجاق‌شده‌ها را نشان می‌دهد؛ جست‌وجو در همین صفحه رویِ کلِ مراجعین (فعال+غیرفعال) کار می‌کند | `http/clients.ts` GET (SELECT `pinned_at`)، `index.html` `renderTodayClientsView`، `isTodayClient`، `jalaliDayTehran` | IMPL (2026-09-16، commit نشده) |
| REQ-019 | سنجاق/برداشتنِ سنجاقِ مراجعِ فعال از منویِ کارت؛ غیرفعال‌کردنِ مراجعِ سنجاق‌شده سنجاق را هم پاک می‌کند (سرور، اتمیک با همان UPDATE)؛ صفحه‌ی جداگانه‌ی «همه‌ی مراجعین» منطقِ قبلیِ REQ-015 (تب/فیلتر/جستجو/مرتب‌سازی) را با سربرگ‌هایِ تاریخیِ اضافه نگه می‌دارد | `http/clients.ts` PATCH `/:id/pin`، PATCH `/:id/status`؛ `index.html` `togglePinClient`، `renderAllClientsView`، `historyBucket` | IMPL (2026-09-16، commit نشده) |

## 03 — Therapy Sessions ([PRD](../04-modules/03-therapy-sessions/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-020 | بدونِ رضایتِ صریحِ مراجع جلسه‌ی **زنده** ساخته نمی‌شود (سرور 400، UI قفل)؛ ثبتِ دستیِ بدونِ ضبط (REQ-032) مستثناست | `http/sessions.ts`، `setConsent` | IMPL |
| REQ-021 | شماره‌ی جلسه برای هر مراجع خودکار افزایشی و یکتا | `http/sessions.ts`، migration 002 | IMPL (غیراتمیک) |
| REQ-022 | دکمه‌ی شروع فقط به رضایت + میکروفون وابسته است؛ بررسیِ STT غیرمسدودکننده | `updateStartButtonState`، `runPreflight` | IMPL |
| REQ-023 | جلسه‌ی `completed/canceled` کلیدِ realtime و صدای transcript/note نمی‌پذیرد | `http/stt.ts`، `http/sessions.ts` | IMPL |
| REQ-024 | ادامه بعد از reload: شناسه‌ی جلسه‌ی فعال در localStorage؛ بنرِ ادامه؛ متن از prefixِ DB ادامه می‌یابد | `checkActiveSessionBanner`، `liveResumeSession`، `RTSession.start` | IMPL |
| REQ-025 | توقف/ادامه‌ی دستی؛ توقف فقط از ACTIVE/RECOVERED؛ میکروفون آزاد و تایمر متوقف؛ اتصالِ Soniox با keepalive باز می‌ماند و ادامه روی همان اتصال انجام می‌شود (بدونِ ریستِ گوینده)؛ اگر اتصال بسته شده باشد، mint/WS تازه با حداکثر ۳ تلاش | `RTSession.pause/resume/resumeWithFreshConnection`، `startKeepalive`، `rtOnState` | IMPL (تغییرِ 2026-09-14، commit شده در `2763414`) |
| REQ-026 | پایانِ جلسه → Wrapup؛ `status=completed` بلافاصله پس از finish و دوباره در «ذخیره و پایان» | `endNewRTSession`، `finishSession` | IMPL |
| REQ-027 | لغوِ جلسه متن را دور می‌ریزد و ردیفِ جلسه را حذف می‌کند | `confirmCancelSession` | IMPL |
| REQ-028 | مدتِ جلسه هر ۱۰ ثانیه ذخیره می‌شود | `persistDuration` | IMPL |
| REQ-029 | مشاهده‌ی متن و یادداشت‌های جلسه؛ ویرایشِ تاریخ/ساعت؛ حذفِ جلسه. تاریخ همیشه شمسیِ `YYYY/MM/DD` و ساعت `HH:MM` (ارقامِ لاتین)؛ ورودیِ نامعتبر → 400 | `viewTranscript`، `saveSessionMeta`، `DELETE /api/sessions/:id`، `http/sessionDate.ts` | IMPL (C4 رفع در working tree، 2026-09-14، commit شده در `54a17fd` (2026-09-15)، هنوز deploy نشده) |
| REQ-030 | هشدارِ خروج بدونِ ذخیره؛ هشدارِ مرورگر هنگامِ اتصالِ باز | `showExitWarning`، `beforeunload` | IMPL |
| REQ-031 | هشدار وقتی صدا فعال است ولی ۲۰ ثانیه متنی نمی‌آید | `startSttWatchdog` | IMPL |
| REQ-032 | ثبتِ دستیِ جلسه‌ی گذشته برای آرشیوِ پرونده‌های قبلی: تاریخ/ساعت **اختیاری** (خالی → وقتِ ایران، تصمیمِ مالک 2026-09-14)؛ جلسه بلافاصله `completed` با `source=manual` ساخته می‌شود (بدونِ فرمِ میانی — REQ-033) | `http/sessions.ts` POST `mode:"manual"`، migration 012، `index.html` `startManualSessionFlow` | IMPL |
| REQ-033 | «ثبتِ جلسه‌ی گذشته» بدونِ فرمِ میانی، مستقیم جلسه می‌سازد و صفحه‌اش را باز می‌کند؛ صفحه‌ی جلسه یک **screenِ مستقل** است (نه بخشِ inlineِ داخلِ پرونده — بدونِ اسکرولِ اجباری)؛ از ابتدا هم «یادداشتِ صوتی» هم «یادداشتِ متنی» را کنارِ هم دارد؛ برایِ جلسه‌ی دستی تاریخ/ساعت مستقیم و inline (نه پشتِ دکمه‌ی «ویرایش»ِ بی‌معنی) قابلِ‌تنظیم است؛ یادداشتِ صوتی توقف/ادامه دارد (مثلِ جلسه‌ی زنده) — همان مسیرِ صوتیِ Wrapup (FeeliaRT/legacy WS + صفِ durable)، با state/DOMِ کاملاً جدا تا به جلسه‌ی زنده دست نزند؛ رضایتِ مراجع موضوعیت ندارد (صدای خودِ تراپیست است، نه ضبطِ مراجع) | `index.html` `startManualSessionFlow`، `viewTranscript`، `saveManualDateTime`، `startArchiveVoiceNote(Direct)`، `pauseArchiveVoiceNote`، `resumeArchiveVoiceNote`، `archiveVoiceOnState`، `stopArchiveVoiceNote(Direct)`، `addArchiveTextNote`، `cleanupArchiveVoice` | IMPL |

## 04 — Transcription ([PRD](../04-modules/04-transcription/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-040 | کلیدِ اصلیِ Soniox هرگز به مرورگر نمی‌رسد؛ برای هر اتصال کلیدِ موقتِ single-use (۱۲۰s/۷۲۰۰s) فقط برای جلسه‌ی مالک و پایان‌نیافته؛ حداکثر ۳۰ mint/دقیقه | `http/stt.ts`، `stt/tempkey.ts` | IMPL |
| REQ-041 | پیکربندیِ realtime: `stt-rt-v5`، فارسی، language id، diarization، **با** endpoint detection (سرعتِ finalize بر دقتِ diarization مقدم شد — 2026-09-14) | `feelia-rt.js`، `http/stt.ts`، `stt/soniox.ts` | IMPL (همه‌ی مسیرها یکسان) |
| REQ-042 | متنِ confirmed در reconnect حفظ و interim دور ریخته می‌شود | `scheduleReconnect` | IMPL |
| REQ-043 | reconnect با backoff ۱/۲/۴/۸ ثانیه، حداکثر ۴؛ بعد FAILED ولی ضبط ادامه دارد؛ offline→NETWORK_PAUSED | `scheduleReconnect`، `watchOnline` | IMPL |
| REQ-044 | شروع fail-open: شکستِ mint → ضبطِ durable-only و batch پس از پایان | `RTSession.start` | IMPL |
| REQ-045 | autosave هر ۵s با CAS؛ روی 409 rebase (طولانی‌تر برنده)؛ هشدار پس از ۳ شکستِ پیاپی | `startAutosave`، `persistConfirmed` | IMPL (CAS سرور غیراتمیک) |
| REQ-046 | realtimeِ unreliable → آپلودِ سگمنت‌ها با `purpose=transcript`، رونویسیِ `stt-async-v5`، **append** به متن؛ `finish` منتظرِ drain نمی‌ماند | `finish`، `uploadBatchSegments`، `processBatchQueue`، `mergeBatchTranscript` | IMPL (harness WT: FAIL) |
| REQ-047 | در هر اتصالِ تازه‌ی Soniox (reconnect، یا resume پس از بسته‌شدنِ اتصال) مارکرِ ناپیوستگی در متن؛ برچسبِ گوینده per-generation و بدونِ ادغام؛ توقف/ادامه‌ی عادی روی همان اتصال مارکر نمی‌گیرد | `noteDiscontinuity`، `connectWithFreshMint`، `handleSonioxMessage` | IMPL |
| REQ-048 | بازسازیِ اختیاریِ گوینده‌ها فقط برای جلسه‌ی completed با صدای آرشیو، با کلیکِ صریح، پیش‌نمایش، اعمال با CAS؛ نیازمندِ ffmpeg | `speakerResolve.ts`، `startResolveSpeakersUI`، `applyResolvedSpeakers` | IMPL (commit شده در `2763414`) |
| REQ-049 | مارکرهای `<end>`/`<fin>` از متنِ نمایش/ذخیره حذف می‌شوند | `cleanText`، `buildTextFromTokens` | IMPL (async بدونِ حذف — UNVERIFIED اثر) |
| REQ-050 | فایل و transcription در Soniox پس از رونویسیِ async حذف می‌شوند | `transcribeFileAsync` | IMPL |
| REQ-051 | مسیرهای جایگزین (`SonioxDirect`، `/ws/t`، `/ws/voice`) فقط وقتی FeeliaRT در دسترس نیست | `startSession`، `startVoiceNote` | LEGACY |
| REQ-052 | abort از هر state بدونِ promiseِ معلق یا نشتِ mic/WS/recorder؛ صفِ صدای جلسه پاک می‌شود | `RTSession.abort` | IMPL |
| REQ-053 | finish مبتنی بر رویدادِ `finished` با timeoutِ صریحِ ۸s | `RTSession.finish` | IMPL |
| REQ-054 | mint یا WS دیررس پس از finish/abort نادیده گرفته و بسته می‌شود | `connEpoch`، `openDirectWS` | IMPL |
| REQ-055 | (2026-09-23، دستورِ مالک) تراپیست می‌تواند فایلِ صوتیِ جلسه‌ای را که بیرون از فیلیا ضبط شده آپلود کند؛ هر فایل یک جلسه‌ی تازه (`source='upload'`) با تأییدِ صریحِ رضایت می‌سازد؛ فرمت‌هایِ رایج (از جمله amr/3gp/wma/ویدیوی mp4) بدونِ تبدیلِ دستی؛ حداکثر ۱GB و ۳۰۰ دقیقه | `features/audio-upload/*`، `feelia-upload.js` | IMPL |
| REQ-056 | آپلود تکه‌تکه (۴MB) و قابلِ ادامه است: قطعیِ شبکه/رفرش/بستنِ تب هرگز از صفر شروع نمی‌کند؛ انتخابِ فایل در حالتِ آفلاین تا وصل‌شدن منتظر می‌ماند؛ همان فایل دوباره ثبت نمی‌شود | `feelia-upload.js`، `uploads.routes.ts`، `uploadStore.ts` | IMPL (فقط تستِ mock/UI) |
| REQ-057 | بعد از «دریافت شد» پردازش کاملاً سمتِ سرور و مستقل از مرورگر است؛ jobِ DB-محور با lease؛ ری‌استارت هیچ jobی را گم نمی‌کند | `jobRunner.ts` | IMPL (هارنس؛ ری‌استارتِ واقعی تست نشد) |
| REQ-058 | متنِ هر فایل دقیقاً یک بار ثبت می‌شود (retry/کرش ⇒ بدونِ تکرار)؛ فقط append، هرگز جایگزینی (LAW-008) | `jobMachine.ts`، `sqlJobStore.applyTranscriptOnce` | IMPL (هارنس) |
| REQ-059 | اعلانِ پایدار فقط از رویدادِ واقعیِ backend (متن آماده/بی‌گفتار/ناموفق، پرونده به‌روز/ناموفق)، بدونِ تکرار، بدونِ متنِ بالینی؛ شکست actionable با «تلاشِ دوباره» بدونِ آپلودِ دوباره | `notify.ts`، `uploads.routes.ts`، `index.html` (سینی) | IMPL (mock/UI) |
| REQ-061 | (تصمیمِ مالک 2026-09-24) آپلود برایِ مراجعِ فعال و غیرفعال یکسان در دسترس است و مسیرش با **ذخیره‌ی متن با تفکیکِ گوینده** در جلسه تمام می‌شود؛ پرونده برایِ مراجعِ فعال از این مسیر ساخته نمی‌شود (`UPLOAD_CASE_FILE` خاموش). **2026-09-25:** مسیرِ «مراجعِ **غیرفعال** (با فیچرِ پرونده + «پرونده‌ی خودکار») ⇒ پرونده» آماده است ولی به تصمیمِ مالک («فعلاً متن») پشتِ `UPLOAD_CASE_FILE_INACTIVE=1` خاموش است | `jobMachine.ts#uploadCaseFileAllowed`، `jobRunner.ts#uploadCaseFileAllowedForJob`، `jobRunner.ts#applyTranscriptOnce`، `uploads.routes.ts#jobView (case_file_planned)`، `index.html#jobHasCaseFileStep` | IMPL (هارنس H25، H26، H35، H36 + E2Eِ واقعیِ 2026-09-25 با Soniox/LLM؛ آن E2E پیش از خاموش‌شدنِ پیش‌فرض بود) |
| REQ-060 | (رفعِ F1) هر سگمنتِ صفِ batch فقط یک بار merge می‌شود، با قفلِ ردیف | `batchqueue.ts#applyBatchSegmentOnce` | IMPL (بدونِ تستِ DB) |

## 05 — Notes & Signs ([PRD](../04-modules/05-notes-and-signs/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-060 | ۹ علامتِ از پیش‌تعریف‌شده با `offset_ms` و ساعت حینِ جلسه ثبت می‌شوند | `.sign-chip`، `POST notes` | IMPL |
| REQ-061 | یادداشتِ سریعِ حینِ جلسه (`note_during`) با زمان | `addQuickNote` | IMPL |
| REQ-062 | یادداشتِ متنیِ بعد از جلسه (`note_after`)؛ حذفِ یادداشت با کنترلِ مالکیت | `addTextNote`، `DELETE /api/notes/:id` | IMPL |
| REQ-063 | یادداشتِ صوتی به `session_notes(type=voice)` تبدیل می‌شود و **هرگز** واردِ transcript نمی‌شود؛ در شکست با `purpose=note` در صف | `startVoiceNoteDirect`، `stopVoiceNoteDirect` (اکنون با `POST /notes` صریح در مسیرِ موفق)، `batchqueue` | IMPL — رفعِ مسیرِ موفقِ اصلی 2026-09-14، commit شده در `2763414` ([UI-02](../05-plans/ui-ux-audit-2026-09-14.md))؛ harness WT همچنان FAIL فقط برای مسیرِ شکستِ batch (T15، بدونِ ربط به این رفع) |
| REQ-064 | یادداشت‌ها بر اساسِ `offset_ms` سپس `created_at` مرتب | `GET /api/sessions/:id` | IMPL |

## 06 — Admin Panel ([PRD](../04-modules/06-admin-panel/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-070 | `/api/admin/*` فقط برای `is_admin`؛ 401 بدونِ نشست، 403 غیرادمین | `requireAdmin` | IMPL |
| REQ-071 | داشبورد: تعدادِ تراپیست، مراجع، جلسه، جلساتِ امروز و ۷ روزِ اخیر | `GET /api/admin/stats` | IMPL |
| REQ-072 | فهرستِ تراپیست‌ها با جستجو و تعدادِ مراجع/جلسه و آخرین فعالیت | `GET /api/admin/therapists` | IMPL |
| REQ-073 | فعال/غیرفعال و دادن/گرفتنِ نقشِ ادمین؛ خود را نمی‌توان غیرفعال کرد؛ تنها ادمین نقشِ خود را برنمی‌دارد | `PATCH /api/admin/therapists/:id` | IMPL |
| REQ-074 | حذفِ آبشاریِ تراپیست با تایپِ شماره برای تأیید؛ حذفِ خود ممنوع | `DELETE`، `deleteTherapistModal` | IMPL |
| REQ-075 | ادمین هر مراجعی را حذف می‌کند | `DELETE /api/admin/clients/:id` | PARTIAL (بدونِ تأیید در UI) |
| REQ-076 | ادمین فهرستِ مراجعین/جلسات را بدونِ متنِ رونویسی می‌بیند | `admin.ts` | IMPL |
| REQ-077 | خروجِ داده (یک تراپیست/کلِ سیستم، شاملِ transcript) فقط از مسیرِ ادمین؛ بدونِ export سمتِ تراپیست | `admin.ts`، commit `de6cb31` | IMPL (فیلدهای جدید در export نیستند) |
| REQ-078 | ادمین سگمنت‌های صدای آرشیو را فهرست و با Range پخش می‌کند | `admin.ts`، `openAdminClientSessions` | IMPL — **CONTRADICTED** با متنِ رضایت (REQ-098) |

## 07 — UX Analytics ([PRD](../04-modules/07-ux-analytics/module-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-080 | Clarity فقط اگر: login، غیرادمین، `CLARITY_PROJECT_ID` معتبر، و رضایتِ ذخیره‌شده‌ی همان تراپیست در همان مرورگر | `feelia-analytics.js`، `clientConfig.ts` | IMPL |
| REQ-081 | فقط رویدادهای بدونِ پارامتر از allowlist؛ بدونِ identify؛ بدونِ unmask | `feelia-analytics.js` | IMPL |
| REQ-082 | همه‌ی نواحیِ حاویِ داده‌ی حساس `data-clarity-mask` | `index.html` | IMPL |
| REQ-083 | هر خطای Clarity بی‌صدا خاموش می‌شود و روی اپ اثری ندارد | `feelia-analytics.js` | IMPL |
| REQ-084 | پس از logout اگر Clarity لود شده بود صفحه reload می‌شود | `logout`، `onLogout` | IMPL |

## 09 — Platform ([PRD](../06-platform/platform-prd.md))

| ID | Requirement | Source | Impl |
|---|---|---|---|
| REQ-090 | migrationها در startup به ترتیبِ نام اجرا و در `_migrations` ثبت می‌شوند | `db/migrate.ts` | IMPL |
| REQ-091 | فایل‌های صفِ batch پس از موفقیت حذف و فایل‌های >۲۴h در startup پاک می‌شوند | `batchqueue.ts`، `index.ts` | IMPL |
| REQ-092 | آرشیوِ صدا در startup و هر ۲۴h، ۱۴ روز نگهداری | `sessionAudioArchive.ts`، `index.ts` | IMPL |
| REQ-093 | حذفِ داده‌ی مراجع/جلسه/تراپیست باید صدای مربوط روی دیسک را هم حذف کند | LAW-010 | **PARTIAL** (فایل‌ها یتیم — INFERRED) |
| REQ-094 | همه‌ی کوئری‌ها پارامتری؛ اتصال با UTF8 | `db/connection.ts`، همه‌ی handlerها | IMPL |
| REQ-095 | `GET /api/health` با وضعیتِ DB | `index.ts` | IMPL |
| REQ-096 | همه‌ی فراخوانی‌های سرور به Soniox از `PROXY_URL` در صورتِ تنظیم عبور می‌کنند | `stt/*` | IMPL |
| REQ-097 | صفِ صدای مرورگر در IndexedDB با سقفِ ۳۰۰MB؛ رد شدن به کاربر اعلام می‌شود | `AudioQueueDB` | IMPL |
| REQ-098 | متنِ رضایت و privacy note باید رفتارِ واقعیِ ذخیره‌ی صدا را درست توصیف کند | LAW-009 | **CONTRADICTED** |
| REQ-099 | هیچ داده‌ی بالینی در لاگ‌ها | LAW-001 | **CONTRADICTED** (`DIAG-TEMP`) |
| REQ-100 | آپلودِ سگمنت‌های صدا باید تا سقفِ مورد انتظارِ سرور (فعلاً 1MiB عملی) پذیرفته شود | `index.ts` multipart | PARTIAL (سقفِ ناخواسته؛ نگاه کنید configuration-catalog) |
