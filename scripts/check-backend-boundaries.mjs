// قواعدِ مرزِ ماژول‌هایِ backend (pnpm test:arch) — بدونِ dependency؛ فقط importهایِ نسبیِ server/src را می‌خواند.
//
//  R1  هر feature از featureِ دیگر فقط از طریقِ features/<x>/index.ts import می‌کند (static یا dynamic).
//  R2  shared/، db/، auth/، obs/ و llm/ هرگز از features/ import نمی‌کنند.
//  R3  ریشه‌ی ترکیب (app.ts، index.ts، jobs/) فقط features/<x>/index.ts یا فایلِ route (*.routes.ts) را import می‌کند.
//  R4  چرخه‌ی importِ استاتیک ممنوع است (importِ پویا و import type شمرده نمی‌شوند).
//  R5  featureهایِ لایه‌ای (case-file، treatment-unit، final-transcript): domain/ به هیچ لایه‌ی دیگرِ feature وابسته نیست؛
//      application/ و prompts/ از adapters/ و api/ import نمی‌کنند؛ adapters/ از application/ و api/ import نمی‌کنند
//      (سیم‌کشی فقط در composition.ts / instance.ts / runner.ts در ریشه‌ی feature).
//  R7  هر feature باید index.ts داشته باشد؛ featureهایِ فاقدِ آن فعلاً در allowlistِ نام‌دار (بدهی، LAW-025).
//  R6  پوشه‌هایِ قدیمیِ http/، stt/ و ws/ وجود ندارند.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'src');
const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'mysql' && n !== 'migrations') walk(p, out); }
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

// import/export با specifierِ نسبی. kind: static | type | dynamic
function importsOf(file) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  const staticRe = /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const m of text.matchAll(staticRe)) out.push({ spec: m[3], kind: m[2] ? 'type' : 'static' });
  for (const m of text.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    out.push({ spec: m[1], kind: /await\s*$|\(\s*$|void\s*$/.test(before) || !/:\s*$/.test(before) ? 'dynamic' : 'type' });
  }
  return out.map((i) => {
    let t = path.resolve(path.dirname(file), i.spec);
    if (t.endsWith('.js')) t = t.slice(0, -3) + '.ts';
    return { ...i, target: t };
  });
}

const LAYERED = new Set(['case-file', 'treatment-unit', 'final-transcript']);
const LAYERS = new Set(['domain', 'application', 'prompts', 'adapters', 'api', 'ports']);
// R7: featureهایِ بدونِ index.ts (بدهی؛ رفع در backlog — هر مورد را فقط با ساختنِ index.ts می‌توان از این فهرست برداشت)
const NO_INDEX_ALLOWLIST = new Set(['admin', 'auth', 'client-config', 'legacy-ws']);
const files = walk(SRC);
const violations = [];
const graph = new Map();
const featureOf = (r) => (r.startsWith('features/') ? r.split('/')[1] : null);
const topOf = (r) => r.split('/')[0];

for (const f of files) {
  const fr = rel(f);
  const edges = [];
  for (const imp of importsOf(f)) {
    const tr = rel(imp.target);
    if (!existsSync(imp.target)) { violations.push(`unresolved import ${fr} -> ${imp.spec}`); continue; }
    if (imp.kind === 'static') edges.push(tr);
    const fa = featureOf(fr), fb = featureOf(tr);
    // R1
    if (fa && fb && fa !== fb && tr !== `features/${fb}/index.ts`) {
      violations.push(`R1 ${fr} -> ${tr} (use features/${fb}/index.ts)`);
    }
    // R2
    if (['shared', 'db', 'auth', 'obs', 'llm'].includes(topOf(fr)) && fb) violations.push(`R2 ${fr} -> ${tr}`);
    // R3
    if ((fr === 'app.ts' || fr === 'index.ts' || fr.startsWith('jobs/')) && fb
      && !(tr === `features/${fb}/index.ts` || /\.routes\.ts$/.test(tr))) {
      violations.push(`R3 ${fr} -> ${tr}`);
    }
    // R5
    if (fa && fa === fb && LAYERED.has(fa)) {
      const la = fr.split('/')[2], lb = tr.split('/')[2];
      const bad = LAYERS.has(la) && LAYERS.has(lb) && (
        (la === 'domain' && lb !== 'domain') ||
        ((la === 'application' || la === 'prompts') && (lb === 'adapters' || lb === 'api')) ||
        (la === 'adapters' && (lb === 'application' || lb === 'api')));
      if (bad && imp.kind !== 'type') violations.push(`R5 ${fr} -> ${tr}`);
    }
  }
  graph.set(fr, edges);
}

// R4: چرخه‌ها (DFS)
const state = new Map();
const stack = [];
function dfs(n) {
  state.set(n, 1); stack.push(n);
  for (const m of graph.get(n) || []) {
    if (state.get(m) === 1) violations.push(`R4 cycle: ${[...stack.slice(stack.indexOf(m)), m].join(' -> ')}`);
    else if (!state.has(m)) dfs(m);
  }
  stack.pop(); state.set(n, 2);
}
for (const n of graph.keys()) if (!state.has(n)) dfs(n);

// R7
for (const f of readdirSync(path.join(SRC, 'features'))) {
  const dir = path.join(SRC, 'features', f);
  if (!statSync(dir).isDirectory()) continue;
  const has = existsSync(path.join(dir, 'index.ts'));
  if (!has && !NO_INDEX_ALLOWLIST.has(f)) violations.push(`R7 feature بدونِ index.ts: features/${f}/ (به allowlist اضافه نکنید؛ index.ts بسازید)`);
  if (has && NO_INDEX_ALLOWLIST.has(f)) violations.push(`R7 features/${f}/ اکنون index.ts دارد؛ از NO_INDEX_ALLOWLIST حذفش کنید`);
}

// R6
for (const d of ['http', 'stt', 'ws']) if (existsSync(path.join(SRC, d))) violations.push(`R6 legacy directory still exists: ${d}/`);

if (violations.length) {
  for (const v of violations) console.log(v);
  console.log(`backend boundaries: ${violations.length} violation(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`backend boundaries OK (${files.length} files, ${[...graph.values()].reduce((a, e) => a + e.length, 0)} static imports, no cycles)`);
