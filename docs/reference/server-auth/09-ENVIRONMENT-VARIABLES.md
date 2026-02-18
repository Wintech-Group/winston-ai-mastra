# Environment Variables

## Overview

This document lists all environment variables required for the Mastra + Entra authentication system with BFF pattern.

## Server Environment Variables

### File: `.env`

```bash
# ============================================================
# Azure Entra ID Configuration
# ============================================================

# Directory (tenant) ID from Azure App Registration
# Found: Azure Portal → App Registrations → Your App → Overview
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Application (client) ID from Azure App Registration
# Found: Azure Portal → App Registrations → Your App → Overview
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Client secret for OAuth and OBO flow
# Found: Azure Portal → App Registrations → Your App → Certificates & secrets
# ⚠️ KEEP THIS SECRET - Never commit to version control
AZURE_CLIENT_SECRET=your-client-secret-value

# ============================================================
# Database Configuration
# ============================================================

# PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://mastra:password@localhost:5432/mastra

# ============================================================
# BFF Server Configuration
# ============================================================

# Port for the BFF server
BFF_PORT=3000

# Public URL of the application (used for OAuth redirects)
# Development: http://localhost:3000
# Production: https://your-app.com
APP_URL=http://localhost:3000

# Internal URL of the Mastra server (BFF proxies to this)
MASTRA_URL=http://localhost:4111

# ============================================================
# Mastra Server Configuration
# ============================================================

# Port for the Mastra server
MASTRA_PORT=4111

# Environment (development, staging, production)
NODE_ENV=development

# ============================================================
# Optional: Logging and Monitoring
# ============================================================

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Enable detailed auth logging (set to "true" for debugging)
AUTH_DEBUG=false
```

## Frontend Environment Variables

### File: `.env.local` (React + Vite)

```bash
# ============================================================
# Frontend Configuration
# ============================================================

# With BFF pattern, frontend needs minimal configuration
# All auth is handled server-side

# Optional: Override API URL (usually not needed with Vite proxy)
# VITE_API_URL=http://localhost:3000
```

> **Note**: With the BFF pattern, the frontend doesn't need Azure credentials. All sensitive configuration stays on the server.

## Production Configuration

### Backend (`.env.production`)

```bash
# Azure credentials (use secrets manager in production)
AZURE_TENANT_ID=your-production-tenant-id
AZURE_CLIENT_ID=your-production-client-id
AZURE_CLIENT_SECRET=your-production-secret

# Production database with SSL
DATABASE_URL=postgresql://user:password@prod-host:5432/mastra?sslmode=require

# Production URLs
APP_URL=https://your-app.com
MASTRA_URL=http://mastra-internal:4111

# Production settings
NODE_ENV=production
BFF_PORT=3000
MASTRA_PORT=4111
LOG_LEVEL=warn
AUTH_DEBUG=false
```

### Frontend (`.env.production`)

```bash
# Typically empty or minimal for BFF pattern
# The frontend doesn't need auth configuration
```

## Environment Variable Validation

Add validation at application startup:

### File: `src/config/env.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Azure Entra
  AZURE_TENANT_ID: z.string().uuid('AZURE_TENANT_ID must be a valid UUID'),
  AZURE_CLIENT_ID: z.string().uuid('AZURE_CLIENT_ID must be a valid UUID'),
  AZURE_CLIENT_SECRET: z.string().min(1, 'AZURE_CLIENT_SECRET is required'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // URLs
  APP_URL: z.string().url('APP_URL must be a valid URL'),
  MASTRA_URL: z.string().url('MASTRA_URL must be a valid URL'),
  
  // Ports
  BFF_PORT: z.string().default('3000'),
  MASTRA_PORT: z.string().default('4111'),
  
  // Optional
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AUTH_DEBUG: z.string().transform(v => v === 'true').default('false'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const env = validateEnv();
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

| Platform | Solution |
|----------|----------|
| Docker/Kubernetes | Kubernetes Secrets, Docker Secrets |
| AWS | AWS Secrets Manager, Parameter Store |
| Azure | Azure Key Vault |
| GCP | Google Secret Manager |
| Vercel | Environment Variables (encrypted) |
| Railway | Environment Variables |

### Example: Using Azure Key Vault

```typescript
// src/config/secrets.ts
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

const keyVaultUrl = process.env.AZURE_KEY_VAULT_URL;

export async function loadSecrets(): Promise<void> {
  if (!keyVaultUrl) {
    console.log('Using environment variables (no Key Vault configured)');
    return;
  }
  
  const client = new SecretClient(keyVaultUrl, new DefaultAzureCredential());
  
  // Load secrets into process.env
  process.env.AZURE_CLIENT_SECRET = (await client.getSecret('mastra-client-secret')).value;
  process.env.DATABASE_URL = (await client.getSecret('mastra-database-url')).value;
  
  console.log('Secrets loaded from Azure Key Vault');
}
```

## Docker Configuration

### File: `docker-compose.yml`

```yaml
version: '3.8'

services:
  bff:
    build: 
      context: .
      dockerfile: Dockerfile.bff
    ports:
      - "3000:3000"
    environment:
      - AZURE_TENANT_ID=${AZURE_TENANT_ID}
      - AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
      - AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}
      - DATABASE_URL=postgresql://mastra:password@postgres:5432/mastra
      - APP_URL=http://localhost:3000
      - MASTRA_URL=http://mastra:4111
      - BFF_PORT=3000
    depends_on:
      - postgres
      - mastra

  mastra:
    build:
      context: .
      dockerfile: Dockerfile.mastra
    environment:
      - AZURE_TENANT_ID=${AZURE_TENANT_ID}
      - AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
      - AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}
      - DATABASE_URL=postgresql://mastra:password@postgres:5432/mastra
      - MASTRA_PORT=4111
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=mastra
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=mastra
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

volumes:
  postgres_data:
```

## Quick Reference

| Variable | Required | Component | Description |
|----------|----------|-----------|-------------|
| `AZURE_TENANT_ID` | ✅ | BFF, Mastra | Entra tenant ID |
| `AZURE_CLIENT_ID` | ✅ | BFF, Mastra | App registration client ID |
| `AZURE_CLIENT_SECRET` | ✅ | BFF, Mastra | Client secret for OAuth/OBO |
| `DATABASE_URL` | ✅ | BFF, Mastra | PostgreSQL connection string |
| `APP_URL` | ✅ | BFF | Public application URL |
| `MASTRA_URL` | ✅ | BFF | Internal Mastra server URL |
| `BFF_PORT` | ❌ | BFF | BFF server port (default: 3000) |
| `MASTRA_PORT` | ❌ | Mastra | Mastra server port (default: 4111) |
| `NODE_ENV` | ❌ | All | Environment name |

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

1. Check DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Verify network connectivity
4. Check database user permissions

### Client secret not working

1. Secrets expire—check expiration date in Azure Portal
2. Copy the secret **value**, not the secret ID
3. Generate a new secret if needed
4. Ensure no extra whitespace in env var

### OAuth redirect mismatch

1. Check APP_URL matches exactly what's configured in Azure
2. Include or exclude trailing slashes consistently
3. Use https in production
