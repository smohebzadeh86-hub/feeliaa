// APIِ عمومیِ feature پرونده برایِ featureهایِ دیگر: سیاستِ مرکزیِ تولیدِ خودکار (routeها از api/caseFile.routes.ts).
export { maybeAutoGenerateCaseFile, triggerCaseFileForSession, type AutoCaseFileOutcome } from './application/autoTrigger.js';
export { listCaseFileVersions, getCaseFileVersionContent } from './adapters/repository/caseFileRepository.sql.js';
