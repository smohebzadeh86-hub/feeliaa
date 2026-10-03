// رکوردِ canonicalِ جلسه (Session Data Engine، فاز ۲/۳): توکن‌هایِ زمان‌دار، نوبت‌هایِ گوینده، نقشِ گوینده، متنِ canonical.
// سندِ مالک: docs/07-subsystems/08-session-record.md
export { sessionRecordRoutes } from './record.routes.js';
export { getRoles, setRoles } from './record.repository.js';
export { saveCanonicalRecord, saveCanonicalRecordStandalone, canonicalTextForSession, exportCanonicalRecord, deterministicJobId, type CanonicalRecordInput } from './record.repository.js';
export { packTokens, unpackTokens, TOKEN_ENGINE, TOKEN_MODEL, type RecordToken } from './tokens.js';
export { buildSegments, renderCanonicalText, type SegmentDraft } from './segments.js';
