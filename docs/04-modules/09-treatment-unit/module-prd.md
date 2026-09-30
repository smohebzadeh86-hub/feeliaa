# Module 09 — واحدِ درمان (Treatment Unit) · PRD

> last-verified: 2026-09-30 @ `17d6919` · مالک: [feature-index](../../02-reference/feature-index.md) (`treatment-unit`) · وضعیت: ACTIVE-CANONICAL · REQ-117…REQ-119
> قالب: [feature-doc-template](../../00-governance/feature-doc-template.md) (LAW-026)

## ۱. چرا (Why)
- **مسئله:** درمانگرِ زوج/خانواده مجبور بود مراجع را «یک نفر» ثبت کند؛ برایِ Soniox تعدادِ گوینده/نقش نامعلوم بود و هر جلسه با یک contextِ ثابت (فردی) رونویسی می‌شد.
- **تصمیم‌ها** (منبع: Event Log 2026-09-27 «واحدِ درمان … فاز ۱ و ۲»؛ [verification](../../../verification/2026-09-27-treatment-unit-phase1-2.md)):
  1. (مالک) درختِ «نوعِ پرونده» در فرمِ «مراجعِ جدید»، نه صفحه‌ی شروعِ جلسه.
  2. (مالک) **ارتقا** (فردی ⇒ زوج) در همان پرونده، به‌جایِ پرونده‌ی جدید.
  3. (مالک) کاتالوگِ **داده‌محور** (جدول‌هایِ `tu_*` با seed) — بدونِ hard-code.
  4. تصمیمِ قبلیِ «تعدادِ افراد پرسیده نشود» بازبینی شد: تعداد پرسیده نمی‌شود، از اعضایِ پرونده و حاضرینِ جلسه **مشتق** می‌شود.
  5. **contextِ Soniox فقط نقش/سن/جنسیت/تعداد/رویکرد دارد — هرگز مستعار یا یادداشت** (LAW-001؛ تستِ harness) و **fail-open** است (LAW-012: هر خطا ⇒ contextِ ثابتِ قبلی).
  6. A/Bِ واقعی (36 اجرا، 2026-09-27، [verification](../../../verification/2026-09-27-treatment-unit-diarization-ab.md)) نشان داد context **دقتِ تفکیکِ گوینده را بهتر نمی‌کند** (حتی contextِ غلط ضرری نزد) ⇒ این ادعا نباید در UI/مستندات بیاید؛ ارزشِ feature = ثبتِ درستِ اعضا/حاضرین و برچسبِ نقشِ گوینده (نه دقتِ Soniox).
  7. (2026-09-27، 030) برچسبِ `partner_f/m` «خانم/آقا» شد (نه «همسر» برایِ هر دو) تا در زوجِ هم‌جنس ابهام نباشد.
  8. (2026-09-29) `sessions.pre_note` دیگر نوشته نمی‌شود؛ یادداشتِ پیش از جلسه ردیفِ `session_notes(type='note_before'|'voice_before')` است ([ماژول 05](../05-notes-and-signs/module-prd.md)).

## ۲. چه می‌کند (What)
- هر مراجع یک **نوعِ واحد** دارد: `individual`، `couple`، `family`، `child_parent` (کاتالوگ)، با اعضایِ نقش‌دار (`client_members`). مراجعِ قدیمی/بدونِ عضو یک عضوِ ضمنی `id:"self"` از `clients.category/gender` دارد (بدونِ backfill).
- ثبت/ویرایش/ارتقایِ واحد (`PUT /api/clients/:id/unit`) با اعتبارسنجیِ دامنه (تعدادِ اعضا، نقشِ مجاز، دسته/جنسیت).
- هر جلسه‌ی زنده می‌تواند **حاضرین** (`sessions.attendees`، زیرمجموعه‌ی اعضا؛ NULL = همه) داشته باشد.
- درمانگر **رویکردهایِ درمانی** (`therapists.modalities`) را انتخاب می‌کند؛ رویکردِ پیش‌فرض واحدِ پیشنهادی را تعیین می‌کند (مثلاً EFT ⇒ زوج).
- **contextِ پویایِ Soniox** برایِ realtime (mint با `purpose=transcript`؛ برایِ `note`/`pre-note` context خالی است)، batch، آپلود، resolve-speakers و «متنِ نهایی» از واحد + حاضرین + رویکرد ساخته می‌شود (`sessionSttContext`)؛ و **فهرستِ نقش‌هایِ مجازِ گوینده** (`sessionSpeakerRoster`) برایِ «متنِ نهایی» ([subsystem 07](../../07-subsystems/07-final-transcript.md)).

## ۳. مرزها (Boundaries)
- سطحِ عمومی `features/treatment-unit/index.ts`: `treatmentUnits` (سرویس)، `TreatmentUnitValidationError`، نوعِ `SonioxContext`، `treatmentUnitRoutes` (index.ts routeها را هم export می‌کند — R3 هر دو شکل را می‌پذیرد).
- لایه‌ها (R5 برایِ featureهایِ لایه‌ای): `domain/` (types، rules، sonioxContext، errors) ← `application/treatmentUnitService.ts` ← `ports/treatmentUnitRepo.port.ts` ← `adapters/treatmentUnitRepository.sql.ts`؛ سیم‌کشی در `instance.ts` (env: `TU_CATALOG_TTL_MS`، `SONIOX_CONTEXT_MAX_TERMS/CHARS`). R5 برایِ این feature توسطِ `pnpm test:arch` سنجیده می‌شود (`LAYERED` در `scripts/check-backend-boundaries.mjs`).
- مصرف‌کننده‌ها (فقط از `index.ts`): `clients` (ساخت/توضیحِ واحد)، `sessions` (`attendeesForNewSession`)، `transcription` (`stt.routes.ts` mint، `batch/processQueue.ts` [import پویا]، `speakerResolve.ts`)، `audio-upload/worker.ts`، `final-transcript` (`runner.ts`، routes).
- وابستگی: `shared/sessionSttContext.ts` (contextِ پایه).

## ۴. کد (Code)
- Backend: `server/src/features/treatment-unit/` — `TreatmentUnitService` (`catalog`، `getUnit`، `describeUnit`، `validate`، `saveUnit`، `attendeesForNewSession`، `listTherapistModalities`، `setTherapistModalities`، `sessionSpeakerRoster`، `sessionSttContext`)؛ دامنه: `normalizeMembers`، `memberLabels`، `speakerProfile` (`rules.ts`)، `buildSonioxContext` (`sonioxContext.ts`).
- Frontend (`public/index.html`، [frontend-map](../../02-reference/frontend-map.md)): `tuUnit`، `tuRole`، `tuDefaultPreset`، `tuNewState`، `tuStateFromUnit`، `tuStateToBody`، `tuAutoLabels`، `tuUnitSummary`، `renderUnitEditor`، `renderEditUnit`، `openEditUnitModal`/`confirmEditUnit` (مودالِ `#editUnitModal`)، `renderModalitiesChips`/`openModalitiesModal`/`confirmModalities` (`#modalitiesModal`)، کارتِ «حاضرین + یادداشتِ پیش از جلسه» در `#screenSetup`؛ رویدادِ Clarity `client_unit_edited`.

## ۵. داده (Data)
- **مالک:** `tu_unit_types`، `tu_member_roles`، `tu_modalities`، `tu_modality_terms`، `client_members` (migrationهایِ 029، 030، 032).
- **لمس‌شده:** `clients.unit_type` (ستونِ feature در جدولِ `clients`)، `sessions.attendees`، `therapists.modalities`. ویرایشِ seed = migrationِ جدید. [database-catalog](../../02-reference/database-catalog.md).

## ۶. API و config
`GET /api/catalog/treatment-units`، `GET/PUT /api/clients/:id/unit`، `GET/PUT /api/therapist/modalities` + فیلدهایِ افزوده‌ی `POST /api/clients`، `GET /api/clients[/:id]`، `POST /api/sessions` — [api-catalog §8.2](../../02-reference/api-catalog.md). کدهایِ خطا: [error-code-catalog](../../02-reference/error-code-catalog.md). env: `TU_CATALOG_TTL_MS`، `SONIOX_CONTEXT_MAX_TERMS`، `SONIOX_CONTEXT_MAX_CHARS` ([configuration-catalog](../../02-reference/configuration-catalog.md)).

## ۷. تست (Tests)
`pnpm test:tu` (`scripts/treatment-unit-harness.ts`، بدونِ DB/شبکه): دامنه، نگاشتِ مدالیته، ساختِ context (بدونِ مستعار)، migration. E2Eِ DB و UI با mock در [verification](../../../verification/2026-09-27-treatment-unit-e2e-and-setup-edit.md) (تاریخی). **پوشش نمی‌دهد:** اثرِ context بر دقتِ گوینده (A/B: بی‌اثر)، ویرایشِ کاتالوگ از پنلِ ادمین (وجود ندارد).

## ۸. ریسک و بدهی
- `client_members.role_code` بدونِ FK به کاتالوگ (اعتبار فقط در دامنه).
- کاتالوگ از پنلِ ادمین قابلِ ویرایش نیست.
- فاز ۳ («پس‌پردازشِ گوینده/turn») در Event Log «باز» ثبت شده؛ پوشش‌اش امروز در «متنِ نهایی» ([subsystem 07](../../07-subsystems/07-final-transcript.md)) است — UNKNOWN اینکه فازِ ۳ مستقل مدنظرِ مالک است یا نه.
- `application/` و `api/` مستقیم `query`/SQL ندارند؛ SQL فقط در `adapters/` (R5 ماشینی چک می‌شود).
