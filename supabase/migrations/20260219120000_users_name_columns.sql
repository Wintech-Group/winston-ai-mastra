-- Add given_name and family_name columns to align with MSAL optional token claims
-- (email, family_name, given_name, groups, preferred_username)
-- The upn column already exists and maps to preferred_username.

ALTER TABLE mastra_auth.users
  ADD COLUMN IF NOT EXISTS given_name  TEXT,
  ADD COLUMN IF NOT EXISTS family_name TEXT;
