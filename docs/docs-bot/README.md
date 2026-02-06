# Wintech Docs Bot — Complete Setup Guide

This guide covers everything you need to set up and use the **Wintech Docs Bot**, a GitHub App that serves as a service account for the document governance system.

## Table of Contents

- [What is the Docs Bot?](#what-is-the-docs-bot)
- [Production Setup](#production-setup)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Using in Your Application](#using-in-your-application)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [References](#references)

---

## What is the Docs Bot?

The Docs Bot is a GitHub App (not a user account) that:

- **Acts on behalf of authenticated staff** who may not have GitHub accounts
- **Creates branches, commits, pull requests, and issues** in content repositories
- **Receives webhooks** for automation (push, PR, issues events)
- **Supports multiple document types** (policies, SOPs, tech docs) across multiple repos

### Permissions

| Resource      | Level | Purpose                       |
| ------------- | ----- | ----------------------------- |
| Contents      | Write | Create branches and commits   |
| Issues        | Write | Create and manage suggestions |
| Pull Requests | Write | Create and manage change PRs  |
| Metadata      | Read  | Access repository metadata    |

### Webhook Events

- `push` — Triggers content sync, PDF generation, index updates
- `pull_request` — Triggers validation, approval routing
- `issues` — Triggers suggestion tracking and notifications
- `issue_comment` — Detects approval commands in PR comments

---

## Production Setup

Follow these steps to create and configure the production Docs Bot.

### Prerequisites

- Admin access to the Wintech-Group GitHub organization
- Deployed central service URL (e.g., `https://your-service.com`)

### 1. Generate the App Manifest

```bash
# Using the helper script with your service URL
bun run github-app:create prod https://your-service.com
```

This will output a manifest JSON with your production webhook URL.

### 2. Create the GitHub App

**Copy the JSON output** from the script, then paste it at:

https://github.com/organizations/Wintech-Group/settings/apps/new

GitHub will show a registration page where you review the app settings, then click "Create GitHub App" to complete registration.

### 3. Generate Private Key

1. On the app configuration page, scroll to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file

### 4. Encode the Private Key

The private key must be base64 encoded to store in a single-line environment variable.

#### Windows PowerShell

```powershell
# Encode to base64
$keyPath = "wintech-docs-bot.2026-02-05.private-key.pem"
$encoded = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keyPath))
$encoded | Out-File -Encoding ASCII encoded-key.txt

# Copy to clipboard
Get-Content encoded-key.txt | Set-Clipboard
```

#### Linux/macOS

```bash
# Encode to base64 (single line, no newlines)
base64 -i wintech-docs-bot.2026-02-05.private-key.pem | tr -d '\n' > encoded-key.txt

# Copy to clipboard (macOS)
cat encoded-key.txt | pbcopy

# Copy to clipboard (Linux with xclip)
cat encoded-key.txt | xclip -selection clipboard
```

### 5. Get App ID and Installation ID

**App ID:**

- Navigate to your GitHub App settings
- Note the **App ID** at the top of the page (numeric, e.g., `123456`)

**Installation ID:**

1. Navigate to: `https://github.com/organizations/Wintech-Group/settings/installations`
2. Click on your app installation
3. The URL will show: `.../installations/{INSTALLATION_ID}`
4. Note the numeric installation ID (e.g., `107965932`)

Alternatively, use GitHub CLI:

```bash
gh api /orgs/Wintech-Group/installation --jq '.id'
```

### 6. Generate Webhook Secret

```bash
# Generate a strong random secret
openssl rand -hex 32

# Or on Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

Enter this secret in your GitHub App settings under "Webhook secret (optional)".

### 7. Configure Environment Variables

Set these environment variables in your hosting provider:

```env
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=107965932
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcFFJ...
GITHUB_WEBHOOK_SECRET=your_generated_secret_here
```

See [Environment Variables](#environment-variables) section for platform-specific instructions.

### 8. Install on Content Repositories

1. Navigate to app settings → Install App
2. Select repositories (e.g., `docs-policy-governance`)
3. Grant permissions when prompted

### 9. Delete Local Files

**Important:** Delete the private key files from your local machine:

```bash
rm wintech-docs-bot.2026-02-05.private-key.pem
rm encoded-key.txt
```

---

## Local Development Setup

For local development, you need a **separate dev app** with webhooks pointing to your local machine via ngrok.

### 1. Install ngrok

```bash
# Windows (via winget)
winget install ngrok.ngrok

# Or download from https://ngrok.com/download
```

### 2. Start ngrok

```bash
# Mastra dev server runs on port 4111 by default
ngrok http 4111
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### 3. Create Dev GitHub App

```bash
# Using the helper script with your ngrok URL
bun run github-app:create dev https://abc123.ngrok-free.app
```

**Copy the JSON output** and paste it at:

https://github.com/organizations/Wintech-Group/settings/apps/new

Give the dev app a different name (e.g., `wintech-docs-bot-dev`).

### 4. Generate Dev Private Key

1. On the dev app settings page → "Private keys" → "Generate a private key"
2. Save the `.pem` file to your project root as `dev-private-key.pem`
3. **Ensure it's in .gitignore** (should already be there)

### 5. Create Test Repository

Create a test content repository (e.g., `docs-policy-governance-test`) and install **only the dev app** on it.

**Important:** Never install the dev app on production repositories.

### 6. Configure Local Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your dev app credentials:

```env
# Dev App Configuration
GITHUB_APP_ID=<your_dev_app_id>
GITHUB_APP_INSTALLATION_ID=<dev_installation_id>
GITHUB_APP_PRIVATE_KEY=<base64_encoded_dev_key>
GITHUB_WEBHOOK_SECRET=<random_string>
```

**Note:** You can either base64 encode the dev key or use `GITHUB_APP_PRIVATE_KEY_PATH=./dev-private-key.pem` if your code supports it.

### 7. Start Development Server

```bash
bun run dev
```

Your local service should now receive webhooks from GitHub when you interact with the test repo.

### 8. Verify Webhooks

Test by making a commit to your test repo. Check:

- ngrok is still running
- "Recent Deliveries" tab in GitHub App webhook settings shows the event
- Your local server logs show the webhook received

### Updating ngrok URL

If ngrok restarts and you get a new URL:

1. Get the new URL from ngrok
2. Update webhook URL in GitHub App settings:
   https://github.com/organizations/Wintech-Group/settings/apps/<your-dev-app>

Or recreate the dev app with the new URL.

### Cleanup

When done developing:

```bash
# Stop ngrok (Ctrl+C)

# Delete dev private key
rm dev-private-key.pem

# Optionally uninstall or delete the dev app
```

---

## Environment Variables

### Required Variables

```env
GITHUB_APP_ID=123456                      # Your App ID
GITHUB_APP_INSTALLATION_ID=107965932      # Installation ID
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJT...   # Base64-encoded private key
GITHUB_WEBHOOK_SECRET=your_secret_here    # Webhook verification secret
```

### Platform-Specific Setup

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Set environment variables
railway variables set GITHUB_APP_ID=123456
railway variables set GITHUB_APP_INSTALLATION_ID=107965932
railway variables set GITHUB_APP_PRIVATE_KEY="$(cat encoded-key.txt)"
railway variables set GITHUB_WEBHOOK_SECRET="your_secret_here"
```

#### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Set environment variables (production)
vercel env add GITHUB_APP_ID production
# When prompted, enter: 123456

vercel env add GITHUB_APP_INSTALLATION_ID production
# When prompted, enter: 107965932

vercel env add GITHUB_APP_PRIVATE_KEY production
# When prompted, paste the base64-encoded key

vercel env add GITHUB_WEBHOOK_SECRET production
# When prompted, enter your webhook secret
```

#### Fly.io

```bash
# Set secrets
flyctl secrets set GITHUB_APP_ID=123456
flyctl secrets set GITHUB_APP_INSTALLATION_ID=107965932
flyctl secrets set GITHUB_APP_PRIVATE_KEY="$(cat encoded-key.txt)"
flyctl secrets set GITHUB_WEBHOOK_SECRET="your_secret_here"
```

#### Generic Hosting Provider

1. Log into your hosting provider dashboard
2. Navigate to application settings
3. Find "Environment Variables" or "Config Vars"
4. Add each variable
5. Save and restart your application

---

## Using in Your Application

### Load GitHub Configuration

```typescript
interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: string
  webhookSecret: string
}

function loadGitHubConfig(): GitHubAppConfig {
  const {
    GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY,
    GITHUB_APP_INSTALLATION_ID,
    GITHUB_WEBHOOK_SECRET,
  } = process.env

  if (
    !GITHUB_APP_ID ||
    !GITHUB_APP_PRIVATE_KEY ||
    !GITHUB_APP_INSTALLATION_ID
  ) {
    throw new Error("Missing required GitHub App configuration")
  }

  // Decode the base64-encoded private key
  const privateKey = Buffer.from(GITHUB_APP_PRIVATE_KEY, "base64").toString(
    "utf-8",
  )

  return {
    appId: GITHUB_APP_ID,
    privateKey,
    installationId: GITHUB_APP_INSTALLATION_ID,
    webhookSecret: GITHUB_WEBHOOK_SECRET || "",
  }
}
```

### Create Authenticated Client

```typescript
import { App } from "@octokit/app"
import { Octokit } from "@octokit/rest"

async function createGitHubClient(): Promise<Octokit> {
  const config = loadGitHubConfig()

  const app = new App({
    appId: config.appId,
    privateKey: config.privateKey,
  })

  const installationAccessToken = await app.getInstallationAccessToken({
    installationId: parseInt(config.installationId, 10),
  })

  return new Octokit({
    auth: installationAccessToken,
  })
}
```

### Read File Contents

```typescript
async function getFileContents(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<string> {
  const octokit = await createGitHubClient()

  const response = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  })

  if ("content" in response.data && response.data.type === "file") {
    return Buffer.from(response.data.content, "base64").toString("utf-8")
  }

  throw new Error(`Path ${path} is not a file`)
}
```

### Create File/Commit

```typescript
async function createFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  authorEmail: string,
  authorName: string,
): Promise<void> {
  const octokit = await createGitHubClient()

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `${message}\n\nAuthored-by: ${authorEmail}`,
    content: Buffer.from(content).toString("base64"),
    branch,
    committer: {
      name: "Docs Bot",
      email: "docs-bot@company.com",
    },
    author: {
      name: authorName,
      email: authorEmail,
    },
  })
}
```

### Verify Webhook Signature

```typescript
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const config = loadGitHubConfig()

  if (!config.webhookSecret) {
    console.warn("GITHUB_WEBHOOK_SECRET not set - verification disabled")
    return true // Only for development!
  }

  const crypto = require("crypto")
  const hmac = crypto.createHmac("sha256", config.webhookSecret)
  const digest = "sha256=" + hmac.update(payload).digest("hex")

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}
```

### Complete Example

See [github_auth_example.ts](../docs_handler/infra/github_auth_example.ts) for a complete implementation with error handling and additional operations.

---

## Security Best Practices

### 1. Never Commit Credentials

- Add `.env` to `.gitignore`
- Use `.env.example` for documentation only
- Never commit `.pem` files or encoded keys

### 2. Rotate Keys Periodically

- GitHub Apps support multiple active keys
- Generate new key → update env var → delete old key
- Recommended: rotate every 90 days

### 3. Limit Access

- Only administrators should access production environment variables
- Use separate apps/keys for dev/staging/prod
- Never use production credentials locally

### 4. Monitor for Exposed Keys

- Enable GitHub secret scanning
- Use tools like `git-secrets` or `truffleHog` locally
- Set up alerts for exposed credentials

### 5. Verify Webhook Signatures

- Always verify signatures in production
- Reject requests with invalid signatures
- Use constant-time comparison (`crypto.timingSafeEqual`)

### 6. Principle of Least Privilege

- Grant only required permissions
- Review permissions quarterly
- Remove unused installations

---

## Troubleshooting

### Webhooks Not Arriving

**Symptoms:** Events in GitHub but no webhook deliveries

**Solutions:**

1. Check ngrok is still running (free tier URLs expire)
2. Verify webhook URL in GitHub App settings matches your service
3. Check "Recent Deliveries" tab in GitHub App webhook settings
4. Ensure your service is publicly accessible
5. Check firewall/security group rules

### Authentication Errors

**Symptoms:** "Bad credentials" or "Not authenticated"

**Solutions:**

1. Verify `GITHUB_APP_ID` matches your app
2. Check private key is properly base64 encoded
3. Ensure no extra newlines/spaces in encoded key
4. Test decoding:
   ```typescript
   const decoded = Buffer.from(
     process.env.GITHUB_APP_PRIVATE_KEY,
     "base64",
   ).toString("utf-8")
   console.log(decoded.substring(0, 50)) // Should show: -----BEGIN RSA PRIVATE KEY-----
   ```

### Installation Errors

**Symptoms:** "Not installed" or "App not installed on repository"

**Solutions:**

1. Verify `GITHUB_APP_INSTALLATION_ID` is correct
2. Check app is installed on the target organization/repository
3. Ensure app has required permissions
4. Prompt to re-accept permissions if they were expanded

### Webhook Signature Verification Fails

**Symptoms:** Webhooks rejected due to invalid signature

**Solutions:**

1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
2. Ensure using raw request body (not parsed JSON)
3. Check signature header format: `sha256=...`
4. Verify webhook secret was set (it's optional in GitHub UI)

### Rate Limiting

**Symptoms:** 403 errors from GitHub API

**Solutions:**

1. Check rate limit headers in responses
2. Implement exponential backoff
3. For higher limits, consider GitHub Enterprise
4. Cache responses when possible

### ngrok Issues (Local Dev)

**Symptoms:** ngrok URL not working or "tunnel not found"

**Solutions:**

1. Ensure ngrok is still running
2. Free tier URLs expire after 2 hours
3. Update webhook URL if ngrok restarted
4. Consider ngrok paid plan for static URLs
5. Alternatives: localtunnel, serveo, localhost.run

---

## References

### Documentation

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [GitHub App Manifest](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest)
- [Authenticating with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)

### Project Documentation

- [Policy System Implementation Plan](../docs_handler/infra/policy_system_implementation_plan.md)
- [System Architecture](../docs_handler/infra/policy_system_architecture.md)
- [Architecture Decision Records](../docs_handler/infra/policy_system_adrs.md)

### Tools

- [ngrok](https://ngrok.com/)
- [GitHub CLI](https://cli.github.com/)
- [Octokit SDK](https://github.com/octokit)

---

## Support

For questions or issues:

1. Check this guide and troubleshooting section
2. Review GitHub App settings and Recent Deliveries
3. Check service logs for detailed error messages
4. Review [GitHub Apps Best Practices](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
