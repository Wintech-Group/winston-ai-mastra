import type { UIMessage } from "ai"

/**
 * Mock chat messages for developing document artifact UI.
 * Reconstructed from a real API stream response.
 * Documents are wrapped in <document title="...">...</document> tags.
 */
export const mockMessages: UIMessage[] = [
  {
    id: "user-1",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Write me a markdown document that explains markdown syntax",
      },
    ],
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: `Hi Duncan — below is a demonstration Markdown document that explains Markdown syntax. You can copy this entire message into a .md file and view it in any Markdown renderer.

<document title="Markdown: a short, practical guide">
# Markdown: a short, practical guide

Markdown is a lightweight plain-text formatting syntax that converts easily to HTML. This document explains common Markdown features with live examples and shows the raw syntax in fenced code blocks so you can copy and reuse them.

---

## 1. Headings

Use \`#\` for headings. More \`#\` characters mean a smaller heading.

Rendered:
# Heading level 1
## Heading level 2
### Heading level 3

Raw:
\`\`\`
# Heading level 1
## Heading level 2
### Heading level 3
\`\`\`

You can also use "Setext" style for level 1 and 2 headings:

Rendered:
Heading style 1
===============

Heading style 2
---------------

Raw:
\`\`\`
Heading style 1
===============

Heading style 2
---------------
\`\`\`

---

## 2. Paragraphs and line breaks

Separate paragraphs with a blank line.

Rendered:
This is the first paragraph.

This is the second paragraph.

A single trailing two spaces at the end of a line creates a line break.

Raw:
\`\`\`
This is the first paragraph.

This is the second paragraph.

This line ends with two spaces.  
This starts on a new line.
\`\`\`

---

## 3. Emphasis

Rendered:
- *Italic* (or _italic_)
- **Bold** (or __bold__)
- ***Bold and italic***

Raw:
\`\`\`
*Italic* or _Italic_
**Bold** or __Bold__
***Bold and italic***
\`\`\`

---

## 4. Lists

Unordered lists use \`-\`, \`*\` or \`+\`. Ordered lists use numbers.

Rendered:
- Item one
- Item two
  - Nested item

1. First
2. Second
   1. Sub-item

Raw:
\`\`\`
- Item one
- Item two
  - Nested item

1. First
2. Second
   1. Sub-item
\`\`\`

Task lists (GitHub-flavoured Markdown):

Rendered:
- [x] Complete draft
- [ ] Review changes

Raw:
\`\`\`
- [x] Complete draft
- [ ] Review changes
\`\`\`

---

## 5. Links and images

Inline link:

Rendered:
This is an [inline link to example.com](https://example.com).

Raw:
\`\`\`
This is an [inline link to example.com](https://example.com).
\`\`\`

Reference-style links:

Raw and convenient for multiple uses:
\`\`\`
This is a [reference link][1].

[1]: https://example.com "Optional title"
\`\`\`

Images use a preceding \`!\`:

Rendered:
![Alt text — example image](https://via.placeholder.com/150)

Raw:
\`\`\`
![Alt text — example image](https://via.placeholder.com/150)
\`\`\`

---

## 6. Code

Inline code:

Rendered:
Use \`git status\` to check the repo.

Raw:
\`\`\`
Use \`git status\` to check the repo.
\`\`\`

Code blocks:

Rendered (language hint allows syntax highlighting):

\`\`\`python
def hello():
    print("Hello, Markdown!")
\`\`\`

Raw:
    \`\`\`python
    def hello():
        print("Hello, Markdown!")
    \`\`\`

(Indenting by four spaces also creates a code block in some Markdown flavours.)

---

## 7. Blockquotes

Rendered:
> This is a blockquote.
> 
> It can contain multiple paragraphs.

Raw:
\`\`\`
> This is a blockquote.
>
> It can contain multiple paragraphs.
\`\`\`

Nested blockquotes:
\`\`\`
> Outer quote
> > Inner quote
\`\`\`

---

## 8. Horizontal rules

Rendered:

---

Raw:
\`\`\`
---
\`\`\`
You can also use \`***\` or \`___\`.

---

## 9. Tables (GitHub Flavoured Markdown)

Rendered:

| Name       | Role         | Location        |
|-----------|-------------|----------------|
| Alice      | Engineer     | Wolverhampton   |
| Bob        | Designer     | London          |

Raw:
\`\`\`
| Name       | Role         | Location        |
|-----------|-------------|----------------|
| Alice      | Engineer     | Wolverhampton   |
| Bob        | Designer     | London          |
\`\`\`

---

## 10. Escaping characters

If you need to show literal characters like \`*\`, \`_\`, \`#\`, or \`[\`, precede them with a backslash:

Rendered:
\\*Not italic\\* and \\#not a heading

Raw:
\`\`\`
\\*Not italic\\* and \\#not a heading
\`\`\`

---

That covers the fundamentals. With these building blocks you can write clean, readable documents that render beautifully on GitHub, in chat, and on the web.
</document>

That covers all the core Markdown syntax you'll need. A few things you could try next:

- Paste the document above into a \`.md\` file and preview it in VS Code.
- Generate a printable cheat-sheet PDF from this Markdown.
- Create a one-page quick-reference tailored to Wintech's documentation style.

Would you like one of those, Duncan?`,
      },
    ],
  },
]
