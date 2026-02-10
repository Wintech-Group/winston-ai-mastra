/**
 * SharePoint Site Operations
 */

import { graphFetch } from "./client"
import type { Site } from "./types"

/**
 * Resolve a SharePoint site URL to its site ID
 * @param siteUrl - Full SharePoint site URL (e.g., https://tenant.sharepoint.com/sites/SiteName)
 */
export async function getSiteId(siteUrl: string): Promise<string> {
  const url = new URL(siteUrl)
  const host = url.host
  const sitePath = url.pathname

  const site = await graphFetch<Site>(`/sites/${host}:${sitePath}`)
  return site.id
}
