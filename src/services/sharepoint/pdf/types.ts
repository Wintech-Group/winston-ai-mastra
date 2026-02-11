/**
 * PDF Generation Types
 */

import type { Content, TDocumentDefinitions } from "pdfmake/interfaces"

/**
 * Content for a single section (left, center, or right) of a header/footer.
 *
 * Each section can contain text, an image, or both. When both are provided,
 * the image is rendered above the text.
 *
 * Text supports `{currentPage}` and `{totalPages}` placeholders.
 */
export interface HeaderFooterSection {
  /** Text content. Supports {currentPage} and {totalPages} placeholders. */
  text?: string | string[]
  /** Absolute path to an image file (SVG or raster) */
  image?: string
  /** Image width in points */
  imageWidth?: number
  /** Image height in points */
  imageHeight?: number
  /** Font size for text in this section (default: 8) */
  fontSize?: number
  /** Text color (default: "#1B1F1B") */
  color?: string
}

/**
 * Header or footer definition with left / center / right sections,
 * mirroring the MS Word header/footer model.
 */
export interface HeaderFooterDef {
  left?: HeaderFooterSection
  center?: HeaderFooterSection
  right?: HeaderFooterSection
  /** Left and right margins for this band [left, right] in points */
  margins?: [number, number]
  /** Vertical alignment of each column's content relative to the tallest column (default: "top") */
  verticalAlign?: "top" | "center" | "bottom"
}

/** Configuration for PDF document generation */
export interface PdfOptions {
  /** Document title (used as metadata, not rendered directly) */
  title?: string

  /** Page size - defaults to A4 */
  pageSize?: "A4" | "LETTER" | "LEGAL"

  /** Page orientation */
  pageOrientation?: "portrait" | "landscape"

  /** Header definition (omit to disable header) */
  header?: HeaderFooterDef

  /** Footer definition (omit to disable footer) */
  footer?: HeaderFooterDef

  /** Page margins [left, top, right, bottom] in points */
  margins?: [number, number, number, number]
}

/** Default PDF options — margins match Wintech Word template */
export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  title: "",
  pageSize: "A4",
  pageOrientation: "portrait",
  margins: [72, 99, 57, 72], // left, top, right, bottom (from Word template)
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
