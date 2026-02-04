# Document Governance System — Implementation Plan

| Attribute | Value |
|-----------|-------|
| Document Version | 0.3.0 |
| Created | 2026-01-26 |
| Last Updated | 2026-01-26 |
| Related Documents | Policy System Architecture v0.7.0, ADRs v0.3.0 |
| Purpose | Define phased implementation approach with incremental deliverables |

---

## Principles

1. **Incremental value** — Each phase delivers working functionality that can be tested
2. **Prove before proceeding** — Validate each phase works before building the next
3. **Separate repositories** — Content repos are standalone, not mixed with infrastructure code
4. **Service account model** — Docs Bot acts on behalf of users; staff are not GitHub org members
5. **Webhook-driven automation** — Central service handles all automation; content repos are pure content
6. **Platform-ready** — Architecture supports multiple document types (policies, SOPs, tech docs)
7. **M365 for identity** — Azure AD is the source of truth for user identity and permissions

---

## Repository Structure

Content repositories contain only content — no workflow files. All automation is handled by the central service via webhooks.

```
Organisation
├── policy-governance/          # Policies repo (content only)
│   ├── policies/
│   ├── schema/
│   ├── metadata/
│   └── templates/
│
├── doc-governance-service/     # Central service (webhook handlers, agent, tools)
│   ├── src/
│   │   ├── webhooks/           # GitHub webhook handlers
│   │   ├── handlers/           # Push, PR, Issue handlers
│   │   ├── services/           # Sync, PDF, Index services
│   │   └── config/             # Document type configurations
│   ├── mastra/                 # Agent & tools
│   ├── spfx/                   # SharePoint web part
│   ├── db/                     # Database migrations
│   └── terraform/              # Infrastructure as code
│
└── doc-governance-docs/        # Documentation (optional)
    ├── architecture/
    ├── adrs/
    └── runbooks/
```

**Adding a new document type:**
1. Create content repository (no workflows needed)
2. Install Docs Bot on the repository
3. Add configuration entry mapping repo → document type
4. Create schema, domains.yaml, and agent skill
5. Done — webhooks automatically route to central service

---

## Docs Bot (Service Account)

### What Is It?

The **Docs Bot** is a service account identity registered with GitHub that allows the system to interact with the GitHub API on behalf of users. It serves all document types — policies, SOPs, tech docs, etc.

Staff do not need GitHub accounts. All GitHub operations (creating branches, commits, PRs, issues) are performed by the Docs Bot, with human attribution recorded in metadata.

### Why a Service Account?

| Requirement | Personal Token | OAuth | Service Account (Bot) |
|-------------|----------------|-------|----------------------|
| Staff don't need GitHub accounts | ✅ | ❌ | ✅ |
| Actions attributed to a bot, not a person | ❌ | ❌ | ✅ |
| Granular permissions (only what's needed) | ❌ | ❌ | ✅ |
| Not tied to an individual's account | ❌ | ❌ | ✅ |
| Can be installed on multiple repos | ❌ | ❌ | ✅ |
| Receives webhooks for automation | ❌ | ❌ | ✅ |
| Audit trail shows bot identity | ❌ | ❌ | ✅ |

### Docs Bot Configuration

**Name:** `doc-governance-bot`

**Permissions (GitHub App registration):**
- Repository contents: Read & Write (create branches, commits)
- Issues: Read & Write (create suggestions)
- Pull requests: Read & Write (create, update, merge)
- Metadata: Read
- Webhooks: Configured to send events to central service

**Webhook events:**
- `push` — Triggers sync, PDF generation, index update
- `pull_request` — Triggers validation, approval routing
- `issues` — Triggers suggestion tracking
- `issue_comment` — Triggers approval command detection

**Installed on:** All content repositories (policies, SOPs, etc.)

### How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ User            │────►│ Mastra Tool     │────►│ GitHub API      │
│ (jane.smith@)   │     │                 │     │                 │
│                 │     │ 1. Get bot      │     │                 │
│ "Create a PR    │     │    credentials  │     │                 │
│  to update      │     │    from Key     │     │                 │
│  rule X"        │     │    Vault        │     │                 │
│                 │     │                 │     │                 │
│                 │     │ 2. Call GitHub  │     │ Authenticated   │
│                 │     │    API as bot   │     │ as:             │
│                 │     │                 │     │ doc-gov-bot     │
│                 │     │ 3. Include user │     │                 │
│                 │     │    identity in  │     │                 │
│                 │     │    commit msg   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### What It Looks Like in GitHub

**Commits:**
```
┌─────────────────────────────────────────────────────────────┐
│ doc-governance-bot committed 2 hours ago                    │
│                                                             │
│ Update IT-001: Add encryption exception for marketing       │
│                                                             │
│ Authored-by: jane.smith@company.com                        │
│ Request-id: suggestion-12345                                │
└─────────────────────────────────────────────────────────────┘
```

**Pull Requests:**
```
┌─────────────────────────────────────────────────────────────┐
│ doc-governance-bot wants to merge 1 commit into main        │
│                                                             │
│ #42 Update IT-001: Add encryption exception                │
│                                                             │
│ Created on behalf of: jane.smith@company.com               │
└─────────────────────────────────────────────────────────────┘
```

### Attribution Model

Since the bot makes all commits, we attribute actions via:

1. **Commit message metadata:**
   ```
   Update IT-001: Add encryption exception for marketing devices
   
   Authored-by: jane.smith@company.com
   Approved-by: security.team@company.com, hr.team@company.com
   Request-id: suggestion-12345
   ```

2. **PR body contains approval table** (machine-readable, updated by central service)

3. **Audit log in Postgres** (every action logged with user, timestamp, action type)

### Setup (One-Time)

1. **Register the bot** in GitHub organisation settings → Developer settings → GitHub Apps → New GitHub App
2. **Configure permissions:** Contents (read/write), Issues (read/write), Pull Requests (read/write)
3. **Configure webhook URL:** Point to central service endpoint
4. **Generate private key:** Download `.pem` file
5. **Store credentials:** Upload private key to Azure Key Vault
6. **Install on repositories:** Install on each content repo

---

## Approval Workflow (Without GitHub Reviewers)

Since staff aren't GitHub users, we track approvals ourselves:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PR Lifecycle                              │
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐ │
│  │ Created  │────►│ Pending  │────►│ Approved │────►│ Merged │ │
│  │          │     │ Approval │     │          │     │        │ │
│  └──────────┘     └────┬─────┘     └──────────┘     └────────┘ │
│                        │                                        │
│                        ▼                                        │
│               ┌─────────────────┐                               │
│               │ Approval Table  │                               │
│               │ in PR Body      │                               │
│               │                 │                               │
│               │ Domain │ Status │                               │
│               │ ───────┼─────── │                               │
│               │ IT     │ ✅     │                               │
│               │ HR     │ ⏳     │                               │
│               └─────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Approval table format in PR body:**

```markdown
## Approval Status

| Domain | Required Approver | Status | Approved By | Date |
|--------|-------------------|--------|-------------|------|
| IT | jane.smith@company.com | ✅ Approved | jane.smith@company.com | 2026-01-26 |
| HR | hr.team@company.com | ⏳ Pending | - | - |

---
*Managed by Docs Bot. Do not edit manually.*
```

**Workflow:**

1. **PR created** → Webhook received → Central service parses diff, identifies domains
2. **Approval table added** → Service updates PR body with required approvers
3. **Notifications sent** → Teams/email to required approvers
4. **Approver uses agent** → "Approve the change to IT-001"
5. **Tool updates PR** → Marks approval in table, adds comment
6. **All approved** → Service merges PR automatically
7. **Merge triggers** → Push webhook → Sync to SharePoint, update index, generate PDF

---

## Phase 0: Foundation

**Goal:** Establish repository structure, schema, first policy conversion, and Docs Bot registration.

**Duration:** 1 week

### Deliverables

| Item | Description |
|------|-------------|
| `policy-governance` repo | Empty content repo with folder structure |
| `policy.schema.json` | JSON Schema for frontmatter validation |
| `domains.yaml` | Domain definitions with owners (Azure AD emails) |
| First policy converted | One existing PDF policy in new format |
| Docs Bot registered | GitHub App with webhook configuration |

### Tasks

- [ ] Create `policy-governance` repository (content only, no workflows)
- [ ] Create folder structure (`policies/`, `schema/`, `metadata/`, `templates/`)
- [ ] Define JSON Schema for policy frontmatter
- [ ] Create `domains.yaml` with initial domains and owners
- [ ] Convert one existing policy (e.g., IT Security) to frontmatter markdown
- [ ] Create `policy-template.md` for new policies
- [ ] Register Docs Bot (GitHub App) with required permissions
- [ ] Configure webhook URL (placeholder until service deployed)
- [ ] Generate and securely store bot private key (Azure Key Vault)
- [ ] Install Docs Bot on `policy-governance` repository

### Validation

- [ ] Policy file passes schema validation (manual)
- [ ] Docs Bot can read repository contents
- [ ] Docs Bot can create a test branch and commit

---

## Phase 1: Central Service & SharePoint Pipeline

**Goal:** Deploy central service; policies authored in GitHub automatically appear as native SharePoint pages.

**Duration:** 3 weeks

**Dependencies:** Phase 0 complete

### Deliverables

| Item | Description |
|------|-------------|
| Central service | Deployed to Azure Container Apps |
| Webhook endpoint | `/webhooks/github` receiving events |
| Push handler | Validates, syncs to SharePoint, generates PDF |
| SharePoint site | Site with pages for policies |
| Graph API app registration | Azure AD app for SharePoint access |
| Document type config | Mapping for `policy-governance` repo |

### Tasks

- [ ] Create `doc-governance-service` repository
- [ ] Set up Node.js/TypeScript project structure
- [ ] Implement webhook signature verification
- [ ] Implement document type configuration loader
- [ ] Create SharePoint site (`policies.company.com`)
- [ ] Create Azure AD app registration for Graph API
- [ ] Grant `Sites.ReadWrite.All` permission (admin consent)
- [ ] Build markdown → SharePoint page converter
- [ ] Implement push handler (sync to SharePoint)
- [ ] Define SharePoint page template/structure
- [ ] Create metadata columns on SharePoint (PolicyID, Version, Domain, etc.)
- [ ] Build PDF generation (markdown → branded PDF)
- [ ] Implement PDF archiving logic
- [ ] Create Archive document library for PDFs
- [ ] Deploy service to Azure Container Apps
- [ ] Configure Docs Bot webhook URL to point to service
- [ ] Add policy-governance repo to document type config

### Validation

- [ ] Webhook received when PR merged
- [ ] Edit policy in GitHub, merge PR
- [ ] SharePoint page updates automatically
- [ ] PDF appears in library
- [ ] Previous PDF archived
- [ ] Page is searchable in SharePoint

---

## Phase 2: Search & Retrieval

**Goal:** AI agent can search and retrieve policies from Postgres index.

**Duration:** 2 weeks

**Dependencies:** Phase 1 complete

### Deliverables

| Item | Description |
|------|-------------|
| Postgres schema | Tables for policies, rules, embeddings |
| Index update handler | Updates index on push webhook |
| Mastra tools | `query_policies`, `get_policy`, `search_rules` |
| Embedding pipeline | Generate embeddings for rules and prose |

### Tasks

- [ ] Design Postgres schema (policies, rules, embeddings tables)
- [ ] Create database migrations
- [ ] Select and configure embedding model
- [ ] Build embedding generation pipeline
- [ ] Add index update to push handler
- [ ] Implement hybrid search query (vector + keyword + metadata)
- [ ] Build Mastra tool: `query_policies`
- [ ] Build Mastra tool: `get_policy` (fetch from GitHub)
- [ ] Build Mastra tool: `search_rules`
- [ ] Build Mastra tool: `get_rules_by_filter`

### Validation

- [ ] Index populated with test policy on merge
- [ ] `query_policies` returns relevant results for test queries
- [ ] "Can I take my laptop to China?" returns IT + Travel policies
- [ ] Full policy content retrieved successfully
- [ ] Hybrid search finds both semantic and keyword matches

---

## Phase 3: Suggestions & Notifications

**Goal:** Any staff member can suggest a policy change via the agent; owners get notified.

**Duration:** 1 week

**Dependencies:** Phase 2 complete

### Deliverables

| Item | Description |
|------|-------------|
| Mastra tool | `submit_suggestion` (creates GitHub Issue via Docs Bot) |
| Mastra tool | `get_my_suggestions` (lists user's suggestions) |
| Issue handler | Notifies policy owner on new suggestion |
| Audit logging | Log all suggestions with user identity |

### Tasks

- [ ] Build Mastra tool: `submit_suggestion`
- [ ] Create GitHub Issue template for suggestions
- [ ] Build Mastra tool: `get_my_suggestions`
- [ ] Implement issue webhook handler
- [ ] Implement Teams/email notifications to owner
- [ ] Implement audit logging for suggestions
- [ ] Map Azure AD user to suggestion metadata

### Validation

- [ ] User submits suggestion via agent
- [ ] GitHub Issue created (by Docs Bot) with correct labels and metadata
- [ ] Policy owner receives Teams notification
- [ ] User can check status of their suggestions
- [ ] Audit log contains suggestion record

---

## Phase 4: Editing & Approvals

**Goal:** Policy owners can edit policies and domain owners can approve via the agent.

**Duration:** 3 weeks

**Dependencies:** Phase 3 complete

### Deliverables

| Item | Description |
|------|-------------|
| Mastra tool | `create_change` (creates branch + PR via Docs Bot) |
| Mastra tool | `update_change` (updates existing PR) |
| Mastra tool | `get_pending_approvals` |
| Mastra tool | `get_change_diff` |
| Mastra tool | `approve_change` |
| Mastra tool | `reject_change` |
| PR handler | Validates schema, parses diff, adds approval table |
| Auto-merge logic | Merges when all approvals complete |
| Permission checking | Validate user can perform action |

### Tasks

- [ ] Build Mastra tool: `create_change`
- [ ] Build Mastra tool: `update_change`
- [ ] Build PR approval table format (markdown in PR body)
- [ ] Implement PR webhook handler (opened/synchronize events)
- [ ] Implement schema validation in PR handler
- [ ] Implement domain detection from diff
- [ ] Implement approval table generation
- [ ] Build Mastra tool: `get_pending_approvals`
- [ ] Build Mastra tool: `get_change_diff`
- [ ] Build Mastra tool: `approve_change` (updates PR approval table)
- [ ] Build Mastra tool: `reject_change`
- [ ] Implement auto-merge when all approvals received
- [ ] Implement permission checking (is user a domain owner?)
- [ ] Build diff rendering for agent canvas
- [ ] Notification on approval request
- [ ] Notification on approval/rejection
- [ ] Audit logging for all approval actions

### Validation

- [ ] Owner creates change via agent
- [ ] PR created (by Docs Bot) with approval table listing required approvers
- [ ] Domain owner receives notification
- [ ] Domain owner approves via agent
- [ ] Approval recorded in PR (by Docs Bot)
- [ ] When all approve, PR auto-merges
- [ ] SharePoint page and index update
- [ ] Rejection returns PR to owner with comments

---

## Phase 5: SharePoint Integration

**Goal:** Full chat agent experience in SharePoint with all workflows.

**Duration:** 2 weeks

**Dependencies:** Phase 4 complete

### Deliverables

| Item | Description |
|------|-------------|
| SPFx web part | Governance Assistant chat interface |
| Canvas components | Diff viewer, policy preview, edit interface |
| "Suggest Change" button | Quick access on policy pages |
| Page template | Standard layout for all policy pages |

### Tasks

- [ ] Set up SPFx development environment
- [ ] Build chat web part (connects to Mastra agent)
- [ ] Build canvas area for rich content
- [ ] Build diff viewer component
- [ ] Build policy preview component
- [ ] Build "Suggest Change" button/trigger
- [ ] Integrate with SharePoint user context (pass identity to agent)
- [ ] Add web part to policy page template
- [ ] Deploy to SharePoint app catalog
- [ ] Test on all policy pages

### Validation

- [ ] Chat agent works in SharePoint
- [ ] User can query policies
- [ ] User can submit suggestions
- [ ] Owner can edit and create PRs
- [ ] Domain owner can view diff and approve
- [ ] All workflows complete end-to-end in SharePoint

---

## Phase 6: Production Readiness

**Goal:** System is ready for full rollout with all policies.

**Duration:** 2 weeks

**Dependencies:** Phase 5 complete

### Deliverables

| Item | Description |
|------|-------------|
| Review reminder job | Scheduled job for review date checks |
| Acknowledgement tracking | SharePoint List integration |
| All policies converted | Full policy library in new format |
| Runbooks | Operational documentation |
| Monitoring | Logging, alerting, dashboards |

### Tasks

- [ ] Build review reminder scheduled job (internal cron)
- [ ] Implement acknowledgement tracking (SharePoint List)
- [ ] Convert remaining policies to new format
- [ ] Bulk initial index load
- [ ] Create operational runbooks
- [ ] Set up monitoring and alerting
- [ ] Performance testing
- [ ] Security review
- [ ] User documentation / training materials
- [ ] Soft launch with pilot group
- [ ] Full rollout

### Validation

- [ ] Review reminders sent on schedule
- [ ] Overdue policies flagged
- [ ] Acknowledgements recorded
- [ ] All policies searchable and viewable
- [ ] System performs under expected load
- [ ] No security vulnerabilities

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Foundation | 1 week | Week 1 |
| Phase 1: Central Service & SharePoint | 3 weeks | Week 4 |
| Phase 2: Search & Retrieval | 2 weeks | Week 6 |
| Phase 3: Suggestions & Notifications | 1 week | Week 7 |
| Phase 4: Editing & Approvals | 3 weeks | Week 10 |
| Phase 5: SharePoint Integration | 2 weeks | Week 12 |
| Phase 6: Production Readiness | 2 weeks | Week 14 |

**Total estimated duration: 14 weeks (~3.5 months)**

---

## Phase Dependencies

```
Phase 0: Foundation
    │
    ▼
Phase 1: Central Service & SharePoint Pipeline
    │
    ▼
Phase 2: Search & Retrieval
    │
    ▼
Phase 3: Suggestions & Notifications
    │
    ▼
Phase 4: Editing & Approvals
    │
    ▼
Phase 5: SharePoint Integration
    │
    ▼
Phase 6: Production Readiness
```

Phases are sequential — each builds on the previous. Limited parallelisation possible:
- PDF template design can happen during Phase 0-1
- SPFx development environment setup can happen during Phase 3-4
- Policy conversion can begin after Phase 1 (parallel with 2-4)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Graph API permission delays | Engage IT early; have fallback to static HTML if needed |
| Embedding model performance | Benchmark early in Phase 2; have fallback model |
| Complex diff rendering | Start with text diff; enhance incrementally |
| User adoption | Pilot with engaged team; iterate on UX feedback |
| Docs Bot rate limits | Implement caching; batch operations where possible |
| Webhook reliability | Implement retry logic; dead letter queue for failed events |
| Service availability | Deploy with multiple replicas; health checks |

---

## Success Criteria by Phase

| Phase | Success Criteria |
|-------|------------------|
| 0 | One valid policy file in repo; Docs Bot working |
| 1 | Merge in GitHub → appears in SharePoint automatically |
| 2 | Agent finds relevant policies for compliance queries |
| 3 | Staff can suggest changes; owners get notified |
| 4 | Full edit/approve/merge cycle works via agent |
| 5 | Complete workflow works in SharePoint UI |
| 6 | All policies live; system in production use |

---

## Open Items to Resolve Before Starting

| Item | Owner | Deadline |
|------|-------|----------|
| SharePoint site provisioning | IT | Before Phase 1 |
| Azure AD app registration approval | IT | Before Phase 1 |
| GitHub organisation access | IT | Before Phase 0 |
| PDF branding requirements | Comms/Design | Before Phase 1 |
| Domain owners list | Policy Team | Before Phase 0 |
| Pilot policy selection | Policy Team | Before Phase 0 |
| Embedding model decision | Duncan | Before Phase 2 |
| Azure Container Apps provisioning | IT | Before Phase 1 |

---

## Future: Adding New Document Types

Once the platform is proven with policies, adding a new document type (e.g., SOPs) requires:

| Step | Effort |
|------|--------|
| Create content repository | Minutes |
| Install Docs Bot on repo | Minutes |
| Add document type configuration | Hours |
| Create schema for new type | Hours |
| Create domains.yaml for new type | Hours |
| Create agent skill for new type | Days |
| Create SharePoint site | Hours |
| Bulk convert existing documents | Days |

No changes to central service code required — just configuration.

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-01-26 | Duncan / Claude | Initial implementation plan |
| 0.2.0 | 2026-01-26 | Duncan / Claude | Clarified Policy Bot terminology; added detailed explanation of service account approach |
| 0.3.0 | 2026-01-26 | Duncan / Claude | Renamed to Docs Bot; replaced GitHub Actions with webhook-driven central service; updated for platform model supporting multiple document types |
