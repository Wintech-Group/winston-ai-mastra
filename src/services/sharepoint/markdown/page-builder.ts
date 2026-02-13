/**
 * SharePoint Page Builder
 *
 * Constructs SharePoint page payloads from HTML content.
 */

import {
  createPage,
  ensureDocumentLibrary,
  getSiteId,
  listPages,
  publishPage,
  updatePage,
  type LibraryTarget,
} from "../graph"
import type { ImageFetcher } from "./images"
import { processMarkdownImages } from "./images"
import { markdownToHtml } from "./parser"

/** Options for the title area of a SharePoint page */
interface TitleAreaOptions {
  enableGradientEffect?: boolean
  layout?: "plain" | "colorBlock" | "overlap" | "imageAndTitle"
  showAuthor?: boolean
  showPublishedDate?: boolean
  textAlignment?: "left" | "center" | "right"
}

/** Default title area settings */
const DEFAULT_TITLE_AREA: TitleAreaOptions = {
  enableGradientEffect: false,
  layout: "plain",
  showAuthor: false,
  showPublishedDate: true,
  textAlignment: "left",
}

/**
 * Build the page canvas layout with HTML content
 */
function buildCanvasLayout(htmlContent: string) {
  return {
    horizontalSections: [
      {
        layout: "oneColumn",
        id: "1",
        emphasis: "none",
        columns: [
          {
            id: "1",
            width: 12,
            webparts: [
              {
                "@odata.type": "#microsoft.graph.textWebPart",
                innerHtml: htmlContent,
              },
            ],
          },
        ],
      },
    ],
  }
}

/**
 * Build the title area configuration
 */
function buildTitleArea(title: string, options: TitleAreaOptions = {}) {
  const mergedOptions = { ...DEFAULT_TITLE_AREA, ...options }
  return {
    ...mergedOptions,
    title,
  }
}

/**
 * Build the base page structure (shared between create and update)
 */
function buildBasePageStructure(
  title: string,
  htmlContent: string,
  titleAreaOptions?: TitleAreaOptions,
): Record<string, unknown> {
  return {
    "@odata.type": "#microsoft.graph.sitePage",
    title,
    showComments: true,
    showRecommendedPages: false,
    titleArea: buildTitleArea(title, titleAreaOptions),
    canvasLayout: buildCanvasLayout(htmlContent),
  }
}

/**
 * Build the page payload for creating a new page
 */
export function buildCreatePayload(
  title: string,
  htmlContent: string,
  titleAreaOptions?: TitleAreaOptions,
): Record<string, unknown> {
  return {
    ...buildBasePageStructure(title, htmlContent, titleAreaOptions),
    pageLayout: "article",
    name: `${title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-")}.aspx`,
  }
}

/**
 * Build the page payload for updating an existing page
 *
 * Note: Only certain properties can be updated via PATCH:
 * - title, description, thumbnailWebUrl
 * - showComments, showRecommendedPages
 * - titleArea, canvasLayout
 *
 * Properties NOT allowed: name, pageLayout
 */
export function buildUpdatePayload(
  title: string,
  htmlContent: string,
  titleAreaOptions?: TitleAreaOptions,
): Record<string, unknown> {
  return buildBasePageStructure(title, htmlContent, titleAreaOptions)
}

/**
 * Find an existing page by title
 */
export async function findExistingPage(
  siteId: string,
  title: string,
): Promise<{ id: string; name: string } | null> {
  const pages = await listPages(siteId)
  const found = pages.find(
    (page) => page.title.toLowerCase() === title.toLowerCase(),
  )
  return found ? { id: found.id, name: found.name } : null
}

/** Result of page creation/update operation */
export interface PageResult {
  url: string
  action: "created" | "updated"
}

/**
 * Main entry point: Create or update a SharePoint page from markdown
 *
 * @param siteUrl - Full SharePoint site URL
 * @param title - Page title
 * @param markdownContent - Raw markdown content
 * @param fetchImage - Optional callback to fetch image data by relative path
 * @param library - Optional pre-resolved library target for image uploads
 */
export async function createOrUpdatePage(
  siteUrl: string,
  title: string,
  markdownContent: string,
  fetchImage?: ImageFetcher,
  library?: LibraryTarget,
): Promise<PageResult> {
  // Get site ID from URL
  console.log(`Resolving site: ${siteUrl}`)
  const siteId = await getSiteId(siteUrl)
  console.log(`Site ID: ${siteId}`)

  // Process images: upload to SharePoint and replace paths
  let processedMarkdown = markdownContent
  if (fetchImage) {
    // Resolve library target if not provided
    const imageLibrary = library ?? await ensureDocumentLibrary(siteId, "Documents")
    processedMarkdown = await processMarkdownImages(
      siteId,
      markdownContent,
      fetchImage,
      imageLibrary,
    )
  }

  // Convert markdown to HTML
  const htmlContent = markdownToHtml(processedMarkdown)

  // Check if page already exists
  const existingPage = await findExistingPage(siteId, title)

  let pageId: string
  let pageName: string
  let action: "created" | "updated"

  if (existingPage) {
    console.log(`Updating existing page: ${existingPage.name}`)
    const updatePayload = buildUpdatePayload(title, htmlContent)
    await updatePage(siteId, existingPage.id, updatePayload)
    pageId = existingPage.id
    pageName = existingPage.name
    action = "updated"
  } else {
    console.log(`Creating new page: ${title}`)
    const createPayload = buildCreatePayload(title, htmlContent)
    const created = await createPage(siteId, createPayload)
    pageId = created.id
    pageName = created.name
    action = "created"
  }

  // Publish the page
  console.log(`Publishing page...`)
  await publishPage(siteId, pageId)

  // Construct the page URL
  const pageUrl = `${siteUrl}/SitePages/${pageName.replace(".aspx", "")}.aspx`

  console.log(`Page ${action}: ${pageUrl}`)
  return { url: pageUrl, action }
}
