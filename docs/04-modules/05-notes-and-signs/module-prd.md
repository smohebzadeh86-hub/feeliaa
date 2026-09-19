# Module 05 — Notes & Signs · PRD

> **وضعیت:** ACTIVE-CANONICAL · REQ-060…064.

## Problem
مشاهداتِ غیرکلامی (گریه، سکوت، بی‌قراری) و فکرهای لحظه‌ایِ تراپیست در متنِ رونویسی نیستند؛ اگر با زمان ثبت نشوند، ارزشِ بالینی‌شان از دست می‌رود.

## Goal
ثبتِ یک‌لمسیِ علائم و یادداشت‌های کوتاه با زمانِ نسبی به شروعِ جلسه، و یادداشت‌های متنی/صوتی پس از جلسه — جدا از transcript.

## Users / Actors
تراپیست؛ Soniox برای یادداشتِ صوتی.

## Use Cases
| UC | شرح |
|---|---|
| UC-05.1 | حینِ جلسه روی یکی از ۹ چیپِ علامت می‌زند → ثبت با زمانِ تایمر و ساعت |
| UC-05.2 | حینِ جلسه یادداشتِ سریع تایپ می‌کند (Enter) |
| UC-05.3 | در Wrapup یادداشتِ متنی اضافه/حذف می‌کند |
| UC-05.4 | در Wrapup یادداشتِ صوتی ضبط می‌کند؛ متن زنده نشان داده و ثبت می‌شود؛ در شکست «با تأخیر» ثبت می‌شود |
| UC-05.5 | در پرونده، علائم و یادداشت‌ها کنارِ متنِ جلسه دیده می‌شوند |

## Business Rules
- علائمِ مجاز: گریان، لرزش، تنش عضلانی، سکوت طولانی، خشم، پرخاشگری، اتصال چشمی گریزان، خواب‌آلودگی، بی‌قراری ([database-catalog](../../02-reference/database-catalog.md)).
- یادداشتِ صوتی هرگز واردِ transcript نمی‌شود (REQ-063، LAW-008).
- analytics فقط «رخ داد» را می‌داند، هرگز نوع/متن (LAW-011).

## Functional Requirements
1. `POST /api/sessions/:id/notes` برای sign/note_during/note_after.
2. `DELETE /api/notes/:id`.
3. یادداشتِ صوتی: FeeliaRT `mode:'note'` (بدونِ persistِ transcript) → متن به فهرستِ Wrapup؛ fallback با `purpose=note`؛ legacy `/ws/voice`.
4. مرتب‌سازی بر اساسِ `offset_ms` سپس `created_at`.

## Non-Functional Requirements
ثبتِ علامت نباید جلسه را بلاک کند (خطای شبکه بی‌صدا).

## Permissions
فقط مالکِ جلسه.

## States
یادداشتِ صوتی: ضبط → نهایی‌سازی → ثبت شد / در حالِ پردازش / متنی ثبت نشد.

## Validation
`type` الزامی (مقدار بررسی نمی‌شود — شکاف)؛ بقیه اختیاری.

## Dependencies
ماژول 03 (تایمر، جلسه)، ماژول 04 (موتور)، subsystem 02.

## Acceptance Criteria
- [ ] کلیکِ «گریان» در دقیقه‌ی ۳ → ردیفِ `sign` با `offset_ms≈180000`.
- [ ] یادداشتِ صوتیِ ناموفق → در نهایت ردیفِ `voice` و `transcript` دست‌نخورده (T15 — **WT FAIL**).
- [ ] حذفِ یادداشتِ جلسه‌ی تراپیستِ دیگر → 404.

## Known Gaps
- `offset_ms || null`: علامت در ثانیه‌ی صفر `offset_ms=null` می‌شود.
- حذفِ علامت در Wrapup (`removeSign`) — رفتارِ حذف از DB بررسی شود (کد در بازه‌ی خوانده‌نشده‌ی `index.html` است؛ **UNVERIFIED**).
- **باگ (تأییدشده 2026-09-14، روی production فعال) — ✅ رفع شد در working tree 2026-09-14:** یادداشتِ صوتیِ مسیرِ اصلی (FeeliaRT، `stopVoiceNoteDirect`) فقط به آرایه‌ی محلیِ `wrapupNotes` اضافه می‌شد و هیچ‌وقت به سرور ارسال نمی‌شد. اکنون `POST /api/sessions/:id/notes` صریح می‌فرستد (مثلِ `addTextNote`). کد commit نشده؛ روی production همچنان باگ فعال است تا push/deploy. → [UI audit، UI-02](../../05-plans/ui-ux-audit-2026-09-14.md).

## Out of Scope
علائمِ سفارشی، ویرایشِ یادداشت، پیوندِ یادداشت به نقطه‌ی متن (`anchors` استفاده نمی‌شود).
