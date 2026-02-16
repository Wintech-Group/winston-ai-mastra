/**
 * HTML to PDFMake Converter
 *
 * Uses the html-to-pdfmake library to convert HTML content into pdfmake format.
 */

import type { Content } from "pdfmake/interfaces"
// @ts-expect-error - html-to-pdfmake doesn't have type definitions
import htmlToPdfmake from "html-to-pdfmake"

// linkedom's DOMParser doesn't place HTML fragments inside <body> when
// parsing 'text/html', which causes html-to-pdfmake to return empty output.
// We wrap the markup in a full document structure before parsing, and pass
// a plain object as `window` since linkedom's window silently ignores
// property assignment (so we can't override DOMParser on it directly).
import { parseHTML, DOMParser } from "linkedom"

const { document } = parseHTML("<!DOCTYPE html><html></html>")

function FragmentSafeDOMParser() {}
FragmentSafeDOMParser.prototype.parseFromString = function (
  markup: string,
  type: "text/html" | "image/svg+xml" | "text/xml",
) {
  const parser = new DOMParser()
  if (type === "text/html" && !markup.includes("<body")) {
    markup =
      "<!DOCTYPE html><html><head></head><body>" + markup + "</body></html>"
  }
  return parser.parseFromString(markup, type)
}

const window = { document, DOMParser: FragmentSafeDOMParser }

/**
 * Regex pattern to match emojis
 */
const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B50}-\u{2B55}]|[\u{200D}]|[\u{FE0F}]|[\u{1F1E0}-\u{1F1FF}]/gu

/**
 * Strip emojis from text (Roboto font doesn't support them)
 */
function stripEmojis(text: string): string {
  return text.replace(EMOJI_REGEX, "").replace(/\s{2,}/g, " ")
}

/**
 * Pre-process HTML to handle task list checkboxes
 * Converts <input type="checkbox"> to text representation
 */
function preprocessTaskLists(html: string): string {
  // Replace checked checkboxes with bold [x]
  let processed = html.replace(
    /<input[^>]*checked[^>]*type=["']?checkbox["']?[^>]*>/gi,
    "<b>[x]</b> ",
  )
  // Also handle the other order (type before checked)
  processed = processed.replace(
    /<input[^>]*type=["']?checkbox["']?[^>]*checked[^>]*>/gi,
    "<b>[x]</b> ",
  )
  // Replace unchecked checkboxes with bold [ ] and non-breaking space for width
  processed = processed.replace(
    /<input[^>]*type=["']?checkbox["']?[^>]*>/gi,
    "<b>[&nbsp;&nbsp;]</b> ",
  )

  return processed
}

/**
 * Convert HTML to pdfmake Content array
 *
 * @param html - HTML string to convert
 * @returns Array of pdfmake Content objects
 */
export function htmlToPdfmakeContent(html: string): Content[] {
  // Pre-process: strip emojis and convert task checkboxes
  let processedHtml = stripEmojis(html)
  processedHtml = preprocessTaskLists(processedHtml)

  // Use html-to-pdfmake library for the conversion
  const result = htmlToPdfmake(processedHtml, {
    // Provide window object for Node.js/Bun environment
    window,
    // Default styles for elements
    defaultStyles: {
      h1: { fontSize: 16, bold: true, marginBottom: 10, color: "#253E34" },
      h2: {
        fontSize: 12,
        bold: true,
        marginBottom: 8,
        marginTop: 6,
        color: "#50645c",
      },
      h3: {
        fontSize: 10,
        bold: true,
        marginBottom: 6,
        marginTop: 4,
        color: "#1b1f1b",
      },
      h4: {
        fontSize: 10,
        bold: true,
        marginBottom: 4,
        marginTop: 2,
        color: "#1b1f1b",
      },
      h5: {
        fontSize: 9,
        bold: true,
        marginBottom: 4,
        marginTop: 2,
        color: "#1b1f1b",
      },
      h6: {
        fontSize: 8,
        bold: true,
        marginBottom: 4,
        marginTop: 2,
        color: "#1b1f1b",
      },
      p: { marginBottom: 8, color: "#1b1f1b" },
      ul: { marginBottom: 4, marginTop: 0, color: "#1b1f1b" },
      ol: { marginBottom: 4, marginTop: 0, color: "#1b1f1b" },
      li: { marginBottom: 2, color: "#1b1f1b" },
      pre: {
        font: "Courier",
        fontSize: 9,
        background: "#e3e8e7",
        margin: [0, 8, 0, 8],
      },
      code: {
        font: "Courier",
        fontSize: 9,
        background: "#e3e8e7",
      },
      blockquote: {
        marginLeft: 20,
        italics: true,
        color: "#c7d1cf",
      },
      a: {
        color: "#3C69E6",
        decoration: "underline",
      },
      table: { marginBottom: 4, marginTop: 4 },
      th: {
        bold: true,
        color: "#1b1f1b",
      },
    },
  })

  // Post-process content to clean whitespace-only elements and fix nested list margins
  const cleanContent = cleanPdfContent(result)

  // html-to-pdfmake returns a single object or array — normalize to always return an array
  if (Array.isArray(cleanContent)) {
    return cleanContent as Content[]
  }

  return [cleanContent] as Content[]
}

/**
 * Custom table layout providing Wintech-branded styling:
 * - Thin gray borders
 * - Light green-gray header background
 * - Comfortable cell padding
 */
const wintechTableLayout = {
  hLineWidth: (i: number, node: { table: { body: unknown[][] } }) =>
    i === 0 || i === node.table.body.length ? 0.8 : 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => "#c7d1cf",
  vLineColor: () => "#c7d1cf",
  fillColor: (i: number) => {
    if (i === 0) return "#dde3e2" // header row
    return null
  },
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

/**
 * Apply table styles and page-break settings to a pdfmake table node.
 *
 * - Sets `dontBreakRows` so individual rows never split across pages
 * - Sets `headerRows` so the first row repeats on every page for long tables
 * - Applies the Wintech branded table layout
 */
function styleTableNode(node: Record<string, unknown>): void {
  const table = node.table as Record<string, unknown> | undefined
  if (!table) return

  // Page-break control
  table.dontBreakRows = true
  table.headerRows = 1

  // Apply custom layout
  node.layout = wintechTableLayout

  // html-to-pdfmake sets fillColor directly on <th> cells which overrides
  // the layout's fillColor callback. Strip fillColor from every cell so the
  // layout is the sole authority for background colors.
  const body = table.body as unknown[][] | undefined
  if (body) {
    for (const row of body) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c]
        if (cell && typeof cell === "object" && !Array.isArray(cell)) {
          const rec = cell as Record<string, unknown>
          delete rec.fillColor
        }
      }
    }
  }
}

/** Check whether a node is a heading (H1–H6) produced by html-to-pdfmake */
function isHeadingNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false
  const rec = node as Record<string, unknown>
  // html-to-pdfmake sets nodeName on converted elements
  if (typeof rec.nodeName === "string" && /^H[1-6]$/i.test(rec.nodeName))
    return true
  // Also check style array/string for html-h* patterns
  const style = rec.style
  if (typeof style === "string" && /^html-h[1-6]$/.test(style)) return true
  if (
    Array.isArray(style) &&
    style.some((s: unknown) => typeof s === "string" && /^html-h[1-6]$/.test(s))
  )
    return true
  return false
}

/** Check whether a node is an unbreakable wrapper (e.g. a table we wrapped) */
function isUnbreakableNode(node: unknown): boolean {
  if (!node || typeof node !== "object") return false
  const rec = node as Record<string, unknown>
  return rec.unbreakable === true && Array.isArray(rec.stack)
}

/** Check whether a node or any of its children contain an image */
function containsImage(node: unknown): boolean {
  if (!node || typeof node !== "object") return false
  const rec = node as Record<string, unknown>
  if ("image" in rec) return true
  for (const value of Object.values(rec)) {
    if (Array.isArray(value) && value.some(containsImage)) return true
    if (value && typeof value === "object" && containsImage(value)) return true
  }
  return false
}

/**
 * Merge heading sequences + unbreakable pairs so they stay on the same page.
 * When one or more headings immediately precede an unbreakable stack (table,
 * list, image, or paragraph), all headings are prepended into that stack —
 * keeping the entire group together.
 *
 * Example: H2 → H3 → Image becomes {stack: [H2, H3, Image], unbreakable: true}
 */
function mergeHeadingsWithUnbreakables(items: unknown[]): unknown[] {
  const merged: unknown[] = []
  let i = 0

  while (i < items.length) {
    const current = items[i]

    // If this is a heading, look ahead to collect all consecutive headings
    if (isHeadingNode(current)) {
      const headings: unknown[] = [current]
      let j = i + 1

      // Collect consecutive headings
      while (j < items.length && isHeadingNode(items[j])) {
        headings.push(items[j])
        j++
      }

      // Check if the sequence ends with an unbreakable node
      const followingNode = items[j]
      if (followingNode && isUnbreakableNode(followingNode)) {
        // Merge all collected headings + the unbreakable into one stack
        const wrapper = { ...(followingNode as Record<string, unknown>) }
        wrapper.stack = [...headings, ...(wrapper.stack as unknown[])]
        merged.push(wrapper)
        i = j + 1 // skip all the nodes we merged
      } else {
        // No unbreakable following, add headings normally
        merged.push(...headings)
        i = j
      }
    } else {
      merged.push(current)
      i++
    }
  }

  return merged
}

/**
 * Recursively clean and process PDFMake content
 * - Removes whitespace-only text elements
 * - Fixes nested list margins
 * - Applies table styles and page-break settings
 * - Keeps headings together with immediately-following content (tables, lists, images, paragraphs)
 */
function cleanPdfContent(content: unknown, insideList = false): unknown {
  if (Array.isArray(content)) {
    const cleaned = content
      .map((item) => cleanPdfContent(item, insideList))
      .filter((item) => {
        // Remove whitespace-only text objects
        if (item && typeof item === "object" && "text" in item) {
          const textItem = item as { text: unknown }
          if (
            typeof textItem.text === "string" &&
            textItem.text.trim() === ""
          ) {
            return false
          }
        }
        return true
      })

    // Merge any heading that directly precedes an unbreakable element
    return mergeHeadingsWithUnbreakables(cleaned)
  }

  if (content && typeof content === "object") {
    const result = { ...(content as Record<string, unknown>) }

    // Check if this node is a list
    const isList = "ul" in result || "ol" in result
    // Check if this node is a table
    const isTable = "table" in result
    // Check if this node is an image
    const isImage = "image" in result
    // Check if this node is a paragraph (text-based or containing images/other block content)
    const isParagraph =
      !isHeadingNode(result) &&
      (result.nodeName === "P" ||
        result.style === "html-p" ||
        (Array.isArray(result.style) && result.style.includes("html-p")))

    // If it's a nested list (inside another list structure), remove bottom margin
    if (isList && insideList) {
      result.marginBottom = 0
    }

    // Wrap top-level lists in an unbreakable stack so short lists stay on
    // one page (and can merge with a preceding heading). Nested lists inside
    // another list are left alone — only the outermost list gets the wrapper.
    if (isList && !insideList) {
      // Recurse into the list items first
      for (const key of ["ul", "ol"] as const) {
        if (key in result) {
          result[key] = cleanPdfContent(result[key], true)
        }
      }
      return { stack: [result], unbreakable: true }
    }

    // Apply table styling and page-break settings.
    // Wrap the table in an unbreakable stack so short tables stay on one
    // page. pdfmake will still break genuinely long tables across pages
    // using dontBreakRows + headerRows as a graceful fallback.
    if (isTable) {
      styleTableNode(result)
      return { stack: [result], unbreakable: true }
    }

    // Wrap images in an unbreakable stack so they stay with a preceding heading
    if (isImage) {
      result.alignment = "center"
      return { stack: [result], unbreakable: true }
    }

    // Wrap paragraphs in an unbreakable stack so they stay with a preceding heading.
    // If the paragraph contains an image, center it.
    if (isParagraph) {
      if (containsImage(result)) {
        result.alignment = "center"
      }
      return { stack: [result], unbreakable: true }
    }

    for (const [key, value] of Object.entries(result)) {
      if (key === "stack" || key === "columns") {
        result[key] = cleanPdfContent(value, insideList)
      } else if (key === "ul" || key === "ol") {
        result[key] = cleanPdfContent(value, true)
      }
    }

    return result
  }

  return content
}
