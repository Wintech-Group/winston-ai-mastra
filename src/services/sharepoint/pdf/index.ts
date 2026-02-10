/**
 * PDF Generation Module
 *
 * Converts HTML (from markdown) to PDF with headers, footers, and page numbers.
 */

import { markdownToHtml } from "../markdown/parser"
import { generatePdf } from "./generator"
import { htmlToPdfmakeContent } from "./html-to-pdfmake"
import type { PdfOptions, PdfResult } from "./types"

// Re-export types and utilities
export { generatePdf } from "./generator"
export { htmlToPdfmakeContent } from "./html-to-pdfmake"
export type { PdfOptions, PdfResult } from "./types"

/**
 * Convert markdown content directly to PDF
 *
 * This is the main entry point for markdown → PDF conversion.
 * Combines the markdown parser, HTML-to-pdfmake converter, and PDF generator.
 */
export async function markdownToPdf(
  markdown: string,
  options: Partial<PdfOptions> = {},
): Promise<PdfResult> {
  // Step 1: Convert markdown to HTML
  const html = markdownToHtml(markdown)

  // Step 2: Convert HTML to pdfmake content
  const content = htmlToPdfmakeContent(html)

  // Step 3: Generate PDF
  return generatePdf(content, options)
}

/**
 * Convert HTML directly to PDF
 *
 * Use this if you already have HTML content and want to skip markdown parsing.
 */
export async function htmlToPdf(
  html: string,
  options: Partial<PdfOptions> = {},
): Promise<PdfResult> {
  const content = htmlToPdfmakeContent(html)
  return generatePdf(content, options)
}
