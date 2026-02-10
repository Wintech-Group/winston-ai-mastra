/**
 * Markdown Image Processing
 *
 * Handles extraction, upload, and URL replacement for images in markdown content.
 * Uses a callback-based approach to fetch image data, making this module
 * independent of the image source (filesystem, GitHub API, etc.).
 */

import { extname } from "path"
import { uploadImageWithDedup } from "../graph"

/** Callback to fetch image data by relative path. Returns null if not found. */
export type ImageFetcher = (path: string) => Promise<Buffer | null>

/**
 * Process markdown images: upload to SharePoint and replace paths
 * Supports both markdown syntax ![alt](path) and HTML <img src="path">
 *
 * @param siteId - SharePoint site ID for image upload
 * @param markdown - Raw markdown content
 * @param fetchImage - Callback to retrieve image data by path
 * @returns Modified markdown with SharePoint URLs
 */
export async function processMarkdownImages(
  siteId: string,
  markdown: string,
  fetchImage: ImageFetcher,
): Promise<string> {
  let modifiedMarkdown = markdown

  // Cache to dedupe processing of the same image path
  const processedImages = new Map<string, string>()

  // Helper to process a single image path and return new URL
  const processPath = async (imagePath: string): Promise<string | null> => {
    // Return cached result if already processed
    if (processedImages.has(imagePath)) {
      return processedImages.get(imagePath)!
    }
    // Skip if imagePath is undefined or already a URL
    if (
      !imagePath ||
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return null
    }

    console.log(`\nProcessing image: ${imagePath}`)

    // Fetch image data via callback
    const imageBuffer = await fetchImage(imagePath)

    if (!imageBuffer) {
      console.log(`  Image not found: ${imagePath}`)
      return null
    }

    // Extract extension from the path
    const extension = extname(imagePath).slice(1) // Remove leading dot

    // Upload with deduplication
    const result = await uploadImageWithDedup(siteId, imageBuffer, extension)

    // Cache the result for future references to the same path
    processedImages.set(imagePath, result.url)

    return result.url
  }

  // 1. Process Markdown Images: ![alt](path)
  const markdownRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const markdownMatches = [...modifiedMarkdown.matchAll(markdownRegex)]
  for (const match of markdownMatches) {
    const fullMatch = match[0]
    const alt = match[1]
    const imagePath = match[2]

    const newUrl = await processPath(imagePath!)
    if (newUrl) {
      modifiedMarkdown = modifiedMarkdown.replace(
        fullMatch,
        `![${alt}](${newUrl})`,
      )
      console.log(`  Replaced (MD) with: ${newUrl}`)
    }
  }

  // 2. Process HTML Images: <img src="path" ...> or <img ... src="path" ...>
  const htmlImgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g
  const htmlMatches = [...modifiedMarkdown.matchAll(htmlImgRegex)]
  for (const match of htmlMatches) {
    const fullMatch = match[0]!
    const imagePath = match[1]!

    const newUrl = await processPath(imagePath)
    if (newUrl) {
      // Replace only the src attribute within this specific <img> tag
      const newHtmlMatch = fullMatch.replace(imagePath, newUrl)
      modifiedMarkdown = modifiedMarkdown.replace(fullMatch, newHtmlMatch)
      console.log(`  Replaced (HTML) with: ${newUrl}`)
    }
  }

  return modifiedMarkdown
}
