# Verification — audit صدا، مرحله‌ی ۴ (بخش E: mimeِ واقعی، بخش F: فایلِ کاملِ ادمین) — 2026-09-16

## دامنه
آخرین دو بخشِ باقی‌مانده از پلنِ `SONIOX.md`:
- **بخشِ E:** فوروارد کردنِ mimeِ واقعیِ کلاینت (به‌جایِ هاردکدِ `audio/webm`).
- **بخشِ F:** پنلِ ادمین — یک فایلِ کاملِ چسبیده‌شده به‌جایِ لیستِ سگمنت‌به‌سگمنت (تصمیمِ صریحِ مالک).

## تغییرات

### بخشِ E
- سرور (`sessions.ts`): `file.mimetype`ِ واقعی (از `@fastify/multipart`) خوانده و به `enqueueBatch` پاس داده می‌شود.
- `batchqueue.ts`: `extForMime`/`mimeForExt` (export شده) — mime بینِ enqueue و پردازشِ بعدی از رویِ **پسوندِ فایلِ صفِ موقت** (`webm`/`ogg`/`m4a`) منتقل می‌شود؛ `mimeFromFilename` این را در `processBatchQueue`/`sweepOldBatchFiles` بازمی‌گرداند.
- `sessionAudioArchive.ts`: پسوندِ فایلِ آرشیو از رویِ mimeِ واقعی تعیین می‌شود (`extForMime` مشترک با batchqueue.ts).
- کلاینت (`feelia-rt.js`): `recordedMime` از خودِ `MediaRecorder.mimeType` (نه فقط `pickMime()`ِ حدسی) گرفته می‌شود — پوششِ سافاری که هیچ‌کدام از `MIME_CANDIDATES` را پشتیبانی نمی‌کند.

### بخشِ F
- `sessionAudioArchive.ts`: تابعِ جدیدِ `getFullSessionAudio(sessionId)` — فقط سگمنت‌هایِ `kind='session'` را با ffmpeg concat می‌کند و در `data/session-audio/<sid>/full.<ext>` + `full.meta.json` (شمارشِ سگمنت‌ها برایِ invalidationِ کش) نگه می‌دارد.
  - مسیرِ سریع: اگر همه‌ی سگمنت‌ها یک container/codec دارند → `concat demuxer` با `-c copy` (بدونِ ری‌اینکود).
  - مسیرِ fallback: اگر container/codec مختلف است (نادر، مثلاً تغییرِ مرورگر وسطِ جلسه) → `-filter_complex concat` با ری‌اینکودِ opus.
  - بدونِ ffmpeg → پیامِ روشن (`این قابلیت بدونِ ffmpeg در دسترس نیست`)، نه خطایِ مبهم.
- `admin.ts`: روتِ جدیدِ `GET /api/admin/sessions/:id/audio/full[?download=1]` (Range + Content-Disposition، مشابهِ الگویِ موجودِ per-segment stream)؛ `GET /api/admin/sessions/:id/audio` حالا `kind` و `pending_count` هم برمی‌گرداند.
- `index.html`: لیستِ «سگمنت ۱، سگمنت ۲، …» کاملاً حذف شد؛ به‌جایش یک `<audio>` + یک دکمه‌ی دانلود رویِ `audio/full`؛ یادداشت‌هایِ صوتی (`kind='note'`) جدا و همچنان تک‌به‌تک (نیازی به concat ندارند)؛ بنرِ «N فایل هنوز در صفِ پردازشِ سرور است» اگر `pending_count>0`.

## تست‌هایِ استاتیک
| تست | نتیجه |
|---|---|
| `cd server && npx tsc --noEmit` | ✅ |
| `node --check public/feelia-rt.js` | ✅ |
| syntax-checkِ `index.html` | ✅ |
| `pnpm test:rt` | ✅ ۲۹ PASS/۶ FAIL — همون baseline، بدونِ رگرسیون |

## تستِ زنده — سرورِ dev واقعی + MySQLِ لوکالِ واقعی + ffmpegِ واقعی + مرورگرِ واقعی

### بخشِ E
حسابِ canaryِ جدا (`09120000033`). فایل‌هایِ **واقعی** با ffmpeg ساخته شدند: `testE.ogg` (Vorbis) و `testE.m4a` (AAC) — نه صرفاً تغییرِ پسوند.
- آپلود با `Content-Type: audio/ogg` و `audio/mp4` → `session_audio.mime` دقیقاً `audio/ogg`/`audio/mp4` ثبت شد (نه دیگر `audio/webm` هاردکد)؛ فایل‌هایِ رویِ دیسک با پسوندِ درست (`000000.ogg`، `000001.m4a`).
- `duration_ms` برایِ **هر دو فرمت** درست استخراج شد (۲۰۰۰ms) — تأییدِ جانبیِ اینکه ری‌ماکس/probe برایِ m4a هم کار می‌کند، نه فقط webm.
- آپلودِ oggِ واقعی با `purpose=transcript` (نه فقط archive) → فایلِ صفِ موقت با پسوندِ `.ogg` ساخته شد؛ بعدِ پردازش، `session_audio.mime='audio/ogg'` — تأییدِ round-trip کاملِ `mimeFromFilename`.

### بخشِ F
حسابِ canaryِ ادمین جدا (`09120000022`، `is_admin` فقط رویِ همین ردیفِ مشخص با SQL دستی ست شد، بعداً کامل حذف شد — هیچ کاری زیرِ حسابِ واقعیِ ادمینِ مالک انجام نشد).
1. **مسیرِ سریع (uniform):** ۳ سگمنتِ واقعیِ webm (۱ ثانیه هرکدام) آپلود شد → `GET /audio/full` فایلی با مدت‌زمانِ **۳٫۰۳۱ ثانیه** برگرداند (دقیقاً مجموع) — بدونِ ری‌اینکود، آنی.
2. **کش:** درخواستِ دوم دقیقاً همان `content-length` را بدونِ فعالیتِ جدیدِ ffmpeg در لاگ برگرداند.
3. **دانلود:** `?download=1` → `Content-Disposition: attachment; filename="session-<id>.webm"` درست.
4. **مسیرِ fallback (mixed):** یک سگمنتِ m4aِ واقعی (AAC) اضافه شد (۴ سگمنت، ۲ فرمت) → کش خودکار باطل شد (`segCount` 3→4)، فایلِ جدید با `-filter_complex concat` ساخته شد، مدت‌زمانِ **۴٫۰۳ ثانیه** (دقیقاً مجموع) — تأییدِ کاملِ مسیرِ fallback با دادهٔ واقعی.
5. **جلسه‌ی بدونِ صدا:** `404 {"error":"صدایی برایِ این جلسه آرشیو نشده است"}`.
6. **بدونِ ffmpeg** (سرور با `FFMPEG_PATH=nonexistent-ffmpeg-binary` ری‌استارت شد): `503 {"error":"این قابلیت بدونِ ffmpeg در دسترس نیست"}` — دقیقاً پیامِ خواسته‌شده در پلن؛ **آرشیوِ خودِ سگمنت همچنان موفق بود** (fail-open، `duration_ms=NULL`) — سرور بعد با ffmpegِ واقعی ری‌استارت شد.
7. **UIِ واقعیِ مرورگر:** `openAdminClientSessions` صدا زده شد → HTMLِ واقعی بازرسی شد: دقیقاً یک برچسبِ «صدایِ کاملِ جلسه:»، یک `<audio src=".../audio/full">`، یک دکمه‌ی دانلود — **هیچ لیستِ سگمنتی نیست**. `audio.load()` واقعاً اجرا شد: `duration=4.029`، `readyState=4` (کاملاً قابلِ‌پخش)، بدونِ خطا — نه فقط بررسیِ HTML، پخشِ واقعی در DOM.
8. **بنرِ صفِ در-انتظار:** یک سگمنتِ نامعتبر با `purpose=transcript` آپلود شد (می‌ماند در صف چون Soniوx رد می‌کند) → `pending_count=1` از API؛ در UIِ واقعی رشته‌ی «صفِ پردازشِ سرور» در HTML ظاهر شد.

## پاکسازی
هر ۳ حسابِ canaryِ این مرحله (E: ۱ تراپیست/۱ مراجع/۲ جلسه؛ F: ۱ تراپیست/۳ مراجع/۳ جلسه) حذف شدند —
حذفِ مستقیمِ ردیفِ تراپیست از DB (کاسکید تا مراجع/جلسات/صدا). شمارش‌ها دقیقاً به `۱/۱/۱/۰`
برگشتند. ۵ پوشه‌ی آرشیوِ canary + فایل‌هایِ باقی‌مانده در `batch-queue` از دیسک پاک شدند (برگشت
به ۱۹ پوشه/صفِ خالی). فایل‌هایِ اسکرچِ محلی (ogg/m4a/webm ساخته‌شده با ffmpeg) پاک شدند.
`mysqld`/سرورِ dev متوقف شدند.

## نتیجه‌گیری
هر دو بخشِ باقی‌مانده (E و F) **رویِ زیرساختِ کاملاً واقعی** (فایل‌هایِ صوتیِ واقعیِ ساخته‌شده با
ffmpeg در چند فرمت، MySQLِ واقعی، ffmpegِ واقعی، مرورگرِ واقعی با پخشِ واقعیِ DOM) پیاده و تست
شدند. تمامِ ۸ سناریوی کلیدی (mimeِ صحیح برایِ ۲ فرمت، round-trip از طریقِ صفِ سرور، concatِ
سریع، کش، دانلود، fallbackِ مختلط، خطایِ بدونِ‌صدا، خطایِ بدونِ‌ffmpeg با fail-openِ آرشیو، و
رندرِ واقعیِ UI) بدونِ استثنا درست کار کردند. `tsc`/`pnpm test:rt` بدونِ رگرسیون. **با این
مرحله، هر ۶ بخشِ پلنِ اصلی (A تا F) پیاده و با زیرساختِ واقعی تأیید شده‌اند** — فقط commit/deploy
باقی مانده (تصمیمِ مالک، LAW-006/LAW-022).
