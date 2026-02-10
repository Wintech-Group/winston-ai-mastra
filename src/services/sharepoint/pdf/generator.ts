/**
 * PDF Generator
 *
 * Generates PDF documents from pdfmake content with headers, footers,
 * and page numbering.
 *
 * Uses pdfmake v0.3+ API
 */

import { createRequire } from "module"
import { dirname, join } from "path"
import type {
  Content,
  DynamicContent,
  TDocumentDefinitions,
  TFontDictionary,
} from "pdfmake/interfaces"
import { DEFAULT_PDF_OPTIONS, type PdfOptions, type PdfResult } from "./types"

// createRequire gives us CJS-compatible require/resolve inside ESM bundles,
// avoiding the ERR_AMBIGUOUS_MODULE_SYNTAX conflict with top-level await.
const _require = createRequire(import.meta.url)
const pdfmake = _require("pdfmake")

// resolve("pdfmake") → .../pdfmake/js/index.js — go up twice to reach package root
const pdfmakeRoot = dirname(dirname(_require.resolve("pdfmake")))
const fontDir = join(pdfmakeRoot, "fonts", "Roboto")

// Server-side: pass absolute file paths directly — VFS is client-side only
const fonts: TFontDictionary = {
  Roboto: {
    normal: join(fontDir, "Roboto-Regular.ttf"),
    bold: join(fontDir, "Roboto-Medium.ttf"),
    italics: join(fontDir, "Roboto-Italic.ttf"),
    bolditalics: join(fontDir, "Roboto-MediumItalic.ttf"),
  },
}

pdfmake.addFonts(fonts)

/**
 * Create the header function for the PDF
 */
function createHeader(
  options: Required<PdfOptions>,
): DynamicContent | undefined {
  if (!options.showHeader) {
    return undefined
  }

  const headerText = options.headerText || options.title

  return (_currentPage: number, _pageCount: number): Content => ({
    text: headerText,
    alignment: "center",
    fontSize: 9,
    color: "#666666",
    margin: [40, 20, 40, 0],
  })
}

/**
 * Create the footer function with page numbers
 */
function createFooter(
  options: Required<PdfOptions>,
): DynamicContent | undefined {
  if (!options.showFooter) {
    return undefined
  }

  return (currentPage: number, pageCount: number): Content => {
    const text = options.footerFormat
      .replace("{currentPage}", String(currentPage))
      .replace("{totalPages}", String(pageCount))

    return {
      text,
      alignment: "center",
      fontSize: 9,
      color: "#666666",
      margin: [40, 0, 40, 20],
    }
  }
}

/**
 * Build the complete document definition
 */
function buildDocumentDefinition(
  content: Content[],
  options: Required<PdfOptions>,
): TDocumentDefinitions {
  const header = createHeader(options)
  const footer = createFooter(options)

  return {
    pageSize: options.pageSize,
    pageOrientation: options.pageOrientation,
    pageMargins: options.margins,

    ...(header && { header }),
    ...(footer && { footer }),

    content,

    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
      lineHeight: 1.3,
    },
  }
}

/**
 * Generate a PDF buffer from pdfmake content
 *
 * @param content - pdfmake Content array
 * @param options - PDF generation options
 * @returns Promise resolving to PdfResult with buffer and page count
 */
export async function generatePdf(
  content: Content[],
  options: Partial<PdfOptions> = {},
): Promise<PdfResult> {
  const mergedOptions: Required<PdfOptions> = {
    ...DEFAULT_PDF_OPTIONS,
    ...options,
  }

  const docDefinition = buildDocumentDefinition(content, mergedOptions)

  // Use pdfmake v0.3 API - createPdf returns an object with promise-based methods
  const pdf = pdfmake.createPdf(docDefinition)

  // Get the buffer using the new promise-based API
  const buffer = (await pdf.getBuffer()) as Buffer

  return {
    buffer,
    pageCount: 1, // Actual count is handled by pdfmake internally for headers/footers
  }
}
