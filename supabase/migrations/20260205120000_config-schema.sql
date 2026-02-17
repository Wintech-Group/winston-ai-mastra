-- Migration: Add Config Schema for Document Governance
-- Purpose: Centralize domain ownership and repository workflow configuration in database
-- Date: 2026-02-05

-- Create the config schema
CREATE SCHEMA IF NOT EXISTS config;

-- =====================================================================
-- DOMAIN OWNERSHIP TABLES
-- =====================================================================

-- Organisational domains (IT, HR, Finance, Legal, etc.)
CREATE TABLE config.domains (
    id              TEXT PRIMARY KEY,           -- 'IT', 'HR', 'Finance', 'Legal'
    name            TEXT NOT NULL,              -- 'Information Technology'
    description     TEXT,                       -- Domain description
    contact_email   TEXT,                       -- General domain contact
    teams_channel   TEXT,                       -- Teams channel name
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE config.domains IS 'Organisational domains for document governance approval routing';
COMMENT ON COLUMN config.domains.id IS 'Short domain identifier (e.g., IT, HR)';
COMMENT ON COLUMN config.domains.name IS 'Full domain name for display';
COMMENT ON COLUMN config.domains.contact_email IS 'General contact email for the domain';
COMMENT ON COLUMN config.domains.teams_channel IS 'Microsoft Teams channel name for notifications';

-- Domain owners (people responsible for approving changes in their domain)
CREATE TABLE config.domain_owners (
    domain_id       TEXT NOT NULL REFERENCES config.domains(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,              -- Azure AD email address
    name            TEXT,                       -- Display name
    role            TEXT,                       -- Role/title (e.g., 'Head of IT')
    added_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    added_by        TEXT,                       -- Who added this owner
    PRIMARY KEY (domain_id, email)
);

COMMENT ON TABLE config.domain_owners IS 'People who can approve changes for each domain';
COMMENT ON COLUMN config.domain_owners.email IS 'Azure AD email address (used for permission checks)';
COMMENT ON COLUMN config.domain_owners.added_by IS 'Email of person who added this owner';

-- Domain scope/responsibilities (array of text describing what the domain covers)
CREATE TABLE config.domain_scope (
    domain_id       TEXT NOT NULL REFERENCES config.domains(id) ON DELETE CASCADE,
    scope_item      TEXT NOT NULL,              -- Area of responsibility
    sort_order      INTEGER,                    -- Display order
    PRIMARY KEY (domain_id, scope_item)
);

COMMENT ON TABLE config.domain_scope IS 'Areas of responsibility for each domain';

-- Create indexes for fast owner lookups
CREATE INDEX idx_domain_owners_email ON config.domain_owners(email);
CREATE INDEX idx_domain_owners_domain ON config.domain_owners(domain_id);

-- =====================================================================
-- REPOSITORY CONFIGURATION TABLES
-- =====================================================================

-- Repository workflow configuration (synced from each repo's repo-config.yaml)
CREATE TABLE config.repository_config (
    repo_full_name          TEXT PRIMARY KEY,       -- 'Wintech-Group/docs-policy-governance'
    document_type           TEXT NOT NULL,          -- 'policies', 'sops', 'tech-docs'
    document_path           TEXT NOT NULL,          -- Repository path prefix for document paths (e.g., 'policies/')
    
    -- Approval settings
    approval_required       BOOLEAN DEFAULT TRUE NOT NULL,
    domain_approval         BOOLEAN DEFAULT TRUE NOT NULL,
    owner_approval          BOOLEAN DEFAULT TRUE NOT NULL,
    auto_merge_enabled      BOOLEAN DEFAULT FALSE NOT NULL,
    auto_merge_after_hours  INTEGER,
    
    -- Notification settings
    notify_on_pr_open       BOOLEAN DEFAULT TRUE NOT NULL,
    reminder_after_hours    INTEGER DEFAULT 48,
    escalate_after_hours    INTEGER DEFAULT 120,
    notification_channels   TEXT[] DEFAULT ARRAY['email']::TEXT[],  -- ['email', 'teams']
    
    -- Sync metadata
    config_file_path        TEXT DEFAULT 'metadata/repo-config.yaml' NOT NULL,
    config_sha              TEXT,                   -- SHA of last synced config file
    synced_at               TIMESTAMPTZ,
    
    created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE config.repository_config IS 'Per-repository workflow configuration (synced from repo-config.yaml on push)';
COMMENT ON COLUMN config.repository_config.repo_full_name IS 'Full repository name (owner/repo)';
COMMENT ON COLUMN config.repository_config.document_type IS 'Type of documents in this repo';
COMMENT ON COLUMN config.repository_config.approval_required IS 'Whether any approval is required for changes';
COMMENT ON COLUMN config.repository_config.domain_approval IS 'Whether domain owner approval is required';
COMMENT ON COLUMN config.repository_config.auto_merge_enabled IS 'Whether to auto-merge after all approvals received';
COMMENT ON COLUMN config.repository_config.config_sha IS 'SHA of repo-config.yaml at last sync';
COMMENT ON COLUMN config.repository_config.synced_at IS 'When config was last synced from repo';

-- Cross-domain rules (patterns that require multiple domain approvals)
CREATE TABLE config.cross_domain_rules (
    id                  SERIAL PRIMARY KEY,
    repo_full_name      TEXT NOT NULL REFERENCES config.repository_config(repo_full_name) ON DELETE CASCADE,
    rule_pattern        TEXT NOT NULL,              -- Regex pattern for rule matching
    required_domains    TEXT[] NOT NULL,            -- Array of domain IDs required
    description         TEXT,                       -- Human-readable description
    created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE config.cross_domain_rules IS 'Patterns that require approval from multiple domains';
COMMENT ON COLUMN config.cross_domain_rules.rule_pattern IS 'Regex pattern to match against rule statements';
COMMENT ON COLUMN config.cross_domain_rules.required_domains IS 'Array of domain IDs that must all approve';

-- Create indexes for fast lookups
CREATE INDEX idx_cross_domain_rules_repo ON config.cross_domain_rules(repo_full_name);
CREATE INDEX idx_repository_config_type ON config.repository_config(document_type);

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION config.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to domains table
CREATE TRIGGER update_domains_updated_at
    BEFORE UPDATE ON config.domains
    FOR EACH ROW
    EXECUTE FUNCTION config.update_updated_at();

-- Apply update trigger to repository_config table
CREATE TRIGGER update_repository_config_updated_at
    BEFORE UPDATE ON config.repository_config
    FOR EACH ROW
    EXECUTE FUNCTION config.update_updated_at();

-- =====================================================================
-- PERMISSIONS
-- =====================================================================

-- Grant read access to service role (for the central service to read domain and config data)
GRANT USAGE ON SCHEMA config TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA config TO service_role;

-- Grant write access to service role (for the central service)
GRANT ALL ON ALL TABLES IN SCHEMA config TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA config TO service_role;
