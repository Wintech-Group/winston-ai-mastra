#!/usr/bin/env bun

/**
 * Helper script to create a GitHub App from manifest with environment-specific URLs
 *
 * Usage:
 *   bun run scripts/create-github-app.ts dev https://abc123.ngrok-free.app
 *   bun run scripts/create-github-app.ts prod https://doc-gov-service.azurecontainerapps.io
 */

import { readFile } from "fs/promises"
import { resolve } from "path"

const [env, baseUrl] = process.argv.slice(2)

if (!env || !baseUrl) {
  console.error("Usage: bun run scripts/create-github-app.ts <env> <base-url>")
  console.error(
    "Example: bun run scripts/create-github-app.ts dev https://abc123.ngrok-free.app",
  )
  process.exit(1)
}

const validEnvs = ["dev", "prod"]
if (!validEnvs.includes(env)) {
  console.error(
    `Invalid environment: ${env}. Must be one of: ${validEnvs.join(", ")}`,
  )
  process.exit(1)
}

// Read the appropriate manifest
const manifestPath = resolve(__dirname, `../github_app_manifest.${env}.json`)
const manifestContent = await readFile(manifestPath, "utf-8")

// Replace URLs
let manifest = JSON.parse(manifestContent)

if (env === "dev") {
  manifest.hook_attributes.url = `${baseUrl}/webhooks/github`
  manifest.redirect_url = "http://localhost:3000/setup/callback"
  manifest.setup_url = "http://localhost:3000/setup"
} else {
  manifest.hook_attributes.url = `${baseUrl}/webhooks/github`
  manifest.redirect_url = `${baseUrl}/setup/callback`
  manifest.setup_url = `${baseUrl}/setup`
}

// Output the manifest for piping to gh CLI
console.log(JSON.stringify(manifest, null, 2))

console.error("\n---")
console.error(`✓ Generated manifest for ${env.toUpperCase()} environment`)
console.error(`✓ Webhook URL: ${manifest.hook_attributes.url}`)
console.error("\nTo create the GitHub App, run:")
console.error(
  `  bun run scripts/create-github-app.ts ${env} ${baseUrl} | gh api /organizations/Wintech-Group/app-manifests/conversions --method POST --input -`,
)
console.error("\nOr copy the JSON above and paste it at:")
console.error(
  "  https://github.com/organizations/Wintech-Group/settings/apps/new",
)
