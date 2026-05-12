// POST /api/subscribe  — save Web Push subscription to Neon
// DELETE /api/subscribe — remove subscription (unsubscribe)
import { getDb } from '../lib/db.js';

export default async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'DELETE') {
    const { endpoint } = req.body ?? {};
    if (endpoint) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subscription } = req.body ?? {};
  if (!subscription?.endpoint || !subscription?.keys?.auth || !subscription?.keys?.p256dh) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  try {
    await sql`
      INSERT INTO push_subscriptions (endpoint, auth, p256dh)
      VALUES (${subscription.endpoint}, ${subscription.keys.auth}, ${subscription.keys.p256dh})
      ON CONFLICT (endpoint) DO UPDATE
        SET auth = EXCLUDED.auth, p256dh = EXCLUDED.p256dh, updated_at = NOW()
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[subscribe]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
