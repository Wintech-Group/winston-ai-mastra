/**
 * GitHub branch helpers
 */

import { getGitHubClient } from "./client"

function toRefPath(ref: string): string {
  const trimmed = ref.startsWith("refs/") ? ref.slice(5) : ref
  return trimmed.startsWith("heads/") ? trimmed : `heads/${trimmed}`
}

export interface CreateBranchArgs {
  owner: string
  repo: string
  branch: string
  baseRef?: string
}

export interface CreateBranchResult {
  ref: string
  sha: string
}

export async function createBranch({
  owner,
  repo,
  branch,
  baseRef = "main",
}: CreateBranchArgs): Promise<CreateBranchResult> {
  const octokit = await getGitHubClient()
  const baseRefPath = toRefPath(baseRef)

  const base = await octokit.git.getRef({
    owner,
    repo,
    ref: baseRefPath,
  })

  const created = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: base.data.object.sha,
  })

  return {
    ref: created.data.ref,
    sha: created.data.object.sha,
  }
}
