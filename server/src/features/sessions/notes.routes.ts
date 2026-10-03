// یادداشت/علامتِ جلسه — pluginِ فرزندِ sessionRoutes (گاردِ requireAuth از آن به ارث می‌رسد).
import { randomUUID } from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { getOwnedSession } from '../../db/ownership.js';
import { maybeAutoGenerateCaseFile } from '../case-file/index.js';
import {
  insertNote, getNoteRow, isNoteOwned, deleteNote, getOwnedNoteType, updateNoteText, EDITABLE_NOTE_TYPES,
  insertNoteRevision, listNoteRevisions, getNoteRevisionText,
} from './sessions.repository.js';

// سقفِ متنِ ویرایش‌شده‌ی یادداشتِ پیش از جلسه — متنِ رونویسیِ یک ضبطِ ۵دقیقه‌ای از ۲۰۰۰ نویسه بیشتر است.
const NOTE_EDIT_MAX_CHARS = 20000;

export async function sessionNotesRoutes(app: FastifyInstance) {
  // POST /api/sessions/:id/notes — افزودن یادداشت/علامت
  app.post('/api/sessions/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, text, sign_type, offset_ms, wall_clock } = request.body as {
      type: 'note_during' | 'note_after' | 'note_before' | 'sign' | 'voice';
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

  // PATCH /api/notes/:id — ویرایشِ متنِ یادداشتِ پیش از جلسه (note_before / voice_before)، فقط مالک (غیرمالک ⇒ 404).
  // یادداشت‌هایِ دیگر ویرایش‌پذیر نیستند (PRDِ ماژول ۰۵) ⇒ 400.
  app.patch('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { text } = (request.body ?? {}) as { text?: unknown };
    const type = await getOwnedNoteType(id, request.therapistId);
    if (!type) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }
    if (!(EDITABLE_NOTE_TYPES as readonly string[]).includes(type)) {
      reply.code(400);
      return { error: 'این یادداشت قابلِ ویرایش نیست', code: 'note-not-editable' };
    }
    const clean = typeof text === 'string' ? text.trim() : '';
    if (!clean) {
      reply.code(400);
      return { error: 'متنِ یادداشت خالی است', code: 'note-empty' };
    }
    if (clean.length > NOTE_EDIT_MAX_CHARS) {
      reply.code(400);
      return { error: 'یادداشت بیش از حد طولانی است', code: 'note-too-long' };
    }
    // متنِ قبلی پیش از جایگزینی در تاریخچه می‌ماند (044)
    const before = await getNoteRow(id);
    if (before && typeof before.text === 'string' && before.text !== clean) await insertNoteRevision(id, before.session_id, before.text, request.therapistId ?? null);
    await updateNoteText(id, clean);
    return { note: await getNoteRow(id) };
  });

  // GET /api/notes/:id/revisions — نسخه‌هایِ قبلیِ متنِ یادداشت (فقط متادیتا)
  app.get('/api/notes/:id/revisions', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!(await isNoteOwned(id, request.therapistId))) { reply.code(404); return { error: 'یادداشت یافت نشد' }; }
    return { revisions: await listNoteRevisions(id) };
  });

  // POST /api/notes/:id/revisions/:rid/restore — بازگردانیِ یک نسخه؛ متنِ فعلی هم در تاریخچه می‌ماند
  app.post('/api/notes/:id/revisions/:rid/restore', async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string };
    const type = await getOwnedNoteType(id, request.therapistId);
    if (!type) { reply.code(404); return { error: 'یادداشت یافت نشد' }; }
    const old = await getNoteRevisionText(id, Number(rid));
    if (old === null) { reply.code(404); return { error: 'نسخه یافت نشد' }; }
    const before = await getNoteRow(id);
    if (before && typeof before.text === 'string' && before.text !== old) await insertNoteRevision(id, before.session_id, before.text, request.therapistId ?? null);
    await updateNoteText(id, old);
    return { note: await getNoteRow(id) };
  });

  // DELETE /api/notes/:id — حذف یادداشت
  app.delete('/api/notes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!(await isNoteOwned(id, request.therapistId))) {
      reply.code(404);
      return { error: 'یادداشت یافت نشد' };
    }

    // حذفِ نرم (migration 043): ادمین یادداشتِ حذف‌شده را می‌بیند
    await deleteNote(id, request.therapistId ?? null);
    return { deleted: id, recoverable: true };
  });
}
