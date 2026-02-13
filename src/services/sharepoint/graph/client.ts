/**
 * Core Microsoft Graph API Client
 */

import { getAccessToken } from "../auth"
import type { GraphRequestOptions } from "./types"

export const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"

/**
 * Make an authenticated request to Microsoft Graph API
 */
export async function graphFetch<T>(
  endpoint: string,
  options: GraphRequestOptions = {},
): Promise<T> {
  const token = await getAccessToken()
  const { method = "GET", body, headers = {} } = options

  const response = await fetch(`${GRAPH_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json;odata.metadata=none",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Graph API error: ${response.status} ${response.statusText}\n${errorText}`,
    )
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json() as Promise<T>
}
