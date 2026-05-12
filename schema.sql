-- Run once against your Neon database to create the cache table
-- psql "$DATABASE_URL" -f schema.sql

CREATE TABLE IF NOT EXISTS bfs_cache (
  key        TEXT PRIMARY KEY,
  data       JSONB        NOT NULL,
  source     TEXT         NOT NULL DEFAULT 'live',
  period     TEXT,
  fetched_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bfs_cache_fetched_at_idx ON bfs_cache (fetched_at DESC);

-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  auth       TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
