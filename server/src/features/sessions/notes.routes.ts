// یادداشت/علامتِ جلسه — pluginِ فرزندِ sessionRoutes (گاردِ requireAuth از آن به ارث می‌رسد).
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { getOwnedSession } from '../../db/ownership.js';
import { maybeAutoGenerateCaseFile } from '../case-file/application/autoTrigger.js';
import { insertNote, getNoteRow, isNoteOwned, deleteNote } from './sessions.repository.js';

export async function sessionNotesRoutes(app: FastifyInstance) {
  // POST /api/sessions/:id/notes — افزودن یادداشت/علامت
  app.post('/api/sessions/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, text, sign_type, offset_ms, wall_clock } = request.body as {
      type: 'note_during' | 'note_after' | 'sign' | 'voice';
      text?: string;
      sign_type?: string;
      offset_ms?: number;
      wall_clock?: string;
    };

    if (!type) {
      reply.code(400);
      return { error: 'type الزامی است' };
    }

    const owned = await getOwnedSession(id, request.therapistId!);
    if (!owned) {
      reply.code(404);
      return { error: 'جلسه یافت نشد' };
    }

    const noteId = randomUUID();
    await insertNote({
      id: noteId, sessionId: id, type, text: text || null, signType: sign_type || null, offsetMs: offset_ms || null, wallClock: wall_clock || null,
    });
    const note = await getNoteRow(noteId);

    // یادداشتِ جلسه‌ی از‌قبل‌completedشده (مثلِ افزودنِ یادداشت به جلسه‌ی دستی/آرشیو بعدِ
    // ساختنش) — همان باگِ بالا: بدونِ این، auto-generate هیچ‌وقت این محتوا را نمی‌بیند.
    if (owned.status === 'completed') {
      void maybeAutoGenerateCaseFile(owned.client_id, request.therapistId!);
    }

    reply.code(201);
    return { note };
  });

  // DELETE /api/notes/:id — حذف یادداشت
  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isNoteOwned(id, request.therapistId))) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }

    await deleteNote(id);
    return { deleted: id };
  });
}
