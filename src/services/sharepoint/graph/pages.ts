/**
 * SharePoint Page Operations
 */

import { graphFetch } from "./client"
import type { PageListResponse, SitePage } from "./types"

/**
 * List all pages in a site
 */
export async function listPages(siteId: string): Promise<SitePage[]> {
  const response = await graphFetch<PageListResponse>(`/sites/${siteId}/pages`)
  return response.value
}

/**
 * Get a specific page by ID
 */
export async function getPage(
  siteId: string,
  pageId: string,
): Promise<SitePage> {
  return graphFetch<SitePage>(`/sites/${siteId}/pages/${pageId}`)
}

/**
 * Create a new page
 */
export async function createPage(
  siteId: string,
  pageData: Record<string, unknown>,
): Promise<SitePage> {
  return graphFetch<SitePage>(`/sites/${siteId}/pages`, {
    method: "POST",
    body: pageData,
  })
}

/**
 * Update an existing page
 */
export async function updatePage(
  siteId: string,
  pageId: string,
  pageData: Record<string, unknown>,
): Promise<SitePage> {
  return graphFetch<SitePage>(
    `/sites/${siteId}/pages/${pageId}/microsoft.graph.sitePage`,
    {
      method: "PATCH",
      body: pageData,
    },
  )
}

/**
 * Publish a page (make it visible)
 */
export async function publishPage(
  siteId: string,
  pageId: string,
): Promise<void> {
  await graphFetch<void>(
    `/sites/${siteId}/pages/${pageId}/microsoft.graph.sitePage/publish`,
    {
      method: "POST",
    },
  )
}
