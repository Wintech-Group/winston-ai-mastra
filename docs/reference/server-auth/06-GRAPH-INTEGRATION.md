# Microsoft Graph Integration

## Overview

This document describes how to access Microsoft Graph API on behalf of authenticated users using the On-Behalf-Of (OBO) flow. This enables tools that can read user emails, tasks, calendars, and other Graph resources.

In the Mastra-integrated auth architecture, the access token used for OBO comes from the server-side session store—never from the browser.

## Prerequisites

1. Azure App Registration configured with Graph permissions (see [02-AZURE-CONFIGURATION.md](./02-AZURE-CONFIGURATION.md))
2. Client secret created for the App Registration
3. PostgreSQL database for token caching

## Installation

```bash
pnpm add @azure/msal-node @microsoft/microsoft-graph-client pg lru-cache
pnpm add -D @types/pg
```

## Token Lifecycle

You cannot control token expiration—Azure AD sets it:

| Token Type    | Typical Lifetime     | Notes                          |
| ------------- | -------------------- | ------------------------------ |
| Access token  | 60-90 minutes        | Configurable via tenant policy |
| Refresh token | 90 days              | Used to get new access tokens  |
| OBO token     | Same as access token | Derived from user's token      |

MSAL handles token refresh automatically when you use caching properly.

## Database Schema

### File: `migrations/001_mastra_auth_schema.sql`

```sql
-- Create dedicated schema for auth-related tables
CREATE SCHEMA IF NOT EXISTS mastra_auth;

-- Mastra auth session store
CREATE TABLE IF NOT EXISTS mastra_auth.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  user_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON mastra_auth.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON mastra_auth.sessions(expires_at);

-- Token cache table for MSAL OBO
CREATE TABLE IF NOT EXISTS mastra_auth.msal_token_cache (
  user_id TEXT PRIMARY KEY,
  cache_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_cache_updated_at
  ON mastra_auth.msal_token_cache(updated_at);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION mastra_auth.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON mastra_auth.sessions
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();

CREATE TRIGGER token_cache_updated_at
  BEFORE UPDATE ON mastra_auth.msal_token_cache
  FOR EACH ROW
  EXECUTE FUNCTION mastra_auth.update_updated_at();
```

## Graph Token Service

### File: `src/mastra/services/graph-token-service.ts`

```typescript
import {
  ConfidentialClientApplication,
  type ICachePlugin,
  type TokenCacheContext,
} from "@azure/msal-node"
import pg from "pg"
import { LRUCache } from "lru-cache"

// ============================================================
// Database Connection Pool
// ============================================================

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  await pool.end()
})

// ============================================================
// PostgreSQL Cache Plugin for MSAL
// ============================================================

/**
 * Creates a cache plugin that persists MSAL token cache to PostgreSQL
 *
 * @param userId - Unique identifier for the user (oid from token)
 */
function createPostgresCachePlugin(userId: string): ICachePlugin {
  return {
    /**
     * Called before MSAL accesses the cache
     * Loads cached data from PostgreSQL into MSAL's in-memory cache
     */
    async beforeCacheAccess(context: TokenCacheContext): Promise<void> {
      try {
        const result = await pool.query(
          "SELECT cache_data FROM mastra_auth.msal_token_cache WHERE user_id = $1",
          [userId],
        )

        if (result.rows.length > 0) {
          context.tokenCache.deserialize(result.rows[0].cache_data)
        }
      } catch (error) {
        console.error("Failed to load token cache:", error)
        // Continue without cache - will trigger fresh token acquisition
      }
    },

    /**
     * Called after MSAL modifies the cache
     * Persists updated cache to PostgreSQL
     */
    async afterCacheAccess(context: TokenCacheContext): Promise<void> {
      if (!context.cacheHasChanged) {
        return
      }

      try {
        const serialized = context.tokenCache.serialize()

        await pool.query(
          `INSERT INTO mastra_auth.msal_token_cache (user_id, cache_data, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             cache_data = EXCLUDED.cache_data,
             updated_at = NOW()`,
          [userId, serialized],
        )
      } catch (error) {
        console.error("Failed to save token cache:", error)
        // Non-fatal - token will work but won't be cached
      }
    },
  }
}

// ============================================================
// MSAL Client Management
// ============================================================

/**
 * LRU cache for MSAL client instances
 * Keeps last 1000 active users in memory to avoid recreating clients
 */
const msalClients = new LRUCache<string, ConfidentialClientApplication>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour TTL
  dispose: (client, userId) => {
    console.debug(`MSAL client evicted for user: ${userId}`)
  },
})

/**
 * Gets or creates an MSAL client for a specific user
 * Each user needs their own client instance for proper token isolation
 */
function getMsalClient(userId: string): ConfidentialClientApplication {
  let client = msalClients.get(userId)

  if (!client) {
    client = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      },
      cache: {
        cachePlugin: createPostgresCachePlugin(userId),
      },
    })

    msalClients.set(userId, client)
  }

  return client
}

// ============================================================
// Token Acquisition
// ============================================================

/**
 * Acquires a Microsoft Graph access token using the On-Behalf-Of flow
 *
 * MSAL automatically:
 * 1. Checks cache for valid token
 * 2. Uses refresh token if access token expired
 * 3. Only calls Entra if necessary
 *
 * @param userToken - The user's access token for your API
 * @param userId - The user's Object ID (oid claim)
 * @returns Graph access token
 */
export async function getGraphTokenOnBehalfOf(
  userToken: string,
  userId: string,
): Promise<string> {
  const client = getMsalClient(userId)

  try {
    const response = await client.acquireTokenOnBehalfOf({
      oboAssertion: userToken,
      scopes: ["https://graph.microsoft.com/.default"],
    })

    if (!response?.accessToken) {
      throw new Error(
        "Failed to acquire Graph token - no access token returned",
      )
    }

    return response.accessToken
  } catch (error: any) {
    // Handle invalid_grant error (token expired or revoked)
    if (error?.errorCode === "invalid_grant") {
      console.warn("Invalid grant for user, clearing cache:", userId)
      await clearUserTokenCache(userId)
      msalClients.delete(userId)

      // Retry with fresh client
      const freshClient = getMsalClient(userId)
      const response = await freshClient.acquireTokenOnBehalfOf({
        oboAssertion: userToken,
        scopes: ["https://graph.microsoft.com/.default"],
      })

      if (!response?.accessToken) {
        throw new Error("Failed to acquire Graph token after cache clear")
      }

      return response.accessToken
    }

    console.error("OBO token exchange failed:", error)
    throw error
  }
}

// ============================================================
// Cache Management
// ============================================================

/**
 * Clears the token cache for a specific user
 * Call this on logout or when tokens become invalid
 */
export async function clearUserTokenCache(userId: string): Promise<void> {
  await pool.query(
    "DELETE FROM mastra_auth.msal_token_cache WHERE user_id = $1",
    [userId],
  )
  msalClients.delete(userId)
}

/**
 * Cleans up stale token cache entries
 * Run this periodically (e.g., daily cron job)
 *
 * @param daysOld - Delete entries older than this many days
 * @returns Number of deleted entries
 */
export async function cleanupStaleTokenCache(daysOld = 30): Promise<number> {
  const result = await pool.query(
    `DELETE FROM mastra_auth.msal_token_cache 
     WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
     RETURNING user_id`,
  )

  // Clear in-memory clients for deleted users
  for (const row of result.rows) {
    msalClients.delete(row.user_id)
  }

  console.info(`Cleaned up ${result.rowCount} stale token cache entries`)
  return result.rowCount ?? 0
}

/**
 * Gets token cache statistics for monitoring
 */
export async function getTokenCacheStats(): Promise<{
  totalCachedUsers: number
  inMemoryClients: number
  oldestEntry: Date | null
  newestEntry: Date | null
}> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      MIN(updated_at) as oldest,
      MAX(updated_at) as newest
    FROM mastra_auth.msal_token_cache
  `)

  return {
    totalCachedUsers: parseInt(result.rows[0].total),
    inMemoryClients: msalClients.size,
    oldestEntry: result.rows[0].oldest,
    newestEntry: result.rows[0].newest,
  }
}

/**
 * Gracefully closes database connections
 * Call this on application shutdown
 */
export async function closeTokenService(): Promise<void> {
  msalClients.clear()
  await pool.end()
}
```

## Graph API Tools

### File: `src/mastra/tools/graph-tools.ts`

```typescript
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { Client } from "@microsoft/microsoft-graph-client"
import { getGraphTokenOnBehalfOf } from "../services/graph-token-service"

// ============================================================
// Graph Client Helper
// ============================================================

function getGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  })
}

// ============================================================
// Email Tools
// ============================================================

export const getMyEmails = createTool({
  id: "get-my-emails",
  description: "Retrieves the user's recent emails from Outlook/Exchange",
  inputSchema: z.object({
    count: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of emails to retrieve"),
    folder: z.enum(["inbox", "sent", "drafts", "deleted"]).default("inbox"),
    unreadOnly: z
      .boolean()
      .default(false)
      .describe("Only return unread emails"),
    searchQuery: z
      .string()
      .optional()
      .describe("Search query to filter emails"),
  }),
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string(),
        from: z.string(),
        receivedDateTime: z.string(),
        preview: z.string(),
        isRead: z.boolean(),
        hasAttachments: z.boolean(),
      }),
    ),
    totalCount: z.number(),
  }),
  execute: async (
    { count, folder, unreadOnly, searchQuery },
    { requestContext },
  ) => {
    const userToken = requestContext.get("userToken") as string
    const userId = requestContext.get("userId") as string

    const graphToken = await getGraphTokenOnBehalfOf(userToken, userId)
    const client = getGraphClient(graphToken)

    const folderMap: Record<string, string> = {
      inbox: "inbox",
      sent: "sentItems",
      drafts: "drafts",
      deleted: "deletedItems",
    }

    let request = client
      .api(`/me/mailFolders/${folderMap[folder]}/messages`)
      .top(count)
      .select(
        "id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments",
      )
      .orderby("receivedDateTime DESC")

    // Build filter conditions
    const filters: string[] = []
    if (unreadOnly) {
      filters.push("isRead eq false")
    }
    if (filters.length > 0) {
      request = request.filter(filters.join(" and "))
    }

    // Add search if provided
    if (searchQuery) {
      request = request.search(`"${searchQuery}"`)
    }

    const response = await request.get()

    return {
      emails: response.value.map((email: any) => ({
        id: email.id,
        subject: email.subject || "(No subject)",
        from: email.from?.emailAddress?.address || "Unknown",
        receivedDateTime: email.receivedDateTime,
        preview: email.bodyPreview?.substring(0, 150) || "",
        isRead: email.isRead,
        hasAttachments: email.hasAttachments,
      })),
      totalCount: response.value.length,
    }
  },
})

export const sendEmail = createTool({
  id: "send-email",
  description:
    "Sends an email on behalf of the user. Requires explicit approval before sending.",
  inputSchema: z.object({
    to: z
      .array(z.string().email())
      .min(1)
      .describe("Recipient email addresses"),
    subject: z.string().min(1).describe("Email subject"),
    body: z.string().min(1).describe("Email body content"),
    bodyType: z.enum(["text", "html"]).default("text"),
    cc: z.array(z.string().email()).optional().describe("CC recipients"),
    importance: z.enum(["low", "normal", "high"]).default("normal"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  // Approval schemas for human-in-the-loop
  suspendSchema: z.object({
    message: z.string(),
    draft: z.object({
      to: z.array(z.string()),
      cc: z.array(z.string()).optional(),
      subject: z.string(),
      body: z.string(),
      importance: z.string(),
    }),
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
  }),
  execute: async ({ to, subject, body, bodyType, cc, importance }, context) => {
    const { resumeData, suspend, requestContext } = context?.agent ?? {}

    // Always require approval before sending emails
    if (!resumeData?.approved) {
      return suspend?.({
        message: "Please review and confirm you want to send this email:",
        draft: { to, cc, subject, body, importance },
      })
    }

    const userToken = requestContext?.get("userToken") as string
    const userId = requestContext?.get("userId") as string

    const graphToken = await getGraphTokenOnBehalfOf(userToken, userId)
    const client = getGraphClient(graphToken)

    const message = {
      subject,
      body: {
        contentType: bodyType === "html" ? "HTML" : "Text",
        content: body,
      },
      toRecipients: to.map((email) => ({
        emailAddress: { address: email },
      })),
      ccRecipients:
        cc?.map((email) => ({
          emailAddress: { address: email },
        })) || [],
      importance,
    }

    await client.api("/me/sendMail").post({ message })

    return {
      success: true,
      message: `Email sent successfully to ${to.join(", ")}`,
    }
  },
})

// ============================================================
// Task Tools (Microsoft To Do)
// ============================================================

export const getMyTasks = createTool({
  id: "get-my-tasks",
  description: "Retrieves the user's tasks from Microsoft To Do",
  inputSchema: z.object({
    listName: z
      .string()
      .optional()
      .describe('Task list name (defaults to "Tasks")'),
    includeCompleted: z.boolean().default(false),
    count: z.number().min(1).max(100).default(25),
  }),
  outputSchema: z.object({
    tasks: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        dueDateTime: z.string().nullable(),
        importance: z.string(),
        createdDateTime: z.string(),
      }),
    ),
    listName: z.string(),
  }),
  execute: async (
    { listName, includeCompleted, count },
    { requestContext },
  ) => {
    const userToken = requestContext.get("userToken") as string
    const userId = requestContext.get("userId") as string

    const graphToken = await getGraphTokenOnBehalfOf(userToken, userId)
    const client = getGraphClient(graphToken)

    // Get task lists
    const lists = await client.api("/me/todo/lists").get()
    const targetList = lists.value.find(
      (l: any) =>
        l.displayName.toLowerCase() === (listName || "Tasks").toLowerCase(),
    )

    if (!targetList) {
      return {
        tasks: [],
        listName: listName || "Tasks",
      }
    }

    // Get tasks from the list
    let request = client
      .api(`/me/todo/lists/${targetList.id}/tasks`)
      .top(count)
      .orderby("createdDateTime DESC")

    if (!includeCompleted) {
      request = request.filter("status ne 'completed'")
    }

    const tasks = await request.get()

    return {
      tasks: tasks.value.map((task: any) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDateTime: task.dueDateTime?.dateTime || null,
        importance: task.importance,
        createdDateTime: task.createdDateTime,
      })),
      listName: targetList.displayName,
    }
  },
})

// ============================================================
// Calendar Tools
// ============================================================

export const getMyCalendar = createTool({
  id: "get-my-calendar",
  description: "Retrieves the user's upcoming calendar events",
  inputSchema: z.object({
    daysAhead: z
      .number()
      .min(1)
      .max(30)
      .default(7)
      .describe("Number of days to look ahead"),
    maxEvents: z.number().min(1).max(50).default(20),
  }),
  outputSchema: z.object({
    events: z.array(
      z.object({
        id: z.string(),
        subject: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().nullable(),
        isAllDay: z.boolean(),
        organizer: z.string(),
        attendees: z.array(z.string()),
      }),
    ),
  }),
  execute: async ({ daysAhead, maxEvents }, { requestContext }) => {
    const userToken = requestContext.get("userToken") as string
    const userId = requestContext.get("userId") as string

    const graphToken = await getGraphTokenOnBehalfOf(userToken, userId)
    const client = getGraphClient(graphToken)

    const startDateTime = new Date().toISOString()
    const endDateTime = new Date(
      Date.now() + daysAhead * 24 * 60 * 60 * 1000,
    ).toISOString()

    const response = await client
      .api("/me/calendarView")
      .query({
        startDateTime,
        endDateTime,
      })
      .top(maxEvents)
      .select("id,subject,start,end,location,isAllDay,organizer,attendees")
      .orderby("start/dateTime")
      .get()

    return {
      events: response.value.map((event: any) => ({
        id: event.id,
        subject: event.subject || "(No title)",
        start: event.start.dateTime,
        end: event.end.dateTime,
        location: event.location?.displayName || null,
        isAllDay: event.isAllDay,
        organizer: event.organizer?.emailAddress?.address || "Unknown",
        attendees:
          event.attendees
            ?.map((a: any) => a.emailAddress?.address)
            .filter(Boolean) || [],
      })),
    }
  },
})
```

## Scheduled Cleanup

Add a cleanup job to remove stale cache entries:

```typescript
// scripts/cleanup-token-cache.ts
import {
  cleanupStaleTokenCache,
  closeTokenService,
} from "../src/mastra/services/graph-token-service"

async function main() {
  const deleted = await cleanupStaleTokenCache(30)
  console.log(`Deleted ${deleted} stale token cache entries`)
  await closeTokenService()
}

main().catch(console.error)
```

Add to crontab or scheduled task runner:

```bash
# Run daily at 3am
0 3 * * * cd /path/to/app && npx tsx scripts/cleanup-token-cache.ts
```

## Error Handling

Common errors and solutions:

| Error                 | Cause                    | Solution                                   |
| --------------------- | ------------------------ | ------------------------------------------ |
| `AADSTS65001`         | Consent not granted      | User needs to consent to Graph permissions |
| `AADSTS700024`        | Client assertion expired | Check server time sync                     |
| `invalid_grant`       | Token expired/revoked    | Clear cache, re-authenticate               |
| `insufficient_claims` | Missing required claims  | Check token configuration                  |

## Monitoring

Log key events for debugging:

```typescript
// Add to graph-token-service.ts
const log = {
  tokenAcquired: (userId: string, cached: boolean) => {
    console.info(`Graph token acquired for ${userId} (cached: ${cached})`)
  },
  tokenError: (userId: string, error: any) => {
    console.error(`Graph token error for ${userId}:`, error.message)
  },
  cacheHit: (userId: string) => {
    console.debug(`Token cache hit for ${userId}`)
  },
  cacheMiss: (userId: string) => {
    console.debug(`Token cache miss for ${userId}`)
  },
}
```
