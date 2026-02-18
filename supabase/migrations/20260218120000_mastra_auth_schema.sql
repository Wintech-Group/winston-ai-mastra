-- Create dedicated schema for auth-related tables
CREATE SCHEMA IF NOT EXISTS mastra_auth;

-- Central user profile cache (Azure AD is source of truth; this is a local cache)
CREATE TABLE IF NOT EXISTS mastra_auth.users (
  id           TEXT PRIMARY KEY, -- Azure AD object ID (OID)
  display_name TEXT,
  email        TEXT,
  upn          TEXT,             -- User principal name
  groups       JSONB,            -- Cached group memberships
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON mastra_auth.users(email);

-- Session store for BFF
CREATE TABLE IF NOT EXISTS mastra_auth.sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES mastra_auth.users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON mastra_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON mastra_auth.sessions(expires_at);

-- Token cache table for MSAL OBO (used for Graph integration)
CREATE TABLE IF NOT EXISTS mastra_auth.msal_token_cache (
  user_id    TEXT PRIMARY KEY REFERENCES mastra_auth.users(id) ON DELETE CASCADE,
  cache_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_cache_updated_at
  ON mastra_auth.msal_token_cache(updated_at);

-- Auto-update timestamp trigger function
CREATE OR REPLACE FUNCTION mastra_auth.update_updated_at()
RETURNS TRIGGER SET SEARCH_PATH = '' AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON mastra_auth.users
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();

CREATE OR REPLACE TRIGGER sessions_updated_at
  BEFORE UPDATE ON mastra_auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();

CREATE OR REPLACE TRIGGER msal_token_cache_updated_at
  BEFORE UPDATE ON mastra_auth.msal_token_cache
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();

-- Grant access to service role only (auth data is sensitive)
GRANT USAGE ON SCHEMA mastra_auth TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA mastra_auth TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mastra_auth TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA mastra_auth TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mastra_auth GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mastra_auth GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mastra_auth GRANT ALL ON ROUTINES TO service_role;
