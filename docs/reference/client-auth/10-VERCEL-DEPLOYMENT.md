# Vercel Deployment (API + UI Split)

## Overview

This repository uses a split deployment model on Vercel:

- **API Project**: Mastra backend (already deployed)
- **UI Project**: Vite frontend (`src/app`) + static hosting

The UI should call the API via relative paths (`/api/...`). In production, Vercel rewrites those calls to the API project domain.

## UI Project Configuration

Use this repository root as the project source and configure:

- **Install Command**: `bun install`
- **Build Command**: `bun run build:app`
- **Output Directory**: `dist/app`

This repo includes a root `vercel.json` with:

- `/api/*` rewrite to the backend project
- SPA fallback rewrite to `/index.html`

> Update the API hostname in `vercel.json` to your real backend domain if it differs.

## API Project Configuration

For the existing backend project, keep your current Mastra build/start setup.

## Environment Variables

### UI Project (required)

Set these in the **UI** Vercel project:

- `VITE_AZURE_TENANT_ID` — Entra tenant ID
- `VITE_AZURE_CLIENT_ID` — Entra app (client) ID used by the frontend

### API Project (required)

Set these in the **API** Vercel project:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `DATABASE_URL`

Set if your backend uses OBO/Graph:

- `AZURE_CLIENT_SECRET`

## Azure App Registration Updates

Add redirect URIs for the UI domain in your Entra App Registration:

- `https://<ui-domain>`
- `https://<ui-domain>/`

If using a Vercel preview branch workflow, add your preview URL pattern as needed.

## Validation Checklist

1. Open `https://<ui-domain>`
2. Sign in with Microsoft
3. Confirm browser requests go to `https://<ui-domain>/api/...`
4. Confirm Vercel rewrite forwards to API domain
5. Confirm authenticated API calls return 200
