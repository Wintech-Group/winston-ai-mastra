// Push handler for GitHub webhooks

import type { EmitterWebhookEvent } from "@octokit/webhooks"
import { parseFrontmatter } from "@wintech-group/documentation-types"
import { loadOrSyncConfig } from "../../../../services/config-service"
import {
  fetchBinaryContent,
  fetchFileContent,
} from "../../../../services/github"
import { extname } from "path"
import { formatDateToISO } from "../../../../utils/date"
import {
  createOrUpdatePage,
  ensureDocumentLibrary,
  getSiteId,
  markdownToPdf,
  processMarkdownImages,
  resolveLogoPath,
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
  // If repo-config.yaml changed, this will fetch, validate, and sync to DB
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

        // 2. Parse frontmatter and extract metadata
        const frontMatter = parseFrontmatter(fileResult.content, "policy")

        if (!frontMatter.success) {
          throw new Error(
            `Invalid frontmatter in ${docPath}: ${JSON.stringify(frontMatter.error)}`,
          )
        }

        const {
          body,
          data: { title, version, effective_date, id: docId },
        } = frontMatter

        const formattedEffectiveDate = formatDateToISO(effective_date)

        // 3. SharePoint sync (if enabled)
        if (repoConfig.sharepointSync.enabled) {
          const { siteUrl, libraryName } = repoConfig.sharepointSync

          // 3a. Resolve site ID and library target (needed for image processing and library operations)
          const siteId = await getSiteId(siteUrl)
          const libTarget = await ensureDocumentLibrary(siteId, libraryName)

          // 3b. Build image fetcher that retrieves images from the GitHub repo
          const docDir = docPath.substring(0, docPath.lastIndexOf("/") + 1)
          const imageBufferMap = new Map<string, Buffer>()
          const fetchImage: ImageFetcher = async (imagePath: string) => {
            // Normalize path separators (handle both forward and back slashes)
            const normalizedPath = imagePath.replace(/\\/g, "/")

            // Handle root-relative paths (starting with /) vs document-relative paths
            const fullPath =
              normalizedPath.startsWith("/") ?
                normalizedPath.slice(1) // Root-relative: strip leading slash
              : docDir + normalizedPath // Document-relative: combine with doc directory

            const imgResult = await fetchBinaryContent(
              owner,
              repo,
              fullPath,
              ref,
            )
            if (!imgResult) return null

            // Store buffer for PDF data URL generation
            imageBufferMap.set(imagePath, imgResult.content)
            return imgResult.content
          }

          // 3c. Process images: upload to SharePoint and replace paths in markdown
          console.log(`[${id}]   Processing images...`)
          const processedBody = await processMarkdownImages(
            siteId,
            body,
            fetchImage,
            libTarget,
          )

          // 3d. Build PDF-specific markdown with base64 data URLs
          //     pdfmake cannot resolve HTTP URLs — it needs data URLs or local paths
          let pdfBody = body
          for (const [imagePath, buffer] of imageBufferMap) {
            const ext = extname(imagePath).slice(1).toLowerCase()
            const mime =
              ext === "jpg" || ext === "jpeg" ? "image/jpeg"
              : ext === "png" ? "image/png"
              : ext === "gif" ? "image/gif"
              : ext === "svg" ? "image/svg+xml"
              : ext === "webp" ? "image/webp"
              : "application/octet-stream"
            const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`
            pdfBody = pdfBody.replaceAll(imagePath, dataUrl)
          }

          // 3e. Generate PDF from markdown with embedded data URLs
          console.log(`[${id}]   Generating PDF...`)
          const pdfResult = await markdownToPdf(pdfBody, {
            title,
            header: {
              left: {
                image: resolveLogoPath("Wintech_Logo_Forest_RGB.svg"),
                imageWidth: 110,
                imageHeight: 24,
              },
              right: {
                text: [
                  `${docId} ${version}`,
                  formattedEffectiveDate,
                  "{currentPage} of {totalPages}",
                ],
                fontSize: 8,
              },
            },
            footer: {
              verticalAlign: "center",
              left: {
                image: resolveLogoPath("BSI LOGO 9001 14001.png"),
                imageWidth: 102,
                imageHeight: 38,
              },
              right: {
                text: title,
                fontSize: 9,
              },
            },
          })
          const pdfFileName = `${title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.pdf`

          // 3f. Upload PDF to document library
          console.log(`[${id}]   Uploading PDF: ${pdfFileName}`)
          const pdfUrl = await uploadFileToLibrary(
            siteId,
            libTarget.driveId,
            pdfFileName,
            pdfResult.buffer,
            libTarget.folderPath,
          )
          console.log(`[${id}]   PDF uploaded: ${pdfUrl}`)

          // 3g. Create or update SharePoint page (using processed markdown)
          console.log(`[${id}]   Syncing SharePoint page: ${title}`)
          const pageResult = await createOrUpdatePage(
            siteUrl,
            title,
            processedBody,
            // No need to pass fetchImage again - images are already processed
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
