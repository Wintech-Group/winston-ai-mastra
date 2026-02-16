# Architecture Decision Records

| Attribute        | Value                           |
| ---------------- | ------------------------------- |
| Document Version | 0.4.0                           |
| Created          | 2026-01-26                      |
| Last Updated     | 2026-02-13                      |
| Related          | [Architecture](architecture.md) |

---

## How to Use This Document

Each decision is recorded with:

- **Status:** Accepted, Superseded, or Under Review
- **Context:** The problem or question being addressed
- **Decision:** What we decided
- **Rationale:** Why we chose this option
- **Alternatives Considered:** What else we evaluated
- **Consequences:** Trade-offs and implications

---

## Decision Index

| ADR     | Decision                                                | Status   |
| ------- | ------------------------------------------------------- | -------- |
| ADR-001 | GitHub as source of truth                               | Accepted |
| ADR-002 | One file per policy (frontmatter markdown)              | Accepted |
| ADR-003 | Structured rules in YAML frontmatter                    | Accepted |
| ADR-004 | Agent-first interaction model                           | Accepted |
| ADR-005 | Native SharePoint pages for viewing                     | Accepted |
| ADR-006 | PDF archive for version history                         | Accepted |
| ADR-007 | Postgres with pgvector for search                       | Accepted |
| ADR-008 | Hybrid search strategy                                  | Accepted |
| ADR-009 | Incremental index updates                               | Accepted |
| ADR-010 | Fallback to SharePoint browse                           | Accepted |
| ADR-011 | GitHub over SharePoint-native version control           | Accepted |
| ADR-012 | Webhook-driven automation (no Actions in content repos) | Accepted |
| ADR-013 | Browser extension over SPFx web part                    | Accepted |

---

## ADR-001: GitHub as Source of Truth

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

We need a system to store and manage policy documents with version control, audit trail, and approval workflows.

### Decision

**Use GitHub as the single source of truth for all policy data.**

### Rationale

Git provides essential capabilities without custom development:

| Capability            | Git (Free)               | Database (Must Build)                   |
| --------------------- | ------------------------ | --------------------------------------- |
| Version history       | Git log                  | Temporal tables or audit log            |
| Diff between versions | Git diff                 | Custom diff implementation              |
| Branching for drafts  | Git branches             | Draft status or shadow tables           |
| Approval workflow     | PRs + required reviewers | Custom workflow or external integration |
| Audit trail           | Immutable commit history | Explicit audit tables                   |
| Rollback              | Git revert               | Manual restore from history             |

### Alternatives Considered

- **Database as source of truth:** Would require building version control, diffing, approval workflows, audit trail. Rejected due to implementation complexity.
- **Database primary, Git as audit log:** Loses PR-based review workflow. Rejected.

### Consequences

- Must sync to SharePoint for viewing and to Postgres for search index
- Policy files need text serialization (YAML frontmatter)

---

## ADR-002: One File Per Policy (Frontmatter Markdown)

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

Policies contain both structured data (rules, metadata, ownership) and prose (explanations, examples, context).

### Decision

**Each policy is a single markdown file with YAML frontmatter containing structured metadata and rules, followed by human-readable prose.**

### Rationale

Conceptual integrity (one document = one policy), single source of truth (rules and prose cannot drift), full context for AI agents, simple PDF generation, familiar format (frontmatter markdown is widely used).

### Alternatives Considered

- **Separate files for rules and prose:** Creates drift risk, complicates atomic versioning. Rejected.
- **Rules only, no prose:** Policies require prose for context and nuance. Rejected.
- **Database for rules, Git for prose:** Two sources of truth. Rejected.

### Consequences

- YAML must be kept in sync with prose by authors (AI agents can assist)
- Parsing required to extract structured data

---

## ADR-003: Structured Rules in YAML Frontmatter

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

Rules within policies need structure for: stable citations, per-rule ownership, exception tracking, domain-based approval routing, severity filtering.

### Decision

**Rules are explicitly structured in YAML frontmatter with ID, domain, severity, statement, rationale, exceptions, and optional per-rule ownership.**

### Rationale

| Need                  | Why YAML                      | Risk with Prose-Only       |
| --------------------- | ----------------------------- | -------------------------- |
| Stable rule citations | Explicit IDs (IT-001-R003)    | AI extraction varies       |
| Per-rule ownership    | `owner` field per rule        | Cannot express in prose    |
| Structured exceptions | Explicit condition + approver | AI might miss or misparse  |
| Domain-based routing  | Explicit `domain` field       | Inference errors           |
| Severity filtering    | Explicit `severity` field     | Must parse "must"/"should" |

### Alternatives Considered

- **Metadata only in YAML, rules in prose:** Per-rule ownership and structured exceptions cannot be reliably represented in prose. Rejected.
- **AI-assisted extraction with author review:** Adds workflow step, extraction still needs validation. Rejected.

### Consequences

- Authors maintain both YAML rules and prose (with AI assistance)
- Richer authoring requirements for non-technical staff

---

## ADR-004: Agent-First Interaction Model

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Updated   | 2026-02-13 |

### Context

Users need to interact with the policy system for: suggesting changes, editing policies, approving changes, checking status. Options include building custom UI components or using a chat agent.

### Decision

**Most user interactions happen through a chat agent. The agent uses Mastra tools to perform operations. Custom UI is limited to a chat interface (delivered via browser extension) and a "Suggest Change" trigger.**

### Rationale

| Benefit           | Explanation                                      |
| ----------------- | ------------------------------------------------ |
| Minimal custom UI | One chat interface vs. multiple forms/dashboards |
| Natural language  | Users describe intent, agent handles mechanics   |
| Flexible          | New capabilities don't require UI changes        |
| Consistent        | All interactions through same interface          |

The agent renders rich content (diffs, previews, edit interfaces) in a canvas area when needed.

### Alternatives Considered

- **Multiple web parts / components:** More code, more maintenance, context switching. Rejected.
- **Separate React portal:** Users leave SharePoint, separate auth concerns. Rejected.

### Consequences

- Chat agent must handle all workflows reliably
- Canvas/artifact area needed for complex content (diffs, previews)
- Browser extension provides the delivery mechanism (see ADR-013)

---

## ADR-005: Native SharePoint Pages for Policy Viewing

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

Policies need to be viewable in SharePoint.

### Decision

**Policies are published as native SharePoint pages, created/updated via Microsoft Graph API on merge to main.**

### Rationale

| Aspect               | Static HTML          | Custom Viewer Web Part | Native SP Pages    |
| -------------------- | -------------------- | ---------------------- | ------------------ |
| Search indexing      | Limited              | None (dynamic content) | Full               |
| UX                   | Document viewer      | Custom                 | Native             |
| Metadata filtering   | File properties only | N/A                    | SharePoint columns |
| Mobile/accessibility | Manual               | Manual                 | Built-in           |

Custom web part content loaded dynamically via API is **not indexed by SharePoint search** — this rules out that approach.

### Alternatives Considered

- **Static HTML files:** UX inferior to native pages. Rejected.
- **Custom viewer web part:** Content invisible to search crawler. Rejected.

### Consequences

- Graph API integration required (Sites.ReadWrite.All)
- Page template needed for consistent layout

---

## ADR-006: PDF Archive for Version History

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

Historical versions need to be accessible for audit and compliance.

### Decision

**Current version is a native SharePoint page. Archived versions are stored as PDF only.**

### Rationale

Archived versions are rarely accessed. PDF is sufficient for audit purposes and avoids complexity of managing multiple live pages per policy.

### Alternatives Considered

- **Versioned SharePoint pages:** Complexity, search exclusion configuration. Rejected.
- **No archive (Git only):** Non-technical users can't access Git. Rejected.

### Consequences

- Previous version PDF generated and archived on each publish
- Can add versioned pages later if PDF insufficient

---

## ADR-007: Postgres with pgvector for Search Index

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

AI agents need to search policies effectively.

### Decision

**Use Postgres with pgvector for hybrid search. Postgres is already part of Mastra infrastructure.**

### Rationale

Single database, existing infrastructure, hybrid search capable. No additional services needed.

### Alternatives Considered

- **Pinecone / Weaviate / Qdrant:** Additional infrastructure, not justified for policy-scale data. Rejected.
- **Azure AI Search:** Cost and lock-in not justified. Rejected.

### Consequences

- Single database for application data and search index
- Embedding model required (decision pending)

---

## ADR-008: Hybrid Search Strategy

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

Policy queries require high recall and high precision. Neither keyword search alone nor vector search alone is sufficient.

### Decision

**Use hybrid search combining vector similarity, keyword matching (full-text), and metadata filtering, with Reciprocal Rank Fusion (RRF) for score combination.**

### Rationale

| Search Type | Strength                                  | Weakness                     |
| ----------- | ----------------------------------------- | ---------------------------- |
| Vector      | Semantic similarity ("laptop" → "device") | May miss exact policy terms  |
| Keyword     | Exact matches on policy terminology       | Misses synonyms, paraphrases |
| Metadata    | Fast filtering (domain, severity, status) | No content understanding     |

### Alternatives Considered

- **Vector only:** May miss exact policy terms. Rejected.
- **Keyword only:** Misses semantic relationships. Rejected.

### Consequences

- Three indexes maintained: vector embeddings, full-text (tsvector), structured metadata
- Agent still loads full policies after search for complete context

---

## ADR-009: Incremental Index Updates

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Decision

**Index updates happen incrementally on merge — only the changed policy file(s) are re-indexed.**

### Rationale

Policies change infrequently. Full rebuild wastes compute for unchanged policies.

### Alternatives Considered

- **Full rebuild on every merge:** Wasteful, slower as policy count grows. Rejected.
- **Scheduled batch rebuild:** Index would be stale between rebuilds. Rejected.

---

## ADR-010: Fallback to SharePoint Browse

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Decision

**If search returns no relevant results or confidence is low, the agent directs the user to SharePoint with links to potentially relevant policies and suggests contacting the policy owner.**

### Rationale

Users should never be completely stuck. Low-confidence answers on compliance questions are dangerous.

---

## ADR-011: GitHub Over SharePoint-Native Version Control

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

SharePoint has version control capabilities. We considered whether SharePoint-native versioning could replace GitHub.

### Decision

**Use GitHub for version control and approval workflows, with SharePoint as the viewing layer only.**

### Rationale

Critical limitations of SharePoint-only:

1. **No diffing for structured content** — Domain owners cannot see what changed in YAML rules
2. **No branching** — Cannot have a draft under review while live version is unchanged
3. **No atomic changes** — SharePoint versions each file independently
4. **Approval workflow complexity** — Domain-based multi-approver with diff review would require building what GitHub provides natively

### Consequences

- Must maintain GitHub → SharePoint sync layer
- Team needs conceptual familiarity with Git (abstracted via agent)

---

## ADR-012: Webhook-Driven Automation

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |

### Context

The system requires automation. As we consider reusing this pattern for multiple document types, workflow duplication in each content repo becomes a maintenance problem.

### Decision

**All automation is handled by the central service via GitHub webhooks. Content repositories contain no workflow files.**

### Rationale

| Approach           | Workflow Location    | New Repo Setup       | Updates             |
| ------------------ | -------------------- | -------------------- | ------------------- |
| Actions per repo   | Each content repo    | Copy workflow files  | Update every repo   |
| Reusable workflows | Central + wrappers   | Copy wrapper files   | Update central repo |
| **Webhooks**       | Central service only | Install App + config | Update service only |

### Consequences

- Central service handles webhook verification and reliability
- GitHub App must be installed on each content repo
- Lose GitHub Actions UI for run visibility (mitigated by service logging)

---

## ADR-013: Browser Extension Over SPFx Web Part

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-02-13 |
| Deciders  | Duncan     |

### Context

The chat agent needs a UI for users to interact with. The original design specified an SPFx (SharePoint Framework) web part embedded in SharePoint pages. After evaluation, SPFx development was found to have significant friction: complex toolchain, SharePoint-specific deployment, limited to SharePoint context only, and challenging to iterate quickly on.

### Decision

**Build a browser extension (Manifest V3) with a simple chat interface instead of an SPFx web part.**

### Rationale

| Aspect                   | SPFx Web Part                        | Browser Extension             |
| ------------------------ | ------------------------------------ | ----------------------------- |
| Works on SharePoint      | Yes                                  | Yes                           |
| Works outside SharePoint | No                                   | Yes (any page)                |
| Toolchain complexity     | High (SPFx generator, gulp, webpack) | Low (standard web bundler)    |
| Deployment               | SharePoint app catalog               | Enterprise sideload or store  |
| Iteration speed          | Slow (rebuild + deploy per change)   | Fast (standard web dev)       |
| Context awareness        | SharePoint page context              | Can detect page URL/content   |
| Authentication           | SharePoint user context              | Azure AD (MSAL)               |
| Distribution             | Tenant-wide or site collection       | Chrome/Edge enterprise policy |

### Alternatives Considered

- **SPFx web part:** Original plan. Rejected due to toolchain friction and being locked to SharePoint context.
- **Teams app:** Would limit to Teams desktop/mobile only; not available when browsing SharePoint. Rejected.
- **Standalone web app:** Users would need to leave their current context. Rejected.

### Consequences

- Extension can work on any page, not just SharePoint — useful for future capabilities
- Must handle Azure AD authentication independently (MSAL.js)
- "Suggest Change" button logic changes from web part integration to page detection
- Distribution via Chrome/Edge enterprise deployment policies or internal extension store
- SharePoint search and native pages remain the primary viewing experience (unchanged)

---

## Pending Decisions

| Topic                    | Question                               | Notes                         |
| ------------------------ | -------------------------------------- | ----------------------------- |
| Embedding model          | Which model for vector embeddings?     | Evaluating Google's new model |
| Graph API permissions    | What app registration scopes needed?   | Sites.ReadWrite.All likely    |
| PDF template             | Branding requirements                  | Pending design input          |
| Review escalation        | Who gets escalated overdue reviews?    | Line manager vs fixed chain   |
| Browser ext distribution | Enterprise policy or Chrome Web Store? | IT decision                   |

---

## Change Log

| Version | Date       | Author | Changes                                                                                                                   |
| ------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-01-26 | Duncan | Initial ADR document with 10 accepted decisions                                                                           |
| 0.2.0   | 2026-01-26 | Duncan | Added ADR-011: GitHub over SharePoint-native version control                                                              |
| 0.3.0   | 2026-01-26 | Duncan | Added ADR-012: Webhook-driven automation                                                                                  |
| 0.4.0   | 2026-02-13 | Duncan | Added ADR-013: Browser extension over SPFx; updated ADR-004; replaced SPFx pending decision with browser ext distribution |
