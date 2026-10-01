// use-caseهایِ واحدِ درمان. به پورت وابسته است، نه به SQL — adapter در index پایین تزریق می‌شود.
import { buildSonioxContext, withPreNote, type SonioxContext } from '../domain/sonioxContext.js';
import {
  IMPLICIT_MEMBER_ID, findUnitType, implicitIndividualMember, memberLabels, normalizeMembers, resolveAttendees, speakerProfile,
} from '../domain/rules.js';
import { TreatmentUnitValidationError } from '../domain/errors.js';
import type { Catalog, MemberInput, TreatmentUnit } from '../domain/types.js';
import type { TreatmentUnitRepo } from '../ports/treatmentUnitRepo.port.js';

export interface TreatmentUnitConfig {
  catalogTtlMs: number;
  context: { maxTerms: number; maxChars: number };
  // سقفِ نویسه‌یِ یادداشتِ پیش از جلسه در context.text؛ ۰ ⇒ خاموش
  preNoteMaxChars: number;
  // contextِ پایه/fallback (وقتی اطلاعاتِ واحد نیست یا خواندنش شکست خورد)
  baseContext: SonioxContext;
}

export class TreatmentUnitService {
  private cache: { at: number; catalog: Catalog } | null = null;

  constructor(private readonly repo: TreatmentUnitRepo, private readonly cfg: TreatmentUnitConfig) {}

  async catalog(): Promise<Catalog> {
    if (this.cache && Date.now() - this.cache.at < this.cfg.catalogTtlMs) return this.cache.catalog;
    const catalog = await this.repo.loadCatalog();
    this.cache = { at: Date.now(), catalog };
    return catalog;
  }

  async getUnit(clientId: string): Promise<TreatmentUnit | null> {
    const row = await this.repo.getClientUnit(clientId);
    if (!row) return null;
    if (row.members.length) return { clientId, unitType: row.unitType, members: row.members };
    // مراجعِ قدیمی/فردیِ بدونِ ردیف: عضوِ ضمنی از ستون‌هایِ clients
    return { clientId, unitType: row.unitType, members: [implicitIndividualMember(await this.catalog(), row)] };
  }

  // خروجیِ API: واحد + برچسبِ نمایشیِ هر عضو (برچسب‌ها از کاتالوگ مشتق می‌شوند)
  async describeUnit(clientId: string) {
    const unit = await this.getUnit(clientId);
    if (!unit) return null;
    const labels = memberLabels(await this.catalog(), unit.members);
    return {
      unit_type: unit.unitType,
      members: unit.members.map((m) => ({ id: m.id, role: m.role, alias: m.alias, category: m.category, gender: m.gender, label: labels.get(m.id) })),
    };
  }

  // اعتبارسنجی بدونِ نوشتن — برایِ POST /api/clients پیش از INSERT
  async validate(unitType: string, members: MemberInput[]) {
    return normalizeMembers(await this.catalog(), unitType, members);
  }

  // ساخت یا ارتقا/تغییرِ واحد. اعضایِ با id ِموجود حفظ می‌شوند.
  async saveUnit(clientId: string, unitType: string, members: MemberInput[]) {
    const normalized = await this.validate(unitType, members);
    await this.repo.replaceUnit(clientId, unitType, normalized.map((m) => (m.id === IMPLICIT_MEMBER_ID ? { ...m, id: undefined } : m)));
    return this.describeUnit(clientId);
  }

  // حاضرینِ جلسه → مقدارِ ذخیره‌ای. null یعنی «همه» (پیش‌فرض) — برایِ فردیِ ضمنی همیشه null.
  async attendeesForNewSession(clientId: string, attendees: unknown): Promise<string[] | null> {
    if (attendees == null) return null;
    const unit = await this.getUnit(clientId);
    if (!unit) throw new TreatmentUnitValidationError('client-not-found', 'مراجع یافت نشد');
    const ids = resolveAttendees(unit, attendees);
    if (ids.length === unit.members.length || ids.includes(IMPLICIT_MEMBER_ID)) return null;
    return ids;
  }

  async listTherapistModalities(therapistId: string) {
    return this.repo.getTherapistModalities(therapistId);
  }

  async setTherapistModalities(therapistId: string, codes: unknown) {
    if (!Array.isArray(codes) || codes.some((c) => typeof c !== 'string')) {
      throw new TreatmentUnitValidationError('modalities-invalid', 'فهرستِ رویکردها نامعتبر است');
    }
    const known = new Set((await this.catalog()).modalities.map((m) => m.code));
    const clean = Array.from(new Set(codes as string[]));
    if (clean.some((c) => !known.has(c))) throw new TreatmentUnitValidationError('modality-unknown', 'رویکردِ ناشناخته');
    await this.repo.setTherapistModalities(therapistId, clean);
    return clean;
  }

  // حاضرینِ جلسه برایِ نقش‌گذاریِ «متنِ نهایی» (برچسبِ نمایشی + واژه‌هایِ رویکرد). fail-open: null.
  async sessionSpeakerRoster(sessionId: string): Promise<{ unitLabel: string; speakers: string[]; terms: string[] } | null> {
    try {
      const src = await this.repo.getSessionContextSource(sessionId);
      if (!src) return null;
      const catalog = await this.catalog();
      const unit = await this.getUnit(src.clientId);
      if (!unit) return null;
      const profile = speakerProfile(catalog, unit, src.attendees);
      if (!profile) return null;
      const mods = catalog.modalities.filter((m) => src.therapistModalities.includes(m.code));
      return {
        unitLabel: profile.unitType.labelFa,
        speakers: profile.speakers.map((s) => s.label),
        terms: Array.from(new Set(mods.flatMap((m) => m.terms))).slice(0, this.cfg.context.maxTerms),
      };
    } catch (e) {
      console.log(`[treatment-unit] roster fallback session=${sessionId} err=${(e as Error)?.name || 'error'}`);
      return null;
    }
  }

  // contextِ Soniox برایِ یک جلسه. هرگز پرتاب نمی‌کند (LAW-012 fail-open): در هر خطا contextِ پایه.
  async sessionSttContext(sessionId: string): Promise<SonioxContext> {
    const ctx = await this.baseSessionContext(sessionId);
    if (!(this.cfg.preNoteMaxChars > 0)) return ctx;
    try {
      return withPreNote(ctx, await this.repo.getSessionPreNotes(sessionId), this.cfg.preNoteMaxChars);
    } catch (e) {
      console.log(`[treatment-unit] pre-note context skipped session=${sessionId} err=${(e as Error)?.name || 'error'}`);
      return ctx;
    }
  }

  private async baseSessionContext(sessionId: string): Promise<SonioxContext> {
    try {
      const src = await this.repo.getSessionContextSource(sessionId);
      if (!src) return this.cfg.baseContext;
      const catalog = await this.catalog();
      const unit = await this.getUnit(src.clientId);
      if (!unit || !findUnitType(catalog, unit.unitType)) return this.cfg.baseContext;
      const profile = speakerProfile(catalog, unit, src.attendees);
      const mods = catalog.modalities.filter((m) => src.therapistModalities.includes(m.code));
      return buildSonioxContext(profile, mods, this.cfg.baseContext, this.cfg.context);
    } catch (e) {
      console.log(`[treatment-unit] context fallback session=${sessionId} err=${(e as Error)?.name || 'error'}`);
      return this.cfg.baseContext;
    }
  }
}
