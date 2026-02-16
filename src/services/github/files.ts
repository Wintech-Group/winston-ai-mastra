/**
 * GitHub content helpers
 */

import { getGitHubClient } from "./client"

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
