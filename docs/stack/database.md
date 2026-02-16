# Database (Postgres + pgvector)

> Schema design, hybrid search strategy, and configuration storage.

| Attribute        | Value                   |
| ---------------- | ----------------------- |
| Document Version | 1.0.0                   |
| Last Updated     | 2026-02-13              |
| Database         | Supabase (Postgres 15+) |
| Extensions       | pgvector, pg_trgm       |

---

## Overview

The Postgres database serves two purposes:

1. **Search Index** — Hybrid search (vector + keyword + metadata) for policy retrieval
2. **Configuration Store** — Domain ownership, repository workflow settings, audit logs

---

## Search Index Schema

### Tables

```sql
-- Policy metadata for fast filtering
CREATE TABLE public.policies (
    id              TEXT PRIMARY KEY,           -- 'IT-001'
    title           TEXT NOT NULL,
    status          TEXT NOT NULL,              -- draft, active, under_review, superseded, archived
    effective_date  DATE,
    review_date     DATE,
    owners          TEXT[] NOT NULL,
    domains         TEXT[] NOT NULL,
    extends         TEXT,
    related         TEXT[],
    acknowledgement_required BOOLEAN DEFAULT FALSE,
    version         TEXT,
    file_path       TEXT,                       -- Path in content repo
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual rules for structured queries
CREATE TABLE public.rules (
    id              TEXT PRIMARY KEY,           -- 'IT-001-R001'
    policy_id       TEXT REFERENCES public.policies(id) ON DELETE CASCADE,
    domain          TEXT NOT NULL,
    severity        TEXT NOT NULL,              -- MUST, MUST NOT, SHOULD, SHOULD NOT, MAY
    statement       TEXT NOT NULL,
    rationale       TEXT,
    owner           TEXT,                       -- Rule-specific owner if different
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Embeddings for semantic search (rules + prose chunks)
CREATE TABLE public.embeddings (
    id              SERIAL PRIMARY KEY,
    source_type     TEXT NOT NULL,              -- 'rule' or 'prose'
    source_id       TEXT NOT NULL,              -- Rule ID or prose chunk ID
    policy_id       TEXT REFERENCES public.policies(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,              -- Text that was embedded
    embedding       vector(768),               -- Dimension depends on model
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_policies_status ON public.policies(status);
CREATE INDEX idx_policies_domains ON public.policies USING GIN(domains);
CREATE INDEX idx_rules_policy_id ON public.rules(policy_id);
CREATE INDEX idx_rules_domain ON public.rules(domain);
CREATE INDEX idx_rules_severity ON public.rules(severity);
CREATE INDEX idx_embeddings_source ON public.embeddings(source_type, source_id);
CREATE INDEX idx_embeddings_policy ON public.embeddings(policy_id);
CREATE INDEX idx_embeddings_vector ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Full-Text Search Index

```sql
-- Add tsvector column for keyword search
ALTER TABLE public.rules ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', statement || ' ' || COALESCE(rationale, ''))) STORED;

CREATE INDEX idx_rules_search ON public.rules USING GIN(search_vector);

-- Prose search on embeddings table
ALTER TABLE public.embeddings ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_embeddings_search ON public.embeddings USING GIN(search_vector);
```

### What Gets Indexed

| Content           | Table                              | Purpose                                     |
| ----------------- | ---------------------------------- | ------------------------------------------- |
| Policy metadata   | `policies`                         | Fast filtering by ID, domain, status, owner |
| Rule metadata     | `rules`                            | Structured queries on severity, domain      |
| Rule embeddings   | `embeddings` (source_type='rule')  | Semantic search for relevant rules          |
| Prose embeddings  | `embeddings` (source_type='prose') | Semantic search in explanatory content      |
| Rule + prose text | Full-text index (tsvector)         | Keyword/exact term matching                 |

**Rule embedding content** — each rule is embedded with its full context:

```
Rule IT-001-R007 (MUST, IT Domain):
Statement: Devices taken to high-risk jurisdictions must undergo pre-travel security assessment.
Rationale: Devices may be subject to inspection, seizure, or compromise in certain jurisdictions.
Exceptions: None.
```

**Prose embedding content** — prose is chunked by paragraph/section:

```
Source: IT-001, Section 3 "Device Security"
Content: All company devices must have full-disk encryption enabled. This protects data...
```

---

## Hybrid Search Strategy

```
User Query
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Vector Search    Keyword Search    Metadata Filter
(embed query,    (ts_query on      (domain, status,
 cosine sim)     rule/prose text)   severity)
    │                  │                  │
    └──────────────────┼──────────────────┘
                       ▼
             Reciprocal Rank Fusion (RRF)
                       │
                       ▼
             Ranked policy IDs
```

### RRF Scoring

Reciprocal Rank Fusion combines scores from multiple retrieval methods without needing normalisation:

```sql
-- Simplified RRF query
WITH vector_results AS (
    SELECT policy_id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1) as rank
    FROM public.embeddings
    WHERE source_type IN ('rule', 'prose')
    LIMIT 20
),
keyword_results AS (
    SELECT policy_id, ROW_NUMBER() OVER (ORDER BY ts_rank(search_vector, plainto_tsquery($2)) DESC) as rank
    FROM public.rules
    WHERE search_vector @@ plainto_tsquery($2)
    LIMIT 20
)
SELECT policy_id,
    SUM(1.0 / (60 + rank)) as rrf_score
FROM (
    SELECT policy_id, rank FROM vector_results
    UNION ALL
    SELECT policy_id, rank FROM keyword_results
) combined
GROUP BY policy_id
ORDER BY rrf_score DESC
LIMIT $3;
```

### Index Update Process

Updates happen incrementally on merge — only the changed policy is re-indexed:

1. Push webhook arrives → identify changed policy file(s)
2. Parse frontmatter + prose from changed file
3. Upsert `policies` and `rules` tables
4. Generate new embeddings for rules + prose chunks
5. Upsert `embeddings` table (delete old, insert new for that policy)
6. Full-text index updates automatically via generated columns

### Embedding Model

**Decision:** TBD — evaluating options. Requirements:

- High quality semantic similarity for policy/compliance domain
- Reasonable dimension size for pgvector performance
- Available via API or self-hostable

---

## Configuration Schema

Domain ownership and repository workflow configuration stored in the `config` schema.

```sql
CREATE SCHEMA IF NOT EXISTS config;

-- Organisational domain ownership
CREATE TABLE config.domains (
    id              TEXT PRIMARY KEY,           -- 'IT', 'HR', 'Finance'
    name            TEXT NOT NULL,              -- 'Information Technology'
    description     TEXT,
    contact_email   TEXT,
    teams_channel   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE config.domain_owners (
    domain_id       TEXT REFERENCES config.domains(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,              -- Azure AD email
    name            TEXT,
    role            TEXT,
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    added_by        TEXT,
    PRIMARY KEY (domain_id, email)
);

CREATE TABLE config.domain_scope (
    domain_id       TEXT REFERENCES config.domains(id) ON DELETE CASCADE,
    scope_item      TEXT NOT NULL,
    sort_order      INTEGER,
    PRIMARY KEY (domain_id, scope_item)
);

-- Per-repository workflow configuration (synced from repo on push)
CREATE TABLE config.repository_config (
    repo_full_name          TEXT PRIMARY KEY,   -- 'Wintech-Group/docs-policy-governance'
    document_type           TEXT NOT NULL,      -- 'policies', 'sops', 'tech-docs'
    approval_required       BOOLEAN DEFAULT TRUE,
    domain_approval         BOOLEAN DEFAULT TRUE,
    owner_approval          BOOLEAN DEFAULT TRUE,
    auto_merge_enabled      BOOLEAN DEFAULT FALSE,
    auto_merge_after_hours  INTEGER,
    notify_on_pr_open       BOOLEAN DEFAULT TRUE,
    reminder_after_hours    INTEGER DEFAULT 48,
    escalate_after_hours    INTEGER DEFAULT 120,
    notification_channels   TEXT[] DEFAULT ARRAY['email'],
    config_file_path        TEXT DEFAULT 'metadata/governance.yaml',
    config_sha              TEXT,
    synced_at               TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-domain rules for specific patterns
CREATE TABLE config.cross_domain_rules (
    id                  SERIAL PRIMARY KEY,
    repo_full_name      TEXT REFERENCES config.repository_config(repo_full_name) ON DELETE CASCADE,
    rule_pattern        TEXT NOT NULL,
    required_domains    TEXT[] NOT NULL,
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_domain_owners_email ON config.domain_owners(email);
CREATE INDEX idx_cross_domain_rules_repo ON config.cross_domain_rules(repo_full_name);
```

### Domain Routing Queries

**Find domain owners for a set of domains:**

```sql
SELECT do.email, do.name, do.role, d.name as domain_name
FROM config.domain_owners do
JOIN config.domains d ON do.domain_id = d.id
WHERE d.id = ANY($1::text[]);
```

**Get repository workflow config:**

```sql
SELECT * FROM config.repository_config WHERE repo_full_name = $1;
```

### governance.yaml (Content Repo)

Each content repository declares its workflow configuration — synced to `config.repository_config` on push:

```yaml
document_type: policies

approval:
  required: true
  domain_approval: true
  owner_approval: true
  auto_merge:
    enabled: false
    after_hours: 24

notifications:
  on_pr_open: true
  channels: [email, teams]
  reminder_after_hours: 48
  escalate_after_hours: 120

cross_domain_rules:
  - pattern: "travel.*high-risk|restricted.*territory"
    domains: [IT, HR]
    description: Travel to high-risk jurisdictions
  - pattern: "remote.*work|work.*from.*home"
    domains: [HR, IT]
    description: Remote working arrangements
```

---

## Type Generation

After schema changes, regenerate TypeScript types:

```bash
bun run supabase:gen-types
```

Output: `src/types/database.types.ts`
