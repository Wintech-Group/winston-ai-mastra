# Mastra + Microsoft Entra Authentication System

## Overview

This documentation describes a complete authentication and authorization system for a Mastra-based AI agent platform using Microsoft Entra ID (Azure AD). The system provides:

- **JWT Authentication**: Token verification using JWKS (JSON Web Key Sets)
- **Group-Based RBAC**: Access control using Entra security groups
- **Dynamic Agent Configuration**: Runtime filtering of tools/agents based on user permissions
- **Microsoft Graph Integration**: On-Behalf-Of (OBO) flow for accessing user data
- **BFF Security Pattern**: Backend-for-Frontend keeps tokens server-side

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  No tokens in browser - just httpOnly session cookie                    ││
│  │  fetch('/api/...') - cookie sent automatically                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS + httpOnly Cookie
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         BFF LAYER (Auth Proxy)                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ ││
│  │  │ /auth/login  │  │ /auth/callback│  │ /api/* proxy                  │ ││
│  │  │ /auth/logout │  │ /auth/refresh │  │ (attaches Bearer token)       │ ││
│  │  └──────────────┘  └──────────────┘  └────────────────────────────────┘ ││
│  │                            │                                             ││
│  │                    ┌───────┴───────┐                                     ││
│  │                    │ Session Store │ (PostgreSQL)                        ││
│  │                    │ - accessToken │                                     ││
│  │                    │ - refreshToken│                                     ││
│  │                    │ - expiresAt   │                                     ││
│  │                    └───────────────┘                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      │ Bearer Token (internal)               │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         MASTRA SERVER                                   ││
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐  ││
│  │  │  MastraAuthEntra│───>│   Middleware     │───>│   RequestContext  │  ││
│  │  │  (JWKS verify)  │    │  (inject user)   │    │   { user, token } │  ││
│  │  └─────────────────┘    └──────────────────┘    └───────────────────┘  ││
│  │                                                            │            ││
│  │  ┌─────────────────────────────────────────────────────────┼──────────┐││
│  │  │                      ORCHESTRATOR AGENT                 ▼          │││
│  │  │  ┌─────────────────────────────────────────────────────────────┐  │││
│  │  │  │  Dynamic Configuration (filtered by user groups)            │  │││
│  │  │  │  ├── tools: { weatherTool, searchTool, ... }                │  │││
│  │  │  │  ├── agents: { financeAgent, hrAgent, ... }                 │  │││
│  │  │  │  └── workflows: { reportWorkflow, ... }                     │  │││
│  │  │  └─────────────────────────────────────────────────────────────┘  │││
│  │  └────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                      │                                       │
│                                      │ OBO Token Exchange                    │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    GRAPH TOKEN SERVICE                                  ││
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐  ││
│  │  │  MSAL-Node      │───>│  PostgreSQL      │───>│  Microsoft Graph  │  ││
│  │  │  (OBO flow)     │    │  Token Cache     │    │  API              │  ││
│  │  └─────────────────┘    └──────────────────┘    └───────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Backend-for-Frontend (BFF) Pattern

**Decision**: Handle OAuth flow server-side, store tokens in server session, use httpOnly cookies.

**Rationale**:
- Application is publicly accessible (no VPN/firewall)
- Tokens never exposed to JavaScript—mitigates XSS token theft
- Attacker with XSS can make requests during session but cannot exfiltrate tokens
- Industry standard for public-facing SPAs with sensitive data

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

| Document | Purpose |
|----------|---------|
| [02-AZURE-CONFIGURATION.md](./02-AZURE-CONFIGURATION.md) | Azure Portal setup steps |
| [03-AUTH-PROVIDER.md](./03-AUTH-PROVIDER.md) | Custom Entra auth provider implementation |
| [04-RBAC-PERMISSIONS.md](./04-RBAC-PERMISSIONS.md) | Group-based permission system |
| [05-DYNAMIC-AGENT-CONFIG.md](./05-DYNAMIC-AGENT-CONFIG.md) | Runtime filtering of agent capabilities |
| [06-GRAPH-INTEGRATION.md](./06-GRAPH-INTEGRATION.md) | OBO flow and token caching |
| [07-BFF-SERVER.md](./07-BFF-SERVER.md) | Backend-for-Frontend auth proxy |
| [08-FRONTEND-INTEGRATION.md](./08-FRONTEND-INTEGRATION.md) | React frontend (no client-side tokens) |
| [09-ENVIRONMENT-VARIABLES.md](./09-ENVIRONMENT-VARIABLES.md) | Required configuration |
| [10-QUICK-START.md](./10-QUICK-START.md) | Implementation checklist |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Framework | Mastra |
| BFF Server | Hono |
| Frontend | React + Vite |
| Auth Provider | Microsoft Entra ID |
| Token Verification | `@mastra/auth` (verifyJwks) |
| Server Auth | `@azure/msal-node` |
| Graph Client | `@microsoft/microsoft-graph-client` |
| Storage | PostgreSQL |
| Session Store | PostgreSQL (mastra_auth schema) |
| Token Cache | PostgreSQL (mastra_auth schema) |

## Security Model

| Threat | Mitigation |
|--------|------------|
| XSS token theft | Tokens in httpOnly cookies, never in JS |
| CSRF | SameSite cookies + CSRF tokens |
| Token replay | Short-lived access tokens, server-side refresh |
| Session hijacking | Secure cookies, HTTPS only |
| Privilege escalation | Server-side group verification on every request |

## Prerequisites

- Microsoft Entra ID tenant with admin access
- Azure App Registration (Web platform, not SPA)
- PostgreSQL database
- Node.js 18+ or Bun runtime
