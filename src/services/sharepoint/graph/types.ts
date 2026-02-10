/**
 * Microsoft Graph API Type Definitions
 */

/** Options for Graph API requests */
export interface GraphRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT"
  body?: unknown
  headers?: Record<string, string>
}

/** SharePoint Site */
export interface Site {
  id: string
  displayName: string
  webUrl: string
}

/** SharePoint Site Page */
export interface SitePage {
  id: string
  name: string
  title: string
  webUrl: string
}

/** Response for page list operations */
export interface PageListResponse {
  value: SitePage[]
}

/** OneDrive/SharePoint Drive Item */
export interface DriveItem {
  id: string
  name: string
  webUrl: string
  file?: {
    hashes?: {
      quickXorHash?: string
      sha1Hash?: string
    }
  }
}

/** Result of file upload operation */
export interface UploadResult {
  webUrl: string
}

/** Result of image upload with deduplication */
export interface ImageUploadResult {
  url: string
  action: "existing" | "uploaded"
}
