/**
 * HTML to PDFMake Converter
 *
 * Uses the html-to-pdfmake library to convert HTML content into pdfmake format.
 */

import type { Content } from "pdfmake/interfaces"
// @ts-expect-error - html-to-pdfmake doesn't have type definitions
import htmlToPdfmake from "html-to-pdfmake"
// @ts-expect-error - jsdom doesn't have bundled types
import { JSDOM } from "jsdom"

// Create a window object for html-to-pdfmake (required in Node.js/Bun)
const { window } = new JSDOM("")

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
      h1: { fontSize: 24, bold: true, marginBottom: 10 },
      h2: { fontSize: 20, bold: true, marginBottom: 8 },
      h3: { fontSize: 16, bold: true, marginBottom: 6 },
      h4: { fontSize: 14, bold: true, marginBottom: 4 },
      h5: { fontSize: 12, bold: true, marginBottom: 4 },
      h6: { fontSize: 11, bold: true, marginBottom: 4 },
      p: { marginBottom: 8 },
      ul: { marginBottom: 4, marginTop: 0 },
      ol: { marginBottom: 4, marginTop: 0 },
      li: { marginBottom: 2 },
      pre: {
        font: "Courier",
        fontSize: 9,
        background: "#f5f5f5",
        margin: [0, 8, 0, 8],
      },
      code: {
        font: "Courier",
        fontSize: 9,
        background: "#f0f0f0",
      },
      blockquote: {
        marginLeft: 20,
        italics: true,
        color: "#666666",
      },
      a: {
        color: "#0066cc",
        decoration: "underline",
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
 * Recursively clean and process PDFMake content
 * - Removes whitespace-only text elements
 * - Fixes nested list margins
 */
function cleanPdfContent(content: unknown, insideList = false): unknown {
  if (Array.isArray(content)) {
    return content
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
  }

  if (content && typeof content === "object") {
    const result = { ...(content as Record<string, unknown>) }

    // Check if this node is a list
    const isList = "ul" in result || "ol" in result

    // If it's a nested list (inside another list structure), remove bottom margin
    if (isList && insideList) {
      result.marginBottom = 0
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
