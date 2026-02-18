# Quick Start Implementation Guide

## Overview

This guide provides the implementation order and key checkpoints for setting up the Mastra + Entra authentication system with auth routes and session middleware integrated directly into the Mastra server.

## Implementation Order

```
1. Azure Configuration (Portal)
   └── App Registration + Permissions + Groups

2. Database Schema
   └── Apply migration (mastra_auth schema)
   └── Regenerate types (supabase:gen-types)

3. Auth on Mastra Server
   └── session-store.ts (supabase-js CRUD)
   └── token-refresh.ts (MSAL singleton)
   └── routes.ts (4 routes via registerApiRoute)
   └── middleware.ts (session validation on /api/*)
   └── Register in mastra/index.ts

4. Frontend
   └── Simple React app (no MSAL)
   └── Vite proxy /api and /auth → :4111

5. Backend Auth Provider (future – RBAC phase)
   └── entra-auth.ts (JWKS verification)
   └── agent-permissions.ts

6. Dynamic Agent Configuration (future)
   └── orchestrator.ts with filtered tools/agents

7. Graph Integration (future)
   └── graph-token-service.ts (OBO + caching)
   └── graph-tools.ts (emails, tasks, calendar)
```

## File Structure

```
src/
├── mastra/
│   ├── auth/
│   │   ├── index.ts                 # Re-exports
│   │   ├── routes.ts                # 4 auth routes via registerApiRoute
│   │   ├── middleware.ts            # sessionAuthMiddleware for /api/*
│   │   ├── session-store.ts         # Supabase CRUD (mastra_auth.sessions)
│   │   └── token-refresh.ts         # MSAL singleton + refresh
│   │
│   ├── agents/
│   │   └── ... (agent definitions)
│   │
│   └── index.ts                     # Mastra instance (registers auth)
│
├── app/
│   ├── lib/
│   │   └── api.ts                   # fetch wrapper (credentials: include)
│   ├── hooks/
│   │   └── useAuth.ts               # useAuth hook
│   ├── routes/
│   │   ├── login.tsx
│   │   └── _authenticated.tsx       # route guard
│   └── main.tsx
│
├── services/
│   └── supabase-client.ts           # Supabase singleton
│
├── types/
│   └── database.types.ts            # Generated (includes mastra_auth schema)
│
└── scripts/
    └── cleanup-sessions.ts

supabase/
└── migrations/
    └── 20260218120000_mastra_auth_schema.sql
```

## Implementation Checklist

### Phase 1: Azure Setup

- [x] Create App Registration in Azure Portal
- [x] Configure redirect URIs (**Web** platform, not SPA)
  - `http://localhost:5173/auth/callback` (dev — Vite port; proxied to Mastra :4111)
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

- [x] Apply migration: `supabase migration up --local`
  - creates `mastra_auth.sessions`
  - creates `mastra_auth.msal_token_cache`
- [x] Regenerate types: `bun run supabase:gen-types`
- [x] Verify schema present in `src/types/database.types.ts`

### Phase 3: Auth on Mastra Server

- [x] Create `src/mastra/auth/session-store.ts` (supabase-js CRUD)
- [x] Create `src/mastra/auth/token-refresh.ts` (MSAL singleton)
- [x] Create `src/mastra/auth/routes.ts` with:
  - [x] `GET /auth/login` — redirect to Microsoft
  - [x] `GET /auth/callback` — exchange code, create session
  - [x] `POST /auth/logout` — delete session
  - [x] `GET /auth/me` — return current user
- [x] Create `src/mastra/auth/middleware.ts` (`sessionAuthMiddleware`)
- [x] Register in `src/mastra/index.ts`:
  - [x] `server.apiRoutes` includes all 4 auth routes
  - [x] `server.middleware` includes `{ path: "/api/*", handler: sessionAuthMiddleware }`
  - [x] `server.cors` includes `{ origin: APP_URL, credentials: true }`

### Phase 4: Frontend

- [x] Create `src/app/lib/api.ts` with fetch wrapper (`credentials: "include"`)
- [x] Create `src/app/hooks/useAuth.ts`
- [x] Configure Vite proxy: `/api` and `/auth` → `http://localhost:4111`
- [ ] Test full login flow (see verification tests below)

### Phase 5: RBAC / Dynamic Configuration (future)

- [ ] Install `@mastra/auth`
- [ ] Create `entra-auth.ts` with `MastraAuthEntra` (JWKS verification)
- [ ] Create `agent-permissions.ts` with group→tool permission maps
- [ ] Dynamic orchestrator config (filter tools/agents by user groups)
- [ ] Add `/api/my-capabilities` endpoint

### Phase 6: Graph Integration (future)

- [ ] Install `@microsoft/microsoft-graph-client`
- [ ] Create graph token service (OBO flow using session `accessToken`)
- [ ] Create Graph tools (emails, tasks, calendar)

## Quick Verification Tests

### 1. Database Tables

```bash
bun run supabase:gen-types
# mastra_auth.sessions should appear in src/types/database.types.ts
```

### 2. Auth Health Check

```bash
curl http://localhost:4111/auth/me
# Should return: {"authenticated":false}
```

### 3. OAuth Flow

1. Open `http://localhost:5173/auth/login` (Vite proxies to Mastra)
2. Should redirect to Microsoft login
3. After login, should redirect back with `sid` session cookie set

### 4. Session Verification

After logging in, check the session was created in Supabase Studio at `http://localhost:54323`
or via the Supabase CLI:

```bash
supabase db execute --local 'SELECT id, user_id, expires_at FROM mastra_auth.sessions;'
```

### 5. API Protection Test

```bash
# Without cookie — should return 401
curl http://localhost:4111/api/agents

# With session cookie (copy sid value from browser DevTools)
curl -b "sid=your-session-id" http://localhost:4111/api/agents
```

## Common Issues and Solutions

| Issue                             | Cause                  | Solution                                                 |
| --------------------------------- | ---------------------- | -------------------------------------------------------- |
| "AADSTS50011: Reply URL mismatch" | Redirect URI mismatch  | Check Azure config uses Web platform, exact URL match    |
| "AADSTS65001"                     | Consent not granted    | Have admin grant consent in Azure Portal                 |
| Groups empty                      | Claims not configured  | Enable groups claim in Token configuration               |
| "invalid_grant"                   | Expired/revoked token  | Clear session and token cache, re-authenticate           |
| 401 from Mastra                   | Token not attached     | Verify session cookie is sent (`credentials: "include"`) |
| CORS errors                       | Origin mismatch        | Check APP_URL matches frontend origin                    |
| Cookies not sent                  | SameSite/Secure issues | Use Lax for dev, verify HTTPS in prod                    |

## Development Workflow

### Starting Services

```bash
# Terminal 1: Mastra server (includes all auth routes + middleware)
bun run dev       # → http://localhost:4111

# Terminal 2: Vite frontend
bun run dev:app   # → http://localhost:5173
```

### Ports

| Service         | Port  |
| --------------- | ----- |
| Frontend (Vite) | 5173  |
| Mastra Server   | 4111  |
| Supabase        | 54321 |
| Supabase Studio | 54323 |

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
