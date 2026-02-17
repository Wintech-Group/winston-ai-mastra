# RBAC Permissions System

## Overview

This document describes the role-based access control (RBAC) system that determines which agents, tools, and workflows each user can access. Permissions are based on Microsoft Entra security group membership.

> RBAC controls authorization after authentication. To restrict who can sign in at all, configure Enterprise App assignment enforcement (Assignment required = Yes) as described in [02-AZURE-CONFIGURATION.md](./02-AZURE-CONFIGURATION.md).

## Design Principles

1. **Deny by Default**: If no permission is defined, access is denied
2. **Empty = Public**: An empty permissions array means all authenticated users can access
3. **Admin Override**: Users in the ADMINS group can access everything
4. **Group-Based**: All permissions are tied to Entra security groups, not individual users

## Permission Configuration

### File: `src/mastra/auth/agent-permissions.ts`

```typescript
import { type EntraUser, MastraAuthEntra, type GroupName, ENTRA_GROUPS } from './entra-auth';

// ============================================================
// Permission Definitions
// ============================================================

/**
 * Defines which groups can access which sub-agents
 * 
 * Key: Agent ID (must match the key used in orchestrator's agents config)
 * Value: Array of group names that can access the agent
 * 
 * Empty array = all authenticated users can access
 */
export const AGENT_PERMISSIONS: Record<string, GroupName[]> = {
  // Finance-specific agents
  financeAgent: ['FINANCE', 'ADMINS'],
  budgetAnalysisAgent: ['FINANCE', 'ADMINS'],
  
  // HR-specific agents
  hrAgent: ['HR', 'ADMINS'],
  recruitingAgent: ['HR', 'ADMINS'],
  
  // Engineering-specific agents
  engineeringAgent: ['ENGINEERING', 'ADMINS'],
  codeReviewAgent: ['ENGINEERING', 'ADMINS'],
  
  // Marketing-specific agents
  marketingAgent: ['MARKETING', 'ADMINS'],
  contentAgent: ['MARKETING', 'ADMINS'],
  
  // General agents (available to everyone)
  generalAgent: [],
  researchAgent: [],
};

/**
 * Defines which groups can access which tools
 * 
 * Key: Tool ID (must match the key used in orchestrator's tools config)
 * Value: Array of group names that can access the tool
 */
export const TOOL_PERMISSIONS: Record<string, GroupName[]> = {
  // Finance tools
  getBudgetReport: ['FINANCE', 'ADMINS'],
  processPayroll: ['FINANCE', 'ADMINS'],
  generateInvoice: ['FINANCE', 'ADMINS'],
  viewExpenses: ['FINANCE', 'ADMINS'],
  
  // HR tools
  viewEmployeeRecords: ['HR', 'ADMINS'],
  updateEmployeeInfo: ['HR', 'ADMINS'],
  processLeaveRequest: ['HR', 'ADMINS'],
  
  // Engineering tools
  deployCode: ['ENGINEERING', 'ADMINS'],
  viewLogs: ['ENGINEERING', 'ADMINS'],
  runTests: ['ENGINEERING', 'ADMINS'],
  
  // Marketing tools
  schedulePost: ['MARKETING', 'ADMINS'],
  analyticsReport: ['MARKETING', 'ADMINS'],
  
  // General tools (available to everyone)
  weatherTool: [],
  searchTool: [],
  calculatorTool: [],
  
  // Graph tools (available to everyone - Graph handles its own permissions)
  getMyEmails: [],
  getMyTasks: [],
  sendEmail: [],  // Uses approval flow for safety
  getMyCalendar: [],
};

/**
 * Defines which groups can access which workflows
 * 
 * Key: Workflow ID (must match the key used in orchestrator's workflows config)
 * Value: Array of group names that can access the workflow
 */
export const WORKFLOW_PERMISSIONS: Record<string, GroupName[]> = {
  // Finance workflows
  financialReportWorkflow: ['FINANCE', 'ADMINS'],
  budgetApprovalWorkflow: ['FINANCE', 'ADMINS'],
  
  // HR workflows
  onboardingWorkflow: ['HR', 'ADMINS'],
  offboardingWorkflow: ['HR', 'ADMINS'],
  
  // Engineering workflows
  deploymentWorkflow: ['ENGINEERING', 'ADMINS'],
  incidentResponseWorkflow: ['ENGINEERING', 'ADMINS'],
  
  // Marketing workflows
  campaignWorkflow: ['MARKETING', 'ADMINS'],
  
  // General workflows (available to everyone)
  researchWorkflow: [],
  documentSummaryWorkflow: [],
};

// ============================================================
// Permission Check Functions
// ============================================================

/**
 * Check if a user can access a resource based on required permissions
 * 
 * @param user - The authenticated user
 * @param permissions - Array of group names that grant access
 * @returns true if user has access
 */
export function canAccess(user: EntraUser, permissions: GroupName[]): boolean {
  // Empty permissions = available to all authenticated users
  if (!permissions || permissions.length === 0) {
    return true;
  }
  
  // Admins can access everything
  if (MastraAuthEntra.userInGroup(user, 'ADMINS')) {
    return true;
  }
  
  // Check if user is in any of the required groups
  return MastraAuthEntra.userInAnyGroup(user, permissions);
}

/**
 * Filter a record of items based on user permissions
 * 
 * @param items - Record of items to filter (agents, tools, or workflows)
 * @param permissions - Permission mapping for the item type
 * @param user - The authenticated user
 * @returns Filtered record containing only accessible items
 */
export function filterByPermissions<T>(
  items: Record<string, T>,
  permissions: Record<string, GroupName[]>,
  user: EntraUser
): Record<string, T> {
  const filtered: Record<string, T> = {};
  
  for (const [key, item] of Object.entries(items)) {
    const requiredGroups = permissions[key];
    
    // If no permission defined, deny access (explicit configuration required)
    if (requiredGroups === undefined) {
      console.warn(`No permission defined for: ${key}. Access denied by default.`);
      continue;
    }
    
    if (canAccess(user, requiredGroups)) {
      filtered[key] = item;
    }
  }
  
  return filtered;
}

// ============================================================
// Convenience Functions
// ============================================================

/**
 * Get list of agent IDs accessible to a user
 */
export function getAccessibleAgentIds(user: EntraUser): string[] {
  return Object.keys(AGENT_PERMISSIONS).filter(agentId => 
    canAccess(user, AGENT_PERMISSIONS[agentId] ?? [])
  );
}

/**
 * Get list of tool IDs accessible to a user
 */
export function getAccessibleToolIds(user: EntraUser): string[] {
  return Object.keys(TOOL_PERMISSIONS).filter(toolId => 
    canAccess(user, TOOL_PERMISSIONS[toolId] ?? [])
  );
}

/**
 * Get list of workflow IDs accessible to a user
 */
export function getAccessibleWorkflowIds(user: EntraUser): string[] {
  return Object.keys(WORKFLOW_PERMISSIONS).filter(workflowId => 
    canAccess(user, WORKFLOW_PERMISSIONS[workflowId] ?? [])
  );
}

/**
 * Get a summary of user's accessible capabilities
 */
export function getUserCapabilities(user: EntraUser): {
  agents: string[];
  tools: string[];
  workflows: string[];
  groups: string[];
} {
  return {
    agents: getAccessibleAgentIds(user),
    tools: getAccessibleToolIds(user),
    workflows: getAccessibleWorkflowIds(user),
    groups: MastraAuthEntra.getUserGroupNames(user),
  };
}

/**
 * Check if a user can access a specific agent
 */
export function canAccessAgent(user: EntraUser, agentId: string): boolean {
  const permissions = AGENT_PERMISSIONS[agentId];
  if (permissions === undefined) return false;
  return canAccess(user, permissions);
}

/**
 * Check if a user can access a specific tool
 */
export function canAccessTool(user: EntraUser, toolId: string): boolean {
  const permissions = TOOL_PERMISSIONS[toolId];
  if (permissions === undefined) return false;
  return canAccess(user, permissions);
}

/**
 * Check if a user can access a specific workflow
 */
export function canAccessWorkflow(user: EntraUser, workflowId: string): boolean {
  const permissions = WORKFLOW_PERMISSIONS[workflowId];
  if (permissions === undefined) return false;
  return canAccess(user, permissions);
}
```

## Alternative: Colocated Permissions

Instead of centralized permission maps, you can define permissions alongside your tools/agents:

### File: `src/mastra/tools/finance-tools.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { GroupName } from '../auth/agent-permissions';

// Extend the tool type to include permissions
interface ToolWithPermissions {
  permissions?: GroupName[];
}

export const getBudgetReport = createTool({
  id: 'get-budget-report',
  description: 'Retrieves departmental budget reports',
  inputSchema: z.object({
    department: z.string(),
    quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
    year: z.number(),
  }),
  outputSchema: z.object({
    report: z.object({
      department: z.string(),
      budget: z.number(),
      spent: z.number(),
      remaining: z.number(),
    }),
  }),
  execute: async ({ department, quarter, year }) => {
    // Implementation...
    return { report: { department, budget: 100000, spent: 75000, remaining: 25000 } };
  },
}) as ReturnType<typeof createTool> & ToolWithPermissions;

// Colocate permissions with the tool
getBudgetReport.permissions = ['FINANCE', 'ADMINS'];
```

Then build the permission map dynamically:

```typescript
// src/mastra/auth/agent-permissions.ts
import * as financeTools from '../tools/finance-tools';
import * as hrTools from '../tools/hr-tools';

// Build TOOL_PERMISSIONS from colocated definitions
export const TOOL_PERMISSIONS: Record<string, GroupName[]> = {};

for (const tool of [...Object.values(financeTools), ...Object.values(hrTools)]) {
  if ('id' in tool && 'permissions' in tool) {
    TOOL_PERMISSIONS[tool.id] = tool.permissions ?? [];
  }
}
```

## API Endpoint for Capabilities

Expose user capabilities to the frontend:

### In `src/mastra/index.ts`

```typescript
routes: {
  '/api/my-capabilities': {
    method: 'GET',
    handler: async (c) => {
      const user = c.get('user') as EntraUser;
      
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      
      const capabilities = getUserCapabilities(user);
      
      return c.json({
        ...capabilities,
        user: {
          name: user.name,
          email: user.preferred_username,
          id: user.oid,
        },
      });
    },
  },
},
```

### Example Response

```json
{
  "agents": ["generalAgent", "researchAgent", "engineeringAgent", "codeReviewAgent"],
  "tools": ["weatherTool", "searchTool", "deployCode", "viewLogs", "runTests"],
  "workflows": ["researchWorkflow", "documentSummaryWorkflow", "deploymentWorkflow"],
  "groups": ["ENGINEERING"],
  "user": {
    "name": "Jane Developer",
    "email": "jane@company.com",
    "id": "abc123-def456"
  }
}
```

## Testing Permissions

```typescript
// scripts/test-permissions.ts
import { MastraAuthEntra, ENTRA_GROUPS, type EntraUser } from '../src/mastra/auth';
import { getUserCapabilities, canAccessTool } from '../src/mastra/auth/agent-permissions';

// Mock user in Engineering group
const engineeringUser: EntraUser = {
  oid: 'test-user-1',
  sub: 'test-user-1',
  name: 'Test Engineer',
  preferred_username: 'engineer@company.com',
  groups: [ENTRA_GROUPS.ENGINEERING],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// Mock admin user
const adminUser: EntraUser = {
  ...engineeringUser,
  oid: 'test-admin-1',
  name: 'Test Admin',
  groups: [ENTRA_GROUPS.ADMINS],
};

console.log('Engineering User Capabilities:');
console.log(JSON.stringify(getUserCapabilities(engineeringUser), null, 2));

console.log('\nAdmin User Capabilities:');
console.log(JSON.stringify(getUserCapabilities(adminUser), null, 2));

console.log('\nPermission Checks:');
console.log('Engineer can access deployCode:', canAccessTool(engineeringUser, 'deployCode'));
console.log('Engineer can access getBudgetReport:', canAccessTool(engineeringUser, 'getBudgetReport'));
console.log('Admin can access getBudgetReport:', canAccessTool(adminUser, 'getBudgetReport'));
```

## Security Considerations

1. **Audit logging**: Log permission denials for security monitoring
2. **Fail closed**: Undefined permissions should deny access, not grant it
3. **Regular review**: Periodically review permission mappings
4. **Principle of least privilege**: Start with minimal permissions, add as needed
5. **Group management**: Manage groups in Entra, not in code
