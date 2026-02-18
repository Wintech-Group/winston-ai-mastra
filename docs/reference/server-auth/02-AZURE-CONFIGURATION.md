# Azure Entra Configuration

## Overview

This document covers the Azure Portal configuration required for the Mastra server-side authentication system. The key difference from a client-side SPA setup is that redirect URIs are configured as **Web** platform (not SPA) since the OAuth callback is handled server-side by auth routes running on the Mastra server.

## App Registration Setup

### 1. Create the App Registration

1. Navigate to **Azure Portal** → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name**: `Mastra Docs Bot` (or your app name)
   - **Supported account types**: Select based on your needs:
     - "Accounts in this organizational directory only" (single tenant)
     - "Accounts in any organizational directory" (multi-tenant)
   - **Redirect URI**:
     - Platform: **Web** (not SPA!)
     - URI: `http://localhost:5173/auth/callback` (development)
4. Click **Register**
5. Note the **Application (client) ID** and **Directory (tenant) ID**

### 2. Configure Authentication

Navigate to **Authentication** in your App Registration:

#### Web Platform Redirect URIs

Add all required redirect URIs for the **Web** platform:

```
http://localhost:5173/auth/callback     # Local development (Vite proxy)
https://your-app.com/auth/callback      # Production
```

> **Important**: Use Web platform, not SPA. Auth routes run on the Mastra server, which handles the OAuth callback server-side using the client secret. In development, Vite (:5173) proxies `/auth/*` to Mastra (:4111).

#### Front-channel logout URL (Optional)

```
https://your-app.com/auth/logout-callback
```

#### Implicit grant and hybrid flows

- ☐ **Access tokens** - Not needed (using authorization code flow)
- ☐ **ID tokens** - Not needed (using authorization code flow)

#### Supported account types

Verify this matches your selection during registration.

### 3. Expose an API

Navigate to **Expose an API**:

#### Application ID URI

1. Click **Set** next to "Application ID URI"
2. Accept the default (`api://<client-id>`) or set a custom URI
3. Click **Save**

#### Add a Scope

1. Click **Add a scope**
2. Configure:
   - **Scope name**: `access_as_user`
   - **Who can consent**: Admins and users
   - **Admin consent display name**: `Access Mastra API as user`
   - **Admin consent description**: `Allows the app to access the Mastra API on behalf of the signed-in user.`
   - **User consent display name**: `Access Mastra API`
   - **User consent description**: `Allow the app to access Mastra on your behalf.`
   - **State**: Enabled
3. Click **Add scope**

### 4. Configure Token Claims

Navigate to **Token configuration**:

#### Add Groups Claim

1. Click **Add groups claim**
2. Select group types to include in token:
   - ✅ **Security groups**
   - ☐ Groups assigned to the application (optional, for large orgs)
3. For each token type, select:
   - **Access token**: Group ID
   - **ID token**: Group ID
   - **SAML**: Group ID
4. Click **Add**

> **Important**: This emits group Object IDs (GUIDs) in the token, not group names. You'll map these IDs to readable names in your code.

#### Optional Claims (Recommended)

Click **Add optional claim** and add these for the **Access token**:

| Claim                | Purpose              |
| -------------------- | -------------------- |
| `email`              | User's email address |
| `preferred_username` | User's UPN           |
| `given_name`         | First name           |
| `family_name`        | Last name            |

### 5. API Permissions

Navigate to **API Permissions**:

#### Microsoft Graph Permissions (Delegated)

Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**:

| Permission        | Purpose        | Requires Admin Consent |
| ----------------- | -------------- | ---------------------- |
| `User.Read`       | Basic profile  | No                     |
| `email`           | Email address  | No                     |
| `profile`         | Full profile   | No                     |
| `openid`          | OpenID Connect | No                     |
| `offline_access`  | Refresh tokens | No                     |
| `Mail.Read`       | Read emails    | No                     |
| `Mail.Send`       | Send emails    | No                     |
| `Tasks.ReadWrite` | To Do tasks    | No                     |
| `Calendars.Read`  | Read calendar  | No                     |

> **Note**: `offline_access` is required for refresh tokens, which the auth server uses to maintain long-lived sessions stored in Supabase.

#### Grant Admin Consent

If your tenant requires admin consent for certain permissions:

1. Click **Grant admin consent for [Your Tenant]**
2. Confirm the action

### 6. Certificates & Secrets

Navigate to **Certificates & secrets**:

#### Client Secret (Required for server-side auth)

1. Click **New client secret**
2. Configure:
   - **Description**: `Mastra Server`
   - **Expires**: Choose based on your security policy (recommend 12-24 months)
3. Click **Add**
4. **Copy the secret value immediately** - it won't be shown again

> **Critical**: The client secret is required for server-side auth. It's used to:
>
> 1. Exchange authorization codes for tokens in the OAuth callback
> 2. Refresh access tokens when they expire
> 3. Perform OBO token exchange for Microsoft Graph

> **Security Note**: For production, consider using a certificate instead of a client secret.

## Security Groups Setup

### 1. Create Security Groups

Navigate to **Microsoft Entra ID** → **Groups**:

Create groups for each department or role:

| Group Name           | Purpose                  |
| -------------------- | ------------------------ |
| `Mastra-Finance`     | Finance team members     |
| `Mastra-HR`          | HR team members          |
| `Mastra-Engineering` | Engineering team members |
| `Mastra-Marketing`   | Marketing team members   |
| `Mastra-Admins`      | Platform administrators  |

### 2. Get Group Object IDs

For each group:

1. Click on the group name
2. Copy the **Object ID** (GUID format)
3. Record the mapping:

```
Mastra-Finance:     a1b2c3d4-e5f6-7890-abcd-ef1234567890
Mastra-HR:          b2c3d4e5-f6a7-8901-bcde-f12345678901
Mastra-Engineering: c3d4e5f6-a7b8-9012-cdef-123456789012
Mastra-Marketing:   d4e5f6a7-b8c9-0123-def1-234567890123
Mastra-Admins:      e5f6a7b8-c9d0-1234-ef12-345678901234
```

### 3. Add Members

For each group, add the appropriate users:

1. Click **Members** → **Add members**
2. Search for and select users
3. Click **Select**

## Groups Overage Handling

If users belong to **200+ groups**, Azure doesn't include groups directly in the token. Instead, it sets a `_claim_names` property indicating an overage.

### Option A: Limit Groups in Token

In **Token configuration** → **Groups claim**, select:

- "Groups assigned to the application"

Then in **Enterprise applications** → Your App → **Users and groups**, assign only the relevant groups.

### Option B: Handle Overage in Code

Your auth provider should detect overage and call Microsoft Graph to fetch groups. See [03-AUTH-PROVIDER.md](./03-AUTH-PROVIDER.md) for implementation.

## Verification

### Test Token Contents

4. After implementing auth routes, complete a login flow
5. Add logging in your callback handler to inspect the token
6. Use [jwt.ms](https://jwt.ms) to decode and verify token contents
7. Verify the token contains:
   - `aud`: Your Application ID
   - `iss`: `https://login.microsoftonline.com/{tenant-id}/v2.0`
   - `groups`: Array of group Object IDs
   - `preferred_username`: User's email/UPN

### Expected Token Structure

```json
{
  "aud": "your-client-id",
  "iss": "https://login.microsoftonline.com/your-tenant-id/v2.0",
  "iat": 1234567890,
  "exp": 1234571490,
  "sub": "user-subject-id",
  "oid": "user-object-id",
  "preferred_username": "user@company.com",
  "name": "John Doe",
  "email": "user@company.com",
  "groups": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "c3d4e5f6-a7b8-9012-cdef-123456789012"
  ]
}
```

## Troubleshooting

### "AADSTS50011: Reply URL mismatch"

1. Verify redirect URI matches exactly (including protocol, trailing slashes)
2. Ensure you're using **Web** platform, not SPA
3. Check for http vs https mismatch

### Groups Not Appearing in Token

1. Verify groups claim is configured in **Token configuration**
2. Check user is actually a member of the groups
3. Ensure you're looking at the **access token**, not the ID token
4. Check for groups overage (200+ groups)

### "AADSTS7000218: Invalid client secret"

1. Client secret may have expired - check expiration date
2. Verify you copied the secret value, not the secret ID
3. Check for whitespace in environment variable

### "AADSTS65001: Consent required"

1. Check which permissions require admin consent
2. Have a tenant admin grant consent via the portal
3. Or use the admin consent URL: `https://login.microsoftonline.com/{tenant}/adminconsent?client_id={client-id}`

### Token refresh failing

1. Ensure `offline_access` scope is included in permissions
2. Check that refresh token hasn't been revoked
3. Verify client secret is valid
