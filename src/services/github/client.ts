/**
 * GitHub client singleton
 *
 * Provides an authenticated Octokit client using GitHub App installation authentication.
 * The client is cached at module level and reused across requests.
 */

import { App } from "@octokit/app"
import { Octokit } from "@octokit/rest"

interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: string
}

// Type returned by getInstallationOctokit when passed Octokit from @octokit/rest
export type InstallationOctokit = Awaited<
  ReturnType<App<{ Octokit: typeof Octokit }>["getInstallationOctokit"]>
>

// Module-level cached instances
let githubApp: App<{ Octokit: typeof Octokit }> | null = null
let octokitClient: InstallationOctokit | null = null
let tokenExpiresAt: Date | null = null

// Installation tokens are valid for 1 hour, refresh 5 minutes early
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * Load and validate GitHub App configuration from environment variables
 */
function loadGitHubConfig(): GitHubAppConfig {
  const { GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID } =
    process.env

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
  }
}

/**
 * Check if the current token needs refreshing
 */
function needsTokenRefresh(): boolean {
  if (!tokenExpiresAt) return true
  return Date.now() > tokenExpiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS
}

/**
 * Get the GitHub App instance (cached)
 */
function getGitHubApp(): App<{ Octokit: typeof Octokit }> {
  if (!githubApp) {
    const config = loadGitHubConfig()
    // Pass Octokit from @octokit/rest to ensure REST API methods are available
    githubApp = new App({
      appId: config.appId,
      privateKey: config.privateKey,
      Octokit: Octokit,
    })
  }
  return githubApp
}

/**
 * Get an authenticated Octokit client
 *
 * The client uses installation authentication and automatically
 * refreshes tokens when they expire.
 */
export async function getGitHubClient(): Promise<InstallationOctokit> {
  if (octokitClient && !needsTokenRefresh()) {
    return octokitClient
  }

  const config = loadGitHubConfig()
  const app = getGitHubApp()

  // Get an installation-authenticated Octokit instance
  // Since we passed Octokit to App constructor, this returns an @octokit/rest instance
  octokitClient = await app.getInstallationOctokit(
    parseInt(config.installationId, 10),
  )

  // Token expires in 1 hour
  tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000)

  return octokitClient
}

/**
 * Reset the client (useful for testing)
 */
export function resetGitHubClient(): void {
  githubApp = null
  octokitClient = null
  tokenExpiresAt = null
}
