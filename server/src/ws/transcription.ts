// WebSocket proxy: مرورگر ← این سرور ← Soniox
import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { query } from '../db/connection.js';
import { SonioxEngine } from '../stt/soniox.js';

// مدیریت جلساتِ فعال
const activeSessions = new Map<string, SonioxEngine>();

export async function transcriptionRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get('/ws/t/:sessionId', { websocket: true }, (connection, request) => {
    const { sessionId } = request.params as { sessionId: string };
    
    const sonioxKey = process.env.SONIOX_API_KEY;
    if (!sonioxKey) {
      connection.send(JSON.stringify({ type: 'error', message: 'کلید Soniox تنظیم نشده' }));
      connection.close();
      return;
    }

    // چک: جلسه در DB وجود داره؟
    query('SELECT id, status FROM sessions WHERE id = $1', [sessionId]).then(result => {
      if (result.rows.length === 0) {
        connection.send(JSON.stringify({ type: 'error', message: 'جلسه یافت نشد' }));
        connection.close();
        return;
      }

      // اگر جلسه‌ی فعالِ دیگه‌ای برای همین session بود، ببندش
      const existing = activeSessions.get(sessionId);
      if (existing) {
        activeSessions.delete(sessionId);
      }

      // ساخت موتور Soniox
      const engine = new SonioxEngine(sonioxKey, {
        onTokens: (tokens) => {
          // متنِ نهایی‌شده → مرورگر + DB (throttled)
          connection.send(JSON.stringify({ type: 'tokens', tokens }));
          
          const text = engine.getFinalText();
          if (text) {
            query(
              'UPDATE sessions SET transcript = $1, updated_at = now() WHERE id = $2',
              [text, sessionId]
            ).catch(() => {});
          }
        },
        onStatus: (status, message) => {
          connection.send(JSON.stringify({ type: 'status', status, message }));
        },
        onFinished: (finalText) => {
          connection.send(JSON.stringify({ type: 'finished', finalText }));
          
          // ذخیره‌ی نهایی + تغییر status
          query(
            `UPDATE sessions SET transcript = $1, status = 'completed', updated_at = now() WHERE id = $2`,
            [finalText, sessionId]
          ).then(() => {
            activeSessions.delete(sessionId);
            connection.close();
          }).catch(() => {
            activeSessions.delete(sessionId);
            connection.close();
          });
        },
        onError: (error) => {
          connection.send(JSON.stringify({ type: 'error', message: error }));
        },
      });

      activeSessions.set(sessionId, engine);

      // شروع موتور
      engine.start().catch(err => {
        connection.send(JSON.stringify({ 
          type: 'error', 
          message: 'خطا در اتصال به سرویس رونویسی',
          detail: String(err)
        }));
      });

      // دریافتِ صدا از مرورگر
      connection.on('message', (data, isBinary) => {
        if (isBinary) {
          // chunk صوتی
          engine.sendAudioChunk(data as Buffer);
        } else {
          // پیام JSON
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'finalize') {
              engine.stop().then(finalText => {
                // onFinished callback همین رو handle می‌کنه
              });
            }
          } catch {}
        }
      });

      connection.on('close', () => {
        // اگر مرورگر بست ولی finalize نفرستاد — auto-finalize
        const eng = activeSessions.get(sessionId);
        if (eng) {
          eng.stop().then(() => {
            activeSessions.delete(sessionId);
          });
        }
      });

    }).catch(err => {
      connection.send(JSON.stringify({ type: 'error', message: 'خطای دیتابیس' }));
      connection.close();
    });
  });
}