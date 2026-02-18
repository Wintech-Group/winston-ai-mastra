/**
 * Middleware that validates the session cookie on protected routes.
 *
 * Reads the `sid` httpOnly cookie, looks up the session in the DB,
 * and refreshes the access token if it's about to expire.
 * Returns 401 if no valid session exists.
 */

import { createMiddleware } from "hono/factory"
import { getCookie, deleteCookie } from "hono/cookie"
import { getSession, deleteSession } from "./session-store"
import { refreshAccessToken } from "./token-refresh"

export const sessionAuthMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "sid")

  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  let session = await getSession(sessionId)

  if (!session) {
    deleteCookie(c, "sid")
    return c.json({ error: "Session expired" }, 401)
  }

  // Refresh token if expiring within 5 minutes
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

  // Make session data available to downstream handlers
  c.set("session" as never, session)

  await next()
})
