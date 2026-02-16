# Policy Management System — Architecture

| Attribute        | Value                                  |
| ---------------- | -------------------------------------- |
| Document Version | 1.0.0                                  |
| Status           | Draft                                  |
| Created          | 2026-01-26                             |
| Last Updated     | 2026-02-13                             |
| Related          | [ADRs](adrs.md), [Roadmap](roadmap.md) |

---

## 1. Design Philosophy

**GitHub as Source of Truth** — All policy data lives in a GitHub repository as structured files. Every other system (SharePoint, AI agents, PDF generation) consumes from or writes to GitHub. This provides immutable, auditable version history; native change tracking; rule-level granularity through structured frontmatter; and clean API access for both humans and AI agents.

**One File Per Policy** — Each policy is a single frontmatter markdown file containing both machine-readable rule definitions and human-readable prose. Rules and prose cannot drift apart. AI agents load one file and have full context.

**SharePoint for Viewing** — Policies are published as native SharePoint pages, fully search-indexed with native UX. No custom viewer needed.

**Browser Extension for Interaction** — A browser extension provides the chat interface for querying policies, submitting suggestions, and managing approvals. This replaces the originally considered SPFx approach (see [ADR-013](adrs.md#adr-013-browser-extension-over-spfx-web-part)).

**Agent-First Interaction** — Most user interactions beyond viewing happen through a chat agent. This minimises custom UI development while providing a natural interface for all workflows.

**Hybrid Retrieval** — Policy queries use hybrid search (vector + keyword + structured metadata) to find relevant policies, then load full files for complete context.

**Separation of Concerns:**

| Concern                   | System                                                 |
| ------------------------- | ------------------------------------------------------ |
| Storage & Version Control | GitHub                                                 |
| Human Viewing             | SharePoint (Native Pages + PDF)                        |
| Human Interaction         | Browser Extension + Mastra Agent                       |
| Policy Retrieval          | Postgres (pgvector) + Hybrid Search                    |
| Workflow Automation       | Central Service (webhook-driven)                       |
| Identity & Permissions    | Azure AD                                               |
| Organisational Data       | People First                                           |
| Domain Ownership          | Postgres (`config.domains`)                            |
| Repository Configuration  | Postgres (`config.repository_config`) synced from repo |

---

## 2. Architecture Overview

```
                                 ┌─────────────────────────┐
                                 │       Azure AD          │
                                 │   (Authentication)      │
                                 └───────────┬─────────────┘
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 ▼                           ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────┐
│    SharePoint Site       │  │   Browser Extension      │  │   Mastra Agent       │
│  (policies.company.com)  │  │   (Chat UI)              │  │                      │
│                          │  │                          │  │   Policy Tools       │
│  • Native pages          │  │  • Query policies        │  │   GitHub Tools       │
│  • PDF archive           │  │  • Submit suggestions    │  │   Microsoft Tools    │
│  • Metadata columns      │  │  • Approve changes       │  │                      │
│  • Search indexing        │  │  • View diffs            │  │                      │
└──────────────────────────┘  └──────────┬───────────────┘  └──────────┬───────────┘
                                         │                             │
                                         └──────────┬──────────────────┘
                                                    │
                                 ┌──────────────────┼──────────────────┐
                                 ▼                                     ▼
                        ┌──────────────┐                      ┌──────────────┐
                        │ Postgres     │                      │ GitHub       │
                        │ (pgvector)   │                      │ Repository   │
                        │              │                      │              │
                        │ • Embeddings │                      │ • Policies   │
                        │ • Metadata   │                      │ • Schema     │
                        │ • Config     │                      │ • Templates  │
                        └──────────────┘                      └──────┬───────┘
                                                                     │
                                                                     │ Webhooks
                                                              ┌──────┴───────┐
                                                              │ Central      │
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

## 3. Policy File Format

Each policy is a single markdown file with YAML frontmatter. See [specs/policy-template.md](specs/policy-template.md) for the blank template and [specs/policy.schema.json](specs/policy.schema.json) for the validation schema.

```yaml
---
id: IT-001
title: Information Security Policy
version: 2.1.0
status: active
effective_date: 2025-06-01
review_date: 2026-06-01
owners:
  - jane.smith@company.com
domains:
  - IT
rules:
  - id: IT-001-R001
    domain: IT
    severity: MUST
    statement: All company devices must have full-disk encryption enabled.
    rationale: Legal requirement under data protection regulations.
    exceptions:
      - condition: Device is used solely for public marketing content
        approver: IT Security Manager
---
# Information Security Policy

## 1. Purpose
...
```

| Benefit                | Explanation                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| Single source of truth | Rules and prose live together; cannot drift apart                      |
| Human-readable         | Open the file, read the policy — no assembly required                  |
| Machine-parseable      | YAML frontmatter provides structured data for AI agents and automation |
| PDF generation         | Render the markdown body with metadata header                          |
| Full context for AI    | Agent loads one file and has complete understanding                    |

---

## 4. Content Repository Structure

The content repository contains only policy content — no workflow files. All automation is handled by the central service via webhooks.

```
docs-policy-governance/
├── policies/
│   ├── IT-001-information-security.md
│   ├── HR-001-travel.md
│   └── ...
├── schema/
│   └── policy.schema.json
├── metadata/
│   └── governance.yaml        # Repository workflow config (syncs to DB on push)
├── templates/
│   └── policy-template.md
└── README.md
```

---

## 5. Core Components

Each component is described at a high level here. For implementation details, see the linked stack document.

### 5.1 GitHub Repository

**Role:** Single source of truth for all policy data.

| Mechanism         | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `main` branch     | Published, active policies only               |
| Feature branches  | Proposed changes (one branch per change)      |
| Pull Requests     | Change proposals with discussion and approval |
| Branch protection | Prevents merge without required approvals     |
| Webhooks          | Delivers events to central service            |

Approval routing is domain-based, managed by the central service. See [stack/webhook-service.md](stack/webhook-service.md) for details.

### 5.2 SharePoint Site

**Role:** Single location for viewing policies.

Policies are published as native SharePoint pages created/updated via Microsoft Graph API on merge. Each page has metadata columns for filtering, a version history section linking to archived PDFs, and a PDF download link.

See [stack/sharepoint.md](stack/sharepoint.md) for page structure, sync process, and Graph API operations.

### 5.3 Browser Extension

**Role:** Chat interface for policy interactions.

A browser extension provides the primary interaction UI for querying policies, submitting suggestions, viewing diffs, and managing approvals. It communicates with the Mastra agent backend and authenticates via Azure AD.

See [stack/browser-extension.md](stack/browser-extension.md) for details.

### 5.4 Mastra Agent & Tools

**Role:** Primary interface for all policy interactions beyond viewing.

The **Governance Assistant** agent uses typed tools to perform operations on GitHub, query the search index, and integrate with Microsoft 365. Tools enforce role-based access control.

See [stack/mastra-agent.md](stack/mastra-agent.md) for agent definition, tool specifications, and skill reference.

### 5.5 Retrieval Layer (Postgres + pgvector)

**Role:** Enable accurate, compliance-critical policy queries through hybrid search.

The retrieval layer combines vector similarity, keyword matching (full-text), and metadata filtering with Reciprocal Rank Fusion (RRF) for scoring. Index updates happen incrementally on merge — only changed policies are re-indexed.

See [stack/database.md](stack/database.md) for schemas, embedding strategy, and search implementation.

### 5.6 Central Service (Webhook Handlers)

**Role:** All automation triggered by GitHub events.

Content repositories contain no workflow files. The central Hono service receives webhooks and handles validation, SharePoint sync, PDF generation, index updates, and approval routing. Adding a new document type requires only installing the GitHub App and adding a configuration entry.

See [stack/webhook-service.md](stack/webhook-service.md) for handler logic, event routing, and configuration.

### 5.7 Docs Bot (GitHub App)

**Role:** Service account for all Git operations.

Staff do not need GitHub accounts. All GitHub operations are performed by the Docs Bot with human attribution in commit metadata.

See [stack/github-app.md](stack/github-app.md) for setup, authentication, and deployment.

---

## 6. Key Data Flows

### 6.1 Suggesting a Change (Any Staff Member)

```
Staff Member → Chat Agent → submit_suggestion tool → GitHub Issue
                                                          │
                                                          ▼
                                                   Central Service
                                                   (issue webhook)
                                                          │
                                                          ▼
                                                   Policy Owner notified
                                                   (Teams/Email)
```

### 6.2 Editing and Approving a Change

```
Policy Owner → Chat Agent → create_change tool → Feature Branch + PR
                                                        │
                                                        ▼
                                                 Central Service (PR webhook)
                                                 ├── Validate schema
                                                 ├── Identify affected domains
                                                 ├── Add approval table to PR
                                                 └── Notify domain owners
                                                        │
                                                        ▼
Domain Owner → Chat Agent → approve_change tool → Update PR approval table
                                                        │
                                                  All approved?
                                                  ├── Yes → Auto-merge → Push webhook
                                                  └── No  → Continue editing
```

### 6.3 Publishing to SharePoint (On Merge)

```
Push webhook → Central Service
               ├── Sync SharePoint (create/update native page via Graph API)
               ├── Generate PDF (archive previous version, upload new)
               ├── Update search index (re-embed changed policy only)
               └── Sync config (if governance.yaml changed)
```

### 6.4 Policy Query

```
User query → Chat Agent → query_policies tool → Hybrid search (Postgres)
                                                       │
                                                 Ranked policy IDs
                                                       │
                                                       ▼
                           Chat Agent → get_policy tool → Load full files from GitHub
                                                       │
                                                       ▼
                                                 Agent reasons over full context
                                                 → Response with rule citations
```

### 6.5 Review Reminder

```
Daily cron → Central Service → Check review dates in all policies
                               ├── Due soon → Notify owner
                               └── Overdue  → Create issue, escalate
```

---

## 7. Security & Permissions

| Actor        | Chat Agent Access                    | SharePoint Access      |
| ------------ | ------------------------------------ | ---------------------- |
| Any Staff    | Query; suggest; view own suggestions | Read policy pages      |
| Policy Owner | + Edit; create changes               | Read policy pages      |
| Domain Owner | + Approve/reject domain rules        | Read policy pages      |
| Admin        | Full tool access                     | Full SharePoint access |

| Layer             | Mechanism                                      |
| ----------------- | ---------------------------------------------- |
| SharePoint pages  | SharePoint permissions / Azure AD groups       |
| Browser extension | Azure AD authentication                        |
| Mastra tools      | Validate user identity + role before executing |
| GitHub            | Branch protection; approval table tracking     |
| Central service   | Webhook signature verification                 |

---

## 8. Supporting Systems

| System                | Purpose                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Azure AD**          | Authentication, user identity, permission checks                                                    |
| **People First** (HR) | Org structure, job titles, department membership; used for acknowledgement targeting and escalation |
| **Microsoft 365**     | Email and Teams notifications (via Graph API); future Teams Approvals integration                   |

---

## 9. Future Enhancements

| Enhancement             | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| Teams Approvals         | Integrate with Microsoft Teams Approvals for managing approval state |
| Voice interface         | Voice queries to the agent in Teams                                  |
| Proactive notifications | Agent notifies users of pending items via Teams chat                 |
| Bulk operations         | "Approve all changes from this week's security review"               |
| Training integration    | Link policy acknowledgements to LMS training records                 |
| Query analytics         | Track common questions to identify policy gaps                       |
| Versioned pages         | Native SP pages for historical versions if PDF archive insufficient  |

---

## Change Log

| Version     | Date                    | Author | Changes                                                                                                                                |
| ----------- | ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0–0.9.0 | 2026-01-26 – 2026-02-05 | Duncan | See previous architecture document for detailed changelog                                                                              |
| 1.0.0       | 2026-02-13              | Duncan | Consolidated from multiple overlapping docs; replaced SPFx web part with browser extension; extracted component details to stack/ docs |
