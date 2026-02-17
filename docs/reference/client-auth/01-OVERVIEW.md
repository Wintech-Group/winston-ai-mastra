# Mastra + Microsoft Entra Authentication System

## Overview

This documentation describes a complete authentication and authorization system for a Mastra-based AI agent platform using Microsoft Entra ID (Azure AD). The system provides:

- **JWT Authentication**: Token verification using JWKS (JSON Web Key Sets)
- **Group-Based RBAC**: Access control using Entra security groups
- **Dynamic Agent Configuration**: Runtime filtering of tools/agents based on user permissions
- **Microsoft Graph Integration**: On-Behalf-Of (OBO) flow for accessing user data

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React + Vite)                         │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐   │
│  │   MSAL.js       │───>│  MastraClient    │───>│  Agent UI Components  │   │
│  │   (OAuth flow)  │    │  (Bearer token)  │    │                       │   │
│  └─────────────────┘    └──────────────────┘    └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS + Bearer Token
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MASTRA SERVER (Bun)                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────────┐   │
│  │  MastraAuthEntra│───>│   Middleware     │───>│   RequestContext      │   │
│  │  (JWKS verify)  │    │  (inject user)   │    │   { user, userToken } │   │
│  └─────────────────┘    └──────────────────┘    └───────────────────────┘   │
│                                                            │                 │
│  ┌─────────────────────────────────────────────────────────┼───────────────┐│
│  │                      ORCHESTRATOR AGENT                 ▼               ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │  Dynamic Configuration (filtered by user groups)                │   ││
│  │  │  ├── tools: { weatherTool, searchTool, ... }                    │   ││
│  │  │  ├── agents: { financeAgent, hrAgent, ... }                     │   ││
│  │  │  └── workflows: { reportWorkflow, ... }                         │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
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

### 1. Custom Auth Provider with JWKS

**Decision**: Use `verifyJwks()` from `@mastra/auth` instead of Supabase Auth or Auth0.

**Rationale**:

- Direct integration with MS Entra, no middleware dependency
- Uses standard OIDC patterns (not "rolling your own auth")
- MS Entra exposes a public JWKS endpoint for signature verification
- Reduces external dependencies and potential points of failure

### 2. Centralized Authorization via Dynamic Configuration

**Decision**: Filter tools/agents/workflows at runtime using dynamic configuration functions.

**Rationale**:

- The orchestrator LLM never sees restricted resources (security by omission)
- No "access denied" messages that reveal resource existence
- Single source of truth for permissions mapping
- Clean separation between authentication (who you are) and authorization (what you can do)

### 3. On-Behalf-Of Flow for Graph Access

**Decision**: Use OBO flow with server-side token caching instead of passing Graph tokens from frontend.

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
| [07-FRONTEND-INTEGRATION.md](./07-FRONTEND-INTEGRATION.md)   | React + MSAL.js setup                     |
| [08-ENVIRONMENT-VARIABLES.md](./08-ENVIRONMENT-VARIABLES.md) | Required configuration                    |

## Technology Stack

| Component          | Technology                                 |
| ------------------ | ------------------------------------------ |
| Runtime            | Bun                                        |
| Framework          | Mastra                                     |
| Frontend           | React + Vite                               |
| Auth Provider      | Microsoft Entra ID                         |
| Token Verification | `@mastra/auth` (verifyJwks)                |
| Frontend Auth      | `@azure/msal-browser`, `@azure/msal-react` |
| Graph Client       | `@microsoft/microsoft-graph-client`        |
| OBO Flow           | `@azure/msal-node`                         |
| Storage            | PostgreSQL                                 |
| Token Cache        | PostgreSQL (mastra_auth schema)            |

## Prerequisites

- Microsoft Entra ID tenant with admin access
- Azure App Registration
- PostgreSQL database
- Node.js 18+ or Bun runtime
