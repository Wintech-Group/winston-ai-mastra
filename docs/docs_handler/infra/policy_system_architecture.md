# Policy Management System Architecture

**High-Level Design Document**

| Attribute         | Value                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| Document Version  | 0.9.0                                                                     |
| Status            | Draft                                                                     |
| Created           | 2026-01-26                                                                |
| Last Updated      | 2026-02-05                                                                |
| Related Documents | Policy Definition Specification v0.1.0, Policy System Requirements v0.1.0 |
| Purpose           | Define the high-level architecture for the policy management system       |

---

## 1. Overview

### 1.1 Design Philosophy

**GitHub as Source of Truth** — All policy data lives in a GitHub repository as structured files. Every other system (SharePoint, AI agents, PDF generation) consumes from or writes to GitHub. This provides:

- Immutable, auditable version history
- Native change tracking and diff capabilities
- Rule-level granularity through structured frontmatter
- Clean API access for both humans and AI agents

**One File Per Policy** — Each policy is a single frontmatter markdown file containing both machine-readable rule definitions and human-readable prose. This ensures:

- Conceptual integrity (a policy is one document)
- Single source of truth (rules and prose cannot drift apart)
- Full context for AI agents (better understanding, better responses)
- Simple PDF generation (markdown body is the human document)

**SharePoint as Single User Interface** — All user interaction happens within SharePoint. Users never leave SharePoint to view, suggest, edit, or approve policies.

**Native SharePoint Pages** — Policies are published as native SharePoint pages, not static files. This ensures full search indexing, native UX, and eliminates the need for a custom viewer web part.

**Agent-First Interaction** — Most user interactions beyond viewing happen through a chat agent embedded in SharePoint. This minimises custom UI development while providing a flexible, natural interface for all workflows. The agent uses tools to perform operations on GitHub.

**Hybrid Retrieval with Full Context** — Policy queries use hybrid search (vector + keyword + structured) to find relevant policies, then load full policy files for complete context. This ensures compliance-critical queries receive accurate, nuanced responses.

**Separation of Concerns** — Each component has a single responsibility:

| Concern                   | System                                                 |
| ------------------------- | ------------------------------------------------------ |
| Storage & Version Control | GitHub                                                 |
| Human Viewing             | SharePoint (Native Pages + PDF)                        |
| Human Interaction         | Chat Agent (SPFx) + Mastra Tools                       |
| Policy Retrieval          | Postgres (pgvector) + Hybrid Search                    |
| Workflow Automation       | Central Service (webhook-driven)                       |
| Identity & Permissions    | Azure AD                                               |
| Organisational Data       | People First                                           |
| Domain Ownership          | Postgres (`config.domains`)                            |
| Repository Configuration  | Postgres (`config.repository_config`) synced from repo |

### 1.2 Architecture Overview

```
                                 ┌─────────────────────────┐
                                 │       Azure AD          │
                                 │   (Authentication)      │
                                 └───────────┬─────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SharePoint Site                              │
│                  (policies.company.com)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Native SharePoint Pages (one per policy)                   │ │
│  │                                                            │ │
│  │ • Full search indexing                                     │ │
│  │ • Native SharePoint UX                                     │ │
│  │ • Metadata columns for filtering                           │ │
│  │ • [Suggest Change] button                                  │ │
│  │ • [Download PDF] link                                      │ │
│  │ • Version history with links to archived PDFs              │ │
│  │ • Embedded chat agent web part                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ SPFx Web Part: Policy Assistant (Chat Interface)           │ │
│  │                                                            │ │
│  │  User: "Can I take my laptop to China?"                   │ │
│  │  Agent: [Retrieves IT + Travel + Security policies]       │ │
│  │         [Reasons over full context]                       │ │
│  │         [Provides answer with rule citations]             │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Canvas / Artifact Area                               │ │ │
│  │  │ • Diff viewer for changes                            │ │ │
│  │  │ • Policy preview                                     │ │ │
│  │  │ • Edit interface for complex changes                 │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
                           ┌──────────────┐
                           │ Mastra Agent │
                           │              │
                           │ Policy Tools │
                           │ (see §4.3)   │
                           └──────┬───────┘
                                  │
                 ┌────────────────┼────────────────┐
                 ▼                │                ▼
        ┌──────────────┐         │       ┌──────────────┐
        │ Postgres     │         │       │ GitHub       │
        │ (pgvector)   │         │       │ Repository   │
        │              │         │       │              │
        │ • Embeddings │         │       │ • Policies   │
        │ • Metadata   │         │       │ • Schema     │
        │ • Keywords   │         │       │ • Metadata   │
        └──────────────┘         │       └──────┬───────┘
                                 │              │
                                 ▼              │ Webhooks
                        ┌──────────────┐        │
                        │ Central      │◄───────┘
                        │ Service      │
                        │              │
                        │ • Validate   │
                        │ • Sync SP    │
                        │ • Gen PDF    │
                        │ • Update     │
                        │   Index      │
                        └──────────────┘
```

---

## 2. Policy File Format

### 2.1 Frontmatter Markdown Structure

Each policy is a single markdown file with YAML frontmatter containing machine-readable metadata and rules, followed by the full human-readable policy document.

```markdown
---
id: IT-001
title: Information Security Policy
version: 2.1.0
status: active
effective_date: 2025-06-01
review_date: 2026-06-01
owners:
  - jane.smith@company.com
  - security.team@company.com
extends: null
related:
  - HR-003-remote-working
  - IT-002-acceptable-use
acknowledgement_required: true

rules:
  - id: IT-001-R001
    domain: IT
    severity: MUST
    statement: All company devices must have full-disk encryption enabled.
    rationale: Legal requirement under data protection regulations.
    exceptions:
      - condition: Device is used solely for public marketing content
        approver: IT Security Manager

  - id: IT-001-R002
    domain: HR
    severity: MUST
    statement: Staff must complete annual security awareness training.
    rationale: Compliance requirement.
    exceptions: []

  - id: IT-001-R003
    domain: IT
    severity: SHOULD
    statement: Staff should report suspected security incidents within 24 hours.
    rationale: Early detection minimises impact.
    exceptions: []
---

# Information Security Policy

## 1. Purpose

This policy establishes the requirements for protecting company
information assets and ensuring compliance with data protection
regulations.

## 2. Scope

This policy applies to all employees, contractors, and third parties
who access company systems or data.

## 3. Device Security

All company devices must have full-disk encryption enabled. This
protects data in the event of device loss or theft.

If you are unsure whether your device is encrypted, contact IT Support
who can verify and enable encryption if needed.

**Exception:** Devices used solely for public marketing content (e.g.,
trade show display devices) may be exempted with IT Security Manager
approval.

## 4. Security Awareness

All staff must complete annual security awareness training. This
training covers phishing recognition, password hygiene, and incident
reporting.

New starters must complete training within their first 30 days.

## 5. Incident Reporting

If you suspect a security incident, report it to security@company.com
as soon as possible, ideally within 24 hours. Early detection helps
us contain issues before they escalate.

When in doubt, report it — we would rather investigate a false alarm
than miss a real incident.

---

_Document Owner: Jane Smith, IT Security Manager_
_Last Review: 2025-06-01_
```

### 2.2 Why This Format

| Benefit                       | Explanation                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Single source of truth**    | Rules and prose live together; they cannot drift apart                 |
| **Human-readable by default** | Open the file, read the policy — no assembly required                  |
| **Machine-parseable**         | Frontmatter YAML provides structured data for AI agents and automation |
| **PDF generation is trivial** | Render the markdown body with metadata header                          |
| **Full context for AI**       | Agent loads one file and has complete understanding of the policy      |
| **Familiar format**           | Frontmatter markdown is widely used (Hugo, Jekyll, Docusaurus, etc.)   |

---

## 3. Repository Structure

The content repository contains only policy content — no workflow files. All automation is handled by the central service via webhooks.

```
docs-policy-governance/
├── policies/
│   ├── IT-001-information-security.md
│   ├── IT-002-acceptable-use.md
│   ├── HR-001-travel.md
│   ├── HR-002-expenses.md
│   ├── FIN-001-procurement.md
│   └── ...
├── schema/
│   └── policy.schema.json            # JSON Schema for frontmatter validation
├── metadata/
│   └── governance.yaml               # Repository workflow configuration (syncs to DB on push)
├── templates/
│   ├── policy-template.md            # Blank template for new policies
│   └── pdf-template.html             # Branding template for PDF generation
└── README.md
```

**Note:** Domain ownership is stored in the Postgres database (`config.domains`) as organisational truth. Repository workflow configuration is defined declaratively in `metadata/governance.yaml` and synced to the database on push.

**Note:** There is no `.github/workflows/` directory. The Policy Bot (GitHub App) is installed on this repository and delivers webhooks to the central service, which handles all automation.

---

## 4. Core Components

### 4.1 GitHub Repository

**Role:** Single source of truth for all policy data.

**Key Mechanisms:**

| Mechanism         | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `main` branch     | Published, active policies only                   |
| Feature branches  | Proposed changes (one branch per change)          |
| Pull Requests     | Change proposals with discussion and approval     |
| Branch protection | Prevents merge without required approvals         |
| Webhooks          | Delivers events to central service for automation |

**Approval Routing:**

Domain-based approval routing is handled by the central service when it receives PR webhooks:

1. PR is opened or updated
2. GitHub sends `pull_request` webhook to central service
3. Service queries database for repository configuration (fast lookup, no file fetching)
4. Service parses the diff to identify which rules changed
5. Queries database for domain owners (`config.domains` + `config.domain_owners`)
6. Updates PR body with approval table listing required approvers
7. Sends notifications to domain owners per repository configuration
8. PR cannot merge until all approvals recorded in approval table

**Configuration Architecture:**

| Configuration       | Storage                                             | Source                                             | Update Method           |
| ------------------- | --------------------------------------------------- | -------------------------------------------------- | ----------------------- |
| Domain ownership    | Postgres (`config.domains`, `config.domain_owners`) | Managed via Central Service API/Admin UI           | Direct database updates |
| Repository workflow | Postgres (`config.repository_config`)               | Declared in each repo's `metadata/governance.yaml` | Synced on push webhook  |

**Benefits:**

- Fast PR handling (database lookup, no GitHub API calls)
- Single source of truth for domain ownership (database)
- Content repos remain declarative and self-contained
- Repository configuration auto-syncs on merge

---

### 4.2 SharePoint Site

**Role:** Single location for viewing policies and interacting with the chat agent.

#### 4.2.1 Site Structure

```
policies.company.com/
├── Home                              # Landing page with policy index + chat agent
├── SitePages/
│   ├── IT-001-information-security.aspx    # Native SP page (latest version)
│   ├── IT-002-acceptable-use.aspx          # Native SP page (latest version)
│   ├── HR-001-travel.aspx                  # Native SP page (latest version)
│   └── ...
├── Archive/                          # Document library for archived PDFs
│   ├── IT-001-information-security-v2.0.0.pdf
│   ├── IT-001-information-security-v1.0.0.pdf
│   └── ...
├── Current/                          # Document library for current PDFs
│   ├── IT-001-information-security.pdf     # Latest version PDF
│   └── ...
└── Lists/
    └── Acknowledgements/             # Tracks user acknowledgements
```

#### 4.2.2 Native SharePoint Pages

Each policy is published as a native SharePoint page, created/updated via Microsoft Graph API on merge.

**Why native pages over static files:**

| Aspect                 | Static HTML Files        | Native SharePoint Pages       |
| ---------------------- | ------------------------ | ----------------------------- |
| Search indexing        | Limited                  | Full                          |
| UX                     | Opens in document viewer | Native page experience        |
| Metadata               | File properties only     | SharePoint columns, filtering |
| Custom viewer web part | Potentially needed       | Not needed                    |
| Mobile responsive      | Manual                   | Automatic                     |
| Accessibility          | Manual                   | Built-in                      |

**Page structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│ IT-001: Information Security Policy                             │
│                                                                 │
│ Version 2.1.0 | Effective: 2025-06-01 | Review: 2026-06-01     │
│ Owners: Jane Smith, Security Team                               │
│ Domain: IT | Status: Active                                     │
│                                                                 │
│ [Suggest Change]                      [Download PDF]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ## 1. Purpose                                                   │
│                                                                 │
│ This policy establishes the requirements for protecting...      │
│                                                                 │
│ ## 2. Scope                                                     │
│                                                                 │
│ This policy applies to all employees, contractors...            │
│                                                                 │
│ ...                                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Version History                                                 │
│ • v2.1.0 (Current) - 2025-06-01                                │
│ • v2.0.0 - 2024-06-01 [PDF]                                    │
│ • v1.0.0 - 2023-01-15 [PDF]                                    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Policy Assistant (Chat Web Part)                            │ │
│ │                                                             │ │
│ │ Ask a question about this policy...                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Page metadata (SharePoint columns):**

| Column        | Type   | Purpose                                |
| ------------- | ------ | -------------------------------------- |
| PolicyID      | Text   | Unique identifier (IT-001)             |
| Title         | Text   | Policy title                           |
| Version       | Text   | Current version number                 |
| Status        | Choice | Active, Draft, Under Review, Archived  |
| EffectiveDate | Date   | When current version took effect       |
| ReviewDate    | Date   | Next scheduled review                  |
| Domain        | Choice | Primary domain (IT, HR, Finance, etc.) |
| Owners        | Person | Policy owners                          |

These columns enable filtering and sorting in SharePoint views.

#### 4.2.3 Versioning Strategy

**Current version:** Native SharePoint page (always shows latest)

- URL: `/SitePages/IT-001-information-security.aspx`
- Fully searchable
- Updated in-place on each merge

**Archived versions:** PDF only

- URL: `/Archive/IT-001-information-security-v2.0.0.pdf`
- Sufficient for audit/compliance
- Not indexed in search (or excluded via search configuration)
- Linked from "Version History" section on current page

**Rationale:**

- Archived versions are rarely accessed
- PDF is sufficient for audit/compliance purposes
- Avoids complexity of managing multiple versioned pages
- Avoids search results showing old versions
- Can add versioned pages later if needed

#### 4.2.4 Native SharePoint Features Used

| Function                 | Implementation                                |
| ------------------------ | --------------------------------------------- |
| Policy viewing           | Native SharePoint pages                       |
| PDF download             | PDF files in document library                 |
| Search                   | SharePoint search (full page content indexed) |
| Browse/filter            | Page library with metadata columns            |
| Permissions              | Azure AD integration, SharePoint groups       |
| Acknowledgement tracking | SharePoint List (policy ID + user + date)     |

#### 4.2.5 Custom UI (Minimal)

| Element                 | Purpose                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| "Suggest Change" button | On each policy page; opens chat with policy context pre-loaded     |
| Chat Agent web part     | Single SPFx web part; embedded on each policy page for interaction |

---

### 4.3 Mastra Agent & Tools

**Role:** Primary interface for all policy interactions beyond viewing.

The chat agent is embedded in SharePoint via an SPFx web part. It uses Mastra tools to perform operations on GitHub, query policies, and manage workflows.

**Agent Capabilities:**

| Capability              | Example Interaction                               |
| ----------------------- | ------------------------------------------------- |
| Query policies          | "What policies apply to contractors?"             |
| Check compliance        | "Can I take my laptop and phone to China?"        |
| Submit suggestion       | "I want to suggest a change to the travel policy" |
| Check suggestion status | "What's the status of my suggestions?"            |
| View pending approvals  | "Show me my pending approvals"                    |
| Review changes          | "Show me the diff for PR #42"                     |
| Approve/reject changes  | "Approve the change to rule HR-001-R003"          |
| Check policy status     | "Which policies are overdue for review?"          |
| Explain rules           | "Why do we require encryption on all devices?"    |

**Canvas / Artifact Area:**

For complex interactions, the agent renders rich content in a canvas area:

| Content Type     | Use Case                           |
| ---------------- | ---------------------------------- |
| Diff viewer      | Reviewing proposed changes         |
| Policy preview   | Previewing edits before submission |
| Edit interface   | Making changes to rules or prose   |
| Status dashboard | Viewing multiple pending items     |
| Approval cards   | Batch reviewing/approving changes  |

**Mastra Tools:**

| Tool                    | Function                                   | Access Level           |
| ----------------------- | ------------------------------------------ | ---------------------- |
| `query_policies`        | Hybrid search for relevant policies        | All staff              |
| `search_rules`          | Semantic search on rules                   | All staff              |
| `get_policy`            | Retrieve full policy content from GitHub   | All staff              |
| `get_rules_by_filter`   | Filter rules by domain, severity, keywords | All staff              |
| `find_related_policies` | Traverse policy relationships              | All staff              |
| `submit_suggestion`     | Create GitHub Issue with suggestion        | All staff              |
| `get_my_suggestions`    | List user's submitted suggestions          | All staff              |
| `get_pending_approvals` | List PRs awaiting user's approval          | Owners / Domain owners |
| `get_change_diff`       | Retrieve diff for a PR                     | Owners / Domain owners |
| `approve_change`        | Approve a PR                               | Owners / Domain owners |
| `reject_change`         | Reject a PR with comment                   | Owners / Domain owners |
| `request_changes`       | Request changes on a PR                    | Owners / Domain owners |
| `create_change`         | Create branch + PR with proposed edits     | Policy owners          |
| `update_change`         | Update an existing PR                      | Policy owners          |
| `get_policy_status`     | List policies with review status           | Owners / Admins        |
| `detect_conflicts`      | Analyse rules for contradictions           | Owners / Admins        |

**Tool Access Control:**

Tools validate user permissions before executing:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Chat Agent      │────►│ Mastra Tool     │────►│ Permission      │
│                 │     │                 │     │ Check           │
│ User request    │     │ e.g. approve_   │     │                 │
│                 │     │ change          │     │ • Get user from │
│                 │     │                 │     │   Azure AD      │
│                 │     │                 │     │ • Check role    │
│                 │     │                 │     │ • Verify owner  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                   ┌─────────────┐               ┌─────────────┐
                                   │ Authorised  │               │ Denied      │
                                   │             │               │             │
                                   │ Execute via │               │ "You don't  │
                                   │ GitHub API  │               │ have access │
                                   │             │               │ to approve  │
                                   │             │               │ this change"│
                                   └─────────────┘               └─────────────┘
```

---

### 4.4 Retrieval Layer

**Role:** Enable accurate, compliance-critical policy queries through hybrid search and full-context loading.

#### 4.4.1 The Retrieval Challenge

A query like "Can I take my company laptop and phone on a factory visit to China?" requires:

| Step                  | Requirement                                                        |
| --------------------- | ------------------------------------------------------------------ |
| Concept mapping       | "laptop" → "company devices", "IT equipment"                       |
| Context understanding | "factory visit" → "business travel", "international travel"        |
| Location awareness    | "China" → "high-risk jurisdiction", "restricted territory"         |
| Policy discovery      | Find: IT Policy, Travel Policy, Security Policy, Export Compliance |
| Rule retrieval        | Find specific rules about devices + travel + jurisdictions         |
| Exception handling    | Check for relevant exceptions and conditions                       |
| Synthesis             | Combine rules from multiple policies into coherent answer          |

Neither keyword search alone (misses synonyms) nor vector search alone (may miss exact terms) is sufficient. We use hybrid search plus agentic retrieval.

#### 4.4.2 Retrieval Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Postgres (pgvector)                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    policies table                        │    │
│  │                                                          │    │
│  │  id           │ policy_id │ title    │ status  │ ...    │    │
│  │  ─────────────┼───────────┼──────────┼─────────┼─────── │    │
│  │  1            │ IT-001    │ Info Sec │ active  │ ...    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    rules table                           │    │
│  │                                                          │    │
│  │  id │ rule_id     │ policy_id │ domain │ severity │ ... │    │
│  │  ───┼─────────────┼───────────┼────────┼──────────┼──── │    │
│  │  1  │ IT-001-R001 │ IT-001    │ IT     │ MUST     │ ... │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    embeddings table                      │    │
│  │                                                          │    │
│  │  id │ source_type │ source_id   │ content    │ vector   │    │
│  │  ───┼─────────────┼─────────────┼────────────┼───────── │    │
│  │  1  │ rule        │ IT-001-R001 │ "All co..." │ [0.1,..] │    │
│  │  2  │ prose       │ IT-001-P003 │ "Device..." │ [0.2,..] │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Full-text search index                │    │
│  │                                                          │    │
│  │  tsvector on rule statements + prose content             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4.3 What Gets Indexed

| Content           | Storage                    | Purpose                                     |
| ----------------- | -------------------------- | ------------------------------------------- |
| Policy metadata   | `policies` table           | Fast filtering by ID, domain, status, owner |
| Rule metadata     | `rules` table              | Structured queries on severity, domain      |
| Rule embeddings   | `embeddings` table         | Semantic search for relevant rules          |
| Prose embeddings  | `embeddings` table         | Semantic search in explanatory content      |
| Rule + prose text | Full-text index (tsvector) | Keyword/exact term matching                 |

**Rule embedding content:**

Each rule is embedded with its full context for rich semantic matching:

```
Rule IT-001-R007 (MUST, IT Domain):
Statement: Devices taken to high-risk jurisdictions must undergo pre-travel
security assessment.
Rationale: Devices may be subject to inspection, seizure, or compromise in
certain jurisdictions.
Exceptions: None.
```

**Prose embedding content:**

Prose is chunked by paragraph/section and embedded separately:

```
Source: IT-001, Section 3 "Device Security"
Content: All company devices must have full-disk encryption enabled. This
protects data in the event of device loss or theft. If you are unsure
whether your device is encrypted, contact IT Support who can verify and
enable encryption if needed.
```

#### 4.4.4 Hybrid Search Strategy

```
┌─────────────────┐
│ User Query      │
│ "laptop China"  │
└────────┬────────┘
         │
         ├────────────────────┬────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Vector Search   │  │ Keyword Search  │  │ Metadata Filter │
│                 │  │                 │  │                 │
│ Embed query     │  │ ts_query on     │  │ domain: IT      │
│ Find similar    │  │ "laptop"        │  │ status: active  │
│ vectors         │  │ "China"         │  │                 │
│                 │  │ "device"        │  │                 │
│                 │  │ "travel"        │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ Reciprocal Rank │
                    │ Fusion (RRF)    │
                    │                 │
                    │ Combine scores  │
                    │ Re-rank results │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │ Policy IDs      │
                    │ (ranked)        │
                    └─────────────────┘
```

#### 4.4.5 Agentic Retrieval Flow

The agent doesn't just search — it reasons about what to retrieve:

```
┌─────────────────────────────────────────────────────────────────┐
│ User: "Can I take my laptop and phone to China?"               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent Reasoning (Step 1):                                       │
│                                                                 │
│ "This query involves:                                          │
│  - Company devices (laptop, phone) → IT Policy                 │
│  - International travel → Travel Policy                        │
│  - China specifically → possibly Security Policy, Export       │
│                                                                 │
│ I should search for policies about: devices, travel,           │
│ international, high-risk jurisdictions, China"                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tool Call: query_policies                                       │
│                                                                 │
│ Hybrid search returns:                                         │
│  1. IT-001 (score: 0.89) - rules about devices, travel         │
│  2. HR-001 (score: 0.84) - travel policy                       │
│  3. SEC-001 (score: 0.76) - security, jurisdictions            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tool Call: get_policy (for each relevant policy)               │
│                                                                 │
│ Load FULL policy files from GitHub:                            │
│  - IT-001-information-security.md                              │
│  - HR-001-travel.md                                            │
│  - SEC-001-security.md                                         │
│                                                                 │
│ ~15,000 tokens total — well within context limits              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent Reasoning (Step 2):                                       │
│                                                                 │
│ With full context, agent:                                      │
│  - Finds specific rules that apply                             │
│  - Checks for exceptions                                        │
│  - Understands the rationale                                    │
│  - Reads prose for nuance and examples                         │
│  - Synthesizes a complete answer                               │
│  - Cites specific rule IDs                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Response:                                                       │
│                                                                 │
│ "Yes, but with conditions:                                     │
│                                                                 │
│ 1. IT-001-R007 requires pre-travel security check for devices  │
│    going to high-risk jurisdictions. China is classified as    │
│    high-risk (SEC-001-R003).                                   │
│                                                                 │
│ 2. HR-001-R012 requires travel approval 14 days in advance     │
│    for travel to restricted territories.                       │
│                                                                 │
│ 3. IT-001-R009 prohibits taking devices with [specific data]   │
│    to China. You'll need a 'clean' device from IT.             │
│                                                                 │
│ Actions needed:                                                │
│  - Submit travel request                                       │
│  - Request travel device from IT                               │
│  - Complete pre-travel security briefing                       │
│                                                                 │
│ Do you want me to help start the travel request?"              │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4.6 Fallback Behaviour

If search returns no relevant results or confidence is low:

```
┌─────────────────────────────────────────────────────────────────┐
│ Agent Response (Fallback):                                      │
│                                                                 │
│ "I couldn't find a definitive answer in our policies for this  │
│ specific situation.                                            │
│                                                                 │
│ These policies might be relevant:                              │
│  - Information Security Policy [link to SP page]               │
│  - Travel Policy [link to SP page]                             │
│                                                                 │
│ You can browse all policies here: [SharePoint link]            │
│                                                                 │
│ Or contact [Policy Owner] for clarification."                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4.7 Index Update Process

Index updates happen incrementally on merge — only the changed policy is re-indexed:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Merge to main   │────►│ Central Service │────►│ Identify        │
│ (push webhook)  │     │ Push Handler    │     │ changed policy  │
└─────────────────┘     └─────────────────┘     │ file(s)         │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Parse policy    │
                                                │ frontmatter +   │
                                                │ prose           │
                                                └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────┐
                        ▼                                ▼        ▼
               ┌──────────────┐                 ┌──────────────┐  │
               │ Update       │                 │ Generate     │  │
               │ policies +   │                 │ embeddings   │  │
               │ rules tables │                 │ for rules +  │  │
               │              │                 │ prose        │  │
               └──────────────┘                 └──────┬───────┘  │
                                                       │          │
                                                       ▼          │
                                                ┌──────────────┐  │
                                                │ Upsert to    │  │
                                                │ embeddings   │  │
                                                │ table        │  │
                                                └──────────────┘  │
                                                                  │
                                                         ┌────────┘
                                                         ▼
                                                ┌──────────────┐
                                                │ Update       │
                                                │ full-text    │
                                                │ search index │
                                                └──────────────┘
```

#### 4.4.8 Embedding Model

**Decision:** TBD — evaluating Google's new embedding model based on promising benchmarks.

**Requirements:**

- High quality semantic similarity for policy/compliance domain
- Reasonable dimension size for pgvector performance
- Available via API or self-hostable

---

### 4.5 SPFx Web Part

**Role:** Embed the chat agent in SharePoint pages.

**Single Web Part:** Policy Assistant

| Feature           | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| Chat interface    | Text input, message history                                   |
| Canvas area       | Rich content rendering (diffs, previews, forms)               |
| Context awareness | Knows which policy page user is viewing (reads page metadata) |
| Authentication    | Inherits SharePoint user context                              |

**"Suggest Change" Button:**

A simple button added to the page template that:

1. Opens the chat agent (if collapsed)
2. Pre-populates context: "I want to suggest a change to [Policy Name]"
3. Agent responds with guided flow for capturing the suggestion

This can be implemented as:

- Part of the chat web part (button in header)
- Separate lightweight web part
- Native SharePoint button with JavaScript to trigger chat

---

### 4.6 Central Service (Webhook Handlers)

All automation is handled by a central service that receives GitHub webhooks. Content repositories contain no workflow files — adding a new document type requires only installing the GitHub App and adding a configuration entry.

#### 4.6.1 Configuration Database Schema

Domain ownership and repository workflow configuration are stored in Postgres for fast access and single source of truth.

**Schema: `config`**

```sql
-- Organisational domain ownership (managed centrally)
CREATE TABLE config.domains (
    id              TEXT PRIMARY KEY,           -- 'IT', 'HR', 'Finance'
    name            TEXT NOT NULL,              -- 'Information Technology'
    description     TEXT,                       -- Domain description
    contact_email   TEXT,                       -- General domain contact
    teams_channel   TEXT,                       -- Teams channel name
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE config.domain_owners (
    domain_id       TEXT REFERENCES config.domains(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,              -- Azure AD email
    name            TEXT,                       -- Display name
    role            TEXT,                       -- Role/title
    added_at        TIMESTAMPTZ DEFAULT NOW(),
    added_by        TEXT,                       -- Who added this owner
    PRIMARY KEY (domain_id, email)
);

CREATE TABLE config.domain_scope (
    domain_id       TEXT REFERENCES config.domains(id) ON DELETE CASCADE,
    scope_item      TEXT NOT NULL,              -- Area of responsibility
    sort_order      INTEGER,
    PRIMARY KEY (domain_id, scope_item)
);

-- Per-repository workflow configuration (synced from repo on push)
CREATE TABLE config.repository_config (
    repo_full_name          TEXT PRIMARY KEY,   -- 'Wintech-Group/docs-policy-governance'
    document_type           TEXT NOT NULL,      -- 'policies', 'sops', 'tech-docs'

    -- Approval settings
    approval_required       BOOLEAN DEFAULT TRUE,
    domain_approval         BOOLEAN DEFAULT TRUE,
    owner_approval          BOOLEAN DEFAULT TRUE,
    auto_merge_enabled      BOOLEAN DEFAULT FALSE,
    auto_merge_after_hours  INTEGER,

    -- Notification settings
    notify_on_pr_open       BOOLEAN DEFAULT TRUE,
    reminder_after_hours    INTEGER DEFAULT 48,
    escalate_after_hours    INTEGER DEFAULT 120,
    notification_channels   TEXT[] DEFAULT ARRAY['email'],  -- ['email', 'teams']

    -- Sync metadata
    config_file_path        TEXT DEFAULT 'metadata/governance.yaml',
    config_sha              TEXT,               -- SHA of last synced config file
    synced_at               TIMESTAMPTZ,

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Cross-domain rules for specific patterns
CREATE TABLE config.cross_domain_rules (
    id                  SERIAL PRIMARY KEY,
    repo_full_name      TEXT REFERENCES config.repository_config(repo_full_name) ON DELETE CASCADE,
    rule_pattern        TEXT NOT NULL,          -- Regex pattern for rule matching
    required_domains    TEXT[] NOT NULL,        -- Array of domain IDs required
    description         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_domain_owners_email ON config.domain_owners(email);
CREATE INDEX idx_cross_domain_rules_repo ON config.cross_domain_rules(repo_full_name);
```

**Repository Configuration File:**

Each content repository declares its workflow configuration in `metadata/governance.yaml`:

```yaml
# metadata/governance.yaml (synced to database on push)
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
  channels:
    - email
    - teams
  reminder_after_hours: 48
  escalate_after_hours: 120

# Cross-domain rules specific to this document type
cross_domain_rules:
  - pattern: "travel.*high-risk|restricted.*territory"
    domains: [IT, HR]
    description: Travel to high-risk jurisdictions

  - pattern: "remote.*work|work.*from.*home"
    domains: [HR, IT]
    description: Remote working arrangements
```

**Domain Management:**

Domains are managed via the central service API (or future admin UI), not via repository files. This keeps domain ownership as an organisational concern, separate from document workflow configuration.

#### 4.6.2 Webhook Events

| Event                        | Trigger       | Actions                                               |
| ---------------------------- | ------------- | ----------------------------------------------------- |
| `push` (to main)             | PR merged     | Sync to SharePoint, generate PDF, update search index |
| `pull_request` (opened)      | PR created    | Validate schema, identify domains, add approval table |
| `pull_request` (synchronize) | PR updated    | Re-validate, update approval table if needed          |
| `issue_comment` (created)    | Comment added | Check for approval commands                           |
| `issues` (opened)            | Issue created | Track as suggestion, notify policy owner              |

#### 4.6.2 Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Central Service                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ POST /webhooks/github                                        │    │
│  │                                                              │    │
│  │  1. Verify webhook signature                                 │    │
│  │  2. Identify source repo → document type config             │    │
│  │  3. Route to appropriate handler                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                 │
│         ▼                    ▼                    ▼                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │ PR Handler  │     │ Push Handler│     │ Issue       │           │
│  │             │     │             │     │ Handler     │           │
│  │ • Validate  │     │ • Sync SP   │     │             │           │
│  │ • Route     │     │ • Gen PDF   │     │ • Track     │           │
│  │   approvals │     │ • Update    │     │   suggestion│           │
│  │ • Update PR │     │   index     │     │ • Notify    │           │
│  │   body      │     │             │     │   owner     │           │
│  └─────────────┘     └─────────────┘     └─────────────┘           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Configuration: Repo → Document Type Mapping                  │    │
│  │                                                              │    │
│  │  company/docs-policy-governance  →  type: policies               │    │
│  │  company/docs-sop-library        →  type: sops                   │    │
│  │  company/docs-tech          →  type: tech-docs              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Scheduled Jobs (internal cron)                               │    │
│  │                                                              │    │
│  │  • Review reminder check (daily)                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 4.6.5 Push Handler (On Merge)

When a PR is merged to `main`:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ push webhook    │────►│ Central Service │────►│ Identify        │
│ (to main)       │     │ Push Handler    │     │ changed files   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼─────────────────────────┐
                        ▼                                ▼                         ▼
               ┌──────────────┐                 ┌──────────────┐          ┌──────────────┐
               │ Check if     │                 │ Sync         │          │ Generate     │
               │ governance   │                 │ SharePoint   │          │ PDF          │
               │ .yaml changed│                 │              │          │              │
               └──────┬───────┘                 │ Graph API    │          │ Archive prev │
                      │                         │ create/update│          │ Upload new   │
                      ▼                         │ native page  │          │              │
               ┌──────────────┐                 └──────────────┘          └──────────────┘
               │ Sync config  │                         │                         │
               │ to database  │                         ▼                         ▼
               │ (upsert)     │                 ┌──────────────┐          ┌──────────────┐
               └──────────────┘                 │ Update       │          │ Update       │
                                                │ Search Index │          │ metadata     │
                                                │              │          │ columns      │
                                                │ Re-embed     │          │              │
                                                │ changed only │          │              │
                                                └──────────────┘          └──────────────┘
```

**Config Sync Logic:**

```typescript
async function handlePush(webhook: PushWebhook) {
  const repoFullName = webhook.repository.full_name

  // Check if governance.yaml changed
  const configChanged = webhook.commits.some(
    (c) =>
      c.modified.includes("metadata/governance.yaml") ||
      c.added.includes("metadata/governance.yaml"),
  )

  if (configChanged) {
    // Fetch and sync config to database
    const config = await fetchFile(
      repoFullName,
      "metadata/governance.yaml",
      "main",
    )
    await syncRepoConfig(repoFullName, config, webhook.head_commit.id)
    console.log(`Synced config for ${repoFullName}`)
  }

  // Continue with normal push handling (sync SP, PDF, index)
  await syncSharePoint(webhook)
  await generatePDFs(webhook)
  await updateSearchIndex(webhook)
}

async function syncRepoConfig(
  repoFullName: string,
  configYaml: string,
  sha: string,
) {
  const config = parseYaml(configYaml)

  // Upsert repository config
  await db.repositoryConfig.upsert({
    where: { repo_full_name: repoFullName },
    update: {
      document_type: config.document_type,
      approval_required: config.approval.required,
      domain_approval: config.approval.domain_approval,
      owner_approval: config.approval.owner_approval,
      auto_merge_enabled: config.approval.auto_merge?.enabled ?? false,
      auto_merge_after_hours: config.approval.auto_merge?.after_hours,
      notify_on_pr_open: config.notifications.on_pr_open,
      reminder_after_hours: config.notifications.reminder_after_hours,
      escalate_after_hours: config.notifications.escalate_after_hours,
      notification_channels: config.notifications.channels,
      config_sha: sha,
      synced_at: new Date(),
      updated_at: new Date(),
    },
    create: {
      /* same fields */
    },
  })

  // Sync cross-domain rules
  await db.crossDomainRules.deleteMany({
    where: { repo_full_name: repoFullName },
  })

  if (config.cross_domain_rules) {
    await db.crossDomainRules.createMany({
      data: config.cross_domain_rules.map((rule) => ({
        repo_full_name: repoFullName,
        rule_pattern: rule.pattern,
        required_domains: rule.domains,
        description: rule.description,
      })),
    })
  }
}
```

#### 4.6.6 PR Handler (On Open/Update)

When a PR is opened or updated:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ pull_request    │────►│ Central Service │────►│ Get repo config │
│ webhook         │     │ PR Handler      │     │ from database   │
└─────────────────┘     └─────────────────┘     │ (fast lookup)   │
                                                └────────┬────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                   ┌─────────────┐               ┌─────────────┐
                                   │ Approval    │               │ No approval │
                                   │ required    │               │ needed      │
                                   └──────┬──────┘               └──────┬──────┘
                                          │                             │
                                          ▼                             ▼
                                   ┌─────────────┐               ┌─────────────┐
                                   │ Validate    │               │ Auto-approve│
                                   │ schema      │               │ or skip     │
                                   └──────┬──────┘               └─────────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Parse diff  │
                                   │ Identify    │
                                   │ domains     │
                                   └──────┬──────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Query DB for│
                                   │ domain      │
                                   │ owners      │
                                   └──────┬──────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Update PR   │
                                   │ body with   │
                                   │ approval    │
                                   │ table       │
                                   └──────┬──────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │ Send        │
                                   │ notifications│
                                   │ to approvers│
                                   └─────────────┘
```

**PR Handler Logic:**

```typescript
async function handlePR(webhook: PRWebhook) {
  const repoFullName = webhook.repository.full_name
  const prNumber = webhook.pull_request.number

  // Get config from database (fast lookup, no GitHub API call)
  const config = await db.repositoryConfig.findUnique({
    where: { repo_full_name: repoFullName },
  })

  if (!config) {
    console.warn(
      `No config found for ${repoFullName}, skipping approval routing`,
    )
    return
  }

  if (!config.approval_required) {
    console.log(`Approval not required for ${repoFullName}`)
    return
  }

  // Validate schema
  const validationErrors = await validatePolicySchema(webhook)
  if (validationErrors.length > 0) {
    await addPRComment(
      repoFullName,
      prNumber,
      formatValidationErrors(validationErrors),
    )
    return
  }

  // Parse diff to identify affected domains
  const affectedDomains = await parseAffectedDomains(webhook)

  if (affectedDomains.length === 0) {
    console.log(`No domain changes detected in PR #${prNumber}`)
    return
  }

  // Query database for domain owners (fast, no file fetching)
  const owners = await db.domainOwners.findMany({
    where: { domain_id: { in: affectedDomains } },
    include: { domain: true },
  })

  // Check cross-domain rules
  const crossDomainRules = await db.crossDomainRules.findMany({
    where: { repo_full_name: repoFullName },
  })

  const additionalDomains = await checkCrossDomainRules(
    webhook,
    crossDomainRules,
  )

  const allDomains = [...new Set([...affectedDomains, ...additionalDomains])]

  // Get all required owners
  const allOwners = await db.domainOwners.findMany({
    where: { domain_id: { in: allDomains } },
    include: { domain: true },
  })

  // Update PR with approval table
  await updatePRApprovalTable(repoFullName, prNumber, allOwners, config)

  // Send notifications
  if (config.notify_on_pr_open) {
    await sendApprovalNotifications(allOwners, webhook, config)
  }
}
```

#### 4.6.7 SharePoint Sync Process

```
┌─────────────────┐     ┌─────────────────┐
│ Changed policy  │────►│ Parse           │
│ file            │     │ frontmatter +   │
└─────────────────┘     │ markdown        │
                        └────────┬────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
       ┌──────────────┐                  ┌──────────────┐
       │ Extract      │                  │ Convert MD   │
       │ metadata     │                  │ to SP page   │
       │              │                  │ content JSON │
       └──────┬───────┘                  └──────┬───────┘
              │                                 │
              └─────────────┬───────────────────┘
                            ▼
                   ┌──────────────┐
                   │ Graph API:   │
                   │ Create/Update│
                   │ SP Page      │
                   └──────┬───────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
   ┌──────────────┐            ┌──────────────┐
   │ Set page     │            │ Add chat     │
   │ metadata     │            │ web part     │
   │ columns      │            │ (if new)     │
   └──────────────┘            └──────────────┘
```

**Graph API operations:**

| Operation         | API Endpoint                             | Purpose                     |
| ----------------- | ---------------------------------------- | --------------------------- |
| Check page exists | `GET /sites/{site-id}/pages`             | Determine create vs update  |
| Create page       | `POST /sites/{site-id}/pages`            | New policy                  |
| Update page       | `PATCH /sites/{site-id}/pages/{page-id}` | Policy update               |
| Set metadata      | Page properties in create/update         | Populate SharePoint columns |
| Add web part      | `POST .../pages/{page-id}/webParts`      | Add chat agent to new pages |

#### 4.6.8 Benefits of Database-First Configuration

| Benefit                | Explanation                                                   |
| ---------------------- | ------------------------------------------------------------- |
| Fast PR handling       | Database lookup vs GitHub API calls for config                |
| Single source of truth | Domain ownership centralized in database                      |
| Declarative config     | Content repos declare workflow settings in governance.yaml    |
| Auto-sync on merge     | Config automatically syncs when governance.yaml changes       |
| No duplication         | All automation logic in one place                             |
| Simple onboarding      | New document type = install GitHub App + add governance.yaml  |
| Atomic updates         | Change config in database, applies to all lookups immediately |
| Platform model         | Content repos are pure content                                |
| Centralised logging    | All events processed through single service                   |

---

### 4.7 Supporting Systems

#### Azure AD

- Authenticates users to SharePoint (native)
- Provides user identity to Mastra tools for permission checks
- User emails used for approval tracking in PR approval tables

#### People First (HR System)

- Provides org structure, job titles, department membership
- Used to determine:
  - Who needs to acknowledge which policies
  - Escalation paths for overdue reviews
- Accessed via API; data cached/synced as needed

#### Microsoft 365

- Email and Teams notifications (via Graph API or connectors)
- Calendar invites for review deadlines (optional)
- **Future:** Teams Approvals integration for managing approval state

---

## 5. Key Data Flows

### 5.1 Suggesting a Change (Any Staff Member)

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   Staff    │────►│ Chat Agent   │────►│ Mastra Tool: │────►│ GitHub Issue   │
│   Member   │     │              │     │ submit_      │     │ (Suggestion)   │
│            │     │ "I want to   │     │ suggestion   │     │                │
│ [Suggest   │     │ suggest..."  │     │              │     │                │
│  Change]   │     │              │     │              │     │                │
└────────────┘     └──────────────┘     └──────────────┘     └───────┬────────┘
                                                                     │
                                                                     ▼
                                                             ┌───────────────┐
                                                             │ Central       │
                                                             │ Service       │
                                                             │ (issue        │
                                                             │  webhook)     │
                                                             └───────┬───────┘
                                                                     │
                                                                     ▼
                                                             ┌───────────────┐
                                                             │ Policy Owner  │
                                                             │ (Teams/Email) │
                                                             └───────────────┘
```

### 5.2 Editing and Approving a Change

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   Policy   │────►│ Chat Agent   │────►│ Mastra Tool: │────►│ Feature Branch │
│   Owner    │     │              │     │ create_      │     │ + Pull Request │
│            │     │ "Update rule │     │ change       │     │                │
│            │     │ X to say..." │     │              │     │                │
└────────────┘     └──────────────┘     └──────────────┘     └───────┬────────┘
                                                                     │
                                                                     ▼
                                                             ┌───────────────┐
                                                             │ Central       │
                                                             │ Service       │
                                                             │ (PR webhook)  │
                                                             └───────┬───────┘
                                                                     │
                          ┌──────────────────────────────────────────┼──────────┐
                          ▼                     ▼                    ▼          │
                   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐   │
                   │ Validate    │      │ Route       │      │ Notify      │   │
                   │ Schema      │      │ Approvals   │      │ Reviewers   │   │
                   └─────────────┘      └──────┬──────┘      └─────────────┘   │
                                               │                               │
                                               ▼                               │
                                       ┌──────────────┐                        │
                                       │ Update PR    │                        │
                                       │ with approval│                        │
                                       │ table        │                        │
                                       └──────┬───────┘                        │
                                              │                                │
                                              ▼                                │
┌────────────┐     ┌──────────────┐     ┌──────────────┐                       │
│  Domain    │────►│ Chat Agent   │────►│ Mastra Tool: │                       │
│  Owner     │     │              │     │ approve_     │                       │
│            │     │ "Show my     │     │ change       │                       │
│            │     │ approvals"   │     │              │                       │
│            │     │              │     │              │                       │
│            │     │ [Diff View]  │     │              │                       │
│            │     │              │     │              │                       │
│            │     │ "Approve"    │     │              │                       │
└────────────┘     └──────────────┘     └──────┬───────┘                       │
                                               │                               │
                               ┌───────────────┴───────────────┐               │
                               ▼                               ▼               │
                       ┌─────────────┐                 ┌─────────────┐         │
                       │ All Approve │                 │ Conflict    │         │
                       │             │                 │ (Reject)    │         │
                       └──────┬──────┘                 └──────┬──────┘         │
                              │                               │                │
                              ▼                               ▼                │
                       ┌─────────────┐                 ┌─────────────┐         │
                       │ Merge to    │                 │ Continue    │◄────────┘
                       │ main        │                 │ Editing     │
                       └─────────────┘                 └─────────────┘
```

### 5.3 Publishing to SharePoint

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Merge to main   │────►│ Central Service │────►│ Identify        │
│ (push webhook)  │     │ Push Handler    │     │ changed policy  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼─────────────────────────┐
                        ▼                                ▼                         ▼
               ┌──────────────┐                 ┌──────────────┐          ┌──────────────┐
               │ Sync         │                 │ Generate     │          │ Update       │
               │ SharePoint   │                 │ PDF          │          │ Index        │
               │              │                 │              │          │              │
               │ Create/Update│                 │ Generate     │          │ Re-embed     │
               │ native SP    │                 │ branded PDF  │          │ changed      │
               │ page via     │                 │              │          │ policy only  │
               │ Graph API    │                 │ Archive prev │          │              │
               │              │                 │ version PDF  │          │              │
               └──────────────┘                 └──────────────┘          └──────────────┘
```

### 5.4 Policy Query

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User Query      │────►│ Chat Agent      │────►│ Mastra Tool:    │
│ "Can I take my  │     │                 │     │ query_policies  │
│ laptop to       │     │                 │     │                 │
│ China?"         │     │                 │     │ Hybrid search   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Postgres        │
                                                │ (pgvector)      │
                                                │                 │
                                                │ Vector +        │
                                                │ Keyword +       │
                                                │ Metadata        │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Ranked policy   │
                                                │ IDs returned    │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Mastra Tool:    │
                                                │ get_policy      │
                                                │                 │
                                                │ Load FULL       │
                                                │ policy files    │
                                                │ from GitHub     │
                                                └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │ Agent reasons   │
                                                │ over complete   │
                                                │ context         │
                                                │                 │
                                                │ Synthesizes     │
                                                │ answer with     │
                                                │ citations       │
                                                └─────────────────┘
```

### 5.5 Review Reminder

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Scheduled       │────►│ Central Service │────►│ Check Review    │
│ (Daily cron)    │     │ Review Job      │     │ Dates in        │
└─────────────────┘     └─────────────────┘     │ All Policies    │
                                                └────────┬────────┘
                                                         │
                                          ┌──────────────┴──────────────┐
                                          ▼                             ▼
                                   ┌─────────────┐               ┌─────────────┐
                                   │ Due Soon    │               │ Overdue     │
                                   └──────┬──────┘               └──────┬──────┘
                                          │                             │
                                          ▼                             ▼
                                   ┌─────────────┐               ┌─────────────┐
                                   │ Notify      │               │ Create Issue│
                                   │ Owner       │               │ Mark Status │
                                   │             │               │ Escalate    │
                                   └─────────────┘               └─────────────┘
```

---

## 6. Key Design Decisions

| Decision                         | Rationale                                                                |
| -------------------------------- | ------------------------------------------------------------------------ |
| One file per policy              | Conceptual integrity; single source of truth; full context for AI agents |
| Frontmatter markdown             | Machine-readable (YAML) + human-readable (prose) in one file             |
| JSON Schema for validation       | Industry standard; tooling available; enforces frontmatter structure     |
| GitHub Issues for suggestions    | Low barrier; doesn't require branch knowledge                            |
| PRs for actual changes           | Full review workflow; required approvals; merge protection               |
| Webhook-driven automation        | Zero duplication; new doc type = install App + config; centralised logic |
| Agent-first interaction          | Minimises custom UI; natural language interface; flexible                |
| Single SPFx web part             | Chat + canvas covers all use cases; minimal development/maintenance      |
| "Suggest Change" button          | Quick access to most common workflow; accessibility for all staff        |
| Native SharePoint pages          | Full search indexing; native UX; no custom viewer needed                 |
| Versioning via PDF archive       | Simple; sufficient for audit; avoids search pollution                    |
| Hybrid search (vector + keyword) | Captures both semantic similarity and exact policy terms                 |
| pgvector in Postgres             | Leverages existing Mastra infrastructure; no additional services         |
| Full policy loading              | Token cost negligible; context quality significantly better              |
| Incremental index updates        | Only re-index changed policy on merge; efficient                         |
| Fallback to SharePoint links     | If search fails, direct user to browse policies with relevant links      |

---

## 7. Security & Permissions

| Actor        | Chat Agent Access                    | SharePoint Access      |
| ------------ | ------------------------------------ | ---------------------- |
| Any Staff    | Query; suggest; view own suggestions | Read policy pages      |
| Policy Owner | + Edit; create changes               | Read policy pages      |
| Domain Owner | + Approve/reject domain rules        | Read policy pages      |
| Admin        | Full tool access                     | Full SharePoint access |

**Permission Enforcement:**

| Layer            | Mechanism                                      |
| ---------------- | ---------------------------------------------- |
| SharePoint pages | SharePoint permissions / Azure AD groups       |
| Chat agent       | Inherits SharePoint user context               |
| Mastra tools     | Validate user identity + role before executing |
| GitHub           | Branch protection; approval table tracking     |
| Central service  | Webhook signature verification                 |

---

## 8. Future Enhancements

| Enhancement                 | Description                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| **Teams Approvals**         | Integrate with Microsoft Teams Approvals app for managing approval state and notifications |
| **Voice interface**         | Allow voice queries to the agent in Teams/SharePoint                                       |
| **Proactive notifications** | Agent notifies users of pending items via Teams chat                                       |
| **Bulk operations**         | "Approve all changes from this week's security review"                                     |
| **Training integration**    | Link policy acknowledgements to LMS training records                                       |
| **Query analytics**         | Track common questions to identify policy gaps or confusion                                |
| **Versioned pages**         | Add native SP pages for historical versions if PDF archive insufficient                    |

---

## 9. Open Questions

| Question                      | Notes                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------- |
| **Policy Bot setup**          | GitHub App registration needed; webhook URL configuration                         |
| **Graph API permissions**     | App registration needed for SP page creation; Sites.ReadWrite.All likely required |
| **PDF template**              | Branding requirements; who provides template?                                     |
| **Review escalation path**    | Line manager from People First? Fixed escalation chain?                           |
| **Conflict detection scope**  | Within policy only, or cross-policy? AI-assisted?                                 |
| **One change at a time**      | Enforce single active PR per policy to avoid merge conflicts?                     |
| **Canvas component library**  | Build custom or use existing component library for diff/preview?                  |
| **Embedding model selection** | Evaluating Google's new model; need to benchmark on policy content                |
| **SP page template**          | Standard template for all policy pages; who designs?                              |
| **Service hosting**           | Azure Container Apps vs App Service vs other                                      |
| **Webhook reliability**       | Retry strategy for failed webhook processing                                      |

---

## 10. Change Log

| Version | Date       | Author          | Changes                                                                                                                                                                                                                    |
| ------- | ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-01-26 | Duncan / Claude | Initial high-level architecture                                                                                                                                                                                            |
| 0.2.0   | 2026-01-26 | Duncan / Claude | Updated to one-file-per-policy frontmatter markdown approach; added AI retrieval strategy                                                                                                                                  |
| 0.3.0   | 2026-01-26 | Duncan / Claude | Replaced separate React Portal with SPFx web parts in SharePoint; added Azure Function proxy                                                                                                                               |
| 0.4.0   | 2026-01-26 | Duncan / Claude | Simplified to agent-first interaction model; single chat SPFx web part; Mastra tools for all operations                                                                                                                    |
| 0.5.0   | 2026-01-26 | Duncan / Claude | Added retrieval layer design with hybrid search, pgvector, incremental indexing, and agentic retrieval flow                                                                                                                |
| 0.6.0   | 2026-01-26 | Duncan / Claude | Changed to native SharePoint pages (via Graph API) instead of static HTML files; added versioning strategy with PDF archive                                                                                                |
| 0.7.0   | 2026-01-26 | Duncan / Claude | Replaced GitHub Actions with webhook-driven central service; content repos now pure content with no workflow files                                                                                                         |
| 0.8.0   | 2026-02-05 | Duncan / Claude | Split domain configuration: organisational ownership in Central Service (`config/domains.yaml`), approval rules in Content Repo (`metadata/approval-config.yaml`)                                                          |
| 0.9.0   | 2026-02-05 | Duncan / Claude | Moved all configuration to Postgres database: domain ownership in `config.domains`, repository workflow in `config.repository_config` (synced from repo's `governance.yaml`); eliminated config files from central service |

---

## 11. Next Steps

- [x] Review and confirm architecture with stakeholders
- [x] Define frontmatter schema in detail (JSON Schema)
- [x] Design database schema for domain ownership (`config.domains`, `config.domain_owners`)
- [x] Create Supabase migration for config schema
- [ ] Design Postgres schema for retrieval layer
- [ ] Evaluate and select embedding model
- [ ] Define Mastra tool specifications (inputs, outputs, permissions)
- [ ] Set up GitHub repository with branch protection
- [ ] Register Policy Bot (GitHub App) with webhook configuration
- [ ] Design SharePoint page template for policies
- [ ] Build central service with webhook handlers
- [ ] Build core Mastra tools (query, suggest, approve)
- [ ] Build SPFx chat web part with canvas area
- [ ] Deploy service to Azure Container Apps
- [ ] Configure document type mapping for policies repo
