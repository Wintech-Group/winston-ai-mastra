# Environment Variables

## Overview

All environment variables live on the Mastra server only. The frontend (Vite) has no auth configuration—auth routes and session management run directly on the Mastra server.

## Server Environment Variables

### File: `.env`

```bash
# ============================================================
# Azure Entra ID Configuration
# ============================================================

# Directory (tenant) ID from Azure App Registration
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Application (client) ID from Azure App Registration
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client secret for OAuth and token refresh
# ⚠️ KEEP THIS SECRET - Never commit to version control
AZURE_CLIENT_SECRET=your-client-secret-value

# ============================================================
# Supabase / Database Configuration
# ============================================================

# Supabase project URL
SUPABASE_URL=http://localhost:54321

# Supabase service role key (full DB access - backend only)
SUPABASE_SECRET_KEY=your-supabase-service-role-key

# PostgreSQL connection string (used by Mastra storage / @mastra/pg)
SUPABASE_CONNECTION_STRING=postgresql://postgres:password@localhost:5432/postgres

# Schema name for Mastra's internal storage
SUPABASE_SCHEMA=mastra_store

# ============================================================
# Application Configuration
# ============================================================

# Public URL of the application (used for OAuth redirect URIs)
# Development: http://localhost:5173  (Vite)
# Production: https://your-app.com
APP_URL=http://localhost:5173

# Environment
NODE_ENV=development
```

## Frontend Environment Variables

The frontend has no auth-related environment variables. All Azure credentials stay on the server.

## Production Configuration

### Backend (`.env.production`)

```bash
# Azure credentials (use secrets manager in production)
AZURE_TENANT_ID=your-production-tenant-id
AZURE_CLIENT_ID=your-production-client-id
AZURE_CLIENT_SECRET=your-production-secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-production-service-role-key
SUPABASE_CONNECTION_STRING=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_SCHEMA=mastra_store

# Production URLs
APP_URL=https://your-app.com

# Production settings
NODE_ENV=production
```

## Environment Variable Validation

Add validation at startup in `src/mastra/auth/token-refresh.ts` (already present) or a dedicated config module:

```typescript
import { z } from "zod"

const envSchema = z.object({
  AZURE_TENANT_ID: z.string().uuid(),
  AZURE_CLIENT_ID: z.string().uuid(),
  AZURE_CLIENT_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  APP_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
})

export const env = envSchema.parse(process.env)
```

## Secrets Management

### Development

Use `.env` files and add them to `.gitignore`:

```gitignore
# .gitignore
.env
.env.local
.env.*.local
.env.production
```

### Production

For production, use secure secrets management:

| Platform          | Solution                             |
| ----------------- | ------------------------------------ |
| Docker/Kubernetes | Kubernetes Secrets, Docker Secrets   |
| AWS               | AWS Secrets Manager, Parameter Store |
| Azure             | Azure Key Vault                      |
| GCP               | Google Secret Manager                |
| Vercel            | Environment Variables (encrypted)    |
| Railway           | Environment Variables                |

## Quick Reference

| Variable                     | Required | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `AZURE_TENANT_ID`            | ✅       | Entra tenant ID                          |
| `AZURE_CLIENT_ID`            | ✅       | App registration client ID               |
| `AZURE_CLIENT_SECRET`        | ✅       | Client secret for OAuth/token refresh    |
| `SUPABASE_URL`               | ✅       | Supabase project URL                     |
| `SUPABASE_SECRET_KEY`        | ✅       | Service role key (backend only)          |
| `SUPABASE_CONNECTION_STRING` | ✅       | PostgreSQL URL for Mastra storage        |
| `SUPABASE_SCHEMA`            | ✅       | Schema for Mastra internal storage       |
| `APP_URL`                    | ✅       | Public application URL (OAuth redirects) |
| `NODE_ENV`                   | ❌       | Environment name (default: development)  |

## Troubleshooting

### "AZURE_TENANT_ID is required"

Ensure your `.env` file exists and is being loaded:

```bash
# Check if env var is set
echo $AZURE_TENANT_ID

# Manually load env file
source .env
```

### "Invalid UUID format"

Tenant and Client IDs must be valid UUIDs. Copy them exactly from the Azure Portal.

### "Connection refused" to database

1. Ensure Supabase is running locally (`supabase start`)
2. Check `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are correct
3. Verify the `mastra_auth` migration has been applied (`supabase migration up --local`)

### Client secret not working

1. Secrets expire—check expiration date in Azure Portal
2. Copy the secret **value**, not the secret ID
3. Generate a new secret if needed
4. Ensure no extra whitespace in env var

### OAuth redirect mismatch

1. Check APP_URL matches exactly what's configured in Azure
2. Include or exclude trailing slashes consistently
3. Use https in production
