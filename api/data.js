// GET /api/data — returns latest cached BFS indicators from Neon
// The frontend calls this on every page load (fast — reads from DB, no external APIs)
import { getDb, getAllIndicators } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sql = getDb();
    const rows = await getAllIndicators(sql);

    // Build a keyed object from DB rows
    const cache = {};
    for (const row of rows) {
      cache[row.key] = {
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        source: row.source,
        period: row.period,
        fetchedAt: row.fetched_at,
      };
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({
      ok: true,
      updatedAt: rows[0]?.fetched_at ?? null,
      data: cache,
    });
  } catch (err) {
    console.error('[/api/data]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
