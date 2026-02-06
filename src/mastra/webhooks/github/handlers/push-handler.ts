// Push handler for GitHub webhooks

import type { EmitterWebhookEvent } from "@octokit/webhooks"

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
  console.log(
    `[${id}] Processing push to ${payload.repository.full_name} (${payload.ref})`,
  )

  // Extract actionable docs from the push event payload
  const docs = getDocsFromPayload({
    payload,
    documentPath: "policies/",
    fileExtension: ".md",
  })

  const config = getDocsFromPayload({
    payload,
    documentPath: "metadata/",
    fileExtension: ".yaml",
  })

  // Process configuration changes
  if (config.update.length > 0) {
    console.log(`[${id}] Config files to update: ${config.update.length}`)
    for (const cfg of config.update) {
      console.log(`[${id}] - ${cfg}`)
      // TODO: Update repository-specific configuration
    }
  }

  // Process document updates
  if (docs.update.length > 0) {
    console.log(`[${id}] Policy docs to update: ${docs.update.length}`)
    for (const doc of docs.update) {
      console.log(`[${id}] - ${doc}`)
      // TODO: Sync with SharePoint, upload PDFs, update vectors, etc.
    }
  }

  // Process document removals
  if (docs.remove.length > 0) {
    console.log(`[${id}] Policy docs to remove: ${docs.remove.length}`)
    for (const doc of docs.remove) {
      console.log(`[${id}] - ${doc}`)
      // TODO: Remove page from SharePoint, archive PDF, update vectors, etc.
    }
  }

  console.log(`[${id}] Push event processing complete`)
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

/**
 * Fetches repository-specific configuration
 * TODO: Implement actual configuration fetching from database or config file
 */
export async function getRepoConfig(repoFullName: string) {
  // Placeholder for fetching repository-specific configuration
  // In a real implementation, this might fetch from a database or config file
  return {
    repoFullName,
    sharePointSite:
      process.env.SHAREPOINT_SITE_URL ||
      "https://contoso.sharepoint.com/sites/policies",
    pdfGeneration: {
      enabled: true,
      outputPath: "pdfs/",
    },
  }
}
