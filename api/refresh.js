// POST /api/refresh — fetches fresh data from BFS/SECO/SNB and stores in Neon
// Called automatically by Vercel Cron (daily at 06:00 UTC) and manually via dashboard
// Requires CRON_SECRET env var to prevent unauthorized calls (except from Vercel Cron)

import { getDb, upsertIndicator, getAllSubscriptions, deleteSubscription } from '../lib/db.js';
import {
  fetchPopulation,
  fetchWages,
  fetchUnemploymentKanton,
  fetchUnemploymentTimeline,
  fetchInflation,
  fetchSNBLeitzins,
  fetchAussenhandel,
} from '../lib/fetchers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();
  const now = new Date().toISOString().slice(0, 7);
  const results = {};

  const tasks = [
    { key: 'population',           label: 'Bevölkerung',             fn: fetchPopulation },
    { key: 'wages',                label: 'Medianlöhne',             fn: fetchWages },
    { key: 'unemploymentKanton',   label: 'Arbeitslosigkeit Kanton', fn: fetchUnemploymentKanton },
    { key: 'unemploymentTimeline', label: 'Arbeitslosigkeit CH',     fn: fetchUnemploymentTimeline },
    { key: 'inflation',            label: 'LIK Inflation',           fn: fetchInflation },
    { key: 'snbLeitzins',          label: 'SNB Leitzins',            fn: fetchSNBLeitzins },
    { key: 'aussenhandel',         label: 'Aussenhandel',            fn: fetchAussenhandel },
  ];

  await Promise.allSettled(
    tasks.map(async ({ key, label, fn }) => {
      try {
        const data = await fn();
        await upsertIndicator(sql, key, data, 'live', now);
        results[key] = { ok: true, rows: Array.isArray(data) ? data.length : 1 };
        console.log(`[refresh] ✓ ${label}: ${results[key].rows} rows`);
      } catch (err) {
        results[key] = { ok: false, error: err.message };
        console.error(`[refresh] ✗ ${label}: ${err.message}`);
      }
    }),
  );

  // Send Web Push notifications if VAPID keys are configured
  const okCount = Object.values(results).filter(r => r.ok).length;
  if (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY) {
    try {
      const { default: webpush } = await import('web-push');
      webpush.setVapidDetails(
        'mailto:tukibeats12@gmail.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );

      const subs = await getAllSubscriptions(sql);
      if (subs.length > 0) {
        const payload = JSON.stringify({
          title: 'BFS Statistik Hub',
          body: `Daten aktualisiert · ${okCount}/${tasks.length} Quellen erfolgreich · ${new Date().toLocaleDateString('de-CH')}`,
        });

        await Promise.allSettled(
          subs.map(sub =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
              payload,
            ).catch(async err => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await deleteSubscription(sql, sub.endpoint);
              }
            }),
          ),
        );
        console.log(`[refresh] Push sent to ${subs.length} subscriber(s)`);
      }
    } catch (err) {
      console.error('[refresh] Push error:', err.message);
    }
  }

  const allOk = Object.values(results).every(r => r.ok);
  return res.status(allOk ? 200 : 207).json({
    ok: allOk,
    refreshedAt: new Date().toISOString(),
    results,
  });
}
