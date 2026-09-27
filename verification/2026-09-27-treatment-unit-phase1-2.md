# Verification — واحدِ درمان + contextِ پویای Soniox (فاز ۱ و ۲) — 2026-09-27

محیط: ماشینِ dev، بدونِ DB/شبکه‌ی واقعی. داده کاملاً ساختگی (canary).

| بررسی | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | تمیز |
| `pnpm test:tu` (جدید) | 17/17 PASS — اعتبارسنجیِ اعضا، برچسبِ خودکار، تعدادِ گوینده (زوج=۳، زوج با یک حاضر=۲)، نبودِ مستعار در context، سقفِ طول، ارتقا، حاضرین، fail-open، migration بدونِ `;` مزاحم |
| `pnpm test:rt` | بدونِ FAIL |
| `pnpm test:up` | 41/41 |
| `pnpm test:cf` | 110/110 |
| Browser pane + mock (scratchpad) | فرمِ درختی: فردی (سن→جنسیت)، زوج («همسر ۱/۲» + زن‌ومرد/دو زن/دو مرد)، خانواده (+پسر با سن)، کودک و والد («با هر دو»)؛ POST `/api/clients` با `unit_type`+`members`؛ ارتقایِ فردی→زوج با PUT (عضوِ ضمنی بدونِ `self`)؛ رویکردِ EFT ⇒ پیش‌فرضِ «زوج»؛ کارتِ حاضرین «همسر ۱، همسر ۲ + شما» → لغوِ یکی ⇒ `attendees:["m-a"]` و `pre_note` در POST `/api/sessions`؛ badge «زوج · ۲ نفر» |

تست‌نشده: اعمالِ migration 029 رویِ MySQL؛ E2E با DB؛ اثرِ واقعیِ context بر دقتِ diarization (نیازمندِ فایلِ صوتیِ ساختگیِ چندنفره و Soniox)؛ میکروفون در Browser pane مسدود است.
