// adapterِ MySQL برایِ پورتِ TreatmentUnitRepo (جداولِ migration 029).
import { randomUUID } from 'node:crypto';
import { pool, query } from '../../../db/connection.js';
import type { Catalog, Member, AgeGroup, Gender } from '../domain/types.js';
import type { NormalizedMember } from '../domain/rules.js';
import type { ClientUnitRow, TreatmentUnitRepo } from '../ports/treatmentUnitRepo.port.js';

// mysql2 ستونِ JSON را معمولاً parse‌شده برمی‌گرداند، ولی در برخی تنظیمات رشته است.
function json<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return v as T;
}

function rowToMember(r: any): Member {
  return {
    id: r.id,
    role: r.role_code,
    alias: r.alias ?? null,
    category: (r.category ?? null) as AgeGroup | null,
    gender: (r.gender ?? null) as Gender | null,
    sort: Number(r.sort) || 0,
  };
}

export class SqlTreatmentUnitRepository implements TreatmentUnitRepo {
  async loadCatalog(): Promise<Catalog> {
    const [units, roles, mods, terms] = await Promise.all([
      query('SELECT * FROM tu_unit_types WHERE active = TRUE ORDER BY sort, code'),
      query('SELECT * FROM tu_member_roles WHERE active = TRUE ORDER BY sort, code'),
      query('SELECT * FROM tu_modalities WHERE active = TRUE ORDER BY sort, code'),
      query('SELECT modality_code, term FROM tu_modality_terms ORDER BY modality_code, term'),
    ]);
    const termsBy = new Map<string, string[]>();
    for (const t of terms.rows as any[]) {
      const arr = termsBy.get(t.modality_code) ?? [];
      arr.push(t.term);
      termsBy.set(t.modality_code, arr);
    }
    return {
      unitTypes: (units.rows as any[]).map((u) => ({
        code: u.code,
        labelFa: u.label_fa,
        minMembers: Number(u.min_members),
        maxMembers: Number(u.max_members),
        allowedRoles: json<string[]>(u.allowed_roles, []),
        presets: json<any[]>(u.presets, []).map((p) => ({ key: p.key, labelFa: p.label_fa, roles: p.roles ?? [], default: !!p.default })),
        contextSetting: u.context_setting,
        sort: Number(u.sort),
      })),
      roles: (roles.rows as any[]).map((r) => ({
        code: r.code,
        labelFa: r.label_fa,
        gender: r.gender ?? null,
        ageGroup: r.age_group ?? null,
        askAge: !!r.ask_age,
        askGender: !!r.ask_gender,
        contextLabel: r.context_label,
        sort: Number(r.sort),
      })),
      modalities: (mods.rows as any[]).map((m) => ({
        code: m.code,
        labelFa: m.label_fa,
        defaultUnit: m.default_unit ?? null,
        contextLabel: m.context_label,
        terms: termsBy.get(m.code) ?? [],
        sort: Number(m.sort),
      })),
    };
  }

  async getClientUnit(clientId: string): Promise<ClientUnitRow | null> {
    const c = await query('SELECT unit_type, category, gender FROM clients WHERE id = ?', [clientId]);
    const row = c.rows[0] as any;
    if (!row) return null;
    const m = await query('SELECT * FROM client_members WHERE client_id = ? AND deleted_at IS NULL ORDER BY sort, created_at', [clientId]);
    return { unitType: row.unit_type || 'individual', category: row.category ?? null, gender: row.gender ?? null, members: (m.rows as any[]).map(rowToMember) };
  }

  async replaceUnit(clientId: string, unitType: string, members: NormalizedMember[]): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [existing] = await conn.query('SELECT id FROM client_members WHERE client_id = ? FOR UPDATE', [clientId]);
      const existingIds = new Set((existing as any[]).map((r) => r.id));
      const keep = new Set<string>();
      for (const m of members) {
        if (m.id && existingIds.has(m.id)) {
          keep.add(m.id);
          await conn.query(
            'UPDATE client_members SET role_code = ?, alias = ?, category = ?, gender = ?, sort = ? WHERE id = ? AND client_id = ?',
            [m.role, m.alias, m.category, m.gender, m.sort, m.id, clientId]
          );
        } else {
          await conn.query(
            'INSERT INTO client_members (id, client_id, role_code, alias, category, gender, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [randomUUID(), clientId, m.role, m.alias, m.category, m.gender, m.sort]
          );
        }
      }
      for (const id of existingIds) {
        // حذفِ نرم (043): عضوِ حذف‌شده از واحدِ درمان می‌ماند ولی دیده نمی‌شود
        if (!keep.has(id)) await conn.query('UPDATE client_members SET deleted_at = NOW() WHERE id = ? AND client_id = ?', [id, clientId]);
      }
      // فردی: ستون‌هایِ قدیمیِ clients هم هم‌گام می‌مانند تا بقیه‌ی سیستم (badge، فیلتر، پرونده) بدونِ تغییر کار کند.
      if (unitType === 'individual' && members[0]) {
        await conn.query('UPDATE clients SET unit_type = ?, category = ?, gender = ? WHERE id = ?',
          [unitType, members[0].category, members[0].gender, clientId]);
      } else {
        await conn.query('UPDATE clients SET unit_type = ? WHERE id = ?', [unitType, clientId]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async getSessionPreNotes(sessionId: string): Promise<string[]> {
    const legacy = await query('SELECT pre_note FROM sessions WHERE id = ?', [sessionId]);
    const notes = await query(
      "SELECT text FROM session_notes WHERE session_id = ? AND deleted_at IS NULL AND type IN ('note_before','voice_before') ORDER BY created_at", [sessionId]);
    return [String((legacy.rows[0] as any)?.pre_note || ''), ...notes.rows.map((r: any) => String(r.text || ''))].map((x) => x.trim()).filter(Boolean);
  }

  async getSessionContextSource(sessionId: string) {
    const r = await query(
      `SELECT s.client_id, s.attendees, t.modalities
         FROM sessions s JOIN clients c ON c.id = s.client_id JOIN therapists t ON t.id = c.therapist_id
        WHERE s.id = ?`,
      [sessionId]
    );
    const row = r.rows[0] as any;
    if (!row) return null;
    return {
      clientId: row.client_id,
      attendees: json<string[] | null>(row.attendees, null),
      therapistModalities: json<string[]>(row.modalities, []),
    };
  }

  async getTherapistModalities(therapistId: string): Promise<string[]> {
    const r = await query('SELECT modalities FROM therapists WHERE id = ?', [therapistId]);
    return json<string[]>((r.rows[0] as any)?.modalities, []);
  }

  async setTherapistModalities(therapistId: string, codes: string[]): Promise<void> {
    await query('UPDATE therapists SET modalities = ? WHERE id = ?', [JSON.stringify(codes), therapistId]);
  }
}
