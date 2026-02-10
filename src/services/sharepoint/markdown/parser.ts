/**
 * Markdown Parsing Utilities
 */

import { marked } from "marked"

/**
 * Convert markdown content to HTML
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string
}
