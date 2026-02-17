# Environment Variables

## Overview

This document lists all environment variables required for the Mastra + Entra authentication system.

## Backend Environment Variables

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

# Client secret for OBO (On-Behalf-Of) flow
# Found: Azure Portal → App Registrations → Your App → Certificates & secrets
# ⚠️ KEEP THIS SECRET - Never commit to version control
AZURE_CLIENT_SECRET=your-client-secret-value

# ============================================================
# Database Configuration
# ============================================================

# PostgreSQL connection string
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://mastra:password@localhost:5432/mastra

# Alternative: Individual connection parameters (if not using connection string)
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=mastra
# DB_USER=mastra
# DB_PASSWORD=password

# ============================================================
# Mastra Server Configuration
# ============================================================

# Port for the Mastra server
PORT=4111

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
# Azure Entra ID Configuration
# ============================================================

# Directory (tenant) ID - same as backend
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Application (client) ID - same as backend
VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# ============================================================
# API Configuration
# ============================================================

# Mastra backend URL
VITE_MASTRA_URL=http://localhost:4111

# ============================================================
# Optional: Feature Flags
# ============================================================

# Enable debug mode for MSAL logging
VITE_DEBUG_AUTH=false
```

## Production Considerations

### Backend (`.env.production`)

```bash
# Use secure, unique values in production
AZURE_TENANT_ID=your-production-tenant-id
AZURE_CLIENT_ID=your-production-client-id
AZURE_CLIENT_SECRET=your-production-secret

# Use connection pooling and SSL for production databases
DATABASE_URL=postgresql://user:password@prod-host:5432/mastra?sslmode=require

# Production settings
NODE_ENV=production
PORT=4111
LOG_LEVEL=warn
AUTH_DEBUG=false
```

### Frontend (`.env.production`)

```bash
VITE_AZURE_TENANT_ID=your-production-tenant-id
VITE_AZURE_CLIENT_ID=your-production-client-id
VITE_MASTRA_URL=https://api.yourdomain.com
VITE_DEBUG_AUTH=false
```

## Environment Variable Validation

Add validation at application startup to catch missing configuration early:

### File: `src/mastra/config/env.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Azure Entra
  AZURE_TENANT_ID: z.string().uuid('AZURE_TENANT_ID must be a valid UUID'),
  AZURE_CLIENT_ID: z.string().uuid('AZURE_CLIENT_ID must be a valid UUID'),
  AZURE_CLIENT_SECRET: z.string().min(1, 'AZURE_CLIENT_SECRET is required'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Server
  PORT: z.string().default('4111'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  
  // Optional
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

### Usage in Application

```typescript
// src/mastra/index.ts
import { env } from './config/env';

console.log(`Starting Mastra server on port ${env.PORT}`);
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`Auth debug: ${env.AUTH_DEBUG}`);
```

## Secrets Management

### Development

For local development, use `.env` files and add them to `.gitignore`:

```gitignore
# .gitignore
.env
.env.local
.env.*.local
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
// src/mastra/config/secrets.ts
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

## Quick Reference

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `AZURE_TENANT_ID` | ✅ | Both | Entra tenant ID |
| `AZURE_CLIENT_ID` | ✅ | Both | App registration client ID |
| `AZURE_CLIENT_SECRET` | ✅ | Backend | Client secret for OBO flow |
| `DATABASE_URL` | ✅ | Backend | PostgreSQL connection string |
| `PORT` | ❌ | Backend | Server port (default: 4111) |
| `NODE_ENV` | ❌ | Backend | Environment name |
| `VITE_MASTRA_URL` | ✅ | Frontend | Backend API URL |

## Troubleshooting

### "AZURE_TENANT_ID is required"

Ensure your `.env` file exists and contains the variable. Check that your shell loaded the env file:

```bash
# Print current env vars
echo $AZURE_TENANT_ID

# Manually load env file
source .env
```

### "Invalid UUID format"

Tenant and Client IDs must be valid UUIDs. Copy them exactly from the Azure Portal—don't include any extra characters.

### "Connection refused" to database

1. Check DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Verify network connectivity (firewalls, VPNs)
4. Check database user has proper permissions

### Client secret not working

1. Secrets expire—check expiration date in Azure Portal
2. Make sure you copied the secret value, not the secret ID
3. Generate a new secret if needed
