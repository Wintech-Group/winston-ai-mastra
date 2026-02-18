/**
 * OAuth auth routes attached to the Mastra server.
 *
 *   GET  /auth/login    → redirect to Microsoft login
 *   GET  /auth/callback → handle OAuth callback, create session
 *   POST /auth/logout   → destroy session
 *   GET  /auth/me       → return current user info from session
 */

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

function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:5173"
}

// ────────────────────────────────────────────────────────────
// GET /auth/login — redirect to Microsoft
// ────────────────────────────────────────────────────────────

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

    const appUrl = getAppUrl()
    const msalClient = getMsalClient()
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: getScopes(),
      redirectUri: `${appUrl}/auth/callback`,
      state,
    })

    return c.redirect(authUrl)
  },
})

// ────────────────────────────────────────────────────────────
// GET /auth/callback — exchange code for tokens, create session
// ────────────────────────────────────────────────────────────

export const authCallbackRoute = registerApiRoute("/auth/callback", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    const appUrl = getAppUrl()
    const code = c.req.query("code")
    const state = c.req.query("state")
    const storedState = getCookie(c, "oauth_state")
    const error = c.req.query("error")
    const errorDescription = c.req.query("error_description")

    deleteCookie(c, "oauth_state")

    if (error) {
      console.error("OAuth error:", error, errorDescription)
      return c.redirect(`${appUrl}/login?error=${encodeURIComponent(error)}`)
    }

    if (!state || state !== storedState) {
      console.error("State mismatch:", {
        received: state,
        expected: storedState,
      })
      return c.redirect(`${appUrl}/login?error=invalid_state`)
    }

    if (!code) {
      return c.redirect(`${appUrl}/login?error=no_code`)
    }

    try {
      const msalClient = getMsalClient()
      const result = await msalClient.acquireTokenByCode({
        code,
        scopes: getScopes(),
        redirectUri: `${appUrl}/auth/callback`,
      })

      if (!result?.accessToken) {
        throw new Error("No access token received")
      }

      const sessionId = crypto.randomBytes(32).toString("hex")
      const session: Session = {
        id: sessionId,
        userId: result.account?.homeAccountId ?? result.uniqueId ?? "unknown",
        accessToken: result.accessToken,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        refreshToken: (result as any).refreshToken,
        expiresAt: result.expiresOn ?? new Date(Date.now() + 3600 * 1000),
        userInfo: {
          name: result.account?.name,
          email: result.account?.username,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          groups: (result.idTokenClaims as any)?.groups,
        },
      }

      await createSession(session)

      setCookie(c, "sid", sessionId, {
        httpOnly: true,
        secure: isProduction(),
        sameSite: "Lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      })

      return c.redirect(appUrl)
    } catch (err) {
      console.error("Token exchange failed:", err)
      return c.redirect(`${appUrl}/login?error=token_exchange_failed`)
    }
  },
})

// ────────────────────────────────────────────────────────────
// POST /auth/logout — destroy session
// ────────────────────────────────────────────────────────────

export const authLogoutRoute = registerApiRoute("/auth/logout", {
  method: "POST",
  requiresAuth: false,
  handler: async (c) => {
    const sessionId = getCookie(c, "sid")

    if (sessionId) {
      await deleteSession(sessionId)
    }

    deleteCookie(c, "sid")

    const tenantId = process.env.AZURE_TENANT_ID
    const appUrl = getAppUrl()
    const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(appUrl)}`

    return c.json({ success: true, logoutUrl })
  },
})

// ────────────────────────────────────────────────────────────
// GET /auth/me — return current user info
// ────────────────────────────────────────────────────────────

export const authMeRoute = registerApiRoute("/auth/me", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    const sessionId = getCookie(c, "sid")

    if (!sessionId) {
      return c.json({ authenticated: false }, 401)
    }

    const session = await getSession(sessionId)

    if (!session) {
      deleteCookie(c, "sid")
      return c.json({ authenticated: false }, 401)
    }

    return c.json({
      authenticated: true,
      user: session.userInfo,
    })
  },
})
