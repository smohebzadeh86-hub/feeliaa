// harness واحدِ درمان — بدونِ DB/شبکه. کاتالوگ و repo جعلی، دادهٔ ساختگی (LAW-001).
// اجرا: pnpm test:tu
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TreatmentUnitService } from '../server/src/features/treatment-unit/application/treatmentUnitService.js';
import { buildSonioxContext, withPreNote } from '../server/src/features/treatment-unit/domain/sonioxContext.js';
import { memberLabels, normalizeMembers, speakerProfile } from '../server/src/features/treatment-unit/domain/rules.js';
import { TreatmentUnitValidationError } from '../server/src/features/treatment-unit/domain/errors.js';
import type { Catalog, Member } from '../server/src/features/treatment-unit/domain/types.js';
import type { TreatmentUnitRepo, ClientUnitRow } from '../server/src/features/treatment-unit/ports/treatmentUnitRepo.port.js';

let pass = 0, fail = 0;
async function t(name: string, fn: () => void | Promise<void>) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e: any) { fail++; console.log('FAIL ' + name + ' — ' + (e?.message || e)); }
}

const role = (code: string, labelFa: string, gender: any, ageGroup: any, askAge: boolean, askGender: boolean, contextLabel: string) =>
  ({ code, labelFa, gender, ageGroup, askAge, askGender, contextLabel, sort: 0 });
const catalog: Catalog = {
  roles: [
    role('client', 'مراجع', null, null, true, true, 'client'),
    role('partner_f', 'همسر', 'f', 'adult', false, false, 'adult woman (partner)'),
    role('partner_m', 'همسر', 'm', 'adult', false, false, 'adult man (partner)'),
    role('mother', 'مادر', 'f', 'adult', false, false, 'mother (adult woman)'),
    role('son', 'پسر', 'm', null, true, false, 'son'),
    role('child', 'کودک', null, 'child', false, true, 'child'),
  ],
  unitTypes: [
    { code: 'individual', labelFa: 'فردی', minMembers: 1, maxMembers: 1, allowedRoles: ['client'], presets: [], contextSetting: 'individual psychotherapy session', sort: 1 },
    { code: 'couple', labelFa: 'زوج', minMembers: 2, maxMembers: 2, allowedRoles: ['partner_f', 'partner_m'],
      presets: [{ key: 'fm', labelFa: 'زن و مرد', roles: ['partner_f', 'partner_m'], default: true }], contextSetting: 'couple therapy session', sort: 2 },
    { code: 'family', labelFa: 'خانواده', minMembers: 2, maxMembers: 8, allowedRoles: ['mother', 'son'], presets: [], contextSetting: 'family therapy session', sort: 3 },
  ],
  modalities: [{ code: 'eft', labelFa: 'EFT', defaultUnit: 'couple', contextLabel: 'emotionally focused therapy', terms: ['چرخه منفی', 'دلبستگی'], sort: 1 }],
};
const BASE = { general: [{ key: 'domain', value: 'Psychotherapy / counseling' }, { key: 'setting', value: 'fallback' }] };
const LIMITS = { maxTerms: 60, maxChars: 8000 };

class FakeRepo implements TreatmentUnitRepo {
  clients = new Map<string, ClientUnitRow>();
  sessions = new Map<string, { clientId: string; attendees: string[] | null; therapistModalities: string[] }>();
  mods: string[] = [];
  notes: string[] = [];
  fail = false;
  seq = 0;
  async loadCatalog() { if (this.fail) throw new Error('db down'); return catalog; }
  async getClientUnit(id: string) { return this.clients.get(id) ?? null; }
  async replaceUnit(id: string, unitType: string, members: any[]) {
    const row = this.clients.get(id)!;
    row.unitType = unitType;
    row.members = members.map((m, i) => ({ ...m, id: m.id ?? `m${++this.seq}`, sort: i })) as Member[];
  }
  async getSessionContextSource(id: string) { if (this.fail) throw new Error('db down'); return this.sessions.get(id) ?? null; }
  async getSessionPreNotes() { if (this.fail) throw new Error('db down'); return this.notes; }
  async getTherapistModalities() { return this.mods; }
  async setTherapistModalities(_: string, c: string[]) { this.mods = c; }
}
const mk = () => {
  const repo = new FakeRepo();
  return { repo, svc: new TreatmentUnitService(repo, { catalogTtlMs: 60_000, context: LIMITS, preNoteMaxChars: 2000, baseContext: BASE }) };
};

(async () => {
  await t('normalize: نقشِ ضمنی سن/جنسیت را تحمیل می‌کند', () => {
    const m = normalizeMembers(catalog, 'couple', [{ role: 'partner_f', gender: 'm' }, { role: 'partner_m' }]);
    assert.equal(m[0].gender, 'f');
    assert.equal(m[0].category, 'adult');
    assert.equal(m[1].gender, 'm');
  });
  await t('normalize: تعدادِ اعضا خارج از بازه رد می‌شود', () => {
    assert.throws(() => normalizeMembers(catalog, 'couple', [{ role: 'partner_f' }]), (e: any) => e instanceof TreatmentUnitValidationError && e.code === 'members-count');
  });
  await t('normalize: نقشِ غیرمجاز برایِ نوع رد می‌شود', () => {
    assert.throws(() => normalizeMembers(catalog, 'couple', [{ role: 'mother' }, { role: 'partner_m' }]), /مجاز نیست/);
  });
  await t('normalize: نوعِ ناشناخته رد می‌شود', () => {
    assert.throws(() => normalizeMembers(catalog, 'group', [{ role: 'client' }]), (e: any) => e.code === 'unit-type-invalid');
  });
  await t('normalize: سن فقط برایِ نقشِ ask_age نگه داشته می‌شود', () => {
    const m = normalizeMembers(catalog, 'family', [{ role: 'mother', category: 'teen' }, { role: 'son', category: 'teen' }]);
    assert.equal(m[0].category, 'adult');
    assert.equal(m[1].category, 'teen');
  });
  await t('برچسب: نقشِ تکراری شماره می‌گیرد، مستعار اولویت دارد', () => {
    const ms: Member[] = [
      { id: 'a', role: 'partner_f', alias: null, category: 'adult', gender: 'f', sort: 0 },
      { id: 'b', role: 'partner_m', alias: null, category: 'adult', gender: 'm', sort: 1 },
      { id: 'c', role: 'son', alias: 'الف', category: 'child', gender: 'm', sort: 2 },
    ];
    const l = memberLabels(catalog, ms);
    assert.equal(l.get('a'), 'همسر 1');
    assert.equal(l.get('b'), 'همسر 2');
    assert.equal(l.get('c'), 'الف');
  });
  await t('context: زوجِ کامل = ۳ گوینده با نقش‌ها + واژه‌هایِ رویکرد', () => {
    const unit = { clientId: 'x', unitType: 'couple', members: normalizeMembers(catalog, 'couple', [{ role: 'partner_f' }, { role: 'partner_m' }]).map((m, i) => ({ ...m, id: 'm' + i })) as Member[] };
    const p = speakerProfile(catalog, unit, null)!;
    assert.equal(p.speakerCount, 3);
    const ctx = buildSonioxContext(p, catalog.modalities, BASE, LIMITS);
    const sp = ctx.general.find((g) => g.key === 'speakers')!.value;
    assert.match(sp, /^3 distinct speakers/);
    assert.match(sp, /adult woman/);
    assert.match(sp, /adult man/);
    assert.equal(ctx.general.find((g) => g.key === 'setting')!.value.startsWith('couple therapy session'), true);
    assert.deepEqual(ctx.terms, ['چرخه منفی', 'دلبستگی']);
  });
  await t('context: زوج، فقط یک نفر حاضر = ۲ گوینده', () => {
    const unit = { clientId: 'x', unitType: 'couple', members: [
      { id: 'a', role: 'partner_f', alias: null, category: 'adult', gender: 'f', sort: 0 },
      { id: 'b', role: 'partner_m', alias: null, category: 'adult', gender: 'm', sort: 1 }] as Member[] };
    assert.equal(speakerProfile(catalog, unit, ['b'])!.speakerCount, 2);
  });
  await t('context: هیچ مستعاری واردِ context نمی‌شود (LAW-001)', () => {
    const unit = { clientId: 'x', unitType: 'family', members: [
      { id: 'a', role: 'mother', alias: 'نام‌مستعار۱', category: 'adult', gender: 'f', sort: 0 },
      { id: 'b', role: 'son', alias: 'نام‌مستعار۲', category: 'teen', gender: 'm', sort: 1 }] as Member[] };
    const ctx = buildSonioxContext(speakerProfile(catalog, unit, null), [], BASE, LIMITS);
    assert.equal(JSON.stringify(ctx).includes('نام‌مستعار'), false);
    assert.match(ctx.general.find((g) => g.key === 'speakers')!.value, /son \(teenager\)/);
  });
  await t('context: سقفِ طول رعایت می‌شود', () => {
    const many = [{ ...catalog.modalities[0], terms: Array.from({ length: 500 }, (_, i) => 'واژه' + i) }];
    const unit = { clientId: 'x', unitType: 'individual', members: [{ id: 'self', role: 'client', alias: null, category: 'adult', gender: 'f', sort: 0 }] as Member[] };
    const ctx = buildSonioxContext(speakerProfile(catalog, unit, null), many, BASE, { maxTerms: 500, maxChars: 1500 });
    assert.ok(JSON.stringify(ctx).length <= 1500);
    assert.ok(ctx.general.some((g) => g.key === 'speakers'));
  });
  await t('سرویس: مراجعِ قدیمی (بدونِ ردیفِ عضو) = فردیِ ضمنی از ستون‌هایِ clients', async () => {
    const { repo, svc } = mk();
    repo.clients.set('c1', { unitType: 'individual', category: 'teen', gender: 'm', members: [] });
    const d = await svc.describeUnit('c1');
    assert.equal(d!.members.length, 1);
    assert.equal(d!.members[0].id, 'self');
    assert.equal(d!.members[0].category, 'teen');
  });
  await t('سرویس: ارتقایِ فردی → زوج، همان پرونده', async () => {
    const { repo, svc } = mk();
    repo.clients.set('c1', { unitType: 'individual', category: 'adult', gender: 'f', members: [] });
    const u = await svc.saveUnit('c1', 'couple', [{ id: 'self', role: 'partner_f' }, { role: 'partner_m' }]);
    assert.equal(u!.unit_type, 'couple');
    assert.equal(u!.members.length, 2);
    assert.ok(u!.members.every((m) => m.id !== 'self'));
  });
  await t('سرویس: حاضرین — همه ⇒ null، زیرمجموعه ذخیره، ناشناخته/خالی رد', async () => {
    const { repo, svc } = mk();
    repo.clients.set('c1', { unitType: 'couple', category: null, gender: null, members: [
      { id: 'a', role: 'partner_f', alias: null, category: 'adult', gender: 'f', sort: 0 },
      { id: 'b', role: 'partner_m', alias: null, category: 'adult', gender: 'm', sort: 1 }] });
    assert.equal(await svc.attendeesForNewSession('c1', undefined), null);
    assert.equal(await svc.attendeesForNewSession('c1', ['a', 'b']), null);
    assert.deepEqual(await svc.attendeesForNewSession('c1', ['a']), ['a']);
    await assert.rejects(svc.attendeesForNewSession('c1', ['zz']), (e: any) => e.code === 'attendees-unknown');
    await assert.rejects(svc.attendeesForNewSession('c1', []), (e: any) => e.code === 'attendees-empty');
  });
  await t('سرویس: contextِ جلسه با رویکردِ درمانگر', async () => {
    const { repo, svc } = mk();
    repo.clients.set('c1', { unitType: 'couple', category: null, gender: null, members: [
      { id: 'a', role: 'partner_f', alias: null, category: 'adult', gender: 'f', sort: 0 },
      { id: 'b', role: 'partner_m', alias: null, category: 'adult', gender: 'm', sort: 1 }] });
    repo.sessions.set('s1', { clientId: 'c1', attendees: null, therapistModalities: ['eft'] });
    const ctx = await svc.sessionSttContext('s1');
    assert.match(ctx.general.find((g) => g.key === 'speakers')!.value, /^3 /);
    assert.equal(ctx.general.find((g) => g.key === 'approach')!.value, 'emotionally focused therapy');
  });
  await t('سرویس: fail-open — خطایِ DB ⇒ contextِ پایه (LAW-012)', async () => {
    const { repo, svc } = mk();
    repo.fail = true;
    assert.deepEqual(await svc.sessionSttContext('s1'), BASE);
  });
  await t('یادداشتِ پیش از جلسه: به context.text می‌رود (با و بدونِ واحدِ درمان)، سقف و خاموشی', async () => {
    const { repo, svc } = mk();
    repo.notes = ['برادرش پدرام و همسرش شیواست', 'کلینیک آرمان'];
    // جلسه‌ای که واحدِ درمانش معلوم نیست ⇒ contextِ پایه + text
    const c0 = await svc.sessionSttContext('none');
    assert.equal(c0.text, 'برادرش پدرام و همسرش شیواست\nکلینیک آرمان');
    assert.deepEqual(c0.general, BASE.general);
    // سقفِ طول
    repo.notes = ['ا'.repeat(5000)];
    assert.equal((await svc.sessionSttContext('none')).text!.length, 2000);
    // بدونِ یادداشت ⇒ text نیست
    repo.notes = [];
    assert.equal((await svc.sessionSttContext('none')).text, undefined);
    // خطایِ خواندنِ یادداشت ⇒ fail-open (contextِ پایه)
    repo.fail = true;
    assert.deepEqual(await svc.sessionSttContext('none'), BASE);
  });
  await t('withPreNote: خاموش (۰) ⇒ بدونِ تغییر؛ سقفِ سختِ ۹۵۰۰ کلِ context را رعایت می‌کند', () => {
    assert.deepEqual(withPreNote(BASE, ['x'], 0), BASE);
    const big = { general: [{ key: 'k', value: 'v'.repeat(9000) }] };
    const out = withPreNote(big, ['ا'.repeat(2000)], 2000);
    assert.ok(JSON.stringify(out).length <= 9500, 'سقفِ کل');
    const huge = { general: [{ key: 'k', value: 'v'.repeat(9480) }] };
    assert.equal(withPreNote(huge, ['abc'], 2000).text, undefined, 'جایی برایِ یادداشت نیست');
  });
  await t('سرویس: رویکردِ ناشناخته رد می‌شود', async () => {
    const { svc } = mk();
    await assert.rejects(svc.setTherapistModalities('t', ['nope']), (e: any) => e.code === 'modality-unknown');
    assert.deepEqual(await svc.setTherapistModalities('t', ['eft', 'eft']), ['eft']);
  });
  await t('migration 029: بدونِ نقطه‌ویرگول در متن/کامنت (runner با ; تکه می‌کند)', () => {
    const sql = readFileSync(new URL('../server/src/db/mysql/migrations/029_treatment_unit.sql', import.meta.url), 'utf-8');
    const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const s of stmts) {
      const body = s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
      assert.match(body, /^(CREATE TABLE|ALTER TABLE|INSERT IGNORE)/, 'تکه‌ی نامعتبر: ' + body.slice(0, 40));
    }
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
