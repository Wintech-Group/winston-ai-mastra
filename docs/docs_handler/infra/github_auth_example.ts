/**
 * GitHub App Authentication Example
 *
 * This demonstrates how to authenticate with GitHub API using environment variables
 * instead of Azure Key Vault.
 */

import { App } from "@octokit/app"
import { Octokit } from "@octokit/rest"

/**
 * Configuration loaded from environment variables
 */
interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: string
  webhookSecret: string
}

/**
 * Load GitHub App configuration from environment variables
 */
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
    throw new Error(
      "Missing required GitHub App configuration. Ensure GITHUB_APP_ID, " +
        "GITHUB_APP_PRIVATE_KEY, and GITHUB_APP_INSTALLATION_ID are set.",
    )
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

/**
 * Create an authenticated Octokit instance for the GitHub App installation
 */
export async function createGitHubClient(): Promise<Octokit> {
  const config = loadGitHubConfig()

  // Create the GitHub App instance with REST API support
  const app = new App({
    appId: config.appId,
    privateKey: config.privateKey,
    Octokit: Octokit,
  })

  // Get an installation-authenticated Octokit instance
  return await app.getInstallationOctokit(parseInt(config.installationId, 10))
}

/**
 * Example: Read file contents from a repository
 */
export async function getFileContents(
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

  // Handle both single file and directory responses
  if ("content" in response.data && response.data.type === "file") {
    // Content is base64 encoded
    return Buffer.from(response.data.content, "base64").toString("utf-8")
  }

  throw new Error(`Path ${path} is not a file`)
}

/**
 * Example: Create a new file in a repository
 */
export async function createFile(
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

/**
 * Example: Create a pull request
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
  authorEmail: string,
): Promise<number> {
  const octokit = await createGitHubClient()

  const response = await octokit.pulls.create({
    owner,
    repo,
    title,
    body: `${body}\n\nCreated on behalf of: ${authorEmail}`,
    head,
    base,
  })

  return response.data.number
}

/**
 * Verify webhook signature for security
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const config = loadGitHubConfig()

  if (!config.webhookSecret) {
    console.warn(
      "GITHUB_WEBHOOK_SECRET not set - webhook verification disabled",
    )
    return true // In development only!
  }

  const crypto = require("crypto")
  const hmac = crypto.createHmac("sha256", config.webhookSecret)
  const digest = "sha256=" + hmac.update(payload).digest("hex")

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

/**
 * Usage examples
 */
async function examples() {
  // Read a policy file
  const policyContent = await getFileContents(
    "Wintech-Group",
    "docs-policy-governance",
    "policies/IT-001-information-security.md",
    "main",
  )

  // Create a new branch and file
  await createFile(
    "Wintech-Group",
    "docs-policy-governance",
    "policies/HR-002-remote-working.md",
    "---\nid: HR-002\n...\n",
    "Add remote working policy",
    "feat/add-remote-working-policy",
    "jane.smith@company.com",
    "Jane Smith",
  )

  // Create a pull request
  const prNumber = await createPullRequest(
    "Wintech-Group",
    "docs-policy-governance",
    "Add remote working policy",
    "This PR adds the new remote working policy as requested.",
    "feat/add-remote-working-policy",
    "main",
    "jane.smith@company.com",
  )

  console.log(`Created PR #${prNumber}`)
}
