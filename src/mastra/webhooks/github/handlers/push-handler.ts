// Push handler for GitHub webhooks

import type { EmitterWebhookEvent } from "@octokit/webhooks"
import { parse as parseYaml } from "yaml"
import { loadOrSyncConfig } from "../../../../services/config-service"
import { fetchFileContent } from "../../../../services/github-client"
import {
  createOrUpdatePage,
  ensureDocumentLibrary,
  getSiteId,
  markdownToPdf,
  uploadFileToLibrary,
  type ImageFetcher,
} from "../../../../services/sharepoint"

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

    const [owner, repo] = repoFullName.split("/") as [string, string]

    for (const docPath of docs.update) {
      console.log(`[${id}] - ${docPath}`)

      try {
        // 1. Fetch markdown content from GitHub
        const fileResult = await fetchFileContent(owner, repo, docPath, ref)
        if (!fileResult) {
          console.warn(`[${id}]   File not found: ${docPath}`)
          continue
        }

        // 2. Parse frontmatter and extract title + body
        const { title, body } = parseFrontmatter(fileResult.content, docPath)

        // 3. SharePoint sync (if enabled)
        if (repoConfig.sharepointSync.enabled) {
          const { siteUrl, libraryName } = repoConfig.sharepointSync

          // 3a. Generate PDF from markdown
          console.log(`[${id}]   Generating PDF...`)
          const pdfResult = await markdownToPdf(body, {
            title,
            showFooter: true,
          })
          const pdfFileName = `${title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.pdf`

          // 3b. Resolve site and ensure document library
          const siteId = await getSiteId(siteUrl)
          const libTarget = await ensureDocumentLibrary(siteId, libraryName)

          // 3c. Upload PDF
          console.log(`[${id}]   Uploading PDF: ${pdfFileName}`)
          const pdfUrl = await uploadFileToLibrary(
            siteId,
            libTarget.driveId,
            pdfFileName,
            pdfResult.buffer,
            libTarget.folderPath,
          )
          console.log(`[${id}]   PDF uploaded: ${pdfUrl}`)

          // 3d. Build image fetcher that retrieves images from the GitHub repo
          const docDir = docPath.substring(0, docPath.lastIndexOf("/") + 1)
          const fetchImage: ImageFetcher = async (imagePath: string) => {
            const fullPath = docDir + imagePath
            const imgResult = await fetchFileContent(owner, repo, fullPath, ref)
            if (!imgResult) return null
            return Buffer.from(imgResult.content, "base64")
          }

          // 3e. Create or update SharePoint page
          console.log(`[${id}]   Syncing SharePoint page: ${title}`)
          const pageResult = await createOrUpdatePage(
            siteUrl,
            title,
            body,
            fetchImage,
          )
          console.log(`[${id}]   Page ${pageResult.action}: ${pageResult.url}`)
        }

        // TODO: Update vector embeddings
      } catch (error) {
        console.error(
          `[${id}]   Failed to process ${docPath}:`,
          error instanceof Error ? error.message : error,
        )
      }
    }
  }

  // Process document removals
  if (docs.remove.length > 0) {
    console.log(
      `[${id}] ${repoConfig.documentType} docs to remove: ${docs.remove.length}`,
    )
    for (const doc of docs.remove) {
      console.log(`[${id}] - ${doc}`)
      // TODO: Remove page from SharePoint, archive PDF, update vectors
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

/**
 * Parse YAML frontmatter from a markdown document.
 * Returns the title (from frontmatter or derived from filename) and the body without frontmatter.
 */
function parseFrontmatter(
  content: string,
  filePath: string,
): { title: string; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (match) {
    const yamlStr = match[1]!
    const body = match[2]!
    try {
      const meta = parseYaml(yamlStr) as Record<string, unknown>
      const title =
        typeof meta.title === "string" && meta.title ?
          meta.title
        : titleFromPath(filePath)
      return { title, body }
    } catch {
      // YAML parse failed — treat entire content as body
    }
  }

  return { title: titleFromPath(filePath), body: content }
}

/** Derive a human-readable title from a file path like "policies/my-cool-policy.md" */
function titleFromPath(filePath: string): string {
  const fileName = filePath.split("/").pop() ?? filePath
  return fileName
    .replace(/\.md$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
