# Document Governance System — Implementation Plan

| Attribute         | Value                                                               |
| ----------------- | ------------------------------------------------------------------- |
| Document Version  | 0.4.0                                                               |
| Created           | 2026-01-26                                                          |
| Last Updated      | 2026-02-05                                                          |
| Related Documents | Policy System Architecture v0.7.0, ADRs v0.3.0                      |
| Purpose           | Define phased implementation approach with incremental deliverables |

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
├── docs-policy-governance/          # Policies repo (content only)
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
3. Add repository config row to database (or create `metadata/governance.yaml` which syncs on first push)
4. Create schema and agent skill (domain ownership already in database)
5. Done — webhooks automatically route to central service

---

## Docs Bot (Service Account)

### What Is It?

The **Docs Bot** is a service account identity registered with GitHub that allows the system to interact with the GitHub API on behalf of users. It serves all document types — policies, SOPs, tech docs, etc.

Staff do not need GitHub accounts. All GitHub operations (creating branches, commits, PRs, issues) are performed by the Docs Bot, with human attribution recorded in metadata.

### Why a Service Account?

| Requirement                               | Personal Token | OAuth | Service Account (Bot) |
| ----------------------------------------- | -------------- | ----- | --------------------- |
| Staff don't need GitHub accounts          | ✅             | ❌    | ✅                    |
| Actions attributed to a bot, not a person | ❌             | ❌    | ✅                    |
| Granular permissions (only what's needed) | ❌             | ❌    | ✅                    |
| Not tied to an individual's account       | ❌             | ❌    | ✅                    |
| Can be installed on multiple repos        | ❌             | ❌    | ✅                    |
| Receives webhooks for automation          | ❌             | ❌    | ✅                    |
| Audit trail shows bot identity            | ❌             | ❌    | ✅                    |

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
│  to update      │     │    from env     │     │                 │
│  rule X"        │     │    variables    │     │                 │
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

### App Definition (In Repo)

To keep the Docs Bot definition versioned alongside this plan, we store the GitHub App manifest in this repository. The app is created from the manifest, ensuring consistent configuration across environments.

**Location:** [docs/docs_handler/infra/github_app_manifest.json](docs/docs_handler/infra/github_app_manifest.json)

**Manifest includes:**

- App name, description, and public/private settings
- Required permissions (contents, issues, pull_requests, metadata)
- Webhook events (push, pull_request, issues, issue_comment)
- Webhook URL placeholder (updated during deployment)
- Setup and callback URLs for installation flow

### Setup (One-Time)

**1. Update manifest with service URL:**

Before creating the app, replace `REPLACE_WITH_SERVICE_URL` in the manifest with the actual deployed service URL (e.g., `https://doc-gov-service.azurecontainerapps.io`).

**2. Create GitHub App from manifest:**

Use the GitHub App Manifest flow to register the app:

```bash
# Navigate to: https://github.com/organizations/Wintech-Group/settings/apps/new

# When prompted for manifest, paste the contents of github_app_manifest.json
# GitHub will create the app and redirect to the configuration page
```

Alternatively, use the GitHub CLI:

```bash
gh api /organizations/Wintech-Group/app-manifests/conversions \
  --method POST \
  --field manifest=@docs/docs_handler/infra/github_app_manifest.json
```

**3. Generate and store private key:**

- On the app configuration page, scroll to "Private keys"
- Click "Generate a private key"
- Download the `.pem` file
- Base64 encode the private key for storage:

  ```bash
  # On Linux/macOS:
  base64 -i downloaded-key.pem | tr -d '\n' > encoded-key.txt

  # On Windows (PowerShell):
  [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("downloaded-key.pem")) | Out-File -Encoding ASCII encoded-key.txt
  ```

- Store the base64-encoded key as environment variable: `GITHUB_APP_PRIVATE_KEY`
- Store App ID as environment variable: `GITHUB_APP_ID`
- Store Installation ID as environment variable: `GITHUB_APP_INSTALLATION_ID`
- **Delete local copies** of both `.pem` file and `encoded-key.txt` after setting environment variables

**Security notes:**

- The private key must be base64 encoded to safely store in a single-line environment variable
- Never commit the private key or encoded key to version control
- Ensure your hosting provider's environment variables are encrypted at rest
- Rotate the key periodically (generate new key in GitHub App settings)

**4. Install on content repositories:**

- Navigate to app settings → Install App
- Select repositories (e.g., `docs-policy-governance`)
- Grant permissions when prompted

**5. Configure environment variables:**

Set the following environment variables in your hosting provider:

- `GITHUB_APP_ID` - Numeric ID from app settings (e.g., `123456`)
- `GITHUB_APP_INSTALLATION_ID` - From installation URL (e.g., `12345678`)
- `GITHUB_APP_PRIVATE_KEY` - Base64-encoded private key from step 3
- `GITHUB_WEBHOOK_SECRET` - Secret for webhook signature verification

**To decode the private key in your application:**

```typescript
// In your GitHub API client
const privateKey = Buffer.from(
  process.env.GITHUB_APP_PRIVATE_KEY!,
  "base64",
).toString("utf-8")
```

**Notes:**

- Private keys must never be committed to the repository
- The manifest can be version controlled; update it before re-registering the app
- Webhook URLs should point to the deployed central service, not localhost
- For local development, use a tool like ngrok to expose your local service, then create a separate development app
- **Detailed setup instructions:** See [github_env_setup.md](./github_env_setup.md) for complete step-by-step guide
- **Example implementation:** See [github_auth_example.ts](./github_auth_example.ts) for code examples

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

| Domain | Required Approver      | Status      | Approved By            | Date       |
| ------ | ---------------------- | ----------- | ---------------------- | ---------- |
| IT     | jane.smith@company.com | ✅ Approved | jane.smith@company.com | 2026-01-26 |
| HR     | hr.team@company.com    | ⏳ Pending  | -                      | -          |

---

_Managed by Docs Bot. Do not edit manually._
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

| Item                          | Description                              |
| ----------------------------- | ---------------------------------------- |
| `docs-policy-governance` repo | Empty content repo with folder structure |
| `policy.schema.json`          | JSON Schema for frontmatter validation   |
| Database config schema        | `config.domains` tables with seed data   |
| `metadata/governance.yaml`    | Repository workflow configuration        |
| First policy converted        | One existing PDF policy in new format    |
| Docs Bot registered           | GitHub App with webhook configuration    |

### Tasks

- [x] Create `docs-policy-governance` repository (content only, no workflows)
- [x] Create folder structure (`policies/`, `schema/`, `metadata/`, `templates/`)
- [x] Define JSON Schema for policy frontmatter
- [x] Create Supabase migration for config schema with seed domain data
- [x] Create `metadata/governance.yaml` for repository workflow configuration
- [ ] Convert one existing policy (e.g., IT Security) to frontmatter markdown
- [x] Create `policy-template.md` for new policies
- [x] Review and update `github_app_manifest.json` (webhook URL placeholder is OK for now)
- [x] Create Docs Bot from manifest using GitHub App Manifest flow
- [x] Generate and add verification for Github App secret
- [x] Install Docs Bot on `docs-policy-governance` repository (Installation ID: 107965932)
- [x] Record App ID and Installation ID for service configuration

### Validation

- [ ] Policy file passes schema validation (manual)
- [x] Docs Bot can read repository contents — **Validated:** Webhook receiving push events successfully
- [ ] Docs Bot can create a test branch and commit

---

## Phase 1: Central Service & SharePoint Pipeline

**Goal:** Deploy central service; policies authored in GitHub automatically appear as native SharePoint pages.

**Duration:** 3 weeks

**Dependencies:** Phase 0 complete

### Deliverables

| Item                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| Central service            | Deployed to Azure Container Apps                |
| Webhook endpoint           | `/webhooks/github` receiving events             |
| Push handler               | Validates, syncs to SharePoint, generates PDF   |
| SharePoint site            | Site with pages for policies                    |
| Graph API app registration | Azure AD app for SharePoint access              |
| Database config synced     | Repository config synced from `governance.yaml` |

### Tasks

- [x] Integrate `doc-governance-service` in mastra repository — **Implemented:** Webhook handler at `src/mastra/webhooks/github/`
- [x] Set up Node.js/TypeScript project structure — **Using:** Bun + TypeScript
- [x] Implement webhook signature verification
- [ ] Implement database query for repository configuration
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
- [ ] Update Docs Bot webhook URL to point to deployed service
- [x] Verify governance.yaml syncs to database on push

### Validation

- [x] Webhook received when PR merged — **Validated:** Push events received successfully (see [sample-webhook-response.txt](../../../sample-webhook-response.txt))
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

| Item                 | Description                                    |
| -------------------- | ---------------------------------------------- |
| Postgres schema      | Tables for policies, rules, embeddings         |
| Index update handler | Updates index on push webhook                  |
| Mastra tools         | `query_policies`, `get_policy`, `search_rules` |
| Embedding pipeline   | Generate embeddings for rules and prose        |

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

| Item          | Description                                             |
| ------------- | ------------------------------------------------------- |
| Mastra tool   | `submit_suggestion` (creates GitHub Issue via Docs Bot) |
| Mastra tool   | `get_my_suggestions` (lists user's suggestions)         |
| Issue handler | Notifies policy owner on new suggestion                 |
| Audit logging | Log all suggestions with user identity                  |

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

| Item                | Description                                        |
| ------------------- | -------------------------------------------------- |
| Mastra tool         | `create_change` (creates branch + PR via Docs Bot) |
| Mastra tool         | `update_change` (updates existing PR)              |
| Mastra tool         | `get_pending_approvals`                            |
| Mastra tool         | `get_change_diff`                                  |
| Mastra tool         | `approve_change`                                   |
| Mastra tool         | `reject_change`                                    |
| PR handler          | Validates schema, parses diff, adds approval table |
| Auto-merge logic    | Merges when all approvals complete                 |
| Permission checking | Validate user can perform action                   |

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

| Item                    | Description                                 |
| ----------------------- | ------------------------------------------- |
| SPFx web part           | Governance Assistant chat interface         |
| Canvas components       | Diff viewer, policy preview, edit interface |
| "Suggest Change" button | Quick access on policy pages                |
| Page template           | Standard layout for all policy pages        |

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

| Item                     | Description                          |
| ------------------------ | ------------------------------------ |
| Review reminder job      | Scheduled job for review date checks |
| Acknowledgement tracking | SharePoint List integration          |
| All policies converted   | Full policy library in new format    |
| Runbooks                 | Operational documentation            |
| Monitoring               | Logging, alerting, dashboards        |

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
| Phase 5: SharePoint Integration       | 2 weeks  | Week 12    |
| Phase 6: Production Readiness         | 2 weeks  | Week 14    |

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

| Risk                        | Mitigation                                                 |
| --------------------------- | ---------------------------------------------------------- |
| Graph API permission delays | Engage IT early; have fallback to static HTML if needed    |
| Embedding model performance | Benchmark early in Phase 2; have fallback model            |
| Complex diff rendering      | Start with text diff; enhance incrementally                |
| User adoption               | Pilot with engaged team; iterate on UX feedback            |
| Docs Bot rate limits        | Implement caching; batch operations where possible         |
| Webhook reliability         | Implement retry logic; dead letter queue for failed events |
| Service availability        | Deploy with multiple replicas; health checks               |

---

## Success Criteria by Phase

| Phase | Success Criteria                                      |
| ----- | ----------------------------------------------------- |
| 0     | One valid policy file in repo; Docs Bot working       |
| 1     | Merge in GitHub → appears in SharePoint automatically |
| 2     | Agent finds relevant policies for compliance queries  |
| 3     | Staff can suggest changes; owners get notified        |
| 4     | Full edit/approve/merge cycle works via agent         |
| 5     | Complete workflow works in SharePoint UI              |
| 6     | All policies live; system in production use           |

---

## Open Items to Resolve Before Starting

| Item                               | Owner        | Deadline       |
| ---------------------------------- | ------------ | -------------- |
| SharePoint site provisioning       | IT           | Before Phase 1 |
| Azure AD app registration approval | IT           | Before Phase 1 |
| GitHub organisation access         | IT           | Before Phase 0 |
| PDF branding requirements          | Comms/Design | Before Phase 1 |
| Domain owners list                 | Policy Team  | Before Phase 0 |
| Pilot policy selection             | Policy Team  | Before Phase 0 |
| Embedding model decision           | Duncan       | Before Phase 2 |
| Azure Container Apps provisioning  | IT           | Before Phase 1 |

---

## Future: Adding New Document Types

Once the platform is proven with policies, adding a new document type (e.g., SOPs) requires:

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

---

## Change Log

| Version | Date       | Author          | Changes                                                                                                                                         |
| ------- | ---------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-01-26 | Duncan / Claude | Initial implementation plan                                                                                                                     |
| 0.2.0   | 2026-01-26 | Duncan / Claude | Clarified Policy Bot terminology; added detailed explanation of service account approach                                                        |
| 0.3.0   | 2026-01-26 | Duncan / Claude | Renamed to Docs Bot; replaced GitHub Actions with webhook-driven central service; updated for platform model supporting multiple document types |
| 0.4.0   | 2026-02-05 | Duncan / Claude | Updated authentication to use environment variables instead of Azure Key Vault; added comprehensive setup guide and code examples               |
