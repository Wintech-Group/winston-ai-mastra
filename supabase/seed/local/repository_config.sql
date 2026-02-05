-- =====================================================================
-- SEED DATA (Example domains)
-- =====================================================================

-- Insert example repository config (for the policy governance repo)
INSERT INTO config.repository_config (
    repo_full_name,
    document_type,
    document_path,
    approval_required,
    domain_approval,
    owner_approval,
    auto_merge_enabled,
    notify_on_pr_open,
    reminder_after_hours,
    escalate_after_hours,
    notification_channels
) VALUES (
    'Wintech-Group/docs-policy-governance',
    'policies',
    'policies/',
    true,
    true,
    true,
    false,
    true,
    48,
    120,
    ARRAY['email', 'teams']::TEXT[]
) ON CONFLICT (repo_full_name) DO NOTHING;