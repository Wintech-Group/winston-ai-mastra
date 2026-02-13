/**
 * PDF Generator
 *
 * Generates PDF documents from pdfmake content with headers, footers,
 * and page numbering.
 *
 * Header and footer each support left / center / right sections with
 * optional images and text — matching the MS Word header/footer model.
 *
 * Uses pdfmake v0.3+ API
 */

import { createRequire } from "module"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join, parse } from "path"
import type {
  Content,
  DynamicContent,
  TDocumentDefinitions,
  TFontDictionary,
} from "pdfmake/interfaces"
import {
  DEFAULT_PDF_OPTIONS,
  type HeaderFooterDef,
  type HeaderFooterSection,
  type PdfOptions,
  type PdfResult,
} from "./types"

// createRequire gives us CJS-compatible require/resolve inside ESM bundles,
// avoiding the ERR_AMBIGUOUS_MODULE_SYNTAX conflict with top-level await.
const _require = createRequire(import.meta.url)
const pdfmake = _require("pdfmake")

// Resolve the source file location so we can find our fonts directory.
// When Mastra bundles, __dirname would point to .mastra/output, but the source
// fonts live relative to the original source file. We walk up from this file's
// location to find the project root (the one with our actual package.json name).
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function findProjectRoot(startDir: string): string {
  let dir = startDir
  const { root } = parse(dir)
  while (dir !== root) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"))
      if (pkg.name === "bun-mastra") return dir
    } catch {
      // no package.json here, keep going
    }
    dir = dirname(dir)
  }
  throw new Error("Could not find project root (bun-mastra package.json)")
}

const projectRoot = findProjectRoot(__dirname)
const fontDir = join(
  projectRoot,
  "src",
  "services",
  "sharepoint",
  "pdf",
  "fonts",
)

// Server-side: pass absolute file paths directly — VFS is client-side only
const fonts: TFontDictionary = {
  ABCNormal: {
    normal: join(fontDir, "ABCNormal-Normal.ttf"),
    bold: join(fontDir, "ABCNormal-Medium.ttf"),
    italics: join(fontDir, "ABCNormal-NormalOblique.ttf"),
    bolditalics: join(fontDir, "ABCNormal-MediumOblique.ttf"),
  },
}

pdfmake.addFonts(fonts)

/**
 * Resolve the absolute path to a logo in the bundled logos directory.
 */
export function resolveLogoPath(filename: string): string {
  return join(
    projectRoot,
    "src",
    "services",
    "sharepoint",
    "pdf",
    "logos",
    filename,
  )
}

/**
 * Build pdfmake content for a single header/footer section.
 * Returns a stack Content node for use inside a column.
 */
function buildSectionContent(
  section: HeaderFooterSection | undefined,
  currentPage: number,
  pageCount: number,
  alignment: "left" | "center" | "right",
): Content {
  if (!section) return { text: "", alignment }

  const items: Content[] = []
  const fontSize = section.fontSize ?? 8
  const color = section.color ?? "#1B1F1B"

  // Image
  if (section.image) {
    const isSvg = section.image.toLowerCase().endsWith(".svg")

    if (isSvg) {
      const svgContent = readFileSync(section.image, "utf-8")
      items.push({
        svg: svgContent,
        width: section.imageWidth ?? 110,
        height: section.imageHeight,
        alignment,
      } as Content)
    } else {
      items.push({
        image: section.image,
        width: section.imageWidth ?? 110,
        height: section.imageHeight,
        alignment,
      } as Content)
    }
  }

  // Text — supports placeholders and multi-line
  if (section.text) {
    const lines = Array.isArray(section.text) ? section.text : [section.text]
    for (const line of lines) {
      const resolved = line
        .replace("{currentPage}", String(currentPage))
        .replace("{totalPages}", String(pageCount))
      items.push({ text: resolved, fontSize, color, alignment })
    }
  }

  if (items.length === 0) return { text: "", alignment }
  if (items.length === 1) return items[0] as Content
  return { stack: items, alignment } as Content
}

/**
 * Estimate the rendered height (in points) of a HeaderFooterSection.
 *
 * Image height is taken from `imageHeight` (or a default 24pt).
 * Each text line is estimated as `fontSize * 1.3` (matching defaultStyle.lineHeight).
 */
function estimateSectionHeight(section?: HeaderFooterSection): number {
  if (!section) return 0

  let height = 0
  const fontSize = section.fontSize ?? 8
  const lineHeight = fontSize * 1.3

  if (section.image) {
    height += section.imageHeight ?? 24
  }

  if (section.text) {
    const lineCount = Array.isArray(section.text) ? section.text.length : 1
    height += lineCount * lineHeight
  }

  return height
}

/**
 * Build a three-column header or footer band from a HeaderFooterDef.
 *
 * Uses a pdfmake columns layout with star-width columns for left, center,
 * and right — mirroring the MS Word header/footer tab-stop model.
 *
 * When `verticalAlign` is "center" or "bottom", shorter columns receive
 * extra top margin so their content aligns relative to the tallest column.
 */
function buildBand(
  def: HeaderFooterDef,
  currentPage: number,
  pageCount: number,
  bandPadding: number,
): Content {
  const marginLR = def.margins ?? [42, 42]
  const vAlign = def.verticalAlign ?? "top"

  const sections = [def.left, def.center, def.right] as const
  const alignments = ["left", "center", "right"] as const

  // Estimate each column's content height to calculate vertical offsets
  const heights = sections.map(estimateSectionHeight)
  const maxHeight = Math.max(...heights)

  const columns = sections.map((section, i) => {
    const alignment = alignments[i] as "left" | "center" | "right"
    const sectionHeight = heights[i] ?? 0
    const content = buildSectionContent(
      section,
      currentPage,
      pageCount,
      alignment,
    )

    let topOffset = 0
    if (vAlign === "center") {
      topOffset = (maxHeight - sectionHeight) / 2
    } else if (vAlign === "bottom") {
      topOffset = maxHeight - sectionHeight
    }

    return {
      width: "*",
      stack: [content],
      ...(topOffset > 0 && { margin: [0, topOffset, 0, 0] }),
    }
  })

  return {
    columns,
    margin: [marginLR[0], bandPadding, marginLR[1], 0],
  } as Content
}

/**
 * Create the header DynamicContent function for pdfmake.
 */
function createHeader(def?: HeaderFooterDef): DynamicContent | undefined {
  if (!def) return undefined

  return (currentPage: number, pageCount: number): Content =>
    buildBand(def, currentPage, pageCount, 30)
}

/**
 * Create the footer DynamicContent function for pdfmake.
 */
function createFooter(def?: HeaderFooterDef): DynamicContent | undefined {
  if (!def) return undefined

  return (currentPage: number, pageCount: number): Content =>
    buildBand(def, currentPage, pageCount, 15)
}

/**
 * Build the complete document definition
 */
function buildDocumentDefinition(
  content: Content[],
  options: PdfOptions,
): TDocumentDefinitions {
  const header = createHeader(options.header)
  const footer = createFooter(options.footer)
  const margins = options.margins ?? DEFAULT_PDF_OPTIONS.margins!

  return {
    pageSize: options.pageSize ?? "A4",
    pageOrientation: options.pageOrientation ?? "portrait",
    pageMargins: margins,

    ...(header && { header }),
    ...(footer && { footer }),

    content,

    defaultStyle: {
      font: "ABCNormal",
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
  const mergedOptions: PdfOptions = {
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
