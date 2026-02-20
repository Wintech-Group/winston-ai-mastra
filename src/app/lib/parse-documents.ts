export type DocumentSegment =
  | {
      type: "text"
      content: string
    }
  | {
      type: "document"
      title: string
      content: string
    }

const DOCUMENT_TAG_RE =
  /<document\s+title="([^"]*)">\s*([\s\S]*?)\s*<\/document>/g

/**
 * Splits a text string into alternating text and document segments.
 * Documents are delimited by `<document title="...">...</document>` tags.
 */
export function parseDocumentSegments(text: string): DocumentSegment[] {
  const segments: DocumentSegment[] = []
  let lastIndex = 0

  for (const match of text.matchAll(DOCUMENT_TAG_RE)) {
    const matchStart = match.index!
    // Text before this document tag
    if (matchStart > lastIndex) {
      const before = text.slice(lastIndex, matchStart).trim()
      if (before) {
        segments.push({ type: "text", content: before })
      }
    }

    segments.push({
      type: "document",
      title: match[1]!,
      content: match[2]!,
    })

    lastIndex = matchStart + match[0].length
  }

  // Remaining text after the last document tag
  if (lastIndex < text.length) {
    const after = text.slice(lastIndex).trim()
    if (after) {
      segments.push({ type: "text", content: after })
    }
  }

  // No documents found — return the whole string as text
  if (segments.length === 0 && text.trim()) {
    segments.push({ type: "text", content: text })
  }

  return segments
}
