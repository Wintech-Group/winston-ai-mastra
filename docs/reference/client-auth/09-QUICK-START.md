# Quick Start Implementation Guide

## Overview

This guide provides the implementation order and key checkpoints for setting up the Mastra + Entra authentication system.

## Implementation Order

```
1. Azure Configuration (Portal)
   └── App Registration + Permissions + Groups

2. Backend Auth Provider
   └── entra-auth.ts + middleware

3. RBAC Permissions
   └── agent-permissions.ts

4. Dynamic Agent Configuration
   └── orchestrator.ts with filtered tools/agents

5. Token Cache Schema
   └── PostgreSQL migration

6. Graph Token Service
   └── graph-token-service.ts

7. Graph Tools
   └── graph-tools.ts (emails, tasks, calendar)

8. Frontend Integration
   └── MSAL + React hooks + components
```

## File Structure

```
src/
├── mastra/
│   ├── auth/
│   │   ├── index.ts                 # Re-exports
│   │   ├── entra-auth.ts            # Custom auth provider
│   │   ├── entra-groups-resolver.ts # Groups overage handling
│   │   └── agent-permissions.ts     # RBAC permission maps
│   │
│   ├── agents/
│   │   ├── orchestrator.ts          # Main orchestrator with dynamic config
│   │   ├── finance-agent.ts         # Department-specific agents
│   │   ├── hr-agent.ts
│   │   ├── engineering-agent.ts
│   │   └── general-agent.ts
│   │
│   ├── tools/
│   │   ├── finance-tools.ts
│   │   ├── hr-tools.ts
│   │   ├── engineering-tools.ts
│   │   ├── general-tools.ts
│   │   └── graph-tools.ts           # Microsoft Graph integration
│   │
│   ├── workflows/
│   │   └── ... (department workflows)
│   │
│   ├── services/
│   │   └── graph-token-service.ts   # OBO flow + caching
│   │
│   ├── config/
│   │   └── env.ts                   # Environment validation
│   │
│   └── index.ts                     # Mastra instance
│
├── lib/
│   ├── msal-config.ts               # MSAL configuration
│   └── mastra-client.ts             # Authenticated client helper
│
├── hooks/
│   ├── useAuth.ts
│   ├── useMastraClient.ts
│   └── useCapabilities.ts
│
├── components/
│   ├── App.tsx
│   ├── LoginPage.tsx
│   ├── AuthenticatedApp.tsx
│   └── Chat.tsx
│
└── main.tsx
```

## Implementation Checklist

### Phase 1: Azure Setup

- [x] Create App Registration in Azure Portal
- [x] Configure redirect URIs (SPA platform)
- [x] Set Application ID URI (`api://{client-id}`)
- [x] Add scope: `access_as_user`
- [x] Enable groups claim (Token configuration)
- [x] Add optional claims (email, preferred_username)
- [/] Add Microsoft Graph permissions
- [x] Create client secret
- [ ] Create security groups (Finance, HR, Engineering, etc.)
- [/] Create login allowlist group (e.g., `Mastra-Users`)
- [ ] Record all group Object IDs
- [x] Grant admin consent for permissions
- [x] Set Enterprise App **Assignment required?** = **Yes**
- [/] Assign allowed users/groups in Enterprise App → Users and groups
- [ ] Verify unassigned user cannot sign in

### Phase 2: Backend Auth

- [ ] Install dependencies: `@mastra/auth`
- [ ] Create `entra-auth.ts` with `MastraAuthEntra` class
- [ ] Configure `ENTRA_GROUPS` with actual Object IDs
- [ ] Create `agent-permissions.ts` with permission maps
- [ ] Register auth provider in Mastra instance
- [ ] Add middleware to inject user into RequestContext
- [ ] Test authentication with a real token

### Phase 3: Dynamic Configuration

- [ ] Create orchestrator agent with dynamic `tools`, `agents`, `workflows`
- [ ] Implement `filterByPermissions` function
- [ ] Create dynamic `instructions` that list available capabilities
- [ ] Add `/api/my-capabilities` endpoint
- [ ] Test with users from different groups

### Phase 4: Graph Integration

- [ ] Create database schema (`mastra_auth.msal_token_cache`)
- [ ] Install dependencies: `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `pg`, `lru-cache`
- [ ] Create `graph-token-service.ts` with PostgreSQL caching
- [ ] Create Graph tools (emails, tasks, calendar)
- [ ] Add tools to orchestrator's `ALL_TOOLS`
- [ ] Add logout endpoint to clear token cache
- [ ] Test OBO flow with actual Graph API calls

### Phase 5: Frontend

- [ ] Install dependencies: `@azure/msal-browser`, `@azure/msal-react`, `@mastra/client-js`
- [ ] Create `msal-config.ts`
- [ ] Create `mastra-client.ts` with token handling
- [ ] Create React hooks (`useAuth`, `useMastraClient`, `useCapabilities`)
- [ ] Create components (LoginPage, AuthenticatedApp, Chat)
- [ ] Initialize MSAL before app render
- [ ] Test full login flow

### Phase 6: Production Prep

- [ ] Set up environment variables in deployment platform
- [ ] Configure production redirect URIs in Azure
- [ ] Set up secrets management (Key Vault, etc.)
- [ ] Add token cache cleanup cron job
- [ ] Enable production logging
- [ ] Test with production credentials

## Quick Verification Tests

### 1. Auth Provider Test

```typescript
// scripts/test-auth.ts
import { MastraAuthEntra, ENTRA_GROUPS } from "../src/mastra/auth"

const auth = new MastraAuthEntra()

// Get a token from jwt.ms or your frontend
const token = "eyJ..."

async function test() {
  const user = await auth.authenticateToken(token)
  console.log("User:", user?.name)
  console.log("Groups:", MastraAuthEntra.getUserGroupNames(user!))
}

test()
```

### 2. Permission Filtering Test

```typescript
// scripts/test-permissions.ts
import {
  filterByPermissions,
  TOOL_PERMISSIONS,
} from "../src/mastra/auth/agent-permissions"
import { ENTRA_GROUPS, type EntraUser } from "../src/mastra/auth"

const engineerUser: EntraUser = {
  oid: "test",
  sub: "test",
  groups: [ENTRA_GROUPS.ENGINEERING],
}

const ALL_TOOLS = {
  /* your tools */
}
const filtered = filterByPermissions(ALL_TOOLS, TOOL_PERMISSIONS, engineerUser)

console.log("Engineer can access:", Object.keys(filtered))
```

### 3. Graph Token Test

```typescript
// scripts/test-graph.ts
import { getGraphTokenOnBehalfOf } from "../src/mastra/services/graph-token-service"

const userToken = "eyJ..." // From frontend
const userId = "user-oid"

async function test() {
  const graphToken = await getGraphTokenOnBehalfOf(userToken, userId)
  console.log("Graph token acquired:", graphToken.substring(0, 50) + "...")
}

test()
```

## Common Issues and Solutions

| Issue              | Cause                      | Solution                                   |
| ------------------ | -------------------------- | ------------------------------------------ |
| "AADSTS65001"      | Consent not granted        | Have admin grant consent in Azure Portal   |
| "Invalid audience" | Wrong scope requested      | Use `api://{client-id}/.default`           |
| Groups empty       | Claims not configured      | Enable groups claim in Token configuration |
| "invalid_grant"    | Expired/revoked token      | Clear cache, re-authenticate               |
| Tools not filtered | User not in RequestContext | Check middleware injects user              |
| CORS errors        | Redirect URI mismatch      | Check exact URI in App Registration        |

## Security Reminders

1. **Never commit secrets** - Use `.env` files + `.gitignore`
2. **Validate tokens server-side** - Never trust frontend-only validation
3. **Use HTTPS in production** - Tokens must be encrypted in transit
4. **Rotate secrets regularly** - Set expiration reminders
5. **Audit permission changes** - Log who accessed what
6. **Principle of least privilege** - Start with minimal permissions
