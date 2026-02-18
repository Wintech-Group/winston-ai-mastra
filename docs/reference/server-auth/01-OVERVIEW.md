# Mastra + Microsoft Entra Authentication System

## Overview

This documentation describes a complete authentication and authorization system for a Mastra-based AI agent platform using Microsoft Entra ID (Azure AD). The system provides:

- **JWT Authentication**: Token verification using JWKS (JSON Web Key Sets)
- **Group-Based RBAC**: Access control using Entra security groups
- **Dynamic Agent Configuration**: Runtime filtering of tools/agents based on user permissions
- **Microsoft Graph Integration**: On-Behalf-Of (OBO) flow for accessing user data
- **Server-Side Session Security**: Tokens stored in Supabase, browser receives only an httpOnly session cookie

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite :5173)                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  No tokens in browser - just httpOnly session cookie                    ││
│  │  fetch('/api/...') - cookie sent automatically (proxied to :4111)       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS + httpOnly Cookie
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MASTRA SERVER (:4111)                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │               Auth Routes (registerApiRoute)                            ││
│  │  ┌──────────────┐  ┌───────────────┐  ┌────────────┐  ┌─────────────┐  ││
│  │  │ GET          │  │ GET           │  │ POST       │  │ GET         │  ││
│  │  │ /auth/login  │  │ /auth/callback│  │/auth/logout│  │ /auth/me    │  ││
│  │  └──────────────┘  └───────────────┘  └────────────┘  └─────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                             ┌────────┴────────┐                              │
│                             │  Session Store   │ (Supabase / PostgreSQL)     │
│                             │  - accessToken   │                              │
│                             │  - refreshToken  │                              │
│                             │  - expiresAt     │                              │
│                             └─────────────────┘                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │           Session Middleware (path: /api/*)                             ││
│  │  reads sid cookie → validates session → auto-refreshes token           ││
│  │  → injects session into request context → 401 if invalid               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         MASTRA AGENTS / TOOLS                           ││
│  │  ┌──────────────────────────────────────────────────────────────────┐  ││
│  │  │  Dynamic Configuration (filtered by user groups – future RBAC)   │  ││
│  │  │  ├── tools: { weatherTool, searchTool, ... }                     │  ││
│  │  │  ├── agents: { financeAgent, hrAgent, ... }                      │  ││
│  │  │  └── workflows: { reportWorkflow, ... }                          │  ││
│  │  └──────────────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      │ OBO Token Exchange (future)           │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    GRAPH TOKEN SERVICE (future)                         ││
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐  ││
│  │  │  MSAL-Node      │───>│  Supabase        │───>│  Microsoft Graph  │  ││
│  │  │  (OBO flow)     │    │  Token Cache     │    │  API              │  ││
│  │  └─────────────────┘    └──────────────────┘    └───────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Auth Integrated into the Mastra Server

**Decision**: Auth routes (`/auth/*`) and session middleware are registered directly on the existing Mastra Hono server via `registerApiRoute` and `ServerConfig.middleware`—no separate BFF process.

**Rationale**:

- Mastra already runs a Hono server; there is no reason for a second one
- Routes registered with `registerApiRoute` are first-class Hono routes
- `ServerConfig.middleware` supports path-scoped middleware (e.g. `/api/*`)
- Fewer moving parts in development and production
- Tokens never exposed to JavaScript—mitigates XSS token theft

### 2. Custom Auth Provider with JWKS

**Decision**: Use `verifyJwks()` from `@mastra/auth` instead of Supabase Auth or Auth0.

**Rationale**:

- Direct integration with MS Entra, no middleware dependency
- Uses standard OIDC patterns (not "rolling your own auth")
- MS Entra exposes a public JWKS endpoint for signature verification
- Reduces external dependencies and potential points of failure

### 3. Centralized Authorization via Dynamic Configuration

**Decision**: Filter tools/agents/workflows at runtime using dynamic configuration functions.

**Rationale**:

- The orchestrator LLM never sees restricted resources (security by omission)
- No "access denied" messages that reveal resource existence
- Single source of truth for permissions mapping
- Clean separation between authentication (who you are) and authorization (what you can do)

### 4. On-Behalf-Of Flow for Graph Access

**Decision**: Use OBO flow with server-side token caching.

**Rationale**:

- Tokens stay server-side (more secure)
- Follows principle of least privilege
- Backend controls which Graph scopes are used
- Token caching reduces latency and Entra rate limit pressure

## Document Index

| Document                                                     | Purpose                                   |
| ------------------------------------------------------------ | ----------------------------------------- |
| [02-AZURE-CONFIGURATION.md](./02-AZURE-CONFIGURATION.md)     | Azure Portal setup steps                  |
| [03-AUTH-PROVIDER.md](./03-AUTH-PROVIDER.md)                 | Custom Entra auth provider implementation |
| [04-RBAC-PERMISSIONS.md](./04-RBAC-PERMISSIONS.md)           | Group-based permission system             |
| [05-DYNAMIC-AGENT-CONFIG.md](./05-DYNAMIC-AGENT-CONFIG.md)   | Runtime filtering of agent capabilities   |
| [06-GRAPH-INTEGRATION.md](./06-GRAPH-INTEGRATION.md)         | OBO flow and token caching                |
| [07-BFF-SERVER.md](./07-BFF-SERVER.md)                       | Auth routes & middleware on Mastra server |
| [08-FRONTEND-INTEGRATION.md](./08-FRONTEND-INTEGRATION.md)   | React frontend (no client-side tokens)    |
| [09-ENVIRONMENT-VARIABLES.md](./09-ENVIRONMENT-VARIABLES.md) | Required configuration                    |
| [10-QUICK-START.md](./10-QUICK-START.md)                     | Implementation checklist                  |

## Technology Stack

| Component          | Technology                                        |
| ------------------ | ------------------------------------------------- |
| Runtime            | Bun                                               |
| Framework          | Mastra                                            |
| Auth Routes        | `registerApiRoute` on Mastra server               |
| Auth Middleware    | `ServerConfig.middleware` on Mastra server        |
| Frontend           | React + Vite                                      |
| Auth Provider      | Microsoft Entra ID                                |
| Token Verification | `@mastra/auth` (verifyJwks) — future RBAC         |
| Server Auth        | `@azure/msal-node`                                |
| Graph Client       | `@microsoft/microsoft-graph-client` — future      |
| Storage            | Supabase / PostgreSQL                             |
| Session Store      | Supabase (`mastra_auth` schema via `supabase-js`) |
| Token Cache        | Supabase (`mastra_auth` schema via `supabase-js`) |

## Security Model

| Threat               | Mitigation                                      |
| -------------------- | ----------------------------------------------- |
| XSS token theft      | Tokens in httpOnly cookies, never in JS         |
| CSRF                 | SameSite cookies + CSRF tokens                  |
| Token replay         | Short-lived access tokens, server-side refresh  |
| Session hijacking    | Secure cookies, HTTPS only                      |
| Privilege escalation | Server-side group verification on every request |

## Prerequisites

- Microsoft Entra ID tenant with admin access
- Azure App Registration (Web platform, not SPA)
- PostgreSQL database
- Node.js 18+ or Bun runtime
