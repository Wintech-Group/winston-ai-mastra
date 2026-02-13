/**
 * Markdown Processing Module
 *
 * Converts markdown to SharePoint pages with image handling.
 */

// Re-export parser functions
export { markdownToHtml } from "./parser"

// Re-export image processing
export { processMarkdownImages, type ImageFetcher } from "./images"

// Re-export page builder
export {
  buildCreatePayload,
  buildUpdatePayload,
  createOrUpdatePage,
  findExistingPage,
  type PageResult,
} from "./page-builder"
