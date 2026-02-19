/**
 * Token refresh using MSAL ConfidentialClientApplication.
 *
 * Shared between the auth middleware (automatic refresh) and
 * the auth routes (initial token acquisition).
 */

import { ConfidentialClientApplication } from "@azure/msal-node"
import { updateSession, type Session } from "./session-store"

function getAzureConfig() {
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const tenantId = process.env.AZURE_TENANT_ID
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      "Missing AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_TENANT_ID",
    )
  }
  return { clientId, clientSecret, tenantId }
}

let _msalClient: ConfidentialClientApplication | null = null

export function getMsalClient(): ConfidentialClientApplication {
  if (_msalClient) return _msalClient
  const { clientId, clientSecret, tenantId } = getAzureConfig()
  _msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  })
  return _msalClient
}

export function getScopes(): string[] {
  const { clientId } = getAzureConfig()
  return [
    `api://${clientId}/access_as_user`,
    "openid",
    "profile",
    "email",
    "offline_access",
  ]
}

export async function refreshAccessToken(
  session: Session,
): Promise<Session | null> {
  if (!session.refreshToken) {
    console.warn("No refresh token available for session:", session.id)
    return null
  }

  try {
    const msalClient = getMsalClient()
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken: session.refreshToken,
      scopes: getScopes(),
    })

    if (!result) return null

    const claims = result.idTokenClaims as Record<string, unknown> | undefined

    const updatedSession: Session = {
      ...session,
      accessToken: result.accessToken,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      refreshToken: (result as any).refreshToken ?? session.refreshToken,
      expiresAt: result.expiresOn ?? new Date(Date.now() + 3600 * 1000),
      userInfo: {
        ...session.userInfo,
        // Overwrite with refreshed claims when present
        ...(claims && {
          name: result.account?.name ?? session.userInfo.name,
          givenName:
            (claims.given_name as string | undefined) ??
            session.userInfo.givenName,
          familyName:
            (claims.family_name as string | undefined) ??
            session.userInfo.familyName,
          email: (claims.email as string | undefined) ?? session.userInfo.email,
          preferredUsername:
            (claims.preferred_username as string | undefined) ??
            session.userInfo.preferredUsername,
          groups:
            (claims.groups as string[] | undefined) ?? session.userInfo.groups,
        }),
      },
    }

    await updateSession(session.id, {
      accessToken: updatedSession.accessToken,
      refreshToken: updatedSession.refreshToken,
      expiresAt: updatedSession.expiresAt,
    })

    return updatedSession
  } catch (error) {
    console.error("Token refresh failed:", error)
    return null
  }
}
