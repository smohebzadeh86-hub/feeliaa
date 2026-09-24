// پیاده‌سازیِ CaseFileRepository با query() موجودِ db/connection.ts — اگر storage
// عوض شود (مثلِ مهاجرتِ قبلیِ Postgres→MySQL)، فقط همین فایل عوض می‌شود.
import { query } from '../../../../db/connection.js';
import type { CaseFileRepository, CaseFileRecord, CaseFileUpsertPatch } from '../../ports/caseFileRepo.port.js';

function rowToRecord(row: any): CaseFileRecord {
  return {
    clientId: row.client_id,
    content: row.content,
    status: row.status,
    generatingStartedAt: row.generating_started_at,
    model: row.model,
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
    generatedFromSessionId: row.generated_from_session_id,
    corpusSignature: row.corpus_signature,
    therapistEditedAt: row.therapist_edited_at,
    forceRegeneratedAt: row.force_regenerated_at,
    forceRegeneratedBy: row.force_regenerated_by,
    errorMessage: row.error_message,
    contentVersion: Number(row.content_version ?? 0),
  };
}

export class SqlCaseFileRepository implements CaseFileRepository {
  async get(clientId: string): Promise<CaseFileRecord | null> {
    const result = await query('SELECT * FROM client_case_file WHERE client_id = ?', [clientId]);
    return result.rows[0] ? rowToRecord(result.rows[0]) : null;
  }

  async claimGenerating(clientId: string, ttlMs: number): Promise<boolean> {
    // INSERT IGNORE: اگر ردیف نیست بساز (برنده‌ی رقابت همین‌جا قفل را دارد)
    const ins = await query(
      `INSERT IGNORE INTO client_case_file (client_id, content, status, generating_started_at) VALUES (?, ?, 'generating', NOW())`,
      [clientId, JSON.stringify({})]
    );
    if (ins.rowCount === 1) return true;
    // ردیف بود: فقط وقتی قفل آزاد است (یا heartbeatش از TTL گذشته) بگیر — یک UPDATEِ اتمیک.
    const upd = await query(
      `UPDATE client_case_file SET status = 'generating', generating_started_at = NOW()
       WHERE client_id = ? AND (status <> 'generating' OR generating_started_at IS NULL
         OR generating_started_at < (NOW() - INTERVAL ? SECOND))`,
      [clientId, Math.ceil(ttlMs / 1000)]
    );
    return upd.rowCount === 1;
  }

  async markGenerating(clientId: string): Promise<void> {
    const existing = await query('SELECT client_id FROM client_case_file WHERE client_id = ?', [clientId]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO client_case_file (client_id, content, status, generating_started_at) VALUES (?, ?, 'generating', NOW())`,
        [clientId, JSON.stringify({})]
      );
    } else {
      await query(`UPDATE client_case_file SET status = 'generating', generating_started_at = NOW() WHERE client_id = ?`, [clientId]);
    }
  }

  async markError(clientId: string, message: string): Promise<void> {
    // ممکن است markGenerating هنوز insert نکرده باشد (خطایِ خیلی زودهنگام) — امن است.
    const existing = await query('SELECT client_id FROM client_case_file WHERE client_id = ?', [clientId]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO client_case_file (client_id, content, status, error_message) VALUES (?, ?, 'error', ?)`,
        [clientId, JSON.stringify({}), message]
      );
    } else {
      await query(`UPDATE client_case_file SET status = 'error', error_message = ? WHERE client_id = ?`, [message, clientId]);
    }
  }

  async upsert(clientId: string, patch: CaseFileUpsertPatch, expectedVersion?: number): Promise<CaseFileRecord | null> {
    const existing = await query('SELECT client_id FROM client_case_file WHERE client_id = ?', [clientId]);

    if (existing.rows.length === 0) {
      try {
        await query(
          `INSERT INTO client_case_file
             (client_id, content, status, model, generated_at, generated_from_session_id, corpus_signature, therapist_edited_at, force_regenerated_at, force_regenerated_by, error_message, content_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            clientId,
            JSON.stringify(patch.content),
            patch.status || 'ready',
            patch.model ?? null,
            patch.generatedAt ?? null,
            patch.generatedFromSessionId ?? null,
            patch.corpusSignature ?? null,
            patch.therapistEditedAt ?? null,
            patch.forceRegeneratedAt ?? null,
            patch.forceRegeneratedBy ?? null,
            patch.errorMessage ?? null,
          ]
        );
      } catch (e: any) {
        // رقابت: ردیف بینِ SELECT و INSERT ساخته شد — با CAS یعنی تعارض، بدونِ CAS دوباره تلاش کن.
        if (e?.errno === 1062) {
          if (expectedVersion !== undefined) return null;
          return this.upsert(clientId, patch);
        }
        throw e;
      }
    } else {
      const fields: string[] = ['content = ?', 'content_version = content_version + 1'];
      const values: unknown[] = [JSON.stringify(patch.content)];
      if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status); }
      if (patch.model !== undefined) { fields.push('model = ?'); values.push(patch.model); }
      if (patch.generatedAt !== undefined) { fields.push('generated_at = ?'); values.push(patch.generatedAt); }
      if (patch.generatedFromSessionId !== undefined) { fields.push('generated_from_session_id = ?'); values.push(patch.generatedFromSessionId); }
      if (patch.corpusSignature !== undefined) { fields.push('corpus_signature = ?'); values.push(patch.corpusSignature); }
      if (patch.therapistEditedAt !== undefined) { fields.push('therapist_edited_at = ?'); values.push(patch.therapistEditedAt); }
      if (patch.forceRegeneratedAt !== undefined) { fields.push('force_regenerated_at = ?'); values.push(patch.forceRegeneratedAt); }
      if (patch.forceRegeneratedBy !== undefined) { fields.push('force_regenerated_by = ?'); values.push(patch.forceRegeneratedBy); }
      if (patch.errorMessage !== undefined) { fields.push('error_message = ?'); values.push(patch.errorMessage); }
      values.push(clientId);
      let sql = `UPDATE client_case_file SET ${fields.join(', ')} WHERE client_id = ?`;
      if (expectedVersion !== undefined) {
        sql += ' AND content_version = ?';
        values.push(expectedVersion);
      }
      const upd = await query(sql, values);
      if (expectedVersion !== undefined && upd.rowCount === 0) return null;
    }

    const result = await query('SELECT * FROM client_case_file WHERE client_id = ?', [clientId]);
    return rowToRecord(result.rows[0]);
  }
}
