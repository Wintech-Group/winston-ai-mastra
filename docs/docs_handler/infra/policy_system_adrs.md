# Policy Management System — Architecture Decision Records

**Technology Decisions Document**

| Attribute         | Value                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Document Version  | 0.3.0                                                                                                   |
| Created           | 2026-01-26                                                                                              |
| Last Updated      | 2026-01-26                                                                                              |
| Related Documents | Policy System Architecture v0.6.0                                                                       |
| Purpose           | Record key architecture and technology decisions with rationale to prevent revisiting settled questions |

---

## How to Use This Document

Each decision is recorded with:

- **Status:** Accepted, Superseded, or Under Review
- **Context:** The problem or question being addressed
- **Decision:** What we decided
- **Rationale:** Why we chose this option
- **Alternatives Considered:** What else we evaluated
- **Consequences:** Trade-offs and implications

If revisiting a decision, update the status and add a new entry referencing the old one.

---

## ADR-001: GitHub as Source of Truth

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

We need a system to store and manage policy documents with version control, audit trail, and approval workflows. Options include using GitHub as the primary store or using a database.

### Decision

**Use GitHub as the single source of truth for all policy data.**

### Rationale

Git provides essential capabilities without custom development:

| Capability               | Git (Free)               | Database (Must Build)                   |
| ------------------------ | ------------------------ | --------------------------------------- |
| Version history          | Git log                  | Temporal tables or audit log            |
| Diff between versions    | Git diff                 | Custom diff implementation              |
| Branching for drafts     | Git branches             | Draft status or shadow tables           |
| Approval workflow        | PRs + required reviewers | Custom workflow or external integration |
| Audit trail              | Immutable commit history | Explicit audit tables                   |
| Rollback                 | Git revert               | Manual restore from history             |
| Change attribution       | Commit author            | Explicit user tracking                  |
| Concurrent edit handling | Branches + merge         | Optimistic locking                      |

Building equivalent workflow and audit capabilities in a database-first approach represents significantly more work than the sync layers required for Git-first.

### Alternatives Considered

**Database as source of truth:**

- Would require building version control, diffing, approval workflows, audit trail
- Policies are document-centric (prose + structure) — databases are optimised for structured data, not documents
- Rejected due to implementation complexity

**Database primary, Git as audit log:**

- Database is live source, changes auto-commit to Git
- Loses PR-based review workflow
- Rejected because PR review is valuable for policy changes

### Consequences

- Must sync to SharePoint for viewing (via GitHub Actions + Graph API)
- Must sync to Postgres for search index (via GitHub Actions)
- Policy files need text serialization (YAML frontmatter)
- Team needs familiarity with Git concepts (abstracted via agent)

---

## ADR-002: One File Per Policy (Frontmatter Markdown)

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Policies contain both structured data (rules, metadata, ownership) and prose (explanations, examples, context). We need to decide how to represent this in the Git repository.

### Decision

**Each policy is a single markdown file with YAML frontmatter containing structured metadata and rules, followed by human-readable prose.**

### Rationale

| Benefit                | Explanation                                              |
| ---------------------- | -------------------------------------------------------- |
| Conceptual integrity   | A policy is one coherent document                        |
| Single source of truth | Rules and prose live together; cannot drift apart        |
| Full context for AI    | Agent loads one file and has complete understanding      |
| Simple PDF generation  | Markdown body renders directly                           |
| Familiar format        | Frontmatter markdown is widely used (Hugo, Jekyll, etc.) |

Modern context windows (128k-200k tokens) easily accommodate loading 20+ full policies (~3,000-7,000 tokens each) when needed for cross-policy analysis.

### Alternatives Considered

**Separate files for rules and prose:**

- Rules in `IT-001-rules.yaml`, prose in `IT-001-policy.md`
- Rejected: Creates drift risk, complicates atomic versioning

**Rules only, no prose:**

- Structured rules without explanatory content
- Rejected: Policies require prose for context, examples, nuance

**Database for rules, Git for prose:**

- Hybrid approach
- Rejected: Two sources of truth, complex sync

### Consequences

- YAML must be kept in sync with prose by authors (AI agents can assist)
- Parsing required to extract structured data
- File size grows with policy complexity

---

## ADR-003: Structured Rules in YAML Frontmatter

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Rules within policies need structure for: stable citations, per-rule ownership, exception tracking, domain-based approval routing, severity filtering. Question: should this structure live in YAML or be extracted from prose by AI?

### Decision

**Rules are explicitly structured in YAML frontmatter with ID, domain, severity, statement, rationale, exceptions, and optional per-rule ownership.**

### Rationale

Structured YAML enables capabilities that prose-only cannot reliably provide:

| Need                  | Why YAML                      | Risk with Prose-Only       |
| --------------------- | ----------------------------- | -------------------------- |
| Stable rule citations | Explicit IDs (IT-001-R003)    | AI extraction varies       |
| Per-rule ownership    | `owner` field per rule        | Cannot express in prose    |
| Structured exceptions | Explicit condition + approver | AI might miss or misparse  |
| Domain-based routing  | Explicit `domain` field       | Inference errors           |
| Severity filtering    | Explicit `severity` field     | Must parse "must"/"should" |

Modern AI agents with clear instructions can maintain coherence between YAML rules and prose explanations.

### Alternatives Considered

**Metadata only in YAML, rules in prose:**

- AI extracts rules at index time
- Rejected: Per-rule ownership and structured exceptions cannot be reliably represented in prose

**AI-assisted extraction with author review:**

- AI extracts, author confirms on PR
- Rejected: Adds workflow step, extraction still needs validation

### Consequences

- Authors maintain both YAML rules and prose (with AI assistance)
- Drift possible between YAML and prose (mitigated by validation, AI coherence)
- Richer authoring requirements for non-technical staff

---

## ADR-004: Agent-First Interaction Model

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Users need to interact with the policy system for: suggesting changes, editing policies, approving changes, checking status. Options include building custom UI components or using a chat agent.

### Decision

**Most user interactions happen through a chat agent embedded in SharePoint. The agent uses Mastra tools to perform operations. Custom UI is limited to a single chat web part and a "Suggest Change" button.**

### Rationale

| Benefit           | Explanation                                    |
| ----------------- | ---------------------------------------------- |
| Minimal custom UI | One web part vs. multiple forms/dashboards     |
| Natural language  | Users describe intent, agent handles mechanics |
| Flexible          | New capabilities don't require UI changes      |
| Consistent        | All interactions through same interface        |
| AI-first design   | Aligns with system philosophy                  |

The agent renders rich content (diffs, previews, edit interfaces) in a canvas area when needed.

### Alternatives Considered

**Multiple SPFx web parts:**

- Separate components for suggestions, approvals, editing, status
- Rejected: More code, more maintenance, context switching

**Separate React portal:**

- Standalone application outside SharePoint
- Rejected: Users leave SharePoint, separate auth concerns

### Consequences

- Chat agent must handle all workflows reliably
- Canvas/artifact area needed for complex content (diffs, previews)
- "Suggest Change" button provides quick access to common workflow
- Future: Teams Approvals integration for approval state management

---

## ADR-005: Native SharePoint Pages for Policy Viewing

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Policies need to be viewable in SharePoint. Options include static HTML files in a document library, a custom viewer web part, or native SharePoint pages.

### Decision

**Policies are published as native SharePoint pages, created/updated via Microsoft Graph API on merge to main.**

### Rationale

| Aspect               | Static HTML Files    | Custom Viewer Web Part | Native SP Pages    |
| -------------------- | -------------------- | ---------------------- | ------------------ |
| Search indexing      | Limited              | None (dynamic content) | Full               |
| UX                   | Document viewer      | Custom                 | Native             |
| Metadata filtering   | File properties only | N/A                    | SharePoint columns |
| Development effort   | Low                  | High                   | Medium             |
| Mobile/accessibility | Manual               | Manual                 | Built-in           |

Custom web part content loaded dynamically via API is **not indexed by SharePoint search** — this is a critical limitation that rules out that approach.

### Alternatives Considered

**Static HTML files:**

- Simple to generate, but opens in document viewer, limited metadata
- Rejected: UX inferior to native pages

**Custom viewer web part:**

- Fetches markdown from GitHub at render time
- Rejected: Content invisible to search crawler

### Consequences

- GitHub Action must convert markdown to SharePoint page format
- Graph API integration required (Sites.ReadWrite.All permission)
- Page template needed for consistent layout
- Metadata columns enable filtering and sorting

---

## ADR-006: PDF Archive for Version History

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Historical versions of policies need to be accessible for audit and compliance. Options include maintaining versioned SharePoint pages or archiving as PDF.

### Decision

**Current version is a native SharePoint page (always latest). Archived versions are stored as PDF only, linked from the current page's version history section.**

### Rationale

| Aspect           | Versioned Pages                 | PDF Archive            |
| ---------------- | ------------------------------- | ---------------------- |
| Implementation   | Complex (manage multiple pages) | Simple (generate PDF)  |
| Search           | Must exclude old versions       | PDFs in Archive folder |
| Audit/compliance | Full                            | Sufficient             |
| Access frequency | Rare                            | Rare                   |
| Storage          | Multiple pages per policy       | One PDF per version    |

Archived versions are rarely accessed. PDF is sufficient for audit purposes and avoids complexity of managing multiple live pages per policy.

### Alternatives Considered

**Versioned SharePoint pages:**

- `/SitePages/IT-001-v2.0.aspx` for each version
- Rejected: Complexity, search exclusion configuration

**No archive (Git only):**

- Rely on Git history
- Rejected: Non-technical users can't access Git

### Consequences

- Previous version PDF generated and archived on each publish
- Current page links to archived PDFs
- Can add versioned pages later if PDF insufficient

---

## ADR-007: Postgres with pgvector for Search Index

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

AI agents need to search policies effectively. Options include dedicated vector databases or using Postgres with pgvector extension.

### Decision

**Use Postgres with pgvector for hybrid search (vector + keyword + structured metadata). Postgres is already part of Mastra infrastructure.**

### Rationale

| Option              | Pros                                                            | Cons                                          |
| ------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| Postgres + pgvector | Single database, existing infrastructure, hybrid search capable | Less specialized than dedicated vector DB     |
| Pinecone            | Managed, scales well                                            | Additional service, cost, external dependency |
| Azure AI Search     | M365 aligned, hybrid built-in                                   | Cost, Azure lock-in                           |
| Weaviate            | Hybrid search native                                            | Additional service to manage                  |

Postgres already exists for Mastra. Adding pgvector keeps the stack simple with no additional services.

### Alternatives Considered

**Dedicated vector database (Pinecone, Weaviate, Qdrant):**

- Rejected: Additional infrastructure, not justified for policy-scale data

**Azure AI Search:**

- Rejected: Cost and lock-in not justified

### Consequences

- Single database for application data and search index
- Hybrid search (vector + full-text + metadata) implemented in SQL
- Embedding model required (decision pending — evaluating Google's new model)

---

## ADR-008: Hybrid Search Strategy

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

Policy queries require high recall (don't miss relevant rules) and high precision (don't return noise). Neither keyword search alone (misses synonyms) nor vector search alone (may miss exact terms) is sufficient.

### Decision

**Use hybrid search combining vector similarity, keyword matching (full-text), and metadata filtering, with Reciprocal Rank Fusion (RRF) for score combination.**

### Rationale

| Search Type | Strength                                  | Weakness                     |
| ----------- | ----------------------------------------- | ---------------------------- |
| Vector      | Semantic similarity ("laptop" → "device") | May miss exact policy terms  |
| Keyword     | Exact matches on policy terminology       | Misses synonyms, paraphrases |
| Metadata    | Fast filtering (domain, severity, status) | No content understanding     |

Combining all three captures both semantic relationships and exact terminology, filtered by relevant metadata.

### Alternatives Considered

**Vector only:**

- Rejected: May miss exact policy terms that matter legally

**Keyword only:**

- Rejected: Misses semantic relationships

**Sequential (vector then keyword filter):**

- Rejected: RRF combination produces better ranking

### Consequences

- Three indexes maintained: vector embeddings, full-text (tsvector), structured metadata
- RRF scoring implemented in search queries
- Agent still loads full policies after search for complete context

---

## ADR-009: Incremental Index Updates

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

The Postgres search index needs to stay in sync with policy changes. Options include full rebuild on every change or incremental updates.

### Decision

**Index updates happen incrementally on merge — only the changed policy file(s) are re-indexed.**

### Rationale

- Policies change infrequently
- Full rebuild wastes compute for unchanged policies
- Incremental update is fast and efficient
- Changed files are easily identified from Git diff

### Alternatives Considered

**Full rebuild on every merge:**

- Simpler logic
- Rejected: Wasteful, slower as policy count grows

**Scheduled batch rebuild:**

- Rebuild nightly regardless of changes
- Rejected: Index would be stale between rebuilds

### Consequences

- GitHub Action identifies changed files and re-indexes only those
- Must handle policy deletion (remove from index)
- Must handle policy rename (delete old, create new)

---

## ADR-010: Fallback to SharePoint Browse

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

When the agent cannot find a definitive answer via search, what should happen?

### Decision

**If search returns no relevant results or confidence is low, the agent directs the user to SharePoint with links to potentially relevant policies and suggests contacting the policy owner.**

### Rationale

- Users should never be completely stuck
- SharePoint has native search and browse capabilities
- Policy owners can clarify edge cases
- Maintains trust by acknowledging limitations

### Alternatives Considered

**Just say "I don't know":**

- Rejected: Unhelpful, dead end

**Always return something:**

- Rejected: Low-confidence answers on compliance questions are dangerous

### Consequences

- Agent must detect low-confidence situations
- Fallback response includes relevant SharePoint links
- Policy owner contact info available from metadata

---

## ADR-011: GitHub Over SharePoint-Native Version Control

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

SharePoint has version control capabilities (version history, restore, check-in/check-out, Power Automate approval workflows). We considered whether SharePoint-native versioning could replace GitHub as the source of truth, eliminating the need for a sync layer.

### Decision

**Use GitHub for version control and approval workflows, with SharePoint as the viewing/interaction layer only.**

### Rationale

SharePoint version control compared to GitHub:

| Capability                    | SharePoint                                | GitHub                      |
| ----------------------------- | ----------------------------------------- | --------------------------- |
| Version history               | ✅ Per document                           | ✅ Per commit               |
| Restore previous              | ✅ Yes                                    | ✅ Yes                      |
| Change attribution            | ✅ Modified by                            | ✅ Commit author            |
| **Compare versions (diff)**   | ❌ Limited (Word only, not markdown/YAML) | ✅ Full diff                |
| **Branching / drafts**        | ❌ No                                     | ✅ Yes                      |
| **Atomic multi-file changes** | ❌ Per-file only                          | ✅ Yes                      |
| Approval workflows            | ⚠️ Power Automate (basic)                 | ✅ PRs + required reviewers |
| Audit trail                   | ✅ Yes                                    | ✅ Immutable                |

**Critical limitations of SharePoint-only:**

1. **No diffing for structured content** — Domain owners cannot see exactly what changed in YAML rules. This makes approval less meaningful for compliance purposes.

2. **No branching** — Cannot have a draft under review while the live version remains unchanged. Edits are immediately visible or require a separate "draft" document with manual promotion.

3. **No atomic changes** — Policy metadata and content are one file in our design. SharePoint versions each file independently with no concept of "this set of changes is version 2.0".

4. **Approval workflow complexity** — Domain-based multi-approver with diff review would require:
   - Custom diff generation (comparing SharePoint versions)
   - Custom domain detection logic
   - Custom approval state tracking
   - Power Automate flows to orchestrate

These capabilities come free with GitHub's PR workflow.

### Alternatives Considered

**SharePoint only with Power Automate:**

- Suggestions via SharePoint list
- Edits directly in SharePoint
- Power Automate for approval routing
- Rejected: No diff capability for reviewers; no branching for draft/live separation

**SharePoint as source with custom workflow:**

- Build diff generation, domain detection, approval tracking
- Agent orchestrates workflow
- Rejected: Rebuilds what GitHub provides natively; higher implementation effort

**Hybrid (SharePoint storage, Git for history):**

- SharePoint is live, changes sync to Git for audit
- Rejected: Loses PR-based review workflow; two systems to manage

### Consequences

- Must maintain GitHub → SharePoint sync layer (GitHub Actions + Graph API)
- Team needs conceptual familiarity with Git (abstracted via agent)
- Additional system (GitHub) beyond M365 ecosystem
- Gain: robust diffing, branching, PR workflows, immutable audit trail

### Trade-off Summary

| Approach                 | Sync Complexity | Workflow Complexity | Diff Support | Branching |
| ------------------------ | --------------- | ------------------- | ------------ | --------- |
| GitHub + SharePoint sync | Medium          | Low (built-in)      | ✅ Full      | ✅ Yes    |
| SharePoint only          | None            | High (must build)   | ❌ Limited   | ❌ No     |

We accept sync complexity in exchange for Git's workflow capabilities.

---

## ADR-012: Webhook-Driven Automation (No GitHub Actions in Content Repos)

| Attribute | Value      |
| --------- | ---------- |
| Status    | Accepted   |
| Date      | 2026-01-26 |
| Deciders  | Duncan     |

### Context

The system requires automation for validation, SharePoint sync, PDF generation, index updates, and approval routing. The original design placed GitHub Actions workflows in each content repository. As we consider reusing this pattern for multiple document types (SOPs, tech docs, etc.), workflow duplication becomes a maintenance problem.

### Decision

**All automation is handled by the central service via GitHub webhooks. Content repositories contain no workflow files.**

### Rationale

| Approach           | Workflow Location       | New Repo Setup       | Updates             |
| ------------------ | ----------------------- | -------------------- | ------------------- |
| Actions per repo   | Each content repo       | Copy workflow files  | Update every repo   |
| Reusable workflows | Central repo + wrappers | Copy wrapper files   | Update central repo |
| **Webhooks**       | Central service only    | Install App + config | Update service only |

**Webhook approach benefits:**

1. **Zero duplication** — Logic lives in one place
2. **Simple onboarding** — New document type = install GitHub App + add config entry
3. **Atomic updates** — Change automation logic once, applies everywhere
4. **Platform model** — Content repos are pure content, no infrastructure concerns

**How it works:**

```
GitHub Events                    Central Service
─────────────────────────────────────────────────────
push to main          ────►      Sync SP, Generate PDF, Update Index
pull_request opened   ────►      Validate schema, Route approvals
pull_request updated  ────►      Re-validate
issue_comment created ────►      Check for approval commands
```

**Content repos become pure content:**

```
docs-policy-governance/
├── policies/
├── schema/
├── metadata/
└── templates/
# No .github/workflows/
```

### Alternatives Considered

**GitHub Actions in each repo:**

- Original design
- Rejected: Duplication across document types, maintenance burden

**Reusable workflows (GitHub native):**

- Central repo with reusable workflows, thin wrappers in content repos
- Rejected: Still requires wrapper files in each repo, partial duplication

**Monorepo for all document types:**

- Single repo with all policies, SOPs, tech docs, etc.
- Rejected: Mixed permissions, doesn't match org structure, complex CODEOWNERS

### Consequences

- Central service must handle webhook signatures and verification
- Must implement retry/reliability logic (GitHub webhooks are generally reliable)
- Lose GitHub Actions UI for run visibility (mitigated by service logging/dashboard)
- GitHub App must be installed on each content repo
- Service needs configuration mapping repos to document types

### Webhook Events Required

| Event                               | Trigger            | Action                                                        |
| ----------------------------------- | ------------------ | ------------------------------------------------------------- |
| `push` (to main)                    | Merge completed    | Sync to SharePoint, generate PDF, update index                |
| `pull_request` (opened/synchronize) | PR created/updated | Validate schema, identify domains, update approval table      |
| `issue_comment` (created)           | Comment added      | Check for approval commands (if using comment-based approval) |
| `issues` (opened)                   | Issue created      | Track as suggestion (if using issues for suggestions)         |

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

---

## Pending Decisions

| Topic                 | Question                                    | Notes                         |
| --------------------- | ------------------------------------------- | ----------------------------- |
| Embedding model       | Which model for vector embeddings?          | Evaluating Google's new model |
| Graph API permissions | What app registration scopes needed?        | Sites.ReadWrite.All likely    |
| PDF template          | Branding requirements                       | Pending design input          |
| Review escalation     | Who gets escalated overdue reviews?         | Line manager vs fixed chain   |
| SPFx deployment       | Tenant-wide or site collection app catalog? | IT decision                   |

---

## Change Log

| Version | Date       | Author          | Changes                                                      |
| ------- | ---------- | --------------- | ------------------------------------------------------------ |
| 0.1.0   | 2026-01-26 | Duncan / Claude | Initial ADR document with 10 accepted decisions              |
| 0.2.0   | 2026-01-26 | Duncan / Claude | Added ADR-011: GitHub over SharePoint-native version control |
| 0.3.0   | 2026-01-26 | Duncan / Claude | Added ADR-012: Webhook-driven automation                     |
