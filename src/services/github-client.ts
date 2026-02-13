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
type InstallationOctokit = Awaited<
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
 * Fetch file contents from a GitHub repository
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - Path to the file
 * @param ref - Git ref (branch, tag, commit SHA). Defaults to default branch.
 * @returns File contents as a string, or null if not found
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{ content: string; sha: string } | null> {
  const octokit = await getGitHubClient()

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })

    // Handle single file response
    if ("content" in response.data && response.data.type === "file") {
      return {
        content: Buffer.from(response.data.content, "base64").toString("utf-8"),
        sha: response.data.sha,
      }
    }

    // Path is a directory, not a file
    console.warn(`Path ${path} is a directory, not a file`)
    return null
  } catch (error) {
    // Handle 404 - file not found
    if (error instanceof Error && "status" in error && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Reset the client (useful for testing)
 */
export function resetGitHubClient(): void {
  githubApp = null
  octokitClient = null
  tokenExpiresAt = null
}

/**
 * Fetch binary file contents from a GitHub repository
 *
 * Unlike fetchFileContent, this returns the raw Buffer without UTF-8 decoding,
 * making it safe for binary files (images, PDFs, etc.).
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - Path to the file
 * @param ref - Git ref (branch, tag, commit SHA). Defaults to default branch.
 * @returns File contents as a Buffer, or null if not found
 */
export async function fetchBinaryContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<{ content: Buffer; sha: string } | null> {
  const octokit = await getGitHubClient()

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    })

    // Handle single file response
    if ("content" in response.data && response.data.type === "file") {
      return {
        content: Buffer.from(response.data.content, "base64"),
        sha: response.data.sha,
      }
    }

    console.warn(`Path ${path} is a directory, not a file`)
    return null
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) {
      return null
    }
    throw error
  }
}
