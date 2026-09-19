# 2026-09-19 — هم‌ترازیِ پرونده‌ی روندِ درمان با سندِ جامع

**دامنه:** prompt (`buildCaseFilePrompt.ts`)، `validate.ts` (`enforceCaseFileRules`)، `generateCaseFile.ts`، `renderCaseFile` در `public/index.html`.

| بررسی | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | ✅ |
| تستِ واحدِ `enforceCaseFileRules` (p1 بدونِ safety→p2، why>4 کلمه بریده، پیشوند، ترتیب) | ✅ |
| syntaxِ JSِ `index.html` | ✅ |
| `pnpm test:rt` | ❌ چند FAIL در T2/T15/T16 (صوت/batch، خطای شبکه‌ی mint)؛ مسیرِ لمس‌نشده؛ baseline مقایسه نشد |
| تولیدِ واقعیِ LLM / بررسیِ بصری | ⏳ توسطِ مالک روی لوکال |

محدودیت: اثرِ تغییرِ prompt بر کیفیتِ خروجی هنوز سنجیده نشده.
