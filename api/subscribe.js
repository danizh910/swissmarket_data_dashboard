// POST /api/subscribe  — save Web Push subscription to Neon
// DELETE /api/subscribe — remove subscription (unsubscribe)
import { getDb } from '../lib/db.js';

// Push endpoints are HTTPS URLs of the browser vendor's push service
function isValidEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) return false;
  try {
    return new URL(endpoint).protocol === 'https:';
  } catch {
    return false;
  }
}

// VAPID keys are base64url strings with bounded length
const isValidKey = (k, max) =>
  typeof k === 'string' && k.length > 0 && k.length <= max && /^[A-Za-z0-9_-]+$/.test(k);

export default async function handler(req, res) {
  try {
    const sql = getDb();

    if (req.method === 'DELETE') {
      const { endpoint } = req.body ?? {};
      if (isValidEndpoint(endpoint)) {
        await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { subscription } = req.body ?? {};
    const { endpoint, keys } = subscription ?? {};
    if (!isValidEndpoint(endpoint) || !isValidKey(keys?.auth, 64) || !isValidKey(keys?.p256dh, 256)) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await sql`
      INSERT INTO push_subscriptions (endpoint, auth, p256dh)
      VALUES (${endpoint}, ${keys.auth}, ${keys.p256dh})
      ON CONFLICT (endpoint) DO UPDATE
        SET auth = EXCLUDED.auth, p256dh = EXCLUDED.p256dh, updated_at = NOW()
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[subscribe]', err);
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
}
