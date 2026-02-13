# Roadmap — Document Governance System

| Attribute    | Value                                            |
| ------------ | ------------------------------------------------ |
| Last Updated | 2026-02-13                                       |
| Total Phases | 7 (Phase 0–6)                                    |
| Related      | [Architecture](architecture.md), [ADRs](adrs.md) |

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
Phase 5: Browser Extension (Chat UI)
    │
    ▼
Phase 6: Production Readiness
```

Limited parallelisation possible:

- PDF template design can happen during Phase 0–1
- Browser extension scaffolding can happen during Phase 3–4
- Policy conversion can begin after Phase 1 (parallel with 2–4)

---

## Phase 0: Foundation

**Goal:** Establish repository structure, schema, first policy conversion, and Docs Bot registration.

| Deliverable                   | Detail Doc                                           |
| ----------------------------- | ---------------------------------------------------- |
| `docs-policy-governance` repo | Content-only repo with folder structure              |
| `policy.schema.json`          | [specs/policy.schema.json](specs/policy.schema.json) |
| Database config schema        | [stack/database.md](stack/database.md)               |
| `metadata/governance.yaml`    | Repository workflow configuration                    |
| First policy converted        | One existing PDF policy in frontmatter markdown      |
| Docs Bot registered           | [stack/github-app.md](stack/github-app.md)           |

### Tasks

- [x] Create `docs-policy-governance` repository (content only, no workflows)
- [x] Create folder structure (`policies/`, `schema/`, `metadata/`, `templates/`)
- [x] Define JSON Schema for policy frontmatter
- [x] Create Supabase migration for config schema with seed domain data
- [x] Create `metadata/governance.yaml` for repository workflow configuration
- [x] Convert one existing policy to frontmatter markdown
- [x] Create `policy-template.md` for new policies
- [x] Register Docs Bot GitHub App — see [stack/github-app.md](stack/github-app.md) for setup
- [x] Install Docs Bot on `docs-policy-governance` repository (Installation ID: 107965932)
- [x] Record App ID and Installation ID for service configuration

> **Note:** GitHub App manifest-based deployment was not possible. The app was created manually via GitHub settings. Manifest files are kept at `src/docs-bot/` for reference.

### Validation

- [x] Policy file passes schema validation
- [x] Docs Bot can read repository contents — webhook receiving push events
- [ ] Docs Bot can create a test branch and commit

---

## Phase 1: Central Service & SharePoint Pipeline

**Goal:** Deploy central service; policies authored in GitHub automatically appear as native SharePoint pages.

| Deliverable                | Detail Doc                                           |
| -------------------------- | ---------------------------------------------------- |
| Central service deployed   | [stack/webhook-service.md](stack/webhook-service.md) |
| Webhook endpoint           | `/webhooks/github` receiving events                  |
| Push handler               | Validates, syncs to SharePoint, generates PDF        |
| SharePoint site            | [stack/sharepoint.md](stack/sharepoint.md)           |
| Graph API app registration | Azure AD app for SharePoint access                   |

### Tasks

- [x] Integrate webhook handlers in mastra repository
- [x] Implement webhook signature verification
- [x] Implement database query for repository configuration
- [x] Create SharePoint site (`policies.company.com`)
- [x] Create Azure AD app registration for Graph API
- [x] Grant `Sites.ReadWrite.All` permission (admin consent)
- [x] Build markdown → SharePoint page converter
- [x] Implement push handler (sync to SharePoint)
- [x] Define SharePoint page template/structure
- [ ] Create metadata columns on SharePoint (PolicyID, Version, Domain, etc.)
- [x] Build PDF generation (markdown → branded PDF)
- [ ] Implement PDF archiving logic
- [ ] Create Archive document library for PDFs
- [x] Deploy service to Mastra cloud
- [x] Update Docs Bot webhook URL to deployed service
- [x] Verify governance.yaml syncs to database on push

### Validation

- [x] Webhook received when PR merged
- [ ] Edit policy in GitHub → merge PR → SharePoint page updates automatically
- [x] SharePoint page created
- [x] PDF generated
- [ ] Previous PDF archived
- [x] Page is searchable in SharePoint

---

## Phase 2: Search & Retrieval

**Goal:** AI agent can search and retrieve policies from Postgres index.

| Deliverable          | Detail Doc                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Postgres schema      | [stack/database.md](stack/database.md) — policies, rules, embeddings tables                     |
| Index update handler | Part of push handler pipeline                                                                   |
| Mastra tools         | [stack/mastra-agent.md](stack/mastra-agent.md) — `query_policies`, `get_policy`, `search_rules` |
| Embedding pipeline   | Generate embeddings for rules and prose                                                         |

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

| Deliverable               | Detail Doc                                           |
| ------------------------- | ---------------------------------------------------- |
| `submit_suggestion` tool  | [stack/mastra-agent.md](stack/mastra-agent.md)       |
| `get_my_suggestions` tool | [stack/mastra-agent.md](stack/mastra-agent.md)       |
| Issue webhook handler     | [stack/webhook-service.md](stack/webhook-service.md) |
| Audit logging             | Per-action logging in Postgres                       |

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

| Deliverable         | Detail Doc                                           |
| ------------------- | ---------------------------------------------------- |
| Edit/approval tools | [stack/mastra-agent.md](stack/mastra-agent.md)       |
| PR handler          | [stack/webhook-service.md](stack/webhook-service.md) |
| Auto-merge logic    | Part of webhook service                              |
| Permission checking | Azure AD integration                                 |

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

## Phase 5: Browser Extension (Chat UI)

**Goal:** Full chat agent experience via browser extension with all workflows.

| Deliverable              | Detail Doc                                               |
| ------------------------ | -------------------------------------------------------- |
| Browser extension        | [stack/browser-extension.md](stack/browser-extension.md) |
| Chat interface           | Text input, message history, canvas area                 |
| "Suggest Change" trigger | Quick access from policy pages                           |
| Azure AD auth            | Inherits user identity                                   |

### Tasks

- [ ] Set up browser extension project (Manifest V3)
- [ ] Build chat interface (connects to Mastra agent)
- [ ] Build canvas area for rich content (diffs, previews)
- [ ] Build diff viewer component
- [ ] Build policy preview component
- [ ] Implement "Suggest Change" trigger (detects policy page context)
- [ ] Integrate Azure AD authentication
- [ ] Test on SharePoint policy pages
- [ ] Package for Chrome and Edge
- [ ] Internal distribution (sideload or enterprise deployment)

### Validation

- [ ] Chat agent works in browser extension
- [ ] User can query policies
- [ ] User can submit suggestions
- [ ] Owner can edit and create PRs
- [ ] Domain owner can view diff and approve
- [ ] All workflows complete end-to-end

---

## Phase 6: Production Readiness

**Goal:** System is ready for full rollout with all policies.

| Deliverable              | Detail Doc                                           |
| ------------------------ | ---------------------------------------------------- |
| Review reminder job      | [stack/webhook-service.md](stack/webhook-service.md) |
| Acknowledgement tracking | [stack/sharepoint.md](stack/sharepoint.md)           |
| All policies converted   | Content in `docs-policy-governance` repo             |
| Monitoring               | Logging, alerting, dashboards                        |

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

| Phase                                 | Duration | Cumulative |
| ------------------------------------- | -------- | ---------- |
| Phase 0: Foundation                   | 1 week   | Week 1     |
| Phase 1: Central Service & SharePoint | 3 weeks  | Week 4     |
| Phase 2: Search & Retrieval           | 2 weeks  | Week 6     |
| Phase 3: Suggestions & Notifications  | 1 week   | Week 7     |
| Phase 4: Editing & Approvals          | 3 weeks  | Week 10    |
| Phase 5: Browser Extension            | 2 weeks  | Week 12    |
| Phase 6: Production Readiness         | 2 weeks  | Week 14    |

---

## Risk Mitigation

| Risk                         | Mitigation                                                 |
| ---------------------------- | ---------------------------------------------------------- |
| Graph API permission delays  | Engage IT early; have fallback to static HTML if needed    |
| Embedding model performance  | Benchmark early in Phase 2; have fallback model            |
| Complex diff rendering       | Start with text diff; enhance incrementally                |
| User adoption                | Pilot with engaged team; iterate on UX feedback            |
| Docs Bot rate limits         | Implement caching; batch operations where possible         |
| Webhook reliability          | Implement retry logic; dead letter queue for failed events |
| Service availability         | Deploy with multiple replicas; health checks               |
| Browser extension deployment | Enterprise policy distribution as fallback to store        |

---

## Success Criteria by Phase

| Phase | Success Criteria                                      |
| ----- | ----------------------------------------------------- |
| 0     | One valid policy file in repo; Docs Bot working       |
| 1     | Merge in GitHub → appears in SharePoint automatically |
| 2     | Agent finds relevant policies for compliance queries  |
| 3     | Staff can suggest changes; owners get notified        |
| 4     | Full edit/approve/merge cycle works via agent         |
| 5     | Complete workflow works in browser extension          |
| 6     | All policies live; system in production use           |

---

## Adding New Document Types (Future)

Once the platform is proven with policies:

| Step                            | Effort  |
| ------------------------------- | ------- |
| Create content repository       | Minutes |
| Install Docs Bot on repo        | Minutes |
| Add document type configuration | Hours   |
| Create schema for new type      | Hours   |
| Seed domain data if needed      | Minutes |
| Create agent skill for new type | Days    |
| Create SharePoint site          | Hours   |
| Bulk convert existing documents | Days    |

No changes to central service code required — just configuration.
