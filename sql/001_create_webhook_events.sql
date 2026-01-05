-- Create webhook_events table for storing incoming webhook requests
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  pathname TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  headers TEXT NOT NULL,
  payload TEXT NOT NULL,
  content_type TEXT NOT NULL,
  processing_time_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- Index for efficient trace lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_trace_id 
ON webhook_events(trace_id);

-- Index for chronological queries (RSS feed generation)
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at 
ON webhook_events(created_at DESC);

-- Index for filtering by pathname (user/endpoint specific queries)
CREATE INDEX IF NOT EXISTS idx_webhook_events_pathname 
ON webhook_events(pathname);

