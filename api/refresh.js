// POST /api/refresh — fetches fresh data from BFS/SECO/SNB and stores in Neon
// Called automatically by Vercel Cron (daily at 06:00 UTC) and manually via dashboard
// Requires CRON_SECRET env var to prevent unauthorized calls (except from Vercel Cron)

import { timingSafeEqual } from 'node:crypto';
import { getDb, upsertIndicator, getIndicator, getAllSubscriptions, deleteSubscription } from '../lib/db.js';
import {
  fetchPopulation,
  fetchWages,
  fetchUnemploymentTimeline,
  fetchInflation,
  fetchSNBLeitzins,
  fetchAussenhandel,
} from '../lib/fetchers.js';

function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Fail closed: without configured CRON_SECRET the endpoint stays locked
  const authHeader = req.headers.authorization ?? '';
  const cronSecret = process.env.CRON_SECRET ?? '';
  if (!cronSecret || !safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();
  const now = new Date().toISOString().slice(0, 7);
  const results = {};

  // Hinweis: unemploymentKanton wird nicht mehr aktualisiert — das SECO-Portal
  // data.seco.admin.ch wurde abgeschaltet und es gibt (Stand Jul 2026) keine
  // öffentliche API für Kantonswerte. Der letzte Stand bleibt in der DB erhalten.
  const tasks = [
    { key: 'population',           label: 'Bevölkerung',             fn: fetchPopulation },
    { key: 'wages',                label: 'Medianlöhne',             fn: fetchWages },
    { key: 'unemploymentTimeline', label: 'Arbeitslosigkeit CH',     fn: fetchUnemploymentTimeline },
    { key: 'inflation',            label: 'LIK Inflation',           fn: fetchInflation },
    { key: 'snbLeitzins',          label: 'SNB Leitzins',            fn: fetchSNBLeitzins },
    { key: 'aussenhandel',         label: 'Aussenhandel',            fn: fetchAussenhandel },
  ];

  await Promise.allSettled(
    tasks.map(async ({ key, label, fn }) => {
      try {
        let data = await fn();

        // For inflation: fetchInflation() returns only the current month.
        // Merge it into the existing DB time series so the chart keeps history.
        if (key === 'inflation' && Array.isArray(data)) {
          try {
            const existingRow = await getIndicator(sql, key);
            if (existingRow) {
              const existing = typeof existingRow.data === 'string'
                ? JSON.parse(existingRow.data)
                : existingRow.data;
              if (Array.isArray(existing) && existing.length > 0) {
                const byMonth = new Map(existing.map(p => [p.m, p]));
                data.forEach(p => byMonth.set(p.m, p));
                data = [...byMonth.values()].sort((a, b) => a.m.localeCompare(b.m));
              }
            }
          } catch { /* merge failed — store new data as-is */ }
        }

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
