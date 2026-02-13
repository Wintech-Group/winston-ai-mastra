/**
 * SharePoint/OneDrive File Operations
 */

import { getAccessToken } from "../auth"
import { computeQuickXorHash } from "../utils/hash"
import { GRAPH_BASE_URL, graphFetch } from "./client"
import type { DriveItem, ImageUploadResult } from "./types"

/**
 * Get a file by its path in a specific drive
 * @returns null if file doesn't exist (404)
 */
export async function getFileByPath(
  siteId: string,
  relativePath: string,
  driveId?: string,
): Promise<DriveItem | null> {
  try {
    const endpoint =
      driveId ?
        `/sites/${siteId}/drives/${driveId}/root:/${relativePath}?$select=id,name,webUrl,file`
      : `/sites/${siteId}/drive/root:/${relativePath}?$select=id,name,webUrl,file`
    return await graphFetch<DriveItem>(endpoint)
  } catch (error: unknown) {
    // Return null if file doesn't exist
    if (error instanceof Error && error.message.includes("404")) {
      return null
    }
    throw error
  }
}

/**
 * Upload a file to SharePoint
 * If file exists, it will be overwritten
 * @returns The web URL of the uploaded file
 */
export async function uploadFile(
  siteId: string,
  folderPath: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
): Promise<string> {
  const token = await getAccessToken()
  const uploadPath = `${folderPath}/${fileName}`

  // Convert to Blob for fetch compatibility
  // Cast needed due to TS5 strict ArrayBuffer typing
  const body = new Blob([fileBuffer as unknown as ArrayBuffer])

  const response = await fetch(
    `${GRAPH_BASE_URL}/sites/${siteId}/drive/root:/${uploadPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body,
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `File upload error: ${response.status} ${response.statusText}\n${errorText}`,
    )
  }

  const result = (await response.json()) as { webUrl: string }
  return result.webUrl
}

/**
 * Upload an image with hash-based deduplication
 * Uses content-addressable storage: filename = {hash}.{extension}
 * Uploads to an "Images" subfolder within the given library target.
 * @returns The SharePoint URL (existing or newly uploaded) and action taken
 */
export async function uploadImageWithDedup(
  siteId: string,
  imageBuffer: Buffer,
  extension: string,
  library: LibraryTarget,
): Promise<ImageUploadResult> {
  // Compute hash and create filename
  const hash = computeQuickXorHash(imageBuffer)
  const fileName = `${hash}.${extension}`

  // Build the Images subfolder path within the library target
  const imageFolder =
    library.folderPath ? `${library.folderPath}/Images` : "Images"

  console.log(`  Checking for existing image: ${fileName}`)

  // Check if file already exists
  const existing = await getFileByPath(
    siteId,
    `${imageFolder}/${fileName}`,
    library.driveId,
  )

  if (existing) {
    console.log(`  Image already exists, reusing URL`)
    return { url: existing.webUrl, action: "existing" }
  }

  // Upload new file to Images subfolder
  console.log(`  Uploading new image...`)
  const url = await uploadFileToLibrary(
    siteId,
    library.driveId,
    fileName,
    imageBuffer,
    imageFolder,
  )
  console.log(`  Uploaded successfully`)
  return { url, action: "uploaded" }
}

/**
 * Target location for file upload
 */
export interface LibraryTarget {
  driveId: string
  folderPath?: string
}

/**
 * Get or create a Document Library (or fallback to Folder)
 * @returns The Drive ID and optional folder path
 */
export async function ensureDocumentLibrary(
  siteId: string,
  libraryName: string,
): Promise<LibraryTarget> {
  const token = await getAccessToken()

  // 1. List all drives to see if it exists
  const drivesResponse = await graphFetch<{
    value: { id: string; name: string }[]
  }>(`/sites/${siteId}/drives`)

  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "")
  const existingDrive = drivesResponse.value.find(
    (d) => normalize(d.name) === normalize(libraryName),
  )

  if (existingDrive) {
    return { driveId: existingDrive.id }
  }

  // 2. If not found, try to create a new List with documentLibrary template
  console.log(`  Creating new Document Library: ${libraryName}...`)
  try {
    const listResponse = await fetch(
      `${GRAPH_BASE_URL}/sites/${siteId}/lists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: libraryName,
          list: {
            template: "documentLibrary",
          },
        }),
      },
    )

    if (!listResponse.ok) {
      throw new Error(
        `Failed to create document library: ${listResponse.status} ${listResponse.statusText}`,
      )
    }

    const list = (await listResponse.json()) as { id: string }

    // 3. Get the Drive associated with the new List
    const driveResponse = await graphFetch<{ id: string }>(
      `/sites/${siteId}/lists/${list.id}/drive`,
    )

    return { driveId: driveResponse.id }
  } catch {
    console.warn(
      `  Could not create Library (Access Denied?). Falling back to folder '${libraryName}' in default Documents drive.`,
    )

    // Fallback: Use default drive and ensure folder exists
    const defaultDrive =
      drivesResponse.value.find((d) => d.name === "Documents") ||
      drivesResponse.value[0]
    if (!defaultDrive) {
      throw new Error("Could not find default Documents drive for fallback.")
    }

    // Check if folder exists
    const folderPath = libraryName
    try {
      await graphFetch(
        `/sites/${siteId}/drives/${defaultDrive.id}/root:/${folderPath}`,
      )
    } catch {
      // If 404, create it
      await fetch(
        `${GRAPH_BASE_URL}/sites/${siteId}/drives/${defaultDrive.id}/root/children`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: libraryName,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
        },
      )
    }

    return {
      driveId: defaultDrive.id,
      folderPath: libraryName,
    }
  }
}

/**
 * Upload a file to a specific Document Library (Drive)
 */
export async function uploadFileToLibrary(
  siteId: string,
  driveId: string,
  fileName: string,
  fileBuffer: Buffer | Uint8Array,
  folderPath?: string,
): Promise<string> {
  const token = await getAccessToken()

  // Convert to Blob for fetch compatibility
  const body = new Blob([fileBuffer as unknown as ArrayBuffer])

  const uploadPath = folderPath ? `${folderPath}/${fileName}` : fileName

  const response = await fetch(
    `${GRAPH_BASE_URL}/sites/${siteId}/drives/${driveId}/root:/${uploadPath}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
      },
      body,
    },
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `File upload error: ${response.status} ${response.statusText}\n${errorText}`,
    )
  }

  const result = (await response.json()) as { webUrl: string }
  return result.webUrl
}
