// Route snapshot — قراردادِ HTTPِ backend به‌صورتِ متنِ مرتب: هر route با method/path، hookهایِ مؤثرش
// (onRequest/preHandler/… به ترتیبِ اجرا، شاملِ hookهایِ ارث‌رسیده از plugin) و گزینه‌هایِ route (bodyLimit،
// websocket). برایِ refactor: اگر فهرستِ routeها یا guardها (requireAuth/requireAdmin/…) عوض شود، diff خالی نیست.
//
//   pnpm test:routes            ⇒ مقایسه با scripts/route-snapshot.txt (خروجِ ۱ در اختلاف)
//   pnpm test:routes --update   ⇒ بازنویسیِ scripts/route-snapshot.txt
//
// بدونِ DB/شبکه: فقط buildApp() + app.ready() (هیچ درخواستی زده نمی‌شود، هیچ jobی شروع نمی‌شود).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { FastifyInstance, RouteOptions } from 'fastify';

const SNAPSHOT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'route-snapshot.txt');

export type RouteCollector = { onRoute: (opts: RouteOptions) => void; routes: RouteOptions[] };

export function createRouteCollector(): RouteCollector {
  const routes: RouteOptions[] = [];
  return { routes, onRoute: (opts) => { routes.push(opts); } };
}

function fnName(f: unknown): string {
  if (typeof f !== 'function') return String(f);
  return f.name || 'anonymous';
}

function hookNames(v: unknown): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(fnName);
}

// printRoutes({commonPrefix:false, includeHooks:true}) درختی است: هر گره یک تکه‌ی مسیر (با تورفتگیِ ۴ نویسه در
// هر سطح) + گروه‌هایِ method با خطوطِ «• (hook) [names]». مسیرِ کامل از پشته‌ی تکه‌ها بازسازی می‌شود و خروجی
// per (method, path) مرتب می‌شود تا ترتیبِ درج در radix tree بی‌اثر باشد.
function effectiveHooks(app: FastifyInstance): Map<string, string[]> {
  const text = app.printRoutes({ commonPrefix: false, includeHooks: true });
  const out = new Map<string, string[]>();
  const stack: string[] = [];
  let currentKeys: string[] = [];
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const hookPos = raw.indexOf('•');
    if (hookPos >= 0) {
      const hook = /•\s*\((\w+)\)\s*(.*)$/.exec(raw);
      if (hook) for (const k of currentKeys) out.get(k)!.push(`${hook[1]}=${hook[2].trim()}`);
      continue;
    }
    const m = /^([│├└─\s]*?)(\S+)\s+\(([^)]*)\)\s*$/.exec(raw);
    if (!m) continue;
    const depth = Math.round(m[1].length / 4);
    stack.length = depth;
    stack[depth - 1] = m[2];
    const full = stack.join('');
    currentKeys = m[3].split(',').map((x) => `${x.trim()} ${full}`);
    for (const k of currentKeys) if (!out.has(k)) out.set(k, []);
  }
  return out;
}

export async function describeRoutes(app: FastifyInstance, collected: RouteOptions[]): Promise<string> {
  await app.ready();
  const lines: string[] = [];
  for (const r of collected) {
    const methods = (Array.isArray(r.method) ? r.method : [r.method]).join(',');
    const opts = [
      `bodyLimit=${r.bodyLimit ?? '-'}`,
      `websocket=${(r as { websocket?: boolean }).websocket ? 'true' : 'false'}`,
      `routePreHandler=[${hookNames(r.preHandler).join(',')}]`,
      `routeOnRequest=[${hookNames(r.onRequest).join(',')}]`,
    ];
    lines.push(`ROUTE ${methods} ${r.url} ${opts.join(' ')}`);
  }
  lines.sort();
  const hooks = effectiveHooks(app);
  const hookLines: string[] = [];
  for (const [k, v] of hooks) hookLines.push(`HOOKS ${k} ${v.join(' ')}`);
  hookLines.sort();
  return [...lines, ...hookLines].join('\n') + '\n';
}

async function main() {
  const update = process.argv.includes('--update');
  const { buildApp } = await import('../server/src/app.js');
  const collector = createRouteCollector();
  const app = await buildApp({ onRoute: collector.onRoute });
  const snap = await describeRoutes(app, collector.routes);
  await app.close();
  if (update || !existsSync(SNAPSHOT_FILE)) {
    writeFileSync(SNAPSHOT_FILE, snap);
    console.log(`route snapshot written (${snap.split('\n').filter((l) => l.startsWith('ROUTE')).length} routes): ${SNAPSHOT_FILE}`);
    return;
  }
  const expected = readFileSync(SNAPSHOT_FILE, 'utf8').replace(/\r\n/g, '\n');
  if (expected === snap) {
    console.log(`route snapshot OK (${snap.split('\n').filter((l) => l.startsWith('ROUTE')).length} routes)`);
    return;
  }
  const a = new Set(expected.split('\n'));
  const b = new Set(snap.split('\n'));
  for (const l of a) if (!b.has(l)) console.log('- ' + l);
  for (const l of b) if (!a.has(l)) console.log('+ ' + l);
  console.log('route snapshot DIFFERS');
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
