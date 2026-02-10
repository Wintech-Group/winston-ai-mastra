/**
 * PDF Generation Types
 */

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces"

/** Configuration for PDF document generation */
export interface PdfOptions {
  /** Document title (appears in header if enabled) */
  title?: string

  /** Page size - defaults to A4 */
  pageSize?: "A4" | "LETTER" | "LEGAL"

  /** Page orientation */
  pageOrientation?: "portrait" | "landscape"

  /** Enable header with document title */
  showHeader?: boolean

  /** Enable footer with page numbers */
  showFooter?: boolean

  /** Custom header text (overrides title) */
  headerText?: string

  /** Footer format - use {currentPage} and {totalPages} as placeholders */
  footerFormat?: string

  /** Page margins [left, top, right, bottom] in points */
  margins?: [number, number, number, number]
}

/** Default PDF options */
export const DEFAULT_PDF_OPTIONS: Required<PdfOptions> = {
  title: "",
  pageSize: "A4",
  pageOrientation: "portrait",
  showHeader: true,
  showFooter: true,
  headerText: "",
  footerFormat: "Page {currentPage} of {totalPages}",
  margins: [40, 60, 40, 60], // Extra top/bottom for header/footer
}

/** Result of PDF generation */
export interface PdfResult {
  /** PDF as a Buffer */
  buffer: Buffer
  /** Number of pages in the document */
  pageCount: number
}

/** Parsed HTML element for conversion */
export interface ParsedElement {
  tag: string
  content: string
  children: ParsedElement[]
  attributes: Record<string, string>
}

export type { Content, TDocumentDefinitions }
