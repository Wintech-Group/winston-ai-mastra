# GitHub App (Docs Bot)

> Canonical setup guide for the Wintech Docs Bot GitHub App.

| Attribute        | Value            |
| ---------------- | ---------------- |
| Document Version | 1.0.0            |
| Last Updated     | 2026-02-13       |
| App Name         | Wintech Docs Bot |
| Organisation     | Wintech-Group    |
| Installation ID  | 107965932        |

---

## What is the Docs Bot?

The Docs Bot is a GitHub App (not a user account) that:

- **Acts on behalf of authenticated staff** who may not have GitHub accounts
- **Creates branches, commits, pull requests, and issues** in content repositories
- **Receives webhooks** for automation (push, PR, issues events)
- **Supports multiple document types** (policies, SOPs, tech docs) across multiple repos

> **Note:** Deploying the GitHub App via manifest-based registration was not possible for the Wintech-Group organisation. The manifest files in `docs-bot/manifests/` are retained for reference, but the app was created manually via the GitHub UI.

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

### Prerequisites

- Admin access to the Wintech-Group GitHub organization
- Deployed central service URL (e.g., `https://your-service.com`)

### 1. Generate the App Manifest

```bash
bun run github-app:create prod https://your-service.com
```

This will output a manifest JSON with your production webhook URL.

### 2. Create the GitHub App

Copy the JSON output, then paste at:

`https://github.com/organizations/Wintech-Group/settings/apps/new`

Review the app settings and click "Create GitHub App".

### 3. Generate Private Key

1. On the app configuration page, scroll to "Private keys"
2. Click "Generate a private key"
3. Download the `.pem` file

### 4. Encode the Private Key

The private key must be base64 encoded to store in a single-line environment variable.

**Windows PowerShell:**

```powershell
$keyPath = "wintech-docs-bot.2026-02-05.private-key.pem"
$encoded = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($keyPath))
$encoded | Out-File -Encoding ASCII encoded-key.txt
Get-Content encoded-key.txt | Set-Clipboard
```

**Linux/macOS:**

```bash
base64 -i wintech-docs-bot.2026-02-05.private-key.pem | tr -d '\n' > encoded-key.txt
cat encoded-key.txt | pbcopy
```

### 5. Get App ID and Installation ID

**App ID:** Navigate to your GitHub App settings → note the App ID at the top

**Installation ID:**

1. Go to `https://github.com/organizations/Wintech-Group/settings/installations`
2. Click your app installation
3. The URL shows `.../installations/{INSTALLATION_ID}`

Or via CLI:

```bash
gh api /orgs/Wintech-Group/installation --jq '.id'
```

### 6. Generate Webhook Secret

```bash
openssl rand -hex 32
```

Enter this secret in your GitHub App settings under "Webhook secret".

### 7. Configure Environment Variables

```env
GITHUB_APP_ID=123456
GITHUB_APP_INSTALLATION_ID=107965932
GITHUB_APP_PRIVATE_KEY=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlFcFFJ...
GITHUB_WEBHOOK_SECRET=your_generated_secret_here
```

### 8. Install on Content Repositories

1. Navigate to app settings → Install App
2. Select repositories (e.g., `docs-policy-governance`)
3. Grant permissions when prompted

### 9. Delete Local Key Files

```bash
rm wintech-docs-bot.2026-02-05.private-key.pem
rm encoded-key.txt
```

---

## Local Development Setup

For local development, create a **separate dev app** with webhooks pointing to your local machine via ngrok.

### 1. Install & Start ngrok

```bash
winget install ngrok.ngrok
ngrok http 4111   # Mastra dev server port
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`).

### 2. Create Dev GitHub App

```bash
bun run github-app:create dev https://abc123.ngrok-free.app
```

Paste the output at the GitHub App registration page. Name it `wintech-docs-bot-dev`.

### 3. Generate Dev Private Key

1. App settings → "Private keys" → "Generate a private key"
2. Save as `dev-private-key.pem` in project root
3. Ensure it's in `.gitignore`

### 4. Create Test Repository

Create `docs-policy-governance-test` and install **only the dev app** on it.

### 5. Configure Local Environment

```bash
cp .env.example .env
```

Update `.env` with dev app credentials:

```env
GITHUB_APP_ID=<dev_app_id>
GITHUB_APP_INSTALLATION_ID=<dev_installation_id>
GITHUB_APP_PRIVATE_KEY=<base64_encoded_dev_key>
GITHUB_WEBHOOK_SECRET=<random_string>
```

### 6. Start & Verify

```bash
bun run dev
```

Test by committing to your test repo. Check:

- ngrok is still running
- "Recent Deliveries" tab in GitHub App webhook settings shows events
- Local server logs show webhooks received

---

## Authentication Code

See [reference/github-auth-example.ts](../reference/github-auth-example.ts) for a complete implementation including:

- Loading config from environment variables
- Base64-decoding the private key
- Creating an authenticated Octokit client
- Reading/writing files via the GitHub API
- Webhook signature verification

---

## Platform-Specific Deployment

### Railway

```bash
railway variables set GITHUB_APP_ID=123456
railway variables set GITHUB_APP_INSTALLATION_ID=107965932
railway variables set GITHUB_APP_PRIVATE_KEY="$(cat encoded-key.txt)"
railway variables set GITHUB_WEBHOOK_SECRET="your_secret_here"
```

### Vercel

```bash
vercel env add GITHUB_APP_ID production
vercel env add GITHUB_APP_INSTALLATION_ID production
vercel env add GITHUB_APP_PRIVATE_KEY production
vercel env add GITHUB_WEBHOOK_SECRET production
```

### Fly.io

```bash
flyctl secrets set GITHUB_APP_ID=123456
flyctl secrets set GITHUB_APP_INSTALLATION_ID=107965932
flyctl secrets set GITHUB_APP_PRIVATE_KEY="$(cat encoded-key.txt)"
flyctl secrets set GITHUB_WEBHOOK_SECRET="your_secret_here"
```

---

## Security Best Practices

1. **Never commit credentials** — `.env` and `.pem` files must be in `.gitignore`
2. **Rotate keys periodically** — GitHub Apps support multiple active keys; rotate every 90 days
3. **Separate environments** — Use separate apps/keys for dev/staging/prod
4. **Verify webhook signatures** — Always verify in production using `crypto.timingSafeEqual`
5. **Principle of least privilege** — Grant only required permissions; review quarterly
6. **Monitor for leaks** — Enable GitHub secret scanning; use `git-secrets` locally

---

## Troubleshooting

| Problem                      | Solution                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Webhooks not arriving        | Check ngrok is running; verify webhook URL in app settings; check "Recent Deliveries" |
| "Bad credentials"            | Verify App ID; check private key is properly base64 encoded; test decoding            |
| "Not installed"              | Verify Installation ID; check app is installed on target repo                         |
| Signature verification fails | Verify webhook secret matches; ensure using raw request body                          |
| Rate limiting (403)          | Check rate limit headers; implement exponential backoff                               |
| ngrok URL expired            | Free tier URLs expire after 2 hours; update webhook URL or consider paid plan         |

---

## References

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Authenticating with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app)
- [Octokit.js Documentation](https://octokit.github.io/rest.js/)
