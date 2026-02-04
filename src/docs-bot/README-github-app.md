# Docs Bot GitHub App

This directory contains the manifest definition for the **Wintech Docs Bot** — a GitHub App that serves as a service account for the document governance system.

## What is it?

The Docs Bot is a GitHub App (not a user account) that:

- Acts on behalf of authenticated staff members who may not have GitHub accounts
- Creates branches, commits, pull requests, and issues in content repositories
- Receives webhooks for automation (push, PR, issues events)
- Supports multiple document types (policies, SOPs, tech docs) across multiple repos

## Files

- `github_app_manifest.json` — Production GitHub App manifest
- `github_app_manifest.dev.json` — Development GitHub App manifest (for local testing)
- `../../scripts/create-github-app.ts` — Helper script to generate manifests with environment-specific URLs

## Creating the App

### Prerequisites

- Admin access to the Wintech-Group GitHub organization
- Deployed central service URL (or use placeholder and update later)

### Steps

1. **Ensure service is deployed** and you have the base URL (e.g., `https://doc-gov-service.azurecontainerapps.io`)

2. **Generate the manifest with your URL**:

   ```bash
   bun run scripts/create-github-app.ts prod https://doc-gov-service.azurecontainerapps.io
   ```

3. **Create the app**:

   **Copy the JSON output from the script**

   Then paste it here: https://github.com/organizations/Wintech-Group/settings/apps/new

   _Note: The GitHub App Manifest flow requires web UI interaction. GitHub will show a registration page where you review the app name and settings, then after you click "Create GitHub App", it processes the manifest._

4. **Generate private key**:
   - On the app configuration page → "Private keys" → "Generate a private key"
   - Download `.pem` file
   - Upload to Azure Key Vault: `doc-governance-bot-private-key`
   - Delete local copy

5. **Record credentials**:
   - App ID (shown on app settings page)
   - Installation ID (from installation URL after installing on a repo)
   - Private key location in Key Vault

6. **Install on content repositories**:
   - App settings → Install App → Select repositories
   - Grant permissions when prompted

## Permissions

| Resource      | Level | Purpose                       |
| ------------- | ----- | ----------------------------- |
| Contents      | Write | Create branches and commits   |
| Issues        | Write | Create and manage suggestions |
| Pull Requests | Write | Create and manage change PRs  |
| Metadata      | Read  | Access repository metadata    |

## Webhook Events

- `push` — Triggers content sync, PDF generation, index updates
- `pull_request` — Triggers validation, approval routing
- `issues` — Triggers suggestion tracking and notifications
- `issue_comment` — Detects approval commands in PR comments

## Security Notes

- **Never commit private keys** — Store in Azure Key Vault only
- The manifest can be version controlled
- Webhook signatures must be verified in the central service
- Use separate dev/prod apps with different webhook URLs

## Local Development

For local development, you **must** use a tunneling service because GitHub webhooks require publicly accessible URLs.

### Setup

1. **Start ngrok** (or similar tool):

   ```bash
   ngrok http 3000
   # Note the HTTPS URL, e.g., https://abc123.ngrok-free.app
   ```

2. **Create a dev app** using the helper script:

   ```bash
   bun run scripts/create-github-app.ts dev https://abc123.ngrok-free.app
   ```

   This will output a manifest with your ngrok URL. Either:
   - Pipe it to GitHub CLI (shown in script output), OR
   - Copy the JSON and paste at https://github.com/organizations/Wintech-Group/settings/apps/new

3. **Generate private key** for the dev app and store it locally (not in Key Vault)

4. **Install dev app on test repository only** (e.g., a `docs-policy-governance-test` repo)

5. **Configure your local environment**:

   ```bash
   # .env.local
   GITHUB_APP_ID=<dev app id>
   GITHUB_APP_PRIVATE_KEY_PATH=./dev-private-key.pem
   GITHUB_WEBHOOK_SECRET=<generate a random string>
   ```

6. **Start your local service** on port 3000

### Important Notes

- Use `github_app_manifest.dev.json` for development
- Use `github_app_manifest.json` for production
- Never install the dev app on production repositories
- Never use production credentials locally
- Restart ngrok and update webhook URL if it changes (free tier URLs expire)
- Delete the `.pem` file when done developing

## Updating the App

To update permissions or events:

1. Update `github_app_manifest.json` or `github_app_manifest.dev.json`
2. Manually update settings in the GitHub App settings UI: https://github.com/organizations/Wintech-Group/settings/apps/<your-app>
3. Users with existing installations will be prompted to accept new permissions

_Note: There's no API to update an existing app from a manifest. The manifest flow is for initial registration only._

## Programmatic Registration (Advanced)

The GitHub App Manifest flow is designed for web-based registration. To fully automate it programmatically:

1. Create a web server with a form that POSTs the manifest to GitHub
2. GitHub redirects back to your `redirect_url` with a temporary `code`
3. Exchange the `code` using: `POST /app-manifests/{code}/conversions`
4. The API returns `id`, `pem`, and `webhook_secret`

This is useful for automated provisioning but requires hosting a web endpoint. For most use cases, the web UI approach is simpler.

## References

- [GitHub App Manifest Documentation](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
- [GitHub Apps Best Practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- Implementation Plan: [policy_system_implementation_plan.md](policy_system_implementation_plan.md)
