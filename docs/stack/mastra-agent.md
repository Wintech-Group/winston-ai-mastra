# Mastra Agent & Tools

> Specification for the Governance Assistant agent and its tool libraries.

| Attribute        | Value                       |
| ---------------- | --------------------------- |
| Document Version | 1.0.0                       |
| Last Updated     | 2026-02-13                  |
| Framework        | [Mastra](https://mastra.ai) |
| Agent Name       | Governance Assistant        |

---

## Overview

The policy governance system uses a single Mastra agent — the **Governance Assistant** — equipped with tools for policy operations, GitHub operations, and Microsoft 365 integration. Domain knowledge is provided via a Mastra skill.

```
┌─────────────────────────────────────────────────────────────────┐
│                   Governance Assistant Agent                     │
│                                                                  │
│  Responsibilities:                                               │
│  • Answer policy compliance questions                            │
│  • Help staff suggest changes                                    │
│  • Help owners edit policies                                     │
│  • Facilitate approval workflows                                 │
│  • Provide policy status and reporting                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Skill: policy-governance                                        │
│  (Domain knowledge, workflows, procedures)                       │
├─────────────────────────────────────────────────────────────────┤
│  Tools                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Policy      │  │ GitHub      │  │ Microsoft   │              │
│  │ Tools       │  │ Tools       │  │ Tools       │              │
│  │ (specific)  │  │ (reusable)  │  │ (reusable)  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Definition

```typescript
import { Agent } from "@mastra/core"
import { policyTools } from "../tools/policy"
import { githubTools } from "../tools/github"
import { microsoftTools } from "../tools/microsoft"

export const governanceAssistant = new Agent({
  name: "Governance Assistant",
  description:
    "Helps staff understand policies, suggest changes, and manage policy workflows",
  tools: [...policyTools, ...githubTools, ...microsoftTools],
  systemPrompt: `You are the Governance Assistant, helping staff with company policies.

Your responsibilities:
- Answer questions about policies accurately, citing specific rules
- Help any staff member suggest policy changes
- Help policy owners edit and update policies
- Facilitate the approval workflow for policy changes
- Provide status updates on suggestions and pending approvals

Key principles:
- Accuracy is critical for compliance questions — always retrieve full policy context
- Be helpful but never guess at policy interpretations
- When uncertain, direct users to policy owners or the SharePoint site
- Attribute information to specific rule IDs when answering compliance questions`,
})
```

### User Context

The agent receives user context from the browser extension:

```typescript
interface UserContext {
  email: string // Azure AD email
  displayName: string
  roles: ("staff" | "policy_owner" | "domain_owner" | "admin")[]
  ownedPolicies?: string[] // Policy IDs if policy_owner
  ownedDomains?: string[] // Domain names if domain_owner
  currentPolicyId?: string // If viewing a specific policy page
}
```

---

## Tool Libraries

### Policy Tools (System-Specific)

These tools interact with Postgres (hybrid search) and GitHub (policy content).

| Tool                    | Purpose                                    | Access        |
| ----------------------- | ------------------------------------------ | ------------- |
| `query_policies`        | Hybrid search for relevant policies        | All           |
| `search_rules`          | Semantic search on rules only              | All           |
| `get_policy`            | Retrieve full policy content from GitHub   | All           |
| `get_rules_by_filter`   | Filter rules by domain, severity, keywords | All           |
| `find_related_policies` | Traverse policy relationships              | All           |
| `submit_suggestion`     | Create GitHub Issue with suggestion        | All           |
| `get_my_suggestions`    | List user's submitted suggestions          | All           |
| `get_pending_approvals` | List PRs awaiting user's approval          | Owners        |
| `get_change_diff`       | Retrieve diff for a PR                     | Owners        |
| `approve_change`        | Approve a PR for a domain                  | Owners        |
| `reject_change`         | Reject a PR with comment                   | Owners        |
| `create_change`         | Create branch + PR with proposed edits     | Policy owners |
| `update_change`         | Update an existing PR                      | Policy owners |
| `get_policy_status`     | List policies with review status           | Owners/Admins |
| `detect_conflicts`      | Analyse rules for contradictions           | Owners/Admins |

#### `query_policies` — Hybrid Search

```typescript
export const queryPolicies = new Tool({
  name: "query_policies",
  description:
    "Search for policies relevant to a query using hybrid search (vector + keyword + metadata)",
  parameters: {
    query: {
      type: "string",
      description: "Natural language query",
      required: true,
    },
    domains: {
      type: "array",
      items: { type: "string" },
      description: "Filter by domains",
      required: false,
    },
    status: {
      type: "string",
      enum: ["active", "draft", "under_review", "superseded", "archived"],
      required: false,
    },
    limit: {
      type: "number",
      description: "Maximum results (default: 5)",
      required: false,
    },
  },
  execute: async (
    { query, domains, status = "active", limit = 5 },
    context,
  ) => {
    const results = await db.hybridSearch({
      queryEmbedding: await generateEmbedding(query),
      queryText: query,
      filters: { domains, status },
      limit,
    })
    return {
      policies: results.map((r) => ({
        policyId: r.policy_id,
        title: r.title,
        score: r.score,
        matchedRules: r.matched_rules,
      })),
    }
  },
})
```

#### `submit_suggestion` — Composite Tool

Combines validation + GitHub Issue creation + audit logging:

```typescript
export const submitSuggestion = new Tool({
  name: "submit_suggestion",
  description:
    "Submit a policy change suggestion (creates GitHub issue and logs to audit)",
  parameters: {
    policyId: { type: "string", required: true },
    summary: { type: "string", required: true },
    details: { type: "string", required: true },
  },
  execute: async ({ policyId, summary, details }, context) => {
    const issue = await createIssue.execute(
      {
        repo: "policy-governance",
        title: `[Suggestion] ${policyId}: ${summary}`,
        body: `## Suggested Change\n\n${details}\n\n## Policy\n${policyId}\n\n## Submitted By\n${context.user.email}`,
        labels: ["suggestion", `policy:${policyId}`],
      },
      context,
    )

    await db.auditLog.insert({
      action: "suggestion_submitted",
      user: context.user.email,
      policyId,
      issueNumber: issue.issueNumber,
      timestamp: new Date(),
    })

    return {
      success: true,
      issueNumber: issue.issueNumber,
      issueUrl: issue.url,
    }
  },
})
```

#### `approve_change` — Composite Tool

Combines permission check + PR update + audit logging:

```typescript
export const approveChange = new Tool({
  name: "approve_change",
  description: "Approve a policy change PR for a specific domain",
  parameters: {
    prNumber: { type: "number", required: true },
    domain: { type: "string", required: true },
    comment: { type: "string", required: false },
  },
  execute: async ({ prNumber, domain, comment }, context) => {
    if (!context.user.ownedDomains?.includes(domain)) {
      return {
        success: false,
        error: `You are not an owner of the ${domain} domain`,
      }
    }

    const pr = await getPr.execute(
      { repo: "policy-governance", prNumber },
      context,
    )
    const updatedBody = updateApprovalTable(pr.body, {
      domain,
      status: "✅ Approved",
      approvedBy: context.user.email,
      date: new Date().toISOString().split("T")[0],
    })

    await updatePr.execute(
      { repo: "policy-governance", prNumber, body: updatedBody },
      context,
    )
    await db.auditLog.insert({
      action: "change_approved",
      user: context.user.email,
      prNumber,
      domain,
      timestamp: new Date(),
    })

    const allApproved = checkAllApproved(updatedBody)
    if (allApproved) {
      await addLabel.execute(
        {
          repo: "policy-governance",
          issueNumber: prNumber,
          labels: ["ready-to-merge"],
        },
        context,
      )
    }

    return { success: true, allApproved }
  },
})
```

### GitHub Tools (Reusable)

Generic GitHub operations authenticated via the Docs Bot. Can be reused by other agents.

| Tool            | Purpose           | Parameters                                     |
| --------------- | ----------------- | ---------------------------------------------- |
| `create_issue`  | Create issue      | `repo`, `title`, `body`, `labels?`             |
| `get_issue`     | Get issue details | `repo`, `issueNumber`                          |
| `list_issues`   | List issues       | `repo`, `labels?`, `state?`, `creator?`        |
| `create_branch` | Create branch     | `repo`, `branchName`, `fromRef?`               |
| `commit_file`   | Commit file       | `repo`, `branch`, `path`, `content`, `message` |
| `create_pr`     | Create PR         | `repo`, `title`, `body`, `head`, `base?`       |
| `update_pr`     | Update PR         | `repo`, `prNumber`, `title?`, `body?`          |
| `get_pr`        | Get PR details    | `repo`, `prNumber`                             |
| `get_pr_diff`   | Get PR diff       | `repo`, `prNumber`                             |
| `list_prs`      | List PRs          | `repo`, `state?`, `labels?`                    |
| `merge_pr`      | Merge PR          | `repo`, `prNumber`, `mergeMethod?`             |
| `get_file`      | Get file content  | `repo`, `path`, `ref?`                         |

### Microsoft Tools (Reusable)

Interact with Microsoft 365 via Graph API.

| Tool                 | Purpose                | Parameters                  |
| -------------------- | ---------------------- | --------------------------- |
| `send_teams_message` | Send Teams message     | `recipientEmail`, `message` |
| `send_email`         | Send email             | `to`, `subject`, `body`     |
| `get_user_info`      | Get Azure AD user info | `email`                     |

---

## Skill: policy-governance

The skill provides domain knowledge — workflows, procedures, and response patterns.

### Answering Compliance Questions

1. Use `query_policies` to find relevant policies (hybrid search)
2. Use `get_policy` to load FULL content of top matches
3. Read the complete policy including prose for context
4. Cite specific rule IDs in answers (e.g., "Per IT-001-R003...")
5. Note any exceptions that might apply
6. If uncertain, acknowledge limitations and suggest contacting the policy owner

### Handling Suggestions

1. Identify which policy they're referring to
2. Capture what they want to change and why
3. Use `create_issue` with labels `suggestion`, `policy:{id}`
4. Confirm submission and explain next steps

### Editing Policies (Owners Only)

1. Verify user is a policy owner (`context.ownedPolicies`)
2. Retrieve current policy with `get_policy`
3. Create branch: `policy/{policy-id}-{short-description}`
4. Commit updated file, create PR with approval table

### Approval Workflow

1. Use `list_prs` filtered by label `needs-review:{domain}`
2. Present changes via `get_pr_diff`
3. Record approval/rejection in PR body
4. If all approvals complete, add `ready-to-merge` label

### Permission Model

| Action               | Required Role                       |
| -------------------- | ----------------------------------- |
| Query policies       | Any staff                           |
| Submit suggestion    | Any staff                           |
| View own suggestions | Any staff                           |
| Edit policy          | Policy owner (for that policy)      |
| Approve changes      | Domain owner (for affected domains) |
| View all status      | Admin                               |

---

## Repository Structure (Target)

```
src/mastra/
├── agents/
│   └── governance-assistant.ts
├── tools/
│   ├── policy/
│   │   ├── index.ts
│   │   ├── query-policies.ts
│   │   ├── search-rules.ts
│   │   ├── get-policy.ts
│   │   ├── get-rules-by-filter.ts
│   │   ├── find-related-policies.ts
│   │   ├── submit-suggestion.ts
│   │   └── approve-change.ts
│   ├── github/
│   │   ├── index.ts
│   │   ├── create-issue.ts
│   │   ├── create-branch.ts
│   │   ├── commit-file.ts
│   │   ├── create-pr.ts
│   │   └── ...
│   └── microsoft/
│       ├── index.ts
│       ├── send-teams-message.ts
│       ├── send-email.ts
│       └── get-user-info.ts
└── skills/
    └── policy-governance/
        ├── SKILL.md
        └── references/
            ├── approval-workflow.md
            ├── domain-routing.md
            └── compliance-responses.md
```

---

## Authentication

Authentication for GitHub and Microsoft Graph APIs. See also [github-app.md](github-app.md) and [reference/github-auth-example.ts](../reference/github-auth-example.ts).

### GitHub (Docs Bot)

```typescript
import { createAppAuth } from "@octokit/auth-app"
import { Octokit } from "@octokit/rest"

export async function getGitHubClient(): Promise<Octokit> {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID,
      privateKey: Buffer.from(
        process.env.GITHUB_APP_PRIVATE_KEY!,
        "base64",
      ).toString("utf-8"),
      installationId: process.env.GITHUB_APP_INSTALLATION_ID,
    },
  })
}
```

### Microsoft Graph

```typescript
import { ClientSecretCredential } from "@azure/identity"
import { Client } from "@microsoft/microsoft-graph-client"

export async function getGraphClient(): Promise<Client> {
  const credential = new ClientSecretCredential(
    process.env.AZURE_TENANT_ID!,
    process.env.AZURE_CLIENT_ID!,
    process.env.AZURE_CLIENT_SECRET!,
  )
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken(
          "https://graph.microsoft.com/.default",
        )
        return token.token
      },
    },
  })
}
```
