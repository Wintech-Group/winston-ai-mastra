# Policy System — Mastra Agent & Tools Specification

| Attribute | Value |
|-----------|-------|
| Document Version | 0.1.0 |
| Created | 2026-01-26 |
| Last Updated | 2026-01-26 |
| Repository | `policy-system-infra` |
| Related Documents | Policy System Architecture v0.6.0, Implementation Plan v0.2.0 |
| Purpose | Define the Mastra agent, tools, and skills for the policy governance system |

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

## Repository Structure

```
policy-system-infra/
├── mastra/
│   ├── agents/
│   │   └── governance-assistant.ts
│   │
│   ├── tools/
│   │   ├── policy/
│   │   │   ├── index.ts
│   │   │   ├── query-policies.ts
│   │   │   ├── search-rules.ts
│   │   │   ├── get-policy.ts
│   │   │   ├── get-rules-by-filter.ts
│   │   │   └── find-related-policies.ts
│   │   │
│   │   ├── github/
│   │   │   ├── index.ts
│   │   │   ├── create-issue.ts
│   │   │   ├── get-issue.ts
│   │   │   ├── list-issues.ts
│   │   │   ├── create-branch.ts
│   │   │   ├── commit-file.ts
│   │   │   ├── create-pr.ts
│   │   │   ├── update-pr.ts
│   │   │   ├── get-pr.ts
│   │   │   ├── get-pr-diff.ts
│   │   │   ├── list-prs.ts
│   │   │   ├── merge-pr.ts
│   │   │   └── get-file.ts
│   │   │
│   │   └── microsoft/
│   │       ├── index.ts
│   │       ├── send-teams-message.ts
│   │       ├── send-email.ts
│   │       └── get-user-info.ts
│   │
│   └── skills/
│       └── policy-governance/
│           ├── SKILL.md
│           ├── references/
│           │   ├── approval-workflow.md
│           │   ├── domain-routing.md
│           │   └── compliance-responses.md
│           └── scripts/
│               └── validate-frontmatter.py
│
├── lib/
│   ├── github-auth.ts          # Policy Bot authentication
│   ├── graph-auth.ts           # Microsoft Graph authentication
│   └── db.ts                   # Postgres connection
│
├── db/
│   └── migrations/             # Database schema migrations
│
└── config/
    └── settings.ts             # Environment configuration
```

---

## Agent: Governance Assistant

### Definition

```typescript
// mastra/agents/governance-assistant.ts

import { Agent } from '@mastra/core';
import { policyTools } from '../tools/policy';
import { githubTools } from '../tools/github';
import { microsoftTools } from '../tools/microsoft';

export const governanceAssistant = new Agent({
  name: 'Governance Assistant',
  description: 'Helps staff understand policies, suggest changes, and manage policy workflows',
  
  tools: [
    ...policyTools,
    ...githubTools,
    ...microsoftTools,
  ],
  
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
- Attribute information to specific rule IDs when answering compliance questions

You have access to the policy-governance skill for detailed workflow guidance.`,
});
```

### User Context

The agent receives user context from the SharePoint integration:

```typescript
interface UserContext {
  email: string;                    // Azure AD email
  displayName: string;
  roles: ('staff' | 'policy_owner' | 'domain_owner' | 'admin')[];
  ownedPolicies?: string[];         // Policy IDs if policy_owner
  ownedDomains?: string[];          // Domain names if domain_owner
  currentPolicyId?: string;         // If viewing a specific policy page
}
```

This context is passed with each request and used by tools for permission checking.

---

## Tool Libraries

### Policy Tools (Specific to This System)

These tools interact with the Postgres search index and GitHub policy repository.

| Tool | Purpose | Access |
|------|---------|--------|
| `query_policies` | Hybrid search for relevant policies | All |
| `search_rules` | Semantic search on rules only | All |
| `get_policy` | Retrieve full policy content from GitHub | All |
| `get_rules_by_filter` | Filter rules by domain, severity, keywords | All |
| `find_related_policies` | Traverse policy relationships | All |

#### `query_policies`

```typescript
// mastra/tools/policy/query-policies.ts

import { Tool } from '@mastra/core';
import { db } from '../../lib/db';

export const queryPolicies = new Tool({
  name: 'query_policies',
  description: 'Search for policies relevant to a query using hybrid search (vector + keyword + metadata)',
  
  parameters: {
    query: {
      type: 'string',
      description: 'Natural language query',
      required: true,
    },
    domains: {
      type: 'array',
      items: { type: 'string' },
      description: 'Filter by domains (optional)',
      required: false,
    },
    status: {
      type: 'string',
      enum: ['active', 'draft', 'under_review', 'archived'],
      description: 'Filter by status (default: active)',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum results (default: 5)',
      required: false,
    },
  },
  
  execute: async ({ query, domains, status = 'active', limit = 5 }, context) => {
    // 1. Generate embedding for query
    // 2. Hybrid search: vector similarity + full-text + metadata filter
    // 3. Reciprocal Rank Fusion for scoring
    // 4. Return ranked policy IDs with relevance scores
    
    const results = await db.hybridSearch({
      queryEmbedding: await generateEmbedding(query),
      queryText: query,
      filters: { domains, status },
      limit,
    });
    
    return {
      policies: results.map(r => ({
        policyId: r.policy_id,
        title: r.title,
        score: r.score,
        matchedRules: r.matched_rules,
      })),
    };
  },
});
```

#### `get_policy`

```typescript
// mastra/tools/policy/get-policy.ts

import { Tool } from '@mastra/core';
import { getGitHubClient } from '../../lib/github-auth';

export const getPolicy = new Tool({
  name: 'get_policy',
  description: 'Retrieve the full content of a policy from GitHub',
  
  parameters: {
    policyId: {
      type: 'string',
      description: 'Policy ID (e.g., IT-001)',
      required: true,
    },
  },
  
  execute: async ({ policyId }, context) => {
    const github = await getGitHubClient();
    
    // Construct file path from policy ID
    const files = await github.repos.getContent({
      owner: 'company',
      repo: 'policy-governance',
      path: 'policies',
    });
    
    // Find matching policy file
    const policyFile = files.data.find(f => 
      f.name.startsWith(policyId.toLowerCase())
    );
    
    if (!policyFile) {
      return { error: `Policy ${policyId} not found` };
    }
    
    const content = await github.repos.getContent({
      owner: 'company',
      repo: 'policy-governance',
      path: policyFile.path,
    });
    
    // Decode and return full content
    const decoded = Buffer.from(content.data.content, 'base64').toString('utf-8');
    
    return {
      policyId,
      filename: policyFile.name,
      content: decoded,
    };
  },
});
```

---

### GitHub Tools (Reusable)

These tools are generic GitHub operations that can be reused by other agents/systems. They authenticate using the Policy Bot credentials.

| Tool | Purpose | Access |
|------|---------|--------|
| `create_issue` | Create a GitHub issue | All |
| `get_issue` | Get issue details | All |
| `list_issues` | List issues with filters | All |
| `create_branch` | Create a new branch | Owners |
| `commit_file` | Commit a file to a branch | Owners |
| `create_pr` | Create a pull request | Owners |
| `update_pr` | Update PR body/title | Owners |
| `get_pr` | Get PR details | All |
| `get_pr_diff` | Get PR diff content | All |
| `list_prs` | List PRs with filters | All |
| `merge_pr` | Merge a PR | System (via auto-merge) |
| `get_file` | Get file content | All |

#### `create_issue`

```typescript
// mastra/tools/github/create-issue.ts

import { Tool } from '@mastra/core';
import { getGitHubClient } from '../../lib/github-auth';

export const createIssue = new Tool({
  name: 'create_issue',
  description: 'Create a GitHub issue',
  
  parameters: {
    repo: {
      type: 'string',
      description: 'Repository name',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Issue title',
      required: true,
    },
    body: {
      type: 'string',
      description: 'Issue body (markdown)',
      required: true,
    },
    labels: {
      type: 'array',
      items: { type: 'string' },
      description: 'Labels to apply',
      required: false,
    },
  },
  
  execute: async ({ repo, title, body, labels = [] }, context) => {
    const github = await getGitHubClient();
    
    // Add attribution to body
    const attributedBody = `${body}

---
*Submitted by: ${context.user.email}*
*Via: Governance Assistant*`;
    
    const issue = await github.issues.create({
      owner: 'company',
      repo,
      title,
      body: attributedBody,
      labels,
    });
    
    return {
      issueNumber: issue.data.number,
      url: issue.data.html_url,
    };
  },
});
```

#### `create_pr`

```typescript
// mastra/tools/github/create-pr.ts

import { Tool } from '@mastra/core';
import { getGitHubClient } from '../../lib/github-auth';

export const createPr = new Tool({
  name: 'create_pr',
  description: 'Create a pull request',
  
  parameters: {
    repo: {
      type: 'string',
      description: 'Repository name',
      required: true,
    },
    title: {
      type: 'string',
      description: 'PR title',
      required: true,
    },
    body: {
      type: 'string',
      description: 'PR body (markdown)',
      required: true,
    },
    head: {
      type: 'string',
      description: 'Source branch',
      required: true,
    },
    base: {
      type: 'string',
      description: 'Target branch (default: main)',
      required: false,
    },
  },
  
  execute: async ({ repo, title, body, head, base = 'main' }, context) => {
    const github = await getGitHubClient();
    
    const pr = await github.pulls.create({
      owner: 'company',
      repo,
      title,
      body,
      head,
      base,
    });
    
    return {
      prNumber: pr.data.number,
      url: pr.data.html_url,
    };
  },
});
```

---

### Microsoft Tools (Reusable)

These tools interact with Microsoft 365 via Graph API.

| Tool | Purpose | Access |
|------|---------|--------|
| `send_teams_message` | Send a Teams chat/channel message | System |
| `send_email` | Send an email | System |
| `get_user_info` | Get user details from Azure AD | All |

#### `send_teams_message`

```typescript
// mastra/tools/microsoft/send-teams-message.ts

import { Tool } from '@mastra/core';
import { getGraphClient } from '../../lib/graph-auth';

export const sendTeamsMessage = new Tool({
  name: 'send_teams_message',
  description: 'Send a message via Microsoft Teams',
  
  parameters: {
    recipientEmail: {
      type: 'string',
      description: 'Recipient email address',
      required: true,
    },
    message: {
      type: 'string',
      description: 'Message content (markdown supported)',
      required: true,
    },
  },
  
  execute: async ({ recipientEmail, message }, context) => {
    const graph = await getGraphClient();
    
    // Send via Teams chat
    // Implementation depends on Teams setup (1:1 chat vs bot)
    
    return { sent: true };
  },
});
```

---

## Skill: policy-governance

The skill provides domain knowledge for the Governance Assistant — workflows, procedures, and guidance that the agent references when handling policy operations.

### SKILL.md

```markdown
---
name: policy-governance
description: |
  Domain knowledge for policy governance workflows. Use when handling:
  - Policy compliance questions (what rules apply to a situation)
  - Policy change suggestions from staff
  - Policy editing by owners
  - Approval workflows for policy changes
  - Policy status reporting and review reminders
---

# Policy Governance Skill

## Answering Compliance Questions

For questions like "Can I do X?" or "What are the rules about Y?":

1. Use `query_policies` to find relevant policies (hybrid search)
2. Use `get_policy` to load FULL content of top matches (do not rely on snippets)
3. Read the complete policy including prose for context
4. Cite specific rule IDs in your answer (e.g., "Per IT-001-R003...")
5. Note any exceptions that might apply
6. If uncertain, acknowledge limitations and suggest contacting the policy owner

**Critical:** Accuracy matters for compliance. Always load full policies, never guess.

See [references/compliance-responses.md](references/compliance-responses.md) for response patterns.

## Handling Suggestions

When a staff member wants to suggest a policy change:

1. Identify which policy they're referring to
2. Capture what they want to change and why
3. Use `create_issue` to submit the suggestion:
   - Repo: `policy-governance`
   - Labels: `suggestion`, `policy:{policy-id}`
   - Body: Include the change request and rationale
4. Confirm submission and explain next steps (owner will review)

## Editing Policies (Owners Only)

When a policy owner wants to make a change:

1. Verify the user is an owner of the policy (check `context.ownedPolicies`)
2. Retrieve current policy with `get_policy`
3. Help them articulate the change
4. Create branch: `policy/{policy-id}-{short-description}`
5. Commit updated file with `commit_file`
6. Create PR with `create_pr` including approval table

See [references/approval-workflow.md](references/approval-workflow.md) for PR format.

## Approval Workflow

When a domain owner needs to approve changes:

1. Use `list_prs` filtered by label `needs-review:{domain}`
2. For each PR, use `get_pr_diff` to show changes
3. Present changes clearly in the canvas/artifact area
4. When they approve, update the PR body approval table
5. Add a comment recording the approval
6. If all approvals complete, the auto-merge workflow handles the rest

See [references/domain-routing.md](references/domain-routing.md) for routing rules.

## Permission Model

| Action | Required Role |
|--------|---------------|
| Query policies | Any staff |
| Submit suggestion | Any staff |
| View own suggestions | Any staff |
| Edit policy | Policy owner (for that policy) |
| Approve changes | Domain owner (for affected domains) |
| View all status | Admin |

Always check `context.roles` and `context.ownedPolicies`/`context.ownedDomains` before executing privileged operations.
```

### references/approval-workflow.md

```markdown
# Approval Workflow Reference

## PR Body Format

When creating a PR for policy changes, use this format:

~~~markdown
## Summary

Brief description of what changed and why.

## Changes

- Modified rule IT-001-R003: Updated encryption requirement
- Added new exception for marketing devices

## Approval Status

| Domain | Required Approver | Status | Approved By | Date |
|--------|-------------------|--------|-------------|------|
| IT | it.security@company.com | ⏳ Pending | - | - |
| HR | hr.team@company.com | ⏳ Pending | - | - |

---
*Managed by Policy Bot. Do not edit manually.*

## Metadata

- Requested by: jane.smith@company.com
- Policy: IT-001
- Request ID: suggestion-12345
~~~

## Recording Approvals

When a domain owner approves:

1. Update the approval table row:
   - Status: `✅ Approved`
   - Approved By: `{approver email}`
   - Date: `{ISO date}`

2. Add a comment:
   ```
   ✅ Approved by @jane.smith@company.com for domain IT
   
   Recorded: 2026-01-26T14:30:00Z
   ```

3. If all domains approved, add label `ready-to-merge`

## Recording Rejections

When a domain owner rejects:

1. Update the approval table row:
   - Status: `❌ Rejected`

2. Add a comment with the reason:
   ```
   ❌ Rejected by @jane.smith@company.com for domain IT
   
   Reason: The proposed exception is too broad. Please narrow the scope.
   
   Recorded: 2026-01-26T14:30:00Z
   ```

3. Notify the PR author to revise
```

### references/domain-routing.md

```markdown
# Domain Routing Reference

## Determining Required Approvers

When a policy change is submitted:

1. Parse the PR diff to identify changed rules
2. Extract the `domain` field from each changed rule
3. Look up domain owners from `metadata/domains.yaml` in the policy repo
4. Add each unique domain owner to the approval table

## domains.yaml Format

```yaml
domains:
  IT:
    name: Information Technology
    owners:
      - it.security@company.com
      - cto@company.com
    
  HR:
    name: Human Resources
    owners:
      - hr.director@company.com
      - hr.team@company.com
    
  Finance:
    name: Finance
    owners:
      - cfo@company.com
      - finance.team@company.com
    
  Legal:
    name: Legal & Compliance
    owners:
      - legal@company.com
```

## Routing Logic

1. If a rule's domain is in domains.yaml → require approval from that domain's owners
2. If a rule's domain is NOT in domains.yaml → require approval from policy owner only
3. If only prose changed (no rule changes) → require approval from policy owner only
4. Policy owner is always implicitly approved (they created the PR)

## Cross-Domain Changes

If a change affects rules in multiple domains (e.g., IT and HR):
- ALL affected domains must approve
- PR cannot merge until all approvals received
- Any rejection blocks the PR
```

### references/compliance-responses.md

```markdown
# Compliance Response Patterns

## Standard Compliance Answer

When answering "Can I do X?" questions:

```
Based on [Policy Name] (specifically rule {rule-id}):

{Clear yes/no/conditional answer}

{Brief explanation of the rule}

{Any relevant exceptions}

{Next steps if action required}
```

## Example Response

User: "Can I take my laptop to China for a client visit?"

```
Based on the Information Security Policy and Travel Policy:

**You can, but with conditions:**

1. Per IT-001-R007 (MUST): Devices taken to high-risk jurisdictions 
   require a pre-travel security assessment. China is classified as 
   high-risk under SEC-001-R003.

2. Per HR-001-R012 (MUST): Travel to restricted territories requires 
   approval 14 days in advance.

3. Per IT-001-R009 (MUST NOT): Devices containing [sensitive data 
   classification] cannot be taken to China. You'll need a clean 
   travel device from IT.

**Actions needed:**
- Submit travel request (at least 14 days before)
- Request a travel device from IT Support
- Complete the pre-travel security briefing

Would you like me to help start the travel request?
```

## When Uncertain

If search results are inconclusive:

```
I couldn't find a definitive answer in our policies for this 
specific situation.

These policies might be relevant:
- [Information Security Policy](/sites/policies/SitePages/IT-001-information-security.aspx)
- [Travel Policy](/sites/policies/SitePages/HR-001-travel.aspx)

You can browse all policies here: [Policy Library](/sites/policies)

Or contact [Policy Owner Name] (policy.owner@company.com) for 
clarification on this specific case.
```

## Never Do

- Guess at policy interpretations
- Say "probably" or "I think" for compliance questions
- Provide answers without citing specific rules
- Assume a rule exists without verifying
```

---

## Composite Tools (Policy-Specific Workflows)

Some workflows combine multiple tools. These can be implemented as higher-level tools or handled by the agent with skill guidance.

### `submit_suggestion` (Composite)

Combines: validation + `create_issue` + audit logging

```typescript
// mastra/tools/policy/submit-suggestion.ts

import { Tool } from '@mastra/core';
import { createIssue } from '../github/create-issue';
import { db } from '../../lib/db';

export const submitSuggestion = new Tool({
  name: 'submit_suggestion',
  description: 'Submit a policy change suggestion (creates GitHub issue and logs to audit)',
  
  parameters: {
    policyId: {
      type: 'string',
      description: 'Policy ID to suggest change for',
      required: true,
    },
    summary: {
      type: 'string',
      description: 'Brief summary of suggested change',
      required: true,
    },
    details: {
      type: 'string',
      description: 'Detailed description of the change and rationale',
      required: true,
    },
  },
  
  execute: async ({ policyId, summary, details }, context) => {
    // Create GitHub issue
    const issue = await createIssue.execute({
      repo: 'policy-governance',
      title: `[Suggestion] ${policyId}: ${summary}`,
      body: `## Suggested Change

${details}

## Policy
${policyId}

## Submitted By
${context.user.email}`,
      labels: ['suggestion', `policy:${policyId}`],
    }, context);
    
    // Audit log
    await db.auditLog.insert({
      action: 'suggestion_submitted',
      user: context.user.email,
      policyId,
      issueNumber: issue.issueNumber,
      timestamp: new Date(),
    });
    
    return {
      success: true,
      issueNumber: issue.issueNumber,
      issueUrl: issue.url,
      message: `Suggestion submitted successfully. The policy owner will be notified.`,
    };
  },
});
```

### `approve_change` (Composite)

Combines: permission check + `update_pr` + `create_issue_comment` + audit logging

```typescript
// mastra/tools/policy/approve-change.ts

import { Tool } from '@mastra/core';
import { getPr, updatePr } from '../github';
import { db } from '../../lib/db';

export const approveChange = new Tool({
  name: 'approve_change',
  description: 'Approve a policy change PR for a specific domain',
  
  parameters: {
    prNumber: {
      type: 'number',
      description: 'PR number to approve',
      required: true,
    },
    domain: {
      type: 'string',
      description: 'Domain being approved for',
      required: true,
    },
    comment: {
      type: 'string',
      description: 'Optional approval comment',
      required: false,
    },
  },
  
  execute: async ({ prNumber, domain, comment }, context) => {
    // Check permission
    if (!context.user.ownedDomains?.includes(domain)) {
      return {
        success: false,
        error: `You are not an owner of the ${domain} domain`,
      };
    }
    
    // Get current PR
    const pr = await getPr.execute({ 
      repo: 'policy-governance', 
      prNumber 
    }, context);
    
    // Update approval table in PR body
    const updatedBody = updateApprovalTable(pr.body, {
      domain,
      status: '✅ Approved',
      approvedBy: context.user.email,
      date: new Date().toISOString().split('T')[0],
    });
    
    await updatePr.execute({
      repo: 'policy-governance',
      prNumber,
      body: updatedBody,
    }, context);
    
    // Add comment
    await createIssueComment.execute({
      repo: 'policy-governance',
      issueNumber: prNumber,
      body: `✅ Approved by ${context.user.email} for domain ${domain}

${comment ? `Comment: ${comment}` : ''}

Recorded: ${new Date().toISOString()}`,
    }, context);
    
    // Audit log
    await db.auditLog.insert({
      action: 'change_approved',
      user: context.user.email,
      prNumber,
      domain,
      timestamp: new Date(),
    });
    
    // Check if all approvals complete
    const allApproved = checkAllApproved(updatedBody);
    if (allApproved) {
      // Add ready-to-merge label (auto-merge workflow will handle)
      await addLabel.execute({
        repo: 'policy-governance',
        issueNumber: prNumber,
        labels: ['ready-to-merge'],
      }, context);
    }
    
    return {
      success: true,
      allApproved,
      message: allApproved 
        ? 'All approvals received. The change will be merged automatically.'
        : 'Approval recorded. Waiting for other domain approvals.',
    };
  },
});
```

---

## Tool Index

### Policy Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `query_policies` | Hybrid search for policies | `query`, `domains?`, `status?`, `limit?` |
| `search_rules` | Semantic search on rules | `query`, `severity?`, `domain?`, `limit?` |
| `get_policy` | Get full policy content | `policyId` |
| `get_rules_by_filter` | Filter rules by criteria | `domain?`, `severity?`, `policyId?` |
| `find_related_policies` | Get related policies | `policyId` |
| `submit_suggestion` | Submit a change suggestion | `policyId`, `summary`, `details` |
| `get_my_suggestions` | List user's suggestions | `status?` |
| `create_change` | Create branch + PR for edit | `policyId`, `changes`, `summary` |
| `update_change` | Update existing PR | `prNumber`, `changes` |
| `get_pending_approvals` | List PRs needing user's approval | - |
| `get_change_diff` | Get PR diff | `prNumber` |
| `approve_change` | Approve a PR | `prNumber`, `domain`, `comment?` |
| `reject_change` | Reject a PR | `prNumber`, `domain`, `reason` |
| `get_policy_status` | List policies with status | `filter?` |

### GitHub Tools (Generic)

| Tool | Description | Parameters |
|------|-------------|------------|
| `create_issue` | Create issue | `repo`, `title`, `body`, `labels?` |
| `get_issue` | Get issue details | `repo`, `issueNumber` |
| `list_issues` | List issues | `repo`, `labels?`, `state?`, `creator?` |
| `create_branch` | Create branch | `repo`, `branchName`, `fromRef?` |
| `commit_file` | Commit file | `repo`, `branch`, `path`, `content`, `message` |
| `create_pr` | Create PR | `repo`, `title`, `body`, `head`, `base?` |
| `update_pr` | Update PR | `repo`, `prNumber`, `title?`, `body?` |
| `get_pr` | Get PR details | `repo`, `prNumber` |
| `get_pr_diff` | Get PR diff | `repo`, `prNumber` |
| `list_prs` | List PRs | `repo`, `state?`, `labels?` |
| `merge_pr` | Merge PR | `repo`, `prNumber`, `mergeMethod?` |
| `get_file` | Get file content | `repo`, `path`, `ref?` |

### Microsoft Tools (Generic)

| Tool | Description | Parameters |
|------|-------------|------------|
| `send_teams_message` | Send Teams message | `recipientEmail`, `message` |
| `send_email` | Send email | `to`, `subject`, `body` |
| `get_user_info` | Get Azure AD user info | `email` |

---

## Authentication

### Policy Bot (GitHub)

```typescript
// lib/github-auth.ts

import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { getSecret } from './keyvault';

let octokitInstance: Octokit | null = null;

export async function getGitHubClient(): Promise<Octokit> {
  if (octokitInstance) return octokitInstance;
  
  const privateKey = await getSecret('GITHUB_APP_PRIVATE_KEY');
  const appId = await getSecret('GITHUB_APP_ID');
  const installationId = await getSecret('GITHUB_INSTALLATION_ID');
  
  octokitInstance = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
  
  return octokitInstance;
}
```

### Microsoft Graph

```typescript
// lib/graph-auth.ts

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { getSecret } from './keyvault';

export async function getGraphClient(): Promise<Client> {
  const tenantId = await getSecret('AZURE_TENANT_ID');
  const clientId = await getSecret('AZURE_CLIENT_ID');
  const clientSecret = await getSecret('AZURE_CLIENT_SECRET');
  
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  
  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        return token.token;
      },
    },
  });
}
```

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-01-26 | Duncan / Claude | Initial agent and tools specification |
