# Auth Routes & Middleware on the Mastra Server

## Overview

Auth is integrated directly into the Mastra server—there is no separate process. Mastra runs a Hono server; auth routes are registered using `registerApiRoute` and the session validation middleware is registered via `ServerConfig.middleware`.

The browser communicates with only one backend: the Mastra server on port 4111. In development, Vite proxies both `/api` and `/auth` to it.

```
Browser (:5173) → Vite proxy → Mastra (:4111)
                                  ├── GET  /auth/login     (redirect to Microsoft)
                                  ├── GET  /auth/callback  (exchange code, set cookie)
                                  ├── POST /auth/logout    (delete session)
                                  ├── GET  /auth/me        (return user info)
                                  └── /api/*               (session middleware → agents/tools)
```

## Why Not a Separate Server?

|                           | Separate BFF              | Integrated (current)    |
| ------------------------- | ------------------------- | ----------------------- |
| Processes in dev          | 3 (Vite, BFF, Mastra)     | 2 (Vite, Mastra)        |
| Internal token forwarding | Yes (BFF → Mastra Bearer) | No                      |
| Deployment surface        | 2 services                | 1 service               |
| Token security            | Same — never in browser   | Same — never in browser |

## File Structure

```
src/mastra/auth/
├── index.ts         — re-exports for routes, middleware, types
├── routes.ts        — 4 OAuth routes via registerApiRoute
├── middleware.ts    — sessionAuthMiddleware (Hono middleware factory)
├── session-store.ts — CRUD against mastra_auth.sessions via supabase-js
└── token-refresh.ts — MSAL ConfidentialClientApplication singleton + refresh
```

## Implementation

### File: `src/mastra/auth/session-store.ts`

Session CRUD using `supabase-js` against the `mastra_auth.sessions` table.

```typescript
import { getSupabaseClient } from "../../services/supabase-client"
import type { Json } from "../../types/database.types"

export interface SessionUserInfo {
  name?: string
  email?: string
  groups?: string[]
}

export interface Session {
  id: string
  userId: string
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  userInfo: SessionUserInfo
}

function authSchema() {
  return getSupabaseClient().schema("mastra_auth")
}

export async function createSession(session: Session): Promise<void> {
  const { error } = await authSchema()
    .from("sessions")
    .insert({
      id: session.id,
      user_id: session.userId,
      access_token: session.accessToken,
      refresh_token: session.refreshToken ?? null,
      expires_at: session.expiresAt.toISOString(),
      user_info: session.userInfo as unknown as Json,
    })
  if (error) throw new Error(`Failed to create session: ${error.message}`)
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await authSchema()
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single()

  if (error) {
    if (error.code === "PGRST116") return null
    throw new Error(`Failed to get session: ${error.message}`)
  }

  return {
    id: data.id,
    userId: data.user_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? undefined,
    expiresAt: new Date(data.expires_at),
    userInfo: data.user_info as unknown as SessionUserInfo,
  }
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<Session, "accessToken" | "refreshToken" | "expiresAt">>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (updates.accessToken) patch.access_token = updates.accessToken
  if (updates.refreshToken) patch.refresh_token = updates.refreshToken
  if (updates.expiresAt) patch.expires_at = updates.expiresAt.toISOString()

  const { error } = await authSchema()
    .from("sessions")
    .update(patch)
    .eq("id", sessionId)
  if (error) throw new Error(`Failed to update session: ${error.message}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await authSchema()
    .from("sessions")
    .delete()
    .eq("id", sessionId)
  if (error) throw new Error(`Failed to delete session: ${error.message}`)
}

export async function deleteExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await authSchema()
    .from("sessions")
    .delete()
    .lt("expires_at", cutoff)
    .select("id")
  if (error)
    throw new Error(`Failed to delete expired sessions: ${error.message}`)
  return data?.length ?? 0
}
```

> **Note**: The `mastra_auth` schema must be in the generated types. The `supabase:gen-types`
> script includes `--schema mastra_auth`. Regenerate after applying the migration.

### File: `src/mastra/auth/token-refresh.ts`

MSAL `ConfidentialClientApplication` singleton for the OAuth flow and token refresh.

```typescript
import { ConfidentialClientApplication } from "@azure/msal-node"
import { updateSession, type Session } from "./session-store"

let _msalClient: ConfidentialClientApplication | null = null

export function getMsalClient(): ConfidentialClientApplication {
  if (_msalClient) return _msalClient
  const { AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID } = process.env
  if (!AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !AZURE_TENANT_ID) {
    throw new Error(
      "Missing AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_TENANT_ID",
    )
  }
  _msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: AZURE_CLIENT_ID,
      clientSecret: AZURE_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    },
  })
  return _msalClient
}

export function getScopes(): string[] {
  return [
    `api://${process.env.AZURE_CLIENT_ID}/access_as_user`,
    "offline_access",
  ]
}

export async function refreshAccessToken(
  session: Session,
): Promise<Session | null> {
  if (!session.refreshToken) return null
  try {
    const result = await getMsalClient().acquireTokenByRefreshToken({
      refreshToken: session.refreshToken,
      scopes: getScopes(),
    })
    if (!result) return null
    const updated: Session = {
      ...session,
      accessToken: result.accessToken,
      refreshToken: (result as any).refreshToken ?? session.refreshToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 3600 * 1000),
    }
    await updateSession(session.id, {
      accessToken: updated.accessToken,
      refreshToken: updated.refreshToken,
      expiresAt: updated.expiresAt,
    })
    return updated
  } catch (error) {
    console.error("Token refresh failed:", error)
    return null
  }
}
```

### File: `src/mastra/auth/routes.ts`

Four routes registered with `registerApiRoute`. All use `requiresAuth: false` since they are
the auth entry points themselves.

```typescript
import { registerApiRoute } from "@mastra/core/server"
import { getCookie, setCookie, deleteCookie } from "hono/cookie"
import crypto from "crypto"
import {
  createSession,
  getSession,
  deleteSession,
  type Session,
} from "./session-store"
import { getMsalClient, getScopes } from "./token-refresh"

const isProduction = () => process.env.NODE_ENV === "production"
const getAppUrl = () => process.env.APP_URL ?? "http://localhost:5173"

// GET /auth/login — redirect to Microsoft
export const authLoginRoute = registerApiRoute("/auth/login", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    const state = crypto.randomBytes(16).toString("hex")
    setCookie(c, "oauth_state", state, {
      httpOnly: true,
      secure: isProduction(),
      sameSite: "Lax",
      maxAge: 300,
      path: "/",
    })
    const authUrl = await getMsalClient().getAuthCodeUrl({
      scopes: getScopes(),
      redirectUri: `${getAppUrl()}/auth/callback`,
      state,
    })
    return c.redirect(authUrl)
  },
})

// GET /auth/callback — exchange code, create session, set cookie
export const authCallbackRoute = registerApiRoute("/auth/callback", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    const appUrl = getAppUrl()
    const code = c.req.query("code")
    const state = c.req.query("state")
    const storedState = getCookie(c, "oauth_state")
    deleteCookie(c, "oauth_state")

    const error = c.req.query("error")
    if (error)
      return c.redirect(`${appUrl}/login?error=${encodeURIComponent(error)}`)
    if (!state || state !== storedState)
      return c.redirect(`${appUrl}/login?error=invalid_state`)
    if (!code) return c.redirect(`${appUrl}/login?error=no_code`)

    try {
      const result = await getMsalClient().acquireTokenByCode({
        code,
        scopes: getScopes(),
        redirectUri: `${appUrl}/auth/callback`,
      })
      if (!result?.accessToken) throw new Error("No access token received")

      const sessionId = crypto.randomBytes(32).toString("hex")
      const session: Session = {
        id: sessionId,
        userId: result.account?.homeAccountId ?? result.uniqueId ?? "unknown",
        accessToken: result.accessToken,
        refreshToken: (result as any).refreshToken,
        expiresAt: result.expiresOn ?? new Date(Date.now() + 3600 * 1000),
        userInfo: {
          name: result.account?.name,
          email: result.account?.username,
          groups: (result.idTokenClaims as any)?.groups,
        },
      }
      await createSession(session)

      setCookie(c, "sid", sessionId, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "Lax",
        maxAge: 60 * 60 * 24,
        path: "/",
      })
      return c.redirect(appUrl)
    } catch (err) {
      console.error("Token exchange failed:", err)
      return c.redirect(`${appUrl}/login?error=token_exchange_failed`)
    }
  },
})

// POST /auth/logout — delete session, return Microsoft logout URL
export const authLogoutRoute = registerApiRoute("/auth/logout", {
  method: "POST",
  requiresAuth: false,
  handler: async (c) => {
    const sessionId = getCookie(c, "sid")
    if (sessionId) await deleteSession(sessionId)
    deleteCookie(c, "sid")
    const logoutUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(getAppUrl())}`
    return c.json({ success: true, logoutUrl })
  },
})

// GET /auth/me — return user info from session (no middleware, checks own cookie)
export const authMeRoute = registerApiRoute("/auth/me", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    const sessionId = getCookie(c, "sid")
    if (!sessionId) return c.json({ authenticated: false }, 401)

    const session = await getSession(sessionId)
    if (!session) {
      deleteCookie(c, "sid")
      return c.json({ authenticated: false }, 401)
    }
    return c.json({ authenticated: true, user: session.userInfo })
  },
})
```

### File: `src/mastra/auth/middleware.ts`

Path-scoped Hono middleware that validates the session cookie on every `/api/*` request.

```typescript
import { createMiddleware } from "hono/factory"
import { getCookie, deleteCookie } from "hono/cookie"
import { getSession, deleteSession } from "./session-store"
import { refreshAccessToken } from "./token-refresh"

export const sessionAuthMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "sid")
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401)

  let session = await getSession(sessionId)
  if (!session) {
    deleteCookie(c, "sid")
    return c.json({ error: "Session expired" }, 401)
  }

  // Auto-refresh if expiring within 5 minutes
  const bufferMs = 5 * 60 * 1000
  if (Date.now() > session.expiresAt.getTime() - bufferMs) {
    const refreshed = await refreshAccessToken(session)
    if (!refreshed) {
      await deleteSession(session.id)
      deleteCookie(c, "sid")
      return c.json({ error: "Session expired, please log in again" }, 401)
    }
    session = refreshed
  }

  c.set("session" as never, session)
  await next()
})
```

### File: `src/mastra/index.ts` (relevant section)

```typescript
import {
  authLoginRoute,
  authCallbackRoute,
  authLogoutRoute,
  authMeRoute,
  sessionAuthMiddleware,
} from "./auth"

export const mastra = new Mastra({
  // ...agents, storage, etc.
  server: {
    apiRoutes: [
      githubWebhookRoute,
      authLoginRoute,
      authCallbackRoute,
      authLogoutRoute,
      authMeRoute,
    ],
    middleware: [
      {
        path: "/api/*",
        handler: sessionAuthMiddleware,
      },
    ],
    cors: {
      origin: process.env.APP_URL ?? "http://localhost:5173",
      credentials: true,
    },
  },
})
```

> **Note**: `/api` is a reserved Mastra namespace—custom routes cannot use that prefix.
> The middleware `path: "/api/*"` is fine and correctly gates Mastra's own agent endpoints.

## Session Cleanup

### File: `scripts/cleanup-sessions.ts`

```typescript
import { deleteExpiredSessions } from "../src/mastra/auth/session-store"

async function main() {
  const deleted = await deleteExpiredSessions()
  console.log(`Deleted ${deleted} expired sessions`)
}

main().catch(console.error)
```

Run with `bun scripts/cleanup-sessions.ts`.

## Database Migration

Apply `supabase/migrations/20260218120000_mastra_auth_schema.sql` which creates:

- `mastra_auth.sessions` — id, user_id, access_token, refresh_token, expires_at, user_info (JSONB), timestamps
- `mastra_auth.msal_token_cache` — for future OBO/Graph token caching
- Auto-update triggers on `updated_at`

```bash
# Apply migration
supabase migration up --local

# Regenerate types (mastra_auth schema is included)
bun run supabase:gen-types
```

## Development Workflow

Only two services needed:

```bash
# Terminal 1: Mastra server (auth routes included)
bun run dev        # → http://localhost:4111

# Terminal 2: Vite frontend
bun run dev:app    # → http://localhost:5173
```

Vite proxies `/api` and `/auth` to `:4111` automatically (configured in `vite.config.ts`).

## Security Considerations

1. **Cookie security**: `httpOnly` blocks JS access; `secure: true` in production; `sameSite: "Lax"` prevents CSRF for most cases
2. **State parameter**: `crypto.randomBytes(16)` stored in a short-lived httpOnly cookie, validated in the callback
3. **Token refresh**: Automatic pre-expiry refresh (5-minute buffer); session deleted on failure
4. **Tokens never reach the browser**: Only the `sid` cookie leaves the server

## Error Responses

```json
{ "error": "Unauthorized" }                          // 401 — no session cookie
{ "error": "Session expired" }                       // 401 — session not in DB
{ "error": "Session expired, please log in again" }  // 401 — token refresh failed
```

Frontend redirects to `/auth/login` on any 401.
