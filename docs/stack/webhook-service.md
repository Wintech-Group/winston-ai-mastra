# Webhook Service (Central Service)

> Hono-based API handling GitHub webhooks and driving all automation pipelines.

| Attribute        | Value                    |
| ---------------- | ------------------------ |
| Document Version | 1.0.0                    |
| Last Updated     | 2026-02-13               |
| Framework        | [Hono](https://hono.dev) |
| Runtime          | Bun / Node >= 22.13.0    |

---

## Overview

All automation is handled by a central webhook service. Content repositories contain no workflow files — adding a new document type requires only installing the GitHub App and adding a `governance.yaml` configuration entry.

The service receives GitHub webhooks and routes them to the appropriate handler based on event type and source repository.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Central Service                           │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ POST /webhooks/github                                      │  │
│  │                                                            │  │
│  │  1. Verify webhook signature                               │  │
│  │  2. Identify source repo → document type config            │  │
│  │  3. Route to appropriate handler                           │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │ PR Handler  │   │ Push Handler│   │ Issue       │           │
│  │             │   │             │   │ Handler     │           │
│  │ • Validate  │   │ • Sync SP   │   │             │           │
│  │ • Route     │   │ • Gen PDF   │   │ • Track     │           │
│  │   approvals │   │ • Update    │   │   suggestion│           │
│  │ • Update PR │   │   index     │   │ • Notify    │           │
│  │   body      │   │ • Sync      │   │   owner     │           │
│  └─────────────┘   │   config    │   └─────────────┘           │
│                     └─────────────┘                              │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Scheduled Jobs (internal cron)                             │  │
│  │ • Review reminder check (daily)                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Webhook Events

| Event                        | Trigger       | Actions                                                            |
| ---------------------------- | ------------- | ------------------------------------------------------------------ |
| `push` (to main)             | PR merged     | Sync to SharePoint, generate PDF, update search index, sync config |
| `pull_request` (opened)      | PR created    | Validate schema, identify domains, add approval table              |
| `pull_request` (synchronize) | PR updated    | Re-validate, update approval table if needed                       |
| `issue_comment` (created)    | Comment added | Check for approval commands                                        |
| `issues` (opened)            | Issue created | Track as suggestion, notify policy owner                           |

---

## Push Handler (On Merge)

When a PR is merged to `main`:

1. **Identify changed files** from the push webhook payload
2. **Check if `governance.yaml` changed** → sync config to database
3. **For each changed policy file:**
   - Sync to SharePoint (create/update native page via Graph API)
   - Generate PDF (archive previous version, upload new)
   - Update search index (re-embed changed policy only)

### Config Sync Logic

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
    const config = await fetchFile(
      repoFullName,
      "metadata/governance.yaml",
      "main",
    )
    await syncRepoConfig(repoFullName, config, webhook.head_commit.id)
  }

  // Continue with normal push handling
  await syncSharePoint(webhook)
  await generatePDFs(webhook)
  await updateSearchIndex(webhook)
}
```

---

## PR Handler (On Open/Update)

When a PR is opened or updated:

1. **Get repository config** from database (fast lookup, no GitHub API call)
2. **Validate policy schema** against JSON Schema
3. **Parse diff** to identify which rules changed and their domains
4. **Query database for domain owners** (`config.domain_owners`)
5. **Check cross-domain rules** (`config.cross_domain_rules`)
6. **Update PR body** with approval table listing required approvers
7. **Send notifications** to domain owners per repository config

```typescript
async function handlePR(webhook: PRWebhook) {
  const repoFullName = webhook.repository.full_name

  // Fast lookup from database
  const config = await db.repositoryConfig.findUnique({
    where: { repo_full_name: repoFullName },
  })

  if (!config?.approval_required) return

  // Validate schema
  const errors = await validatePolicySchema(webhook)
  if (errors.length > 0) {
    await addPRComment(
      repoFullName,
      webhook.pull_request.number,
      formatErrors(errors),
    )
    return
  }

  // Identify affected domains from diff
  const affectedDomains = await parseAffectedDomains(webhook)

  // Query database for owners
  const owners = await db.domainOwners.findMany({
    where: { domain_id: { in: affectedDomains } },
    include: { domain: true },
  })

  // Update PR with approval table
  await updatePRApprovalTable(
    repoFullName,
    webhook.pull_request.number,
    owners,
    config,
  )

  // Notify
  if (config.notify_on_pr_open) {
    await sendApprovalNotifications(owners, webhook, config)
  }
}
```

### Approval Table Format

The PR body is updated with a table tracking required approvals:

```markdown
## Approval Status

| Domain | Required Approver       | Status     | Approved By | Date |
| ------ | ----------------------- | ---------- | ----------- | ---- |
| IT     | it.security@company.com | ⏳ Pending | -           | -    |
| HR     | hr.team@company.com     | ⏳ Pending | -           | -    |

---

_Managed by Docs Bot. Do not edit manually._
```

When a domain owner approves (via the chat agent), their row is updated:

- Status: `✅ Approved`
- Approved By: email
- Date: ISO date

When all rows show approved, the `ready-to-merge` label is added.

---

## Issue Handler

When a GitHub Issue is created with the `suggestion` label:

1. Track the suggestion in the audit log
2. Notify the relevant policy owner(s) via Teams/email
3. Add a comment confirming receipt

---

## Review Reminder Job

Scheduled daily:

1. Query all policies where `review_date` is approaching
2. Send reminders to owners (configurable: 30 days, 14 days, 7 days before)
3. For overdue policies:
   - Create a GitHub Issue
   - Mark status as "Review Overdue"
   - Escalate per escalation path

---

## Webhook Signature Verification

All inbound webhooks must be verified:

```typescript
import { createHmac, timingSafeEqual } from "crypto"

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = createHmac("sha256", secret)
  const digest = "sha256=" + hmac.update(payload).digest("hex")
  return timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}
```

---

## Benefits of Central Service

| Benefit                   | Explanation                                             |
| ------------------------- | ------------------------------------------------------- |
| Zero duplication          | All automation logic in one place                       |
| Simple onboarding         | New doc type = install GitHub App + add governance.yaml |
| Declarative content repos | Repos contain only content + config declaration         |
| Fast PR handling          | Database lookup vs GitHub API calls for config          |
| Centralised logging       | All events processed through single service             |
| Atomic config             | Change database config, applies immediately             |

---

## Sample Webhook Payload

See [reference/sample-webhook-payload.txt](../reference/sample-webhook-payload.txt) for a complete example of a `push` event webhook payload from the `docs-policy-governance` repository.
