# Quick Start Implementation Guide

## Overview

This guide provides the implementation order and key checkpoints for setting up the Mastra + Entra authentication system with the BFF (Backend-for-Frontend) pattern.

## Implementation Order

```
1. Azure Configuration (Portal)
   └── App Registration + Permissions + Groups

2. Database Schema
   └── Sessions + Token Cache tables

3. Backend Auth Provider
   └── entra-auth.ts (JWKS verification)

4. RBAC Permissions
   └── agent-permissions.ts

5. Dynamic Agent Configuration
   └── orchestrator.ts with filtered tools/agents

6. Graph Token Service
   └── graph-token-service.ts (OBO + caching)

7. Graph Tools
   └── graph-tools.ts (emails, tasks, calendar)

8. BFF Server
   └── OAuth flow + session management + proxy

9. Frontend
   └── Simple React app (no MSAL)
```

## File Structure

```
src/
├── bff/
│   └── server.ts                    # BFF server (OAuth, sessions, proxy)
│
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
│   └── api.ts                       # Simple fetch wrapper
│
├── hooks/
│   ├── useAuth.ts
│   ├── useChat.ts
│   └── useCapabilities.ts
│
├── components/
│   ├── App.tsx
│   ├── LoginPage.tsx
│   ├── AuthenticatedApp.tsx
│   └── Chat.tsx
│
└── main.tsx

migrations/
└── 001_mastra_auth_schema.sql       # Sessions + token cache tables
```

## Implementation Checklist

### Phase 1: Azure Setup

- [x] Create App Registration in Azure Portal
- [x] Configure redirect URIs (**Web** platform, not SPA)
  - `http://localhost:3000/auth/callback` (dev)
  - `https://your-app.com/auth/callback` (prod)
- [x] Set Application ID URI (`api://{client-id}`)
- [x] Add scope: `access_as_user`
- [x] Enable groups claim (Token configuration)
- [x] Add optional claims (email, preferred_username)
- [x] Add Microsoft Graph permissions (delegated)
  - `User.Read`, `email`, `profile`, `openid`
  - `offline_access` (required for refresh tokens)
  - `Mail.Read`, `Mail.Send`, `Tasks.ReadWrite`, `Calendars.Read`
- [x] Create client secret
- [x] Grant admin consent for permissions
- [ ] Create security groups (Finance, HR, Engineering, etc.)
- [ ] Record all group Object IDs

### Phase 2: Database Setup

- [x] Create PostgreSQL database
- [x] Run migration: `001_mastra_auth_schema.sql`
  - `mastra_auth.sessions` table
  - `mastra_auth.msal_token_cache` table
- [x] Verify tables created correctly

### Phase 3: Backend Auth

- [ ] Install dependencies: `@mastra/auth`
- [ ] Create `entra-auth.ts` with `MastraAuthEntra` class
- [ ] Configure `ENTRA_GROUPS` with actual Object IDs
- [ ] Create `agent-permissions.ts` with permission maps
- [ ] Register auth provider in Mastra instance
- [ ] Add middleware to inject user into RequestContext

### Phase 4: Dynamic Configuration

- [ ] Create orchestrator agent with dynamic `tools`, `agents`, `workflows`
- [ ] Implement `filterByPermissions` function
- [ ] Create dynamic `instructions` that list available capabilities
- [ ] Add `/api/my-capabilities` endpoint

### Phase 5: Graph Integration

- [ ] Install dependencies: `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `pg`, `lru-cache`
- [ ] Create `graph-token-service.ts` with PostgreSQL caching
- [ ] Create Graph tools (emails, tasks, calendar)
- [ ] Add tools to orchestrator's `ALL_TOOLS`
- [ ] Add tool permissions to `TOOL_PERMISSIONS`

### Phase 6: BFF Server

- [ ] Install dependencies: `hono`, `@hono/node-server`
- [ ] Create `bff/server.ts` with:
  - [ ] MSAL client configuration
  - [ ] Session store functions (create, get, update, delete)
  - [ ] `/auth/login` - redirect to Microsoft
  - [ ] `/auth/callback` - handle OAuth callback
  - [ ] `/auth/logout` - clear session
  - [ ] `/auth/me` - return current user
  - [ ] `/api/*` - proxy to Mastra with Bearer token
- [ ] Implement token refresh logic
- [ ] Add CSRF protection
- [ ] Configure httpOnly cookies

### Phase 7: Frontend

- [ ] Create `lib/api.ts` with fetch wrapper
- [ ] Create hooks (`useAuth`, `useChat`, `useCapabilities`)
- [ ] Create components (LoginPage, AuthenticatedApp, Chat)
- [ ] Configure Vite proxy for `/api` and `/auth`
- [ ] Test full login flow

### Phase 8: Production Prep

- [ ] Set up environment variables in deployment platform
- [ ] Configure production redirect URIs in Azure
- [ ] Set up secrets management (Key Vault, etc.)
- [ ] Add session cleanup cron job
- [ ] Add token cache cleanup cron job
- [ ] Enable HTTPS
- [ ] Set `secure: true` on cookies
- [ ] Test with production credentials

## Quick Verification Tests

### 1. Database Connection

```bash
psql $DATABASE_URL -c "SELECT * FROM mastra_auth.sessions LIMIT 1;"
```

### 2. BFF Server Health

```bash
curl http://localhost:3000/auth/me
# Should return: {"authenticated":false}
```

### 3. OAuth Flow

1. Open `http://localhost:3000/auth/login`
2. Should redirect to Microsoft login
3. After login, should redirect back with session cookie

### 4. Session Verification

```bash
# After logging in, check session exists
psql $DATABASE_URL -c "SELECT id, user_id, expires_at FROM mastra_auth.sessions;"
```

### 5. API Proxy Test

```bash
# With session cookie (use browser dev tools to get it)
curl -b "sid=your-session-id" http://localhost:3000/api/my-capabilities
```

### 6. Permission Filtering Test

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

## Common Issues and Solutions

| Issue                             | Cause                  | Solution                                              |
| --------------------------------- | ---------------------- | ----------------------------------------------------- |
| "AADSTS50011: Reply URL mismatch" | Redirect URI mismatch  | Check Azure config uses Web platform, exact URL match |
| "AADSTS65001"                     | Consent not granted    | Have admin grant consent in Azure Portal              |
| Groups empty                      | Claims not configured  | Enable groups claim in Token configuration            |
| "invalid_grant"                   | Expired/revoked token  | Clear session and token cache, re-authenticate        |
| 401 from Mastra                   | Token not attached     | Check BFF proxy adds Authorization header             |
| CORS errors                       | Origin mismatch        | Check APP_URL matches frontend origin                 |
| Cookies not sent                  | SameSite/Secure issues | Use Lax for dev, verify HTTPS in prod                 |

## Development Workflow

### Starting Services

```bash
# Terminal 1: PostgreSQL (if local)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:15

# Terminal 2: Mastra server
cd src/mastra && bun run dev

# Terminal 3: BFF server
cd src/bff && bun run dev

# Terminal 4: Frontend
cd frontend && pnpm dev
```

### Ports

| Service         | Port |
| --------------- | ---- |
| Frontend (Vite) | 5173 |
| BFF Server      | 3000 |
| Mastra Server   | 4111 |
| PostgreSQL      | 5432 |

### Logs to Watch

```bash
# BFF - watch for OAuth callbacks and proxy requests
# Mastra - watch for auth failures and permission checks
# PostgreSQL - watch for connection issues
```

## Security Checklist

- [ ] Client secret not committed to git
- [ ] `.env` files in `.gitignore`
- [ ] Cookies use `httpOnly: true`
- [ ] Cookies use `secure: true` in production
- [ ] CSRF protection enabled
- [ ] OAuth state parameter validated
- [ ] Tokens never logged
- [ ] Sessions expire appropriately
- [ ] Stale sessions cleaned up regularly
