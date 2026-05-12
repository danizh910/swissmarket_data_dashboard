// Neon PostgreSQL client (serverless-optimised pooling)
import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getDb() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Upsert a single indicator into the cache table
export async function upsertIndicator(sql, key, data, source, period = null) {
  await sql`
    INSERT INTO bfs_cache (key, data, source, period, fetched_at)
    VALUES (${key}, ${JSON.stringify(data)}, ${source}, ${period}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET data       = EXCLUDED.data,
          source     = EXCLUDED.source,
          period     = EXCLUDED.period,
          fetched_at = EXCLUDED.fetched_at
  `;
}

// Read all cached indicators
export async function getAllIndicators(sql) {
  const rows = await sql`SELECT key, data, source, period, fetched_at FROM bfs_cache ORDER BY key`;
  return rows;
}

// Read a single indicator
export async function getIndicator(sql, key) {
  const rows = await sql`SELECT key, data, source, period, fetched_at FROM bfs_cache WHERE key = ${key}`;
  return rows[0] || null;
}
