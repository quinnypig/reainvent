CREATE TABLE IF NOT EXISTS session_interest (
  session_id TEXT NOT NULL,
  day INTEGER NOT NULL,
  network_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(session_id, day, network_hash)
);
CREATE INDEX IF NOT EXISTS session_interest_created ON session_interest(created_at);
