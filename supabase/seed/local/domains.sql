-- =====================================================================
-- SEED DATA (Example domains)
-- =====================================================================

-- Insert default domains
INSERT INTO config.domains (id, name, description, contact_email, teams_channel) VALUES
    ('IT', 'Information Technology', 'Technology infrastructure, systems, devices, and security', 'it.support@wintechgroup.com', 'IT Department'),
    ('HR', 'Human Resources', 'People management, employment terms, workplace policies', 'hr@wintechgroup.com', 'HR Department'),
    ('Finance', 'Finance', 'Financial management, budgets, expenses, and procurement', 'finance@wintechgroup.com', 'Finance Department'),
    ('Legal', 'Legal & Compliance', 'Legal requirements, regulatory compliance, contracts', 'legal@wintechgroup.com', 'Legal & Compliance'),
    ('HS', 'Health & Safety', 'Workplace health, safety, and environmental management', 'health.safety@wintechgroup.com', 'Health & Safety'),
    ('Operations', 'Operations', 'Operational processes, service delivery, quality management', 'operations@wintechgroup.com', 'Operations'),
    ('Marketing', 'Marketing', 'Branding, communications, public relations, and social media', 'marketing@wintechgroup.com', 'Marketing & Comms')
ON CONFLICT (id) DO NOTHING;

-- Insert example domain owners (these should be updated with real emails)
INSERT INTO config.domain_owners (domain_id, email, name, role, added_by) VALUES
    ('IT', 'it.manager@wintechgroup.com', 'IT Manager', 'Head of IT', 'system'),
    ('IT', 'it.security@wintechgroup.com', 'IT Security Team', 'Security Specialists', 'system'),
    ('HR', 'hr.manager@wintechgroup.com', 'HR Manager', 'Head of HR', 'system'),
    ('Finance', 'finance.manager@wintechgroup.com', 'Finance Manager', 'Financial Controller', 'system'),
    ('Finance', 'cfo@wintechgroup.com', 'CFO', 'Chief Financial Officer', 'system'),
    ('Legal', 'legal@wintechgroup.com', 'Legal Team', 'Legal Counsel', 'system'),
    ('HS', 'hs.officer@wintechgroup.com', 'H&S Officer', 'Health & Safety Officer', 'system'),
    ('Operations', 'operations.manager@wintechgroup.com', 'Operations Manager', 'Head of Operations', 'system'),
    ('Marketing', 'marketing.manager@wintechgroup.com', 'Marketing Manager', 'Head of Marketing', 'system')
ON CONFLICT (domain_id, email) DO NOTHING;

-- Insert example domain scopes
INSERT INTO config.domain_scope (domain_id, scope_item, sort_order) VALUES
    ('IT', 'Device management and security', 1),
    ('IT', 'Network and infrastructure', 2),
    ('IT', 'Software and licensing', 3),
    ('IT', 'IT support and service delivery', 4),
    ('IT', 'Technical security controls', 5),
    ('HR', 'Employment policies and procedures', 1),
    ('HR', 'Leave and attendance', 2),
    ('HR', 'Workplace conduct and behavior', 3),
    ('HR', 'Training and development', 4),
    ('HR', 'Performance management', 5),
    ('HR', 'Staff wellbeing', 6),
    ('Finance', 'Budget and financial planning', 1),
    ('Finance', 'Expense management and reimbursement', 2),
    ('Finance', 'Procurement and purchasing', 3),
    ('Finance', 'Financial controls and compliance', 4),
    ('Finance', 'Invoice processing', 5),
    ('Legal', 'Legal obligations and requirements', 1),
    ('Legal', 'Regulatory compliance', 2),
    ('Legal', 'Contract management', 3),
    ('Legal', 'Intellectual property', 4),
    ('Legal', 'Data protection and privacy', 5),
    ('Legal', 'Dispute resolution', 6),
    ('HS', 'Workplace health and safety', 1),
    ('HS', 'Risk assessments', 2),
    ('HS', 'Accident and incident reporting', 3),
    ('HS', 'Emergency procedures', 4),
    ('HS', 'Environmental management', 5),
    ('HS', 'Equipment and facilities safety', 6),
    ('Operations', 'Operational procedures and processes', 1),
    ('Operations', 'Service delivery standards', 2),
    ('Operations', 'Quality management', 3),
    ('Operations', 'Supplier and vendor management', 4),
    ('Operations', 'Project management', 5),
    ('Marketing', 'Brand management and guidelines', 1),
    ('Marketing', 'External communications', 2),
    ('Marketing', 'Social media and digital presence', 3),
    ('Marketing', 'Public relations', 4),
    ('Marketing', 'Marketing campaigns', 5),
    ('Marketing', 'Media management', 6)
ON CONFLICT (domain_id, scope_item) DO NOTHING;