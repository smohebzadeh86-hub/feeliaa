// پنل ادمین — فقط is_admin=true. هیچ‌جا متنِ رونویسی‌شده‌ی جلسات نمایش داده نمی‌شود.
// یک plugin با گاردِ requireAdmin؛ زیرماژول‌ها pluginهایِ فرزندند و گارد را به ارث می‌برند.
import { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../auth/guard.js';
import { therapistsAdminRoutes } from './therapists.admin.js';
import { sessionsAdminRoutes } from './sessions.admin.js';
import { audioAdminRoutes } from './audio.admin.js';
import { exportAdminRoutes } from './export.admin.js';
import { obsAdminRoutes } from './obs.admin.js';
import { queueAdminRoutes } from './queue.admin.js';
import { systemAdminRoutes } from './system.admin.js';
import { metricsAdminRoutes } from './metrics.admin.js';
import { dataAccessAdminRoutes } from './dataAccess.admin.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);
  await app.register(therapistsAdminRoutes);
  await app.register(sessionsAdminRoutes);
  await app.register(audioAdminRoutes);
  await app.register(exportAdminRoutes);
  await app.register(obsAdminRoutes);
  await app.register(queueAdminRoutes);
  await app.register(systemAdminRoutes);
  await app.register(metricsAdminRoutes);
  await app.register(dataAccessAdminRoutes);
}
