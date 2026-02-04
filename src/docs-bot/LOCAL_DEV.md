# Local Development Setup — Docs Bot

Quick reference for setting up the Docs Bot in your local development environment.

## 1. Install ngrok

```bash
# Windows (via winget)
winget install ngrok.ngrok

# Or download from https://ngrok.com/download
```

## 2. Start ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

## 3. Create Dev GitHub App

```bash
# Using the helper script
bun run github-app:create dev https://abc123.ngrok-free.app
```

This will output the manifest JSON. You can either:

**Copy the JSON output from the script and paste it at:**

https://github.com/organizations/Wintech-Group/settings/apps/new

GitHub will show you a registration page where you can review the app details before clicking "Create GitHub App".

## 4. Generate Private Key

1. On the GitHub App settings page, scroll to "Private keys"
2. Click "Generate a private key"
3. Save the `.pem` file to your project root as `dev-private-key.pem`
4. **Add to .gitignore** (should already be there)

## 5. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your dev app credentials:

```env
GITHUB_APP_ID=<your_dev_app_id>
GITHUB_APP_PRIVATE_KEY_PATH=./dev-private-key.pem
GITHUB_WEBHOOK_SECRET=<generate_random_string>
```

## 6. Create Test Repository

Create a test content repository (e.g., `docs-policy-governance-test`) and install the dev app on it.

## 7. Start Development Server

```bash
bun run dev
```

Your local service should now receive webhooks from GitHub when you:

- Push to the test repo
- Create/update pull requests
- Create/comment on issues

## Troubleshooting

### Webhooks not arriving

1. Check ngrok is still running (free tier URLs expire after 2 hours)
2. Verify the webhook URL in GitHub App settings matches your ngrok URL
3. Check the "Recent Deliveries" tab in GitHub App webhook settings

### Authentication errors

1. Verify `GITHUB_APP_ID` matches your dev app
2. Check the private key path is correct
3. Ensure the dev app is installed on the repository

### Webhook signature verification fails

1. Ensure `GITHUB_WEBHOOK_SECRET` in `.env` matches the secret in GitHub App settings
2. If you didn't set one, generate a random string and add it to both places

## Updating ngrok URL

If ngrok restarts and you get a new URL:

```bash
# Get new URL
ngrok http 3000

# Update webhook URL in GitHub App settings:
# https://github.com/organizations/Wintech-Group/settings/apps/<your-dev-app>
# Or recreate the app with new URL
```

## Cleanup

When done developing:

```bash
# Stop ngrok
# Ctrl+C

# Delete private key
rm dev-private-key.pem

# Optionally uninstall or delete the dev app
```

## References

- [Full Setup Guide](../docs/docs_handler/infra/README-github-app.md)
- [GitHub App Manifest](../docs/docs_handler/infra/github_app_manifest.dev.json)
- [Implementation Plan](../docs/docs_handler/infra/policy_system_implementation_plan.md)
