// composition root: adapter + config (env، configuration-catalog) را به سرویس وصل می‌کند.
import { SqlTreatmentUnitRepository } from './adapters/treatmentUnitRepository.sql.js';
import { TreatmentUnitService } from './application/treatmentUnitService.js';
import { SESSION_TRANSCRIPTION_CONTEXT } from '../../shared/sessionSttContext.js';

function envInt(name: string, def: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

export const treatmentUnits = new TreatmentUnitService(new SqlTreatmentUnitRepository(), {
  catalogTtlMs: envInt('TU_CATALOG_TTL_MS', 60_000),
  context: {
    maxTerms: envInt('SONIOX_CONTEXT_MAX_TERMS', 60),
    maxChars: envInt('SONIOX_CONTEXT_MAX_CHARS', 8000),
  },
  baseContext: SESSION_TRANSCRIPTION_CONTEXT,
});
