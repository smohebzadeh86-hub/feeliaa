# Verification — یکسان‌سازیِ timezone فرانت به وقتِ تهران (2026-10-01)

تغییر: `public/index.html` — `FEELIA_TZ`، `tehranHM`، `toJalali`/`nowClock`/`fmtDateTime` و نمایش‌هایِ زمانِ ادمین با `timeZone:'Asia/Tehran'`.

## نتایج
| تست | نتیجه |
|---|---|
| `test:docs` | OK (67 docs) |
| `test:routes` | OK (135 routes) |
| `test:arch` | OK |
| `test:rt` | 0 FAIL |
| `test:cf` / `test:up` / `test:tu` / `test:ft` / `test:llm` / `test:adm` | 111 / 54 / 17 / 60 / 18 / 8 — همه 0 fail |
| `tsc --noEmit` (server) | تمیز |
| parse اسکریپتِ inline | سالم |
| ترتیبِ تعریف (TDZ) | `FEELIA_TZ` (خط 2492) قبل از هر استفاده؛ هیچ فراخوانیِ top-level پیش از آن؛ `init` در DOMContentLoaded |
| تابع‌هایِ واقعیِ استخراج‌شده از index.html در TZ=UTC/Tehran/New_York/Tokyo/Kiritimati/Los_Angeles/Berlin | خروجیِ `toJalali`/`tehranHM`/`fmtDateTime` در همه یکسان: 20:45Z ⇒ 1405/07/10 00:15؛ 20:40Z (گذرِ نیمه‌شبِ تهران) ⇒ تاریخ و ساعت هم‌خوان؛ 2026-03-21T20:35Z ⇒ 1405/01/02 00:05 |

## تستِ مرورگریِ واقعی (Browser pane، mock با دادهٔ ساختگی + شبیه‌ساز timezone)
public/ واقعی از mock سرو شد؛ با پارامترِ `?tz=` یک shim (فقط در HTMLِ mock) `Intl`/`Date` را روی timezoneِ خارجی گذاشت (مرورگرِ پنل خودش Asia/Tehran است). ساعتِ واقعیِ تهران هنگامِ تست ≈ 12:24.

| timezoneِ شبیه‌سازی‌شده | ساعتِ محلیِ مرورگر | `POST /api/sessions` (بدنه) | ادمین: جزئیاتِ جلسه با updated_at=20:45Z |
|---|---|---|---|
| America/New_York | 4:54 | date=1405/07/09، start_time=**12:24** | آخرین ذخیره ۱۴۰۵/۷/۱۰ ۰:۱۵ |
| Asia/Tokyo | 17:54 | date=1405/07/09، start_time=**12:24** | آخرین ذخیره ۱۴۰۵/۷/۱۰ ۰:۱۵ |

یعنی با کدِ قبلی ساعتِ ۴:۵۴/۱۷:۵۴ ثبت می‌شد؛ حالا ساعتِ تهران ثبت می‌شود و نمایشِ ادمین مستقل از timezoneِ مرورگر است. خطایِ کنسول: فقط ۵۰۰هایِ عمدیِ mock (توقفِ بعد از POST) و ۴۰۴/ReferenceErrorِ اجرایِ اولِ ناموفقِ خودِ تست (mock با مسیرِ اشتباه).

## انجام نشد
- login/ادمینِ واقعی با حسابِ واقعی (حساب ساخته نشد).
- `test:api` (نیازمندِ مجوزِ مالک).
