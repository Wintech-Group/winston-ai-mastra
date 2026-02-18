-- Create dedicated schema for auth-related tables
CREATE SCHEMA IF NOT EXISTS mastra_auth;

-- Session store for BFF
CREATE TABLE IF NOT EXISTS mastra_auth.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  user_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON mastra_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON mastra_auth.sessions(expires_at);

-- Token cache table for MSAL OBO (used for Graph integration)
CREATE TABLE IF NOT EXISTS mastra_auth.msal_token_cache (
  user_id TEXT PRIMARY KEY,
  cache_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_cache_updated_at
  ON mastra_auth.msal_token_cache(updated_at);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION mastra_auth.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER sessions_updated_at
  BEFORE UPDATE ON mastra_auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();

CREATE OR REPLACE TRIGGER msal_token_cache_updated_at
  BEFORE UPDATE ON mastra_auth.msal_token_cache
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();
