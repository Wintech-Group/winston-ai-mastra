# Backend-for-Frontend (BFF) Server

## Overview

The BFF layer handles OAuth authentication server-side, stores tokens securely, and proxies API requests to Mastra with the appropriate Bearer token attached. The browser only receives an httpOnly session cookie—tokens never touch JavaScript.

## Why BFF?

| Threat | Client-Side Tokens | BFF Pattern |
|--------|-------------------|-------------|
| XSS token theft | Token exfiltrated, usable anywhere | Cannot steal token, only make requests during session |
| Token in browser DevTools | Visible in storage/network | Never visible to browser |
| Token replay attack | Easy if token stolen | Session bound to cookie |

For a publicly accessible application, BFF is the recommended approach.

## Installation

```bash
pnpm add hono @hono/node-server @azure/msal-node pg
pnpm add -D @types/pg
```

## Implementation

### File: `src/bff/server.ts`

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { ConfidentialClientApplication } from '@azure/msal-node';
import pg from 'pg';
import crypto from 'crypto';

// ============================================================
// Configuration
// ============================================================

const config = {
  port: parseInt(process.env.BFF_PORT || '3000'),
  mastraUrl: process.env.MASTRA_URL || 'http://localhost:4111',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  cookieName: 'sid',
  cookieMaxAge: 60 * 60 * 24, // 24 hours
  azure: {
    clientId: process.env.AZURE_CLIENT_ID!,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
    tenantId: process.env.AZURE_TENANT_ID!,
  },
};

// ============================================================
// Database Connection
// ============================================================

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================
// Session Store
// ============================================================

interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  userInfo: {
    name?: string;
    email?: string;
    groups?: string[];
  };
}

async function createSession(session: Session): Promise<void> {
  await pool.query(
    `INSERT INTO mastra_auth.sessions 
     (id, user_id, access_token, refresh_token, expires_at, user_info)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      session.id,
      session.userId,
      session.accessToken,
      session.refreshToken,
      session.expiresAt,
      JSON.stringify(session.userInfo),
    ]
  );
}

async function getSession(sessionId: string): Promise<Session | null> {
  const result = await pool.query(
    `SELECT * FROM mastra_auth.sessions WHERE id = $1`,
    [sessionId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: new Date(row.expires_at),
    userInfo: row.user_info,
  };
}

async function updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (updates.accessToken) {
    sets.push(`access_token = $${paramIndex++}`);
    values.push(updates.accessToken);
  }
  if (updates.refreshToken) {
    sets.push(`refresh_token = $${paramIndex++}`);
    values.push(updates.refreshToken);
  }
  if (updates.expiresAt) {
    sets.push(`expires_at = $${paramIndex++}`);
    values.push(updates.expiresAt);
  }
  
  sets.push(`updated_at = NOW()`);
  values.push(sessionId);
  
  await pool.query(
    `UPDATE mastra_auth.sessions SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

async function deleteSession(sessionId: string): Promise<void> {
  await pool.query(
    `DELETE FROM mastra_auth.sessions WHERE id = $1`,
    [sessionId]
  );
}

// ============================================================
// MSAL Client
// ============================================================

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: config.azure.clientId,
    clientSecret: config.azure.clientSecret,
    authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
  },
});

const scopes = [
  `api://${config.azure.clientId}/access_as_user`,
  'offline_access', // Required for refresh tokens
];

// ============================================================
// Token Refresh
// ============================================================

async function refreshAccessToken(session: Session): Promise<Session | null> {
  if (!session.refreshToken) {
    console.warn('No refresh token available for session:', session.id);
    return null;
  }
  
  try {
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken: session.refreshToken,
      scopes,
    });
    
    if (!result) {
      return null;
    }
    
    const updatedSession: Session = {
      ...session,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken || session.refreshToken,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
    };
    
    await updateSession(session.id, {
      accessToken: updatedSession.accessToken,
      refreshToken: updatedSession.refreshToken,
      expiresAt: updatedSession.expiresAt,
    });
    
    return updatedSession;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

// ============================================================
// Hono App
// ============================================================

const app = new Hono();

// CORS for frontend
app.use('*', cors({
  origin: config.appUrl,
  credentials: true,
}));

// CSRF protection for state-changing requests
app.use('/auth/*', csrf({
  origin: config.appUrl,
}));

// ============================================================
// Auth Routes
// ============================================================

/**
 * GET /auth/login
 * Redirects to Microsoft login
 */
app.get('/auth/login', async (c) => {
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store state in a short-lived cookie for validation
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 300, // 5 minutes
    path: '/',
  });
  
  const authUrl = await msalClient.getAuthCodeUrl({
    scopes,
    redirectUri: `${config.appUrl}/auth/callback`,
    state,
  });
  
  return c.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Handles OAuth callback from Microsoft
 */
app.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'oauth_state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');
  
  // Clear state cookie
  deleteCookie(c, 'oauth_state');
  
  // Handle errors from Microsoft
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return c.redirect(`${config.appUrl}/login?error=${encodeURIComponent(error)}`);
  }
  
  // Validate state to prevent CSRF
  if (!state || state !== storedState) {
    console.error('State mismatch:', { received: state, expected: storedState });
    return c.redirect(`${config.appUrl}/login?error=invalid_state`);
  }
  
  if (!code) {
    return c.redirect(`${config.appUrl}/login?error=no_code`);
  }
  
  try {
    // Exchange code for tokens
    const result = await msalClient.acquireTokenByCode({
      code,
      scopes,
      redirectUri: `${config.appUrl}/auth/callback`,
    });
    
    if (!result || !result.accessToken) {
      throw new Error('No access token received');
    }
    
    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      id: sessionId,
      userId: result.account?.homeAccountId || result.uniqueId || 'unknown',
      accessToken: result.accessToken,
      refreshToken: (result as any).refreshToken,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      userInfo: {
        name: result.account?.name,
        email: result.account?.username,
        // Groups will be in the token claims if configured
        groups: (result.idTokenClaims as any)?.groups,
      },
    };
    
    await createSession(session);
    
    // Set session cookie
    setCookie(c, config.cookieName, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: config.cookieMaxAge,
      path: '/',
    });
    
    // Redirect to app
    return c.redirect(config.appUrl);
  } catch (error) {
    console.error('Token exchange failed:', error);
    return c.redirect(`${config.appUrl}/login?error=token_exchange_failed`);
  }
});

/**
 * POST /auth/logout
 * Clears session and redirects to Microsoft logout
 */
app.post('/auth/logout', async (c) => {
  const sessionId = getCookie(c, config.cookieName);
  
  if (sessionId) {
    await deleteSession(sessionId);
  }
  
  deleteCookie(c, config.cookieName);
  
  // Optionally redirect to Microsoft logout
  const logoutUrl = `https://login.microsoftonline.com/${config.azure.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(config.appUrl)}`;
  
  return c.json({ success: true, logoutUrl });
});

/**
 * GET /auth/me
 * Returns current user info
 */
app.get('/auth/me', async (c) => {
  const sessionId = getCookie(c, config.cookieName);
  
  if (!sessionId) {
    return c.json({ authenticated: false }, 401);
  }
  
  const session = await getSession(sessionId);
  
  if (!session) {
    deleteCookie(c, config.cookieName);
    return c.json({ authenticated: false }, 401);
  }
  
  return c.json({
    authenticated: true,
    user: session.userInfo,
  });
});

// ============================================================
// API Proxy
// ============================================================

/**
 * ALL /api/*
 * Proxies requests to Mastra with Bearer token
 */
app.all('/api/*', async (c) => {
  const sessionId = getCookie(c, config.cookieName);
  
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  let session = await getSession(sessionId);
  
  if (!session) {
    deleteCookie(c, config.cookieName);
    return c.json({ error: 'Session expired' }, 401);
  }
  
  // Check if token needs refresh (5 minute buffer)
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  const bufferMs = 5 * 60 * 1000;
  
  if (now.getTime() > expiresAt.getTime() - bufferMs) {
    console.info('Refreshing token for session:', session.id);
    const refreshedSession = await refreshAccessToken(session);
    
    if (!refreshedSession) {
      // Refresh failed - user needs to re-authenticate
      await deleteSession(session.id);
      deleteCookie(c, config.cookieName);
      return c.json({ error: 'Session expired, please log in again' }, 401);
    }
    
    session = refreshedSession;
  }
  
  // Build proxy URL
  const path = c.req.path; // e.g., /api/agents/orchestrator/generate
  const url = new URL(path, config.mastraUrl);
  url.search = new URL(c.req.url).search;
  
  // Forward the request
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('Content-Type', c.req.header('Content-Type') || 'application/json');
  
  // Copy other relevant headers
  const forwardHeaders = ['Accept', 'Accept-Language', 'X-Request-ID'];
  for (const header of forwardHeaders) {
    const value = c.req.header(header);
    if (value) {
      headers.set(header, value);
    }
  }
  
  try {
    const response = await fetch(url.toString(), {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' 
        ? await c.req.text() 
        : undefined,
    });
    
    // Forward response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip hop-by-hop headers
      if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    
    // Return proxied response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================
// Static Files (Optional - for serving frontend)
// ============================================================

// If you want to serve the frontend from the same server:
// import { serveStatic } from '@hono/node-server/serve-static';
// app.use('/*', serveStatic({ root: './dist' }));

// ============================================================
// Start Server
// ============================================================

console.log(`BFF server starting on port ${config.port}`);

serve({
  fetch: app.fetch,
  port: config.port,
});

export default app;
```

## Session Cleanup

Add a job to clean up expired sessions:

### File: `scripts/cleanup-sessions.ts`

```typescript
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function cleanupExpiredSessions(): Promise<number> {
  const result = await pool.query(
    `DELETE FROM mastra_auth.sessions 
     WHERE expires_at < NOW() - INTERVAL '1 day'
     RETURNING id`
  );
  
  return result.rowCount ?? 0;
}

async function main() {
  const deleted = await cleanupExpiredSessions();
  console.log(`Deleted ${deleted} expired sessions`);
  await pool.end();
}

main().catch(console.error);
```

## Deployment Architecture

### Development

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Vite      │────>│    BFF      │────>│   Mastra    │
│   :5173     │     │    :3000    │     │   :4111     │
└─────────────┘     └─────────────┘     └─────────────┘
```

Configure Vite to proxy API calls:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
});
```

### Production

Option A: Separate services behind load balancer

```
┌─────────────────────────────────────────┐
│              Load Balancer              │
│  ┌─────────────────────────────────────┐│
│  │  /api/*, /auth/* → BFF             ││
│  │  /*             → Static/CDN       ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
          │                    │
          ▼                    ▼
    ┌───────────┐        ┌───────────┐
    │    BFF    │───────>│  Mastra   │
    └───────────┘        └───────────┘
```

Option B: BFF serves static files

```
┌─────────────────────────────────────────┐
│              Load Balancer              │
│  ┌─────────────────────────────────────┐│
│  │  /* → BFF (handles all routes)     ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
                    │
                    ▼
              ┌───────────┐
              │    BFF    │───────> Mastra
              │  + static │
              └───────────┘
```

## Security Considerations

1. **Cookie security**:
   - `httpOnly`: Prevents JavaScript access
   - `secure`: Only sent over HTTPS (enable in production)
   - `sameSite: 'Lax'`: Prevents CSRF for most cases

2. **State parameter**: Validates OAuth callback is from a request we initiated

3. **CSRF protection**: Hono's csrf middleware for POST/PUT/DELETE

4. **Token refresh**: Automatic refresh before expiration

5. **Session cleanup**: Remove expired sessions regularly

## Streaming Support

For streaming responses from Mastra agents, the proxy handles them automatically since we're using `fetch` and returning the raw response body.

## Error Handling

The BFF returns consistent error responses:

```typescript
// 401 - Not authenticated
{ "error": "Unauthorized" }

// 401 - Session expired
{ "error": "Session expired, please log in again" }

// 500 - Proxy error
{ "error": "Internal server error" }
```

Frontend should handle 401 by redirecting to `/auth/login`.
