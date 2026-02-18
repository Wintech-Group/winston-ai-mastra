# Custom Entra Auth Provider

> **Planning Document**: This describes the `MastraAuthEntra` JWKS-verification layer planned for the RBAC phase. The current implementation uses session-cookie auth with `registerApiRoute` (see [07-AUTH-ROUTES.md](./07-AUTH-ROUTES.md)). This provider will be added on top once RBAC is implemented.

## Overview

This document describes the custom authentication provider that verifies JWTs from Microsoft Entra ID using JWKS (JSON Web Key Sets). The provider extends Mastra's `MastraAuthProvider` class and uses the `verifyJwks()` helper from `@mastra/auth`.

In the Mastra-integrated auth architecture, this provider verifies tokens forwarded to the Mastra server by the auth middleware. The tokens themselves are stored server-side in Supabase and never exposed to the browser.

## Installation

```bash
pnpm add @mastra/auth@latest
```

## Implementation

### File: `src/mastra/auth/entra-auth.ts`

```typescript
import { MastraAuthProvider } from "@mastra/core/server"
import type { MastraAuthProviderOptions } from "@mastra/core/server"
import { verifyJwks } from "@mastra/auth"
import type { JwtPayload } from "@mastra/auth"

/**
 * Extended JWT payload with Entra-specific claims
 */
export type EntraUser = JwtPayload & {
  /** Object ID - unique, immutable user identifier */
  oid?: string
  /** User Principal Name (usually email) */
  preferred_username?: string
  /** Display name */
  name?: string
  /** Email address (if email claim is configured) */
  email?: string
  /** Security group Object IDs */
  groups?: string[]
  /** App roles (alternative to groups) */
  roles?: string[]
  /** Indicates groups overage (200+ groups) */
  _hasGroupsOverage?: boolean
}

/**
 * Map of group names to their Entra Object IDs
 *
 * Get Object IDs from: Azure Portal → Entra ID → Groups → [Group] → Object Id
 *
 * Update these values with your actual group Object IDs
 */
export const ENTRA_GROUPS = {
  FINANCE: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  HR: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  ENGINEERING: "c3d4e5f6-a7b8-9012-cdef-123456789012",
  MARKETING: "d4e5f6a7-b8c9-0123-def1-234567890123",
  ADMINS: "e5f6a7b8-c9d0-1234-ef12-345678901234",
} as const

export type GroupName = keyof typeof ENTRA_GROUPS

/**
 * Configuration options for the Entra auth provider
 */
interface EntraAuthOptions extends MastraAuthProviderOptions<EntraUser> {
  /** Azure AD tenant ID (defaults to AZURE_TENANT_ID env var) */
  tenantId?: string
  /** Application (client) ID (defaults to AZURE_CLIENT_ID env var) */
  clientId?: string
}

/**
 * Custom Mastra auth provider for Microsoft Entra ID
 *
 * Verifies JWTs using Microsoft's public JWKS endpoint and extracts
 * user information including security group memberships.
 */
export class MastraAuthEntra extends MastraAuthProvider<EntraUser> {
  private jwksUri: string
  private issuer: string
  private clientId: string

  constructor(options?: EntraAuthOptions) {
    super({ name: options?.name ?? "ms-entra" })

    const tenantId = options?.tenantId ?? process.env.AZURE_TENANT_ID
    const clientId = options?.clientId ?? process.env.AZURE_CLIENT_ID

    if (!tenantId || !clientId) {
      throw new Error(
        "MastraAuthEntra requires Azure tenant ID and client ID. " +
          "Provide via constructor options or AZURE_TENANT_ID/AZURE_CLIENT_ID environment variables.",
      )
    }

    // Microsoft Entra v2.0 endpoints
    this.jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
    this.issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`
    this.clientId = clientId

    this.registerOptions(options)
  }

  /**
   * Verifies the JWT signature using Microsoft's JWKS endpoint
   * and validates the token claims.
   */
  async authenticateToken(token: string): Promise<EntraUser | null> {
    try {
      // Verify signature using Microsoft's public keys
      const payload = (await verifyJwks(token, this.jwksUri)) as EntraUser

      // Validate issuer matches our tenant
      if (payload.iss !== this.issuer) {
        console.warn(
          "Token issuer mismatch:",
          payload.iss,
          "expected:",
          this.issuer,
        )
        return null
      }

      // Validate audience matches our application
      if (payload.aud !== this.clientId) {
        console.warn(
          "Token audience mismatch:",
          payload.aud,
          "expected:",
          this.clientId,
        )
        return null
      }

      // Check for groups overage (user has 200+ groups)
      // In this case, groups must be fetched from Graph API
      if ((payload as any)._claim_names?.groups) {
        payload._hasGroupsOverage = true
        console.info("Groups overage detected for user:", payload.oid)
      }

      return payload
    } catch (error) {
      console.error("Token verification failed:", error)
      return null
    }
  }

  /**
   * Authorizes the user after successful authentication.
   * Override this method to add custom authorization logic.
   */
  async authorizeUser(user: EntraUser): Promise<boolean> {
    // Check token expiration
    if (user.exp && user.exp * 1000 < Date.now()) {
      console.warn("Token expired for user:", user.oid)
      return false
    }

    // Require valid subject or object ID
    if (!user.sub && !user.oid) {
      console.warn("Token missing subject and object ID")
      return false
    }

    // Add additional authorization logic here if needed
    // For example: check if user is in a required base group

    return true
  }

  // ============================================================
  // Static Helper Methods for Group Checks
  // ============================================================

  /**
   * Check if a user is a member of a specific group
   */
  static userInGroup(user: EntraUser, groupName: GroupName): boolean {
    const groupId = ENTRA_GROUPS[groupName]
    return user.groups?.includes(groupId) ?? false
  }

  /**
   * Check if a user is a member of ANY of the specified groups
   */
  static userInAnyGroup(user: EntraUser, groupNames: GroupName[]): boolean {
    return groupNames.some((name) => this.userInGroup(user, name))
  }

  /**
   * Check if a user is a member of ALL specified groups
   */
  static userInAllGroups(user: EntraUser, groupNames: GroupName[]): boolean {
    return groupNames.every((name) => this.userInGroup(user, name))
  }

  /**
   * Get the list of group names a user belongs to
   */
  static getUserGroupNames(user: EntraUser): GroupName[] {
    if (!user.groups) return []

    return Object.entries(ENTRA_GROUPS)
      .filter(([_, groupId]) => user.groups!.includes(groupId))
      .map(([name]) => name as GroupName)
  }

  /**
   * Get a display-friendly identifier for the user
   */
  static getUserDisplayName(user: EntraUser): string {
    return (
      user.name ||
      user.preferred_username ||
      user.email ||
      user.oid ||
      "Unknown User"
    )
  }
}
```

## Handling Groups Overage

When a user belongs to 200+ groups, Entra doesn't include the groups directly in the token. Instead, you must call Microsoft Graph to fetch them.

### File: `src/mastra/auth/entra-groups-resolver.ts`

```typescript
import { Client } from "@microsoft/microsoft-graph-client"
import type { EntraUser } from "./entra-auth"

/**
 * Fetches user's group memberships from Microsoft Graph
 *
 * Use this when groups overage is detected (_hasGroupsOverage = true)
 */
export async function fetchUserGroupsFromGraph(
  accessToken: string,
  userId: string,
): Promise<string[]> {
  const client = Client.init({
    authProvider: (done) => done(null, accessToken),
  })

  try {
    // Get all group memberships (handles pagination automatically)
    const groups: string[] = []
    let response = await client
      .api(`/users/${userId}/memberOf`)
      .select("id")
      .top(999)
      .get()

    while (response) {
      const groupIds = response.value
        .filter(
          (member: any) => member["@odata.type"] === "#microsoft.graph.group",
        )
        .map((group: any) => group.id)

      groups.push(...groupIds)

      // Handle pagination
      if (response["@odata.nextLink"]) {
        response = await client.api(response["@odata.nextLink"]).get()
      } else {
        break
      }
    }

    return groups
  } catch (error) {
    console.error("Failed to fetch groups from Graph:", error)
    throw error
  }
}

/**
 * Resolves groups for a user, fetching from Graph if overage detected
 */
export async function resolveUserGroups(
  user: EntraUser,
  graphAccessToken?: string,
): Promise<string[]> {
  // If groups are in the token, use them directly
  if (user.groups && !user._hasGroupsOverage) {
    return user.groups
  }

  // If overage detected, fetch from Graph
  if (user._hasGroupsOverage) {
    if (!graphAccessToken) {
      console.warn("Groups overage detected but no Graph token provided")
      return []
    }

    const userId = user.oid || user.sub
    if (!userId) {
      console.warn("No user ID available for Graph query")
      return []
    }

    return fetchUserGroupsFromGraph(graphAccessToken, userId)
  }

  // No groups available
  return []
}
```

## Registering the Auth Provider

### File: `src/mastra/index.ts`

```typescript
import { Mastra } from "@mastra/core"
import { PostgresStore } from "@mastra/pg"
import { MastraAuthEntra, type EntraUser } from "./auth/entra-auth"
import { orchestrator } from "./agents/orchestrator"

export const mastra = new Mastra({
  agents: { orchestrator },

  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),

  server: {
    // Register the custom auth provider
    auth: new MastraAuthEntra(),

    // Middleware to inject user into RequestContext
    middleware: [
      async (c, next) => {
        const user = c.get("user") as EntraUser
        const authHeader = c.req.header("Authorization")
        const userToken = authHeader?.replace("Bearer ", "")

        if (user && userToken) {
          // Make user and token available to all agent configuration functions
          c.set("requestContext", {
            user,
            userToken,
            userId: user.oid ?? user.sub,
          })
        }

        await next()
      },
    ],
  },
})
```

## Type Exports

For use throughout your application, re-export the types:

### File: `src/mastra/auth/index.ts`

```typescript
export { MastraAuthEntra, ENTRA_GROUPS } from "./entra-auth"
export type { EntraUser, GroupName } from "./entra-auth"
export {
  fetchUserGroupsFromGraph,
  resolveUserGroups,
} from "./entra-groups-resolver"
```

## Testing the Auth Provider

### Manual Token Test

```typescript
// scripts/test-auth.ts
import { MastraAuthEntra } from "../src/mastra/auth"

const authProvider = new MastraAuthEntra()

// Get a token from your active Supabase session (log it during development)
const testToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs..."

async function test() {
  const user = await authProvider.authenticateToken(testToken)

  if (user) {
    console.log("✅ Authentication successful")
    console.log("User:", MastraAuthEntra.getUserDisplayName(user))
    console.log("Groups:", MastraAuthEntra.getUserGroupNames(user))
    console.log("Is Admin:", MastraAuthEntra.userInGroup(user, "ADMINS"))
  } else {
    console.log("❌ Authentication failed")
  }
}

test()
```

## Security Considerations

1. **Never log full tokens** - They can be used to impersonate users
2. **Validate both issuer and audience** - Prevents token confusion attacks
3. **Handle token expiration** - Don't trust expired tokens
4. **Use HTTPS in production** - Tokens must be transmitted securely
5. **Rotate client secrets** - Set calendar reminders before expiration
6. **Tokens stay server-side** - Auth routes store tokens in Supabase; browser only receives a session cookie
