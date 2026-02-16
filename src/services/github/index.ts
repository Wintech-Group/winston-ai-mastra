/**
 * GitHub service module
 */

export { getGitHubClient, resetGitHubClient } from "./client"
export type { InstallationOctokit } from "./client"

export { fetchBinaryContent, fetchFileContent } from "./files"
export { createBranch } from "./branches"
export {
  createPullRequest,
  mergePullRequest,
  readPullRequests,
} from "./pull-requests"
export {
  createApprovalTable,
  getApprovalTable,
  updateApprovalTable,
} from "./approvals"
export type { ApprovalRow, ApprovalTable, ApprovalUpdate } from "./approvals"
