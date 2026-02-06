// Push handler for GitHub webhooks

import type { EmitterWebhookEvent } from "@octokit/webhooks"
import { loadOrSyncConfig } from "../../../../services/config-service"

type PushEvent = EmitterWebhookEvent<"push">
type PushPayload = PushEvent["payload"]

interface GetDocsFromPayloadArgs {
  documentPath: string
  payload: PushPayload
  fileExtension?: string
}

type ActionableDocs = {
  update: string[]
  remove: string[]
}

export async function handlePushEvent({ id, payload }: PushEvent) {
  const repoFullName = payload.repository.full_name
  const ref = payload.ref.replace("refs/heads/", "")

  console.log(`[${id}] Processing push to ${repoFullName} (${ref})`)

  // Extract config files from the push event payload first
  const configChanges = getDocsFromPayload({
    payload,
    documentPath: "metadata/",
    fileExtension: ".yaml",
  })

  // Load or sync repository configuration
  // If governance.yaml changed, this will fetch, validate, and sync to DB
  const repoConfig = await loadOrSyncConfig({
    repoFullName,
    configFiles: configChanges.update,
    ref,
  })

  console.log(
    `[${id}] Using config: documentPath=${repoConfig.documentPath}, type=${repoConfig.documentType}`,
  )

  // Extract actionable docs using config-defined document path
  const docs = getDocsFromPayload({
    payload,
    documentPath: repoConfig.documentPath,
    fileExtension: ".md",
  })

  // Process document updates
  if (docs.update.length > 0) {
    console.log(
      `[${id}] ${repoConfig.documentType} docs to update: ${docs.update.length}`,
    )
    for (const doc of docs.update) {
      console.log(`[${id}] - ${doc}`)
      // TODO: Sync with SharePoint, upload PDFs, update vectors, etc.
    }
  }

  // Process document removals
  if (docs.remove.length > 0) {
    console.log(
      `[${id}] ${repoConfig.documentType} docs to remove: ${docs.remove.length}`,
    )
    for (const doc of docs.remove) {
      console.log(`[${id}] - ${doc}`)
      // TODO: Remove page from SharePoint, archive PDF, update vectors, etc.
    }
  }

  console.log(`[${id}] Push event processing complete`)

  // Return config for potential downstream use
  return { repoConfig, docs, configChanges }
}

export function getDocsFromPayload({
  payload,
  documentPath,
  fileExtension = ".md",
}: GetDocsFromPayloadArgs): ActionableDocs {
  const commits = payload.commits ?? []

  // Collect all files that were added or modified
  const docsToUpdate = commits.flatMap((commit) => {
    const added = commit.added ?? []
    const modified = commit.modified ?? []
    return [...modified, ...added].filter(
      (file) => file.startsWith(documentPath) && file.endsWith(fileExtension),
    )
  })

  // Collect all files that were removed
  const docsToRemove = commits.flatMap((commit) => {
    const removed = commit.removed ?? []
    return removed.filter(
      (file) => file.startsWith(documentPath) && file.endsWith(fileExtension),
    )
  })

  // Deduplicate files (same file could be touched in multiple commits)
  return {
    update: [...new Set(docsToUpdate)],
    remove: [...new Set(docsToRemove)],
  }
}
