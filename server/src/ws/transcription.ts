// WebSocket proxy: مرورگر ← این سرور ← Soniox
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { query } from '../db/connection.js';
import { SonioxEngine } from '../stt/soniox.js';

const activeSessions = new Map<string, SonioxEngine>();

export async function transcriptionRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/ws/t/:sessionId', { websocket: true }, (socket, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const sonioxKey = process.env.SONIOX_API_KEY;

    if (!sonioxKey || sonioxKey === 'your-key-here') {
      socket.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      socket.close();
      return;
    }

    query('SELECT id, status FROM sessions WHERE id = $1', [sessionId]).then(result => {
      if (result.rows.length === 0) {
        socket.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        socket.close();
        return;
      }

      const engine = new SonioxEngine(sonioxKey, {
        // ⭐ preview: متن کامل (final + در حال گفتن)
        onPreview: (fullText) => {
          try {
            socket.send(JSON.stringify({ type: 'preview', text: fullText }));
          } catch (e) {}
        },
        onStatus: (status, message) => {
          try {
            socket.send(JSON.stringify({ type: 'status', status, message }));
          } catch (e) {}
        },
        onFinished: (finalText) => {
          try {
            socket.send(JSON.stringify({ type: 'finished', finalText }));
          } catch (e) {}
          query(
            `UPDATE sessions SET transcript = $1, status = 'completed', updated_at = now() WHERE id = $2`,
            [finalText, sessionId]
          ).then(() => {
            activeSessions.delete(sessionId);
            try { socket.close(); } catch (e) {}
          }).catch(() => {
            activeSessions.delete(sessionId);
            try { socket.close(); } catch (e) {}
          });
        },
        onError: (error) => {
          try {
            socket.send(JSON.stringify({ type: 'error', message: error }));
          } catch (e) {}
        },
      });

      activeSessions.set(sessionId, engine);

      engine.start().catch(err => {
        try {
          socket.send(JSON.stringify({ type: 'error', message: 'خطا در اتصال به Soniox' }));
        } catch (e) {}
      });

      socket.on('message', (data: Buffer, isBinary: boolean) => {
        if (isBinary) {
          engine.sendAudioChunk(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        } else {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'finalize') {
              engine.stop().then(() => {});
            }
          } catch {}
        }
      });

      socket.on('close', () => {
        const eng = activeSessions.get(sessionId);
        if (eng) {
          eng.stop().then(() => { activeSessions.delete(sessionId); })
            .catch(() => { activeSessions.delete(sessionId); });
        }
      });

    }).catch(err => {
      try { socket.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' })); } catch (e) {}
    });
  });
}