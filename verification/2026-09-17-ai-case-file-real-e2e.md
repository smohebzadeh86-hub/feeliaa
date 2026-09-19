# Verification — AI Case File: تستِ end-to-endِ واقعی (MySQLِ لوکالِ تازه + OpenRouterِ واقعی)

> Evidence — مشاهده در یک لحظه (LAW-019).

## محیط
- MySQL 8.4.9 **standalone** (نه Windows service) رویِ این ماشین init/start شد:
  دیتادایرکتوری `C:\Users\Moheb\feelia-mysql\data`، پورت 3306، کاربر/دیتابیسِ
  `feelia`/`feelia2025` مطابقِ `DATABASE_URL` موجود.
  **اجرایِ دستی — بعدِ هر ری‌استارتِ ویندوز باید دوباره start بشه:**
  ```
  "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --datadir="C:\Users\Moheb\feelia-mysql\data" --port=3306 --console
  ```
- `LLM_PROVIDER=openrouter`، `OPENROUTER_API_KEY`، `OPENROUTER_MODEL=openai/gpt-4o-mini` در `server/.env` (به دستورِ صریحِ مالک).
- سناریوی canary: ثبت‌نامِ تراپیستِ synthetic → مراجعِ `status=inactive` synthetic → یک
  جلسه‌ی دستی با یادداشتِ synthetic (بدونِ داده‌ی واقعیِ مراجع).

## نتایج

| مورد | نتیجه |
|---|---|
| اجرایِ هر ۱۸ migration رویِ MySQLِ واقعی (شاملِ `018_client_case_file.sql`) | ✅ `DESCRIBE client_case_file` دقیقاً منطبق با schema |
| `POST /api/clients/:id/case-file/regenerate` (اولین بار) | ❌→✅ (دو باگِ واقعی پیدا و رفع شد، زیر) |
| ساختارِ خروجی طبقِ `CASE_FILE_JSON_SCHEMA` | ✅ پاسخِ ۲۰۰ با `CaseFileContent` معتبر |
| `PATCH .../case-file` با `action:"edit"` (متنِ فارسی) | ✅ ذخیره/بازگشتِ صحیحِ UTF-8 از MySQL JSON column |
| Regenerate دوباره بعدِ یک edit دستی | ✅ فیلدِ `identity` (`reviewedByTherapist:true`) دقیقاً دست‌نخورده ماند — merge-logic تأیید شد رویِ DB/LLMِ واقعی، نه فقط mock |
| پاکسازیِ canary | ✅ `DELETE /api/clients/:id` (cascade) + حذفِ مستقیمِ therapistِ canary (تنها ردیفِ این DBِ تازه) — `SELECT COUNT(*)` صفر برایِ هر سه جدول |

## باگ‌هایِ واقعیِ کشف‌شده و رفع‌شده

1. **هدرِ `X-Title` با em-dash (—)** در `openrouter.adapter.ts` → Node آن را «not a legal
   HTTP header value» رد می‌کرد → کلِ فراخوانی با پیامِ گمراه‌کننده‌ی «Connection error»
   fail می‌شد. رفع: em-dash → hyphenِ معمولی.
2. **`.toISOString()` برایِ ستون‌هایِ DATETIME** (`generated_at`, `therapist_edited_at`,
   `force_regenerated_at`) → خطایِ MySQLِ «Incorrect datetime value» (فرمتِ
   `...T...Z` برایِ DATETIME نامعتبره). رفع: `new Date()` (شیِ Date، نه رشته) — همان
   الگویی که `clients.ts` برایِ `pinned_at` استفاده می‌کند.
3. **خطاهایِ غیرِ `CaseFileGenerationError` در `generateCaseFile.ts` پیامِ واقعی‌شان گم
   می‌شد** (جایگزینِ یک رشته‌ی عمومی می‌شدند) — دقیقاً همین باعث شد پیدا کردنِ باگِ #۲ سخت
   شود. رفع: همیشه `err.message` واقعی نگه داشته می‌شود.
4. **دفاعی (نه باگِ بحرانی):** در یک اجرایِ واقعی دیده شد مدل گاهی `value` را خالی برمی‌گرداند
   ولی `pending:false` می‌گذارد (خلافِ system prompt). رفع در `mergeTherapistEdits.ts`:
   `pending = draft.pending || value.trim()===''` — صرف‌نظر از ادعایِ مدل.

## نتیجه‌گیری
پایپ‌لاینِ کاملِ AI Case File — از `POST regenerate` تا فراخوانیِ واقعیِ OpenRouter، اعتبارسنجی،
merge، نوشتن در MySQLِ واقعی، و `PATCH` دستیِ تراپیست — با داده‌ی synthetic تأیید شد. کیفیتِ
محتوایِ تولیدشده (نه صحتِ فنیِ pipeline) رویِ یک یادداشتِ کوتاهِ synthetic ارزیابیِ محتواییِ
عمیق نشد — برایِ آن، تستِ رویِ چند مراجعِ واقعی (طبقِ الگویِ سندِ فرآیندِ طراحیِ مالک) لازم است.
