/**
 * SharePoint Service Module
 *
 * Provides SharePoint page creation, PDF generation, and file management
 * via Microsoft Graph API.
 */

// Auth module
export { getAccessToken } from "./auth"

// Graph API module
export {
  createPage,
  getFileByPath,
  getPage,
  getSiteId,
  GRAPH_BASE_URL,
  graphFetch,
  listPages,
  publishPage,
  updatePage,
  uploadFile,
  uploadFileToLibrary,
  ensureDocumentLibrary,
  uploadImageWithDedup,
  type DriveItem,
  type LibraryTarget,
  type GraphRequestOptions,
  type ImageUploadResult,
  type Site,
  type SitePage,
} from "./graph"

// Markdown module
export {
  buildCreatePayload,
  buildUpdatePayload,
  createOrUpdatePage,
  findExistingPage,
  markdownToHtml,
  processMarkdownImages,
  type ImageFetcher,
  type PageResult,
} from "./markdown"

// Utils
export { computeQuickXorHash, computeSHA1 } from "./utils"

// PDF Generation module
export {
  generatePdf,
  htmlToPdf,
  htmlToPdfmakeContent,
  markdownToPdf,
  resolveLogoPath,
  type HeaderFooterDef,
  type HeaderFooterSection,
  type PdfOptions,
  type PdfResult,
} from "./pdf"
