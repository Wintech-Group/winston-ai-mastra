/**
 * Middleware that validates the session cookie on protected routes.
 *
 * Reads the `sid` httpOnly cookie, looks up the session in the DB,
 * and refreshes the access token if it's about to expire.
 * Returns 401 if no valid session exists.
 */

import { createMiddleware } from "hono/factory"
import { getCookie, deleteCookie } from "hono/cookie"
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
} from "@mastra/core/request-context"
import { getSession, deleteSession } from "./session-store"
import { refreshAccessToken } from "./token-refresh"
import type { SessionContextType } from "./request-context"

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

  // Make session data available to Hono route handlers
  c.set("session" as never, session)

  // Populate Mastra's RequestContext so agents and tools get typed session data
  const requestContext = c.get("requestContext" as never) as
    | RequestContext<SessionContextType>
    | undefined

  requestContext?.set("session", {
    userId: session.userId,
    userInfo: session.userInfo,
  })

  // Pass through the client's IANA timezone (e.g. "Europe/London")
  const timezone = c.req.header("X-Timezone")
  if (timezone) {
    requestContext?.set("timezone", timezone)
  }

  // Enforce user isolation — all memory/thread operations are scoped to this user
  // Cast to base RequestContext since MASTRA_RESOURCE_ID_KEY is a reserved internal key
  ;(requestContext as RequestContext | undefined)?.set(
    MASTRA_RESOURCE_ID_KEY,
    session.userId,
  )

  await next()
})
