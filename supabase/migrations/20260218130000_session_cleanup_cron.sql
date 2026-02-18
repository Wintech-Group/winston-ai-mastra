-- Enable pg_cron extension (Supabase supported extension)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup of expired sessions at 03:00 UTC
-- Matches the 24-hour grace period used in scripts/cleanup-sessions.ts
SELECT cron.schedule(
  'mastra-auth-cleanup-expired-sessions',
  '0 3 * * *',
  $$
    DELETE FROM mastra_auth.sessions
    WHERE expires_at < NOW() - INTERVAL '24 hours';
  $$
);
