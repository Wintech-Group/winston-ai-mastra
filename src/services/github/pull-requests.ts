/**
 * GitHub pull request helpers
 */

import { getGitHubClient } from "./client"

export interface CreatePullRequestArgs {
  owner: string
  repo: string
  title: string
  head: string
  base: string
  body?: string
  draft?: boolean
  maintainerCanModify?: boolean
}

export interface ReadPullRequestsArgs {
  owner: string
  repo: string
  state?: "open" | "closed" | "all"
  head?: string
  base?: string
  sort?: "created" | "updated" | "popularity" | "long-running"
  direction?: "asc" | "desc"
  perPage?: number
  page?: number
}

export interface MergePullRequestArgs {
  owner: string
  repo: string
  pullNumber: number
  mergeMethod?: "merge" | "squash" | "rebase"
  commitTitle?: string
  commitMessage?: string
}

export async function createPullRequest({
  owner,
  repo,
  title,
  head,
  base,
  body,
  draft,
  maintainerCanModify,
}: CreatePullRequestArgs) {
  const octokit = await getGitHubClient()

  const response = await octokit.pulls.create({
    owner,
    repo,
    title,
    head,
    base,
    body,
    draft,
    maintainer_can_modify: maintainerCanModify,
  })

  return response.data
}

export async function readPullRequests({
  owner,
  repo,
  state = "open",
  head,
  base,
  sort,
  direction,
  perPage,
  page,
}: ReadPullRequestsArgs) {
  const octokit = await getGitHubClient()

  const response = await octokit.pulls.list({
    owner,
    repo,
    state,
    head,
    base,
    sort,
    direction,
    per_page: perPage,
    page,
  })

  return response.data
}

export async function mergePullRequest({
  owner,
  repo,
  pullNumber,
  mergeMethod,
  commitTitle,
  commitMessage,
}: MergePullRequestArgs) {
  const octokit = await getGitHubClient()

  const response = await octokit.pulls.merge({
    owner,
    repo,
    pull_number: pullNumber,
    merge_method: mergeMethod,
    commit_title: commitTitle,
    commit_message: commitMessage,
  })

  return response.data
}
