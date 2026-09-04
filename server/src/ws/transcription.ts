// WebSocket proxies: جلسه‌ی زنده + یادداشت صوتی
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { query } from '../db/connection.js';
import { SonioxEngine } from '../stt/soniox.js';

const activeSessions = new Map<string, SonioxEngine>();

export async function transcriptionRoutes(app: FastifyInstance) {
  await app.register(websocket);

  // ===== جلسه‌ی زنده =====
  app.get('/ws/t/:sessionId', { websocket: true }, (socket, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const sonioxKey = process.env.SONIOX_API_KEY;

    if (!sonioxKey) {
      socket.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      socket.close();
      return;
    }

    query('SELECT id FROM sessions WHERE id = $1', [sessionId]).then(result => {
      if (result.rows.length === 0) {
        socket.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        socket.close();
        return;
      }

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: (finalText, nonFinalText) => {
          try {
            const full = finalText + nonFinalText;
            socket.send(JSON.stringify({ type: 'preview', text: full }));
          } catch (e) {}
          if (finalText) {
            query('UPDATE sessions SET transcript = $1, updated_at = now() WHERE id = $2',
              [finalText, sessionId]).catch(() => {});
          }
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

  // ===== ⭐ یادداشت صوتی — لایو ترنسکریپت (جدا از جلسه‌ی اصلی) =====
  app.get('/ws/voice/:sessionId', { websocket: true }, (socket, request) => {
    const { sessionId } = request.params as { sessionId: string };
    const sonioxKey = process.env.SONIOX_API_KEY;

    if (!sonioxKey) {
      socket.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      socket.close();
      return;
    }

    query('SELECT id FROM sessions WHERE id = $1', [sessionId]).then(result => {
      if (result.rows.length === 0) {
        socket.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        socket.close();
        return;
      }

      console.log('[voice-ws] connected for session:', sessionId);

      const engine = new SonioxEngine(sonioxKey, {
        onPreview: (finalText, nonFinalText) => {
          try {
            // ⭐ لایو متن — تراپیست همزمان می‌بینه چی می‌گه
            const full = finalText + nonFinalText;
            socket.send(JSON.stringify({ type: 'preview', text: full }));
          } catch (e) {}
        },
        onStatus: (status, message) => {
          try {
            socket.send(JSON.stringify({ type: 'status', status, message }));
          } catch (e) {}
        },
        onFinished: (finalText) => {
          console.log('[voice-ws] finished, text length:', (finalText || '').length);
          try {
            socket.send(JSON.stringify({ type: 'finished', finalText }));
          } catch (e) {}
          // ⭐ ذخیره در session_notes (نه در transcript اصلی!)
          if (finalText && finalText.trim()) {
            query(
              `INSERT INTO session_notes (session_id, type, text, wall_clock)
               VALUES ($1, 'voice', $2, $3)`,
              [sessionId, finalText.trim(), new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })]
            ).then(() => {
              console.log('[voice-ws] ✓ saved to DB');
              try { socket.close(); } catch (e) {}
            }).catch(() => {
              try { socket.close(); } catch (e) {}
            });
          } else {
            try { socket.send(JSON.stringify({ type: 'status', status: 'error', message: 'متنی ثبت نشد' })); } catch (e) {}
            try { socket.close(); } catch (e) {}
          }
        },
        onError: (error) => {
          try {
            socket.send(JSON.stringify({ type: 'error', message: error }));
          } catch (e) {}
        },
      });

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
              console.log('[voice-ws] finalize requested');
              engine.stop().then(() => {});
            }
          } catch {}
        }
      });

      socket.on('close', () => {
        console.log('[voice-ws] browser closed');
        engine.stop().then(() => {}).catch(() => {});
      });

    }).catch(err => {
      try { socket.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' })); } catch (e) {}
    });
  });
}