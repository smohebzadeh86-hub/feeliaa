// بهداشتِ مستندات (pnpm test:docs، LAW-027) — بدونِ dependency، بدونِ DB/شبکه.
//  D1  هر پوشه‌ی server/src/features/* و platform (llm/obs/db/shared/jobs) در feature-index ردیف دارد و سندِ مالکش موجود است.
//  D2  هر سندِ docs/**.md در documentation-map ثبت است.
//  D3  لینک‌هایِ نسبیِ markdown در docs/** و اسنادِ ریشه به فایلِ موجود اشاره می‌کنند.
//  D4  مسیرهایِ `server/src|public|scripts/...` ذکرشده در اسنادِ canonical وجود دارند.
//  D5  همه‌ی routeهایِ scripts/route-snapshot.txt در api-catalog آمده‌اند.
//  D6  همه‌ی migrationها در database-catalog، همه‌ی جدول‌ها در ستونِ «مالک» آمده‌اند.
//  D7  همه‌ی process.env.* در server/src در configuration-catalog آمده‌اند.
//  D8  همه‌ی scriptهایِ package.json در CLAUDE.md §8 آمده‌اند.
//  D9  سندِ مالکِ هر feature خطِ `last-verified:` دارد.
//  D10 symbolهایِ frontend-map در public/ وجود دارند.
//  D11 شناسه‌ی REQ در requirement-catalog تکراری نیست.
//  D12 هر featureِ frontend-map یک banner «// ===== [feature:<id>] =====» در public/index.html دارد.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const errors = [];
const err = (rule, msg) => errors.push(`${rule} ${msg}`);

function walk(dir, ext, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n === '.git') continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (!ext || n.endsWith(ext)) out.push(p);
  }
  return out;
}

const docsFiles = walk(P('docs'), '.md');
const rootDocs = ['CLAUDE.md', 'PROJECT_MASTER_REFERENCE.md'].map((f) => P(f));
// PROJECT_STATUS.md فقط-اضافه‌شدنی و تاریخی است: در D3/D4 نیست
const checkedDocs = [...docsFiles, ...rootDocs].filter((f) => !rel(f).startsWith('docs/08-history/'));
// اسنادِ تاریخی/evidence که مسیرهایِ قدیم را عمداً نگه می‌دارند
const HISTORICAL = /^docs\/(05-plans\/ux-audit-2026-09-14\/|05-plans\/ui-ux-audit-2026-09-14\.md|admin-panel\.md)/;
const pathCheckedDocs = checkedDocs.filter((f) => !HISTORICAL.test(rel(f)));

// ---------- D1 feature-index ----------
const featureIndexPath = P('docs/02-reference/feature-index.md');
const featureIndex = read(featureIndexPath);
const featuresDir = P('server/src/features');
const featureDirs = readdirSync(featuresDir).filter((n) => statSync(path.join(featuresDir, n)).isDirectory());
for (const f of featureDirs) {
  if (!featureIndex.includes(`features/${f}/`)) err('D1', `feature «${f}» در feature-index ردیف ندارد (features/${f}/)`);
}
for (const plat of ['llm', 'obs', 'db', 'shared', 'jobs']) {
  if (!featureIndex.includes(`server/src/${plat}/`)) err('D1', `platform «${plat}» در feature-index ردیف ندارد (server/src/${plat}/)`);
}
const ownerDocs = new Set();
for (const line of featureIndex.split('\n')) {
  if (!/^\|\s*`[a-z-]+`\s*\|/.test(line)) continue;
  for (const m of line.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
    const target = path.resolve(path.dirname(featureIndexPath), m[1]);
    if (!existsSync(target)) err('D1', `سندِ مالکِ feature-index وجود ندارد: ${m[1]}`);
    else ownerDocs.add(target);
  }
}

// ---------- D2 documentation-map ----------
const docMap = read(P('docs/00-governance/documentation-map.md'));
for (const f of docsFiles) {
  const r = rel(f);
  if (HISTORICAL.test(r) && r.includes('ux-audit-2026-09-14/')) continue; // گروهِ UX audit با یک ردیف ثبت شده
  const base = path.basename(f);
  if (!docMap.includes(base) && !docMap.includes(r.replace(/^docs\//, ''))) err('D2', `${r} در documentation-map ثبت نشده`);
}

// ---------- D3 لینک‌ها ----------
for (const f of checkedDocs) {
  const text = read(f).replace(/```[\s\S]*?```/g, '');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    let t = m[1];
    if (/^(https?:|mailto:|#)/.test(t)) continue;
    t = t.split('#')[0];
    if (!t) continue;
    try { t = decodeURIComponent(t); } catch { /* ignore */ }
    const target = path.resolve(path.dirname(f), t);
    if (!existsSync(target)) err('D3', `${rel(f)}: لینکِ شکسته → ${m[1]}`);
  }
}

// ---------- D4 مسیرهایِ ذکرشده ----------
const LEGACY_OK = /^server\/src\/(http|stt|ws)\//; // فقط در نگاشتِ قدیم→جدید و قوانین
for (const f of pathCheckedDocs) {
  const r = rel(f);
  const text = read(f);
  for (const m of text.matchAll(/`((?:server\/src|public|scripts)\/[^`\s]+)`/g)) {
    let t = m[1];
    if (/[*<>{}…–]|\.\.\.|NNN/.test(t)) continue;             // glob/placeholder/بازه
    t = t.replace(/[#:].*$/, '').replace(/[،؛.,)]+$/, '');   // #symbol / :line / علامتِ انتهایی
    if (!t || t.endsWith('/') && existsSync(P(t))) continue;
    if (existsSync(P(t))) continue;
    if (LEGACY_OK.test(t) && /repository-map|project-laws|documentation-map|source-of-truth/.test(r)) continue;
    err('D4', `${r}: مسیرِ ناموجود → ${m[1]}`);
  }
}

// ---------- D5 routeها ----------
const apiCatalog = read(P('docs/02-reference/api-catalog.md'));
for (const line of read(P('scripts/route-snapshot.txt')).split('\n')) {
  const m = /^ROUTE (\S+) (\S+)/.exec(line);
  if (!m || m[1] === 'HEAD' || m[1] === 'OPTIONS') continue;
  if (!apiCatalog.includes(m[2])) err('D5', `route در api-catalog نیست: ${m[1]} ${m[2]}`);
}

// ---------- D6 migration/table ----------
const dbCatalog = read(P('docs/02-reference/database-catalog.md'));
const migDir = P('server/src/db/mysql/migrations');
const tables = new Set();
for (const f of readdirSync(migDir)) {
  if (!/\.(sql|mjs)$/.test(f)) continue;
  if (!dbCatalog.includes(f)) err('D6', `migration در database-catalog نیست: ${f}`);
  if (f.endsWith('.sql')) for (const m of read(path.join(migDir, f)).matchAll(/CREATE TABLE IF NOT EXISTS\s+`?(\w+)`?/g)) tables.add(m[1]);
}
const ownerSection = dbCatalog.split('## ۱. Migrationها')[0];
for (const t of tables) {
  if (!new RegExp('`' + t + '`').test(ownerSection)) err('D6', `جدول در «۰. مالکِ هر جدول» نیست: ${t}`);
}

// ---------- D7 env ----------
const cfg = read(P('docs/02-reference/configuration-catalog.md'));
const envSeen = new Set();
const ENV_IGNORE = new Set(['NODE_ENV', 'HOME', 'PATH', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP']);
for (const f of walk(P('server/src'), '.ts')) {
  const text = read(f);
  for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) envSeen.add(m[1]);
  for (const m of text.matchAll(/\benv\.([A-Z][A-Z0-9_]{2,})/g)) envSeen.add(m[1]);
}
for (const name of [...envSeen].sort()) {
  if (ENV_IGNORE.has(name)) continue;
  if (!cfg.includes(name)) err('D7', `env در configuration-catalog نیست: ${name}`);
}

// ---------- D8 scriptها ----------
const claude = read(P('CLAUDE.md'));
const pkg = JSON.parse(read(P('package.json')));
for (const s of Object.keys(pkg.scripts)) {
  if (s === 'dev') continue;
  if (!claude.includes(s)) err('D8', `script در CLAUDE.md نیست: ${s}`);
}

// ---------- D9 last-verified ----------
for (const f of ownerDocs) {
  if (!/last-verified:\s*\d{4}-\d{2}-\d{2}/.test(read(f))) err('D9', `${rel(f)}: خطِ last-verified ندارد`);
}

// ---------- D10 frontend-map ----------
const fe = ['index.html', 'feelia-rt.js', 'feelia-upload.js', 'feelia-obs.js', 'feelia-analytics.js'].map((n) => read(P('public', n))).join('\n');
for (const line of read(P('docs/02-reference/frontend-map.md')).split('\n')) {
  if (!/^\| `[a-z-]+` \|/.test(line)) continue;
  const cols = line.split('|').map((c) => c.trim());
  for (const c of cols.slice(3, 5)) {
    for (const m of c.matchAll(/`([A-Za-z_$][\w$]*)`/g)) {
      if (!new RegExp('\\b' + m[1].replace(/\$/g, '\\$') + '\\b').test(fe)) err('D10', `frontend-map: symbol در public/ نیست: ${m[1]}`);
    }
  }
}

// ---------- D12 bannerهایِ فرانت ----------
for (const line of read(P('docs/02-reference/frontend-map.md')).split('\n')) {
  const m = /^\| `([a-z-]+)` \|/.exec(line);
  if (m && !read(P('public/index.html')).includes(`[feature:${m[1]}]`)) err('D12', `banner در index.html نیست: [feature:${m[1]}]`);
}

// ---------- D11 REQ ----------
const seenReq = new Map();
for (const line of read(P('docs/03-requirements/requirement-catalog.md')).split('\n')) {
  const m = /^\| (REQ-\d+) \|/.exec(line);
  if (!m) continue;
  seenReq.set(m[1], (seenReq.get(m[1]) || 0) + 1);
}
for (const [id, n] of seenReq) if (n > 1) err('D11', `شناسه‌ی REQ تکراری: ${id} (${n} بار)`);

if (errors.length) {
  console.log(`docs check FAILED (${errors.length}):`);
  for (const e of errors) console.log(' - ' + e);
  process.exit(1);
}
console.log(`docs check OK (${docsFiles.length} docs، ${featureDirs.length} features، ${tables.size} tables، ${envSeen.size} env)`);
