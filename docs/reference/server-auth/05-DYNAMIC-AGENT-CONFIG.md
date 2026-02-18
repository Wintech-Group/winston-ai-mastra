# Dynamic Agent Configuration

## Overview

This document describes how to configure the orchestrator agent to dynamically filter its available tools, sub-agents, and workflows based on the authenticated user's permissions. The key insight is that Mastra agent configuration options (`tools`, `agents`, `workflows`, `instructions`) can be **async functions** that receive `requestContext`, enabling runtime filtering.

## Why Dynamic Configuration?

When a user lacks permission to access a resource:

| Approach | User Experience | Security |
|----------|-----------------|----------|
| Return "Access Denied" | Reveals resource exists | Information leakage |
| **Dynamic filtering** | Resource doesn't exist | Security by omission |

With dynamic configuration, the orchestrator LLM never sees restricted resources—they simply don't exist in its context for that request.

## Implementation

### File: `src/mastra/agents/orchestrator.ts`

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import type { RequestContext } from '@mastra/core';

import { type EntraUser } from '../auth/entra-auth';
import { 
  filterByPermissions, 
  AGENT_PERMISSIONS, 
  TOOL_PERMISSIONS,
  WORKFLOW_PERMISSIONS 
} from '../auth/agent-permissions';

// ============================================================
// Import All Sub-Agents
// ============================================================

import { financeAgent } from './finance-agent';
import { budgetAnalysisAgent } from './budget-analysis-agent';
import { hrAgent } from './hr-agent';
import { recruitingAgent } from './recruiting-agent';
import { engineeringAgent } from './engineering-agent';
import { codeReviewAgent } from './code-review-agent';
import { marketingAgent } from './marketing-agent';
import { contentAgent } from './content-agent';
import { generalAgent } from './general-agent';
import { researchAgent } from './research-agent';

// ============================================================
// Import All Tools
// ============================================================

// Finance tools
import { getBudgetReport, processPayroll, generateInvoice, viewExpenses } from '../tools/finance-tools';

// HR tools
import { viewEmployeeRecords, updateEmployeeInfo, processLeaveRequest } from '../tools/hr-tools';

// Engineering tools
import { deployCode, viewLogs, runTests } from '../tools/engineering-tools';

// Marketing tools
import { schedulePost, analyticsReport } from '../tools/marketing-tools';

// General tools
import { weatherTool, searchTool, calculatorTool } from '../tools/general-tools';

// Graph tools
import { getMyEmails, getMyTasks, sendEmail, getMyCalendar } from '../tools/graph-tools';

// ============================================================
// Import All Workflows
// ============================================================

import { financialReportWorkflow, budgetApprovalWorkflow } from '../workflows/finance-workflows';
import { onboardingWorkflow, offboardingWorkflow } from '../workflows/hr-workflows';
import { deploymentWorkflow, incidentResponseWorkflow } from '../workflows/engineering-workflows';
import { campaignWorkflow } from '../workflows/marketing-workflows';
import { researchWorkflow, documentSummaryWorkflow } from '../workflows/general-workflows';

// ============================================================
// Complete Catalogs (All Available Resources)
// ============================================================

const ALL_AGENTS = {
  financeAgent,
  budgetAnalysisAgent,
  hrAgent,
  recruitingAgent,
  engineeringAgent,
  codeReviewAgent,
  marketingAgent,
  contentAgent,
  generalAgent,
  researchAgent,
};

const ALL_TOOLS = {
  // Finance
  getBudgetReport,
  processPayroll,
  generateInvoice,
  viewExpenses,
  // HR
  viewEmployeeRecords,
  updateEmployeeInfo,
  processLeaveRequest,
  // Engineering
  deployCode,
  viewLogs,
  runTests,
  // Marketing
  schedulePost,
  analyticsReport,
  // General
  weatherTool,
  searchTool,
  calculatorTool,
  // Graph
  getMyEmails,
  getMyTasks,
  sendEmail,
  getMyCalendar,
};

const ALL_WORKFLOWS = {
  // Finance
  financialReportWorkflow,
  budgetApprovalWorkflow,
  // HR
  onboardingWorkflow,
  offboardingWorkflow,
  // Engineering
  deploymentWorkflow,
  incidentResponseWorkflow,
  // Marketing
  campaignWorkflow,
  // General
  researchWorkflow,
  documentSummaryWorkflow,
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Builds dynamic instructions that list only available capabilities
 */
function buildInstructions(
  agentNames: string[],
  toolNames: string[],
  workflowNames: string[]
): string {
  const agentList = agentNames.length > 0 
    ? agentNames.join(', ') 
    : 'none';
  
  const toolList = toolNames.length > 0 
    ? toolNames.join(', ') 
    : 'none';
  
  const workflowList = workflowNames.length > 0 
    ? workflowNames.join(', ') 
    : 'none';

  return `You are an intelligent orchestrator assistant that helps users accomplish tasks by delegating to specialized agents, tools, and workflows.

## Available Capabilities

**Specialized Agents:** ${agentList}
**Tools:** ${toolList}
**Workflows:** ${workflowList}

## Instructions

1. Analyze the user's request carefully
2. Determine which agent, tool, or workflow is best suited for the task
3. Delegate appropriately and synthesize the results
4. If a task cannot be accomplished with your available capabilities, politely explain what you CAN help with instead

## Important Guidelines

- Never mention or reference capabilities you don't have access to
- Never apologize for lacking access to specific resources
- If asked about something outside your capabilities, redirect to what you can help with
- For multi-step tasks, coordinate between your available resources
- Always provide helpful, actionable responses

## Response Style

- Be concise and professional
- Provide clear, structured answers
- Offer follow-up suggestions when appropriate`;
}

// ============================================================
// Orchestrator Agent Definition
// ============================================================

export const orchestrator = new Agent({
  id: 'orchestrator',
  name: 'Orchestrator',
  model: 'openai/gpt-4o',
  
  /**
   * Dynamic instructions - lists only capabilities the user can access
   */
  instructions: async ({ requestContext }) => {
    const user = requestContext.get('user') as EntraUser;
    
    if (!user) {
      return 'You are a helpful assistant. Please authenticate to access full capabilities.';
    }
    
    const availableAgents = filterByPermissions(ALL_AGENTS, AGENT_PERMISSIONS, user);
    const availableTools = filterByPermissions(ALL_TOOLS, TOOL_PERMISSIONS, user);
    const availableWorkflows = filterByPermissions(ALL_WORKFLOWS, WORKFLOW_PERMISSIONS, user);
    
    return buildInstructions(
      Object.keys(availableAgents),
      Object.keys(availableTools),
      Object.keys(availableWorkflows)
    );
  },
  
  /**
   * Dynamic agents - filtered at runtime based on user's group membership
   */
  agents: async ({ requestContext }) => {
    const user = requestContext.get('user') as EntraUser;
    
    if (!user) {
      return {};
    }
    
    return filterByPermissions(ALL_AGENTS, AGENT_PERMISSIONS, user);
  },
  
  /**
   * Dynamic tools - filtered at runtime based on user's group membership
   */
  tools: async ({ requestContext }) => {
    const user = requestContext.get('user') as EntraUser;
    
    if (!user) {
      return {};
    }
    
    return filterByPermissions(ALL_TOOLS, TOOL_PERMISSIONS, user);
  },
  
  /**
   * Dynamic workflows - filtered at runtime based on user's group membership
   */
  workflows: async ({ requestContext }) => {
    const user = requestContext.get('user') as EntraUser;
    
    if (!user) {
      return {};
    }
    
    return filterByPermissions(ALL_WORKFLOWS, WORKFLOW_PERMISSIONS, user);
  },
  
  /**
   * Memory for conversation continuity
   */
  memory: new Memory(),
});
```

## Request Flow

```
1. User sends request (cookie attached automatically)
   │
   ▼
2. BFF validates session, attaches Bearer token
   │
   ▼
3. MastraAuthEntra.authenticateToken(token)
   - Verifies JWT signature via JWKS
   - Extracts user claims including groups
   │
   ▼
4. Middleware injects user into RequestContext
   c.set('requestContext', { user, userToken, userId })
   │
   ▼
5. Agent configuration functions execute:
   │
   ├─ instructions({ requestContext })
   │  └─ Returns instructions listing only accessible capabilities
   │
   ├─ agents({ requestContext })
   │  └─ Returns filtered sub-agents
   │
   ├─ tools({ requestContext })
   │  └─ Returns filtered tools
   │
   └─ workflows({ requestContext })
      └─ Returns filtered workflows
   │
   ▼
6. LLM receives context with ONLY accessible resources
   - Cannot reference finance tools if user is in Engineering
   - Cannot reveal existence of restricted resources
   │
   ▼
7. LLM generates response using available capabilities
```

## Example Scenarios

### Engineering User Request

**User Groups:** `[ENGINEERING]`

**Filtered Capabilities:**
```javascript
agents: { engineeringAgent, codeReviewAgent, generalAgent, researchAgent }
tools: { deployCode, viewLogs, runTests, weatherTool, searchTool, calculatorTool, getMyEmails, ... }
workflows: { deploymentWorkflow, incidentResponseWorkflow, researchWorkflow, documentSummaryWorkflow }
```

**User:** "Can you help me with payroll processing?"

**Response:** "I can help you with engineering tasks like code deployment, viewing logs, running tests, and research. For payroll processing, you'll need to reach out to the Finance team or HR directly. Is there something else I can help you with today?"

### Finance User Request

**User Groups:** `[FINANCE]`

**Filtered Capabilities:**
```javascript
agents: { financeAgent, budgetAnalysisAgent, generalAgent, researchAgent }
tools: { getBudgetReport, processPayroll, generateInvoice, viewExpenses, weatherTool, searchTool, ... }
workflows: { financialReportWorkflow, budgetApprovalWorkflow, researchWorkflow, documentSummaryWorkflow }
```

**User:** "Generate a Q3 budget report for Engineering"

**Response:** *Uses getBudgetReport tool to fetch data, synthesizes into report*

### Admin User Request

**User Groups:** `[ADMINS]`

**Filtered Capabilities:** *All agents, tools, and workflows*

## Testing Dynamic Configuration

```typescript
// scripts/test-dynamic-config.ts
import { orchestrator } from '../src/mastra/agents/orchestrator';
import { ENTRA_GROUPS, type EntraUser } from '../src/mastra/auth';

// Create mock RequestContext
function createMockContext(user: EntraUser) {
  return {
    get: (key: string) => {
      if (key === 'user') return user;
      return undefined;
    },
    set: () => {},
  };
}

// Test user scenarios
const testUsers = {
  engineering: {
    oid: 'eng-user',
    sub: 'eng-user',
    name: 'Engineer',
    groups: [ENTRA_GROUPS.ENGINEERING],
  } as EntraUser,
  
  finance: {
    oid: 'fin-user',
    sub: 'fin-user',
    name: 'Finance User',
    groups: [ENTRA_GROUPS.FINANCE],
  } as EntraUser,
  
  admin: {
    oid: 'admin-user',
    sub: 'admin-user',
    name: 'Admin',
    groups: [ENTRA_GROUPS.ADMINS],
  } as EntraUser,
};

async function testUserConfig(name: string, user: EntraUser) {
  const ctx = createMockContext(user);
  
  console.log(`\n=== ${name} User ===`);
  
  const agents = await orchestrator.agents({ requestContext: ctx });
  console.log('Agents:', Object.keys(agents));
  
  const tools = await orchestrator.tools({ requestContext: ctx });
  console.log('Tools:', Object.keys(tools));
  
  const workflows = await orchestrator.workflows({ requestContext: ctx });
  console.log('Workflows:', Object.keys(workflows));
}

async function main() {
  for (const [name, user] of Object.entries(testUsers)) {
    await testUserConfig(name, user);
  }
}

main();
```

## Performance Considerations

The dynamic configuration functions execute on every request. For optimal performance:

1. **Keep filtering fast**: The `filterByPermissions` function uses simple object iteration
2. **Avoid async operations in filtering**: Group membership checks should be synchronous
3. **Cache if needed**: For very large tool sets, consider caching filtered results per user group combination

```typescript
// Optional: Caching filtered configurations
const configCache = new Map<string, CachedConfig>();

function getCacheKey(user: EntraUser): string {
  // Cache by sorted group combination
  const groups = [...(user.groups || [])].sort();
  return groups.join(',');
}

async function getFilteredTools(user: EntraUser) {
  const cacheKey = getCacheKey(user);
  
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey)!.tools;
  }
  
  const filtered = filterByPermissions(ALL_TOOLS, TOOL_PERMISSIONS, user);
  configCache.set(cacheKey, { tools: filtered, timestamp: Date.now() });
  
  return filtered;
}
```

## Registering the Orchestrator

### File: `src/mastra/index.ts`

```typescript
import { Mastra } from '@mastra/core';
import { PostgresStore } from '@mastra/pg';
import { MastraAuthEntra, type EntraUser } from './auth/entra-auth';
import { orchestrator } from './agents/orchestrator';

export const mastra = new Mastra({
  agents: { orchestrator },
  
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  
  server: {
    auth: new MastraAuthEntra(),
    
    middleware: [
      async (c, next) => {
        const user = c.get('user') as EntraUser;
        const authHeader = c.req.header('Authorization');
        const userToken = authHeader?.replace('Bearer ', '');
        
        if (user && userToken) {
          c.set('requestContext', {
            user,
            userToken,
            userId: user.oid ?? user.sub,
          });
        }
        
        await next();
      },
    ],
  },
});
```
