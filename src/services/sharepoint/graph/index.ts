/**
 * Microsoft Graph API Module
 *
 * Provides authenticated access to SharePoint sites, pages, and files.
 */

// Re-export types
export type {
  DriveItem,
  GraphRequestOptions,
  ImageUploadResult,
  PageListResponse,
  Site,
  SitePage,
  UploadResult,
} from "./types"

// Re-export core client
export { GRAPH_BASE_URL, graphFetch } from "./client"

// Re-export site operations
export { getSiteId } from "./sites"

// Re-export page operations
export {
  createPage,
  getPage,
  listPages,
  publishPage,
  updatePage,
} from "./pages"

// Re-export file operations
export {
  ensureDocumentLibrary,
  getFileByPath,
  uploadFile,
  uploadFileToLibrary,
  uploadImageWithDedup,
  type LibraryTarget,
} from "./files"
