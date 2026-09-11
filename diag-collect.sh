#!/usr/bin/env bash
# ============================================================
# Feelia production diagnosis collector — READ-ONLY
# هیچ کد، کانفیگ، dependency یا state ای را تغییر نمی‌دهد.
# فقط لاگ می‌خواند و گزارش masked تولید می‌کند.
#
# استفاده:
#   chmod +x diag-collect.sh
#   sudo ./diag-collect.sh            # اسنپ‌شات + شنود زنده (Ctrl+C برای پایان)
#   ./diag-collect.sh --check-cookie 'FEELIA_SESSION_VALUE'
#       # verdict دیتابیس بدون چاپ خود کوکی (روی خود VPS بزن)
#   ./diag-collect.sh --soniox-egress # اثبات network path از داخل VPS
#
# متغیرها:
#   APP_DIR=/path/to/server-deploy ./diag-collect.sh
#   WINDOW=300 ./diag-collect.sh     # ثانیه شنود زنده
# ============================================================
set -u

TS=$(date +%Y%m%d-%H%M%S)
REPORT="/tmp/feelia-diag-${TS}.log"
APP_DIR="${APP_DIR:-$HOME/server-deploy}"
WINDOW="${WINDOW:-180}"

mask() {
  sed -E -e 's/(feelia_session=)[^; ,"'"'"'()]+/\1[REDACTED]/g' \
         -e 's/(SONIOX_API_KEY=).*/\1[REDACTED]/g' \
         -e 's/("[Aa][Pp][Ii]_key"[^,}]*")[^",}]+/\1[REDACTED]/g'
}

say() { echo "$@" | tee -a "$REPORT"; }

# ---------- حالت ۱: چک کوکی در DB (فقط verdict، بدون چاپ secret) ----------
check_cookie() {
  local cookie="$1"
  local envf="$APP_DIR/.env"
  [ -f "$envf" ] || { echo "ERROR: .env not found at $envf (APP_DIR=... را ست کن)"; exit 1; }
  local dburl; dburl=$(grep -E '^DATABASE_URL=' "$envf" | cut -d= -f2- | tr -d '\r')
  [ -n "$dburl" ] || { echo "ERROR: DATABASE_URL not found in $envf"; exit 1; }
  command -v psql >/dev/null 2>&1 || { echo "ERROR: psql نصب نیست"; exit 1; }
  command -v sha256sum >/dev/null 2>&1 || { echo "ERROR: sha256sum نیست"; exit 1; }
  local hash; hash=$(printf '%s' "$cookie" | sha256sum | awk '{print $1}')
  echo "querying auth_sessions (cookie/hash چاپ نمی‌شود)..."
  psql "$dburl" -X -t -A -F'|' -c \
    "SELECT count(*) AS n, COALESCE(bool_or(s.expires_at > now()),false) AS any_valid, COALESCE(bool_or(t.active),false) AS any_active FROM auth_sessions s JOIN therapists t ON t.id=s.therapist_id WHERE s.token_hash='$hash';" \
    2>&1 | awk -F'|' '{print "sessions_found=" $1 "  expires_valid=" $2 "  therapist_active=" $3}'
  echo "راهنما: 0|f|f = کوکی در DB نیست (C) | 1|f|* = expire شده (D) | 1|t|f = غیرفعال (D)"
}

# ---------- حالت ۲: اثبات egress سونی‌کس از داخل VPS ----------
soniox_egress() {
  echo "--- DNS ---"
  getent hosts stt-rt.soniox.com || echo "DNS FAIL global"
  getent hosts stt-rt.eu.soniox.com || echo "DNS FAIL eu"
  echo "--- TLS handshake ---"
  timeout 10 openssl s_client -connect stt-rt.soniox.com:443 -servername stt-rt.soniox.com </dev/null 2>&1 | grep -E "Verify return code|Protocol |Cipher " | head -n 5
  echo "--- WS upgrade (curl, no key) ---"
  curl -sv -m 12 -o /dev/null -H 'Upgrade: websocket' -H 'Connection: Upgrade' https://stt-rt.soniox.com/transcribe-websocket 2>&1 | grep -E "^< HTTP|error|timed out" | head -n 10
  echo "--- WS handshake via node (اگر ws موجود است) ---"
  for d in "$APP_DIR/node_modules" "$HOME/server-deploy/node_modules" /opt/feelia/server-deploy/node_modules; do
    if [ -f "$d/ws/wrapper.mjs" ] || [ -f "$d/ws/index.js" ]; then WSMOD="$d"; break; fi
  done
  if command -v node >/dev/null 2>&1 && [ -n "${WSMOD:-}" ]; then
    timeout 30 node -e "const {WebSocket}=require('$WSMOD/ws');for(const u of ['wss://stt-rt.soniox.com/transcribe-websocket','wss://stt-rt.eu.soniox.com/transcribe-websocket']){const t0=Date.now();const ws=new WebSocket(u,{handshakeTimeout:10000});ws.onopen=()=>{console.log(u,'OPEN in '+(Date.now()-t0)+'ms');try{ws.close()}catch(e){}};ws.onerror=(e)=>{console.log(u,'ERROR after '+(Date.now()-t0)+'ms '+(e.message||''))}}" 2>&1
  else
    echo "node/ws در دسترس نیست — همان curl بالا کافی است"
  fi
}

case "${1:-}" in
  --check-cookie) check_cookie "${2:-}"; exit 0;;
  --soniox-egress) soniox_egress 2>&1 | mask | tee -a "$REPORT"; echo "report: $REPORT"; exit 0;;
  -h|--help) sed -n '2,20p' "$0"; exit 0;;
esac

# ---------- حالت اصلی: collect ----------
say "===== Feelia diag collect ${TS} ====="
say "APP_DIR=$APP_DIR  WINDOW=${WINDOW}s"
say ""
say "!!! در یک ترمینال دیگر، الان مسیر مرورگر را ۱-۲ بار برو:"
say "    login -> GET /api/auth/me -> GET /api/stt/check"
say "!!! ساعت دقیق هر 401 را یادداشت کن. پایان شنود با Ctrl+C"
say ""

say "----- [1] date -----"; date | tee -a "$REPORT"
say "----- [2] port 3000 listener -----"
(ss -ltnp 2>/dev/null | grep ':3000' || netstat -ltnp 2>/dev/null | grep ':3000' || echo "no listener info (ss/netstat missing)") | mask | tee -a "$REPORT"
say "----- [3] app process -----"
(ps aux 2>/dev/null | grep -E "node.*(dist/index|server-deploy)" | grep -v grep || echo "no node process matched") | mask | tee -a "$REPORT"

say "----- [4] nginx relevant config -----"
if command -v nginx >/dev/null 2>&1; then
  nginx -T 2>/dev/null | grep -B2 -A8 -E "server_name .*feelia|location .*(api|ws)|proxy_set_header|proxy_cookie|proxy_pass" | mask | tee -a "$REPORT"
else
  say "nginx binary not found"
fi

say "----- [5] app logs, recent 15min -----"
if systemctl list-units --type=service 2>/dev/null | grep -qi feelia; then
  unit=$(systemctl list-units --type=service 2>/dev/null | grep -ioE '[a-z0-9_.-]*feelia[a-z0-9_.-]*\.service' | head -n1)
  say "unit=$unit"
  journalctl -u "$unit" --since "15 minutes ago" --no-pager 2>/dev/null | tail -n 120 | mask | tee -a "$REPORT"
elif command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -qi feelia; then
  pm2 logs --nostream --lines 80 2>/dev/null | mask | tee -a "$REPORT"
elif command -v docker >/dev/null 2>&1 && docker ps 2>/dev/null | grep -qi feelia; then
  c=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i feelia | head -n1)
  say "container=$c"
  docker logs --since 15m "$c" 2>&1 | tail -n 120 | mask | tee -a "$REPORT"
else
  say "no systemd/pm2/docker feelia unit detected — خروجی دستی لازم است"
fi

say "----- [6] nginx access/error, recent auth+stt hits -----"
LOGFILES=$(nginx -T 2>/dev/null | grep -Eo "access_log [^ ;]+|error_log [^ ;]+" | awk '{print $2}' | tr -d ';' | sort -u)
[ -z "$LOGFILES" ] && LOGFILES="/var/log/nginx/access.log /var/log/nginx/error.log"
for f in $LOGFILES; do
  if [ -f "$f" ]; then
    say "== $f =="
    grep -E "api/auth|api/stt|/ws/" "$f" 2>/dev/null | tail -n 40 | mask | tee -a "$REPORT"
  else
    say "== $f (missing) =="
  fi
done

say ""
say "----- [7] LIVE capture ${WINDOW}s — الان تست مرورگر را انجام بده -----"
LIVEFILES=""; for f in $LOGFILES; do [ -f "$f" ] && LIVEFILES="$LIVEFILES $f"; done
if [ -n "$LIVEFILES" ]; then
  # shellcheck disable=SC2086
  timeout "$WINDOW" tail -n0 -F $LIVEFILES 2>/dev/null | grep --line-buffered -E "api/auth|api/stt|/ws/|==>" | mask | tee -a "$REPORT"
else
  say "no live files to follow"
fi

say ""
say "===== DONE report=$REPORT (masked) ====="
echo "گزارش masked آماده است: $REPORT"
