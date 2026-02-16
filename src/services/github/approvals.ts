/**
 * Approval table helpers for PR bodies
 */

export interface ApprovalRow {
  domain: string
  requiredApprover: string
  status: string
  approvedBy: string
  date: string
}

export interface ApprovalTable {
  rows: ApprovalRow[]
  markdown: string
}

export interface ApprovalUpdate {
  domain: string
  requiredApprover?: string
  status?: string
  approvedBy?: string
  date?: string
}

const APPROVAL_TITLE = "## Approval Status"
const APPROVAL_HEADER =
  "| Domain | Required Approver | Status | Approved By | Date |"
const APPROVAL_DIVIDER =
  "| ------ | ----------------- | ------ | ----------- | ---- |"
const APPROVAL_FOOTER = "_Managed by Docs Bot. Do not edit manually._"

function buildApprovalTableMarkdown(rows: ApprovalRow[]): string {
  const rowLines = rows.map(
    (row) =>
      `| ${row.domain} | ${row.requiredApprover} | ${row.status} | ${row.approvedBy} | ${row.date} |`,
  )

  return [
    APPROVAL_TITLE,
    "",
    APPROVAL_HEADER,
    APPROVAL_DIVIDER,
    ...rowLines,
    "",
    "---",
    "",
    APPROVAL_FOOTER,
  ].join("\n")
}

function extractApprovalSection(body: string): string | null {
  const escapedTitle = APPROVAL_TITLE.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  const escapedFooter = APPROVAL_FOOTER.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  const pattern = new RegExp(`${escapedTitle}[\\s\\S]*?${escapedFooter}`)
  const match = body.match(pattern)
  return match ? match[0] : null
}

function parseApprovalRows(section: string): ApprovalRow[] {
  const lines = section.split("\n").map((line) => line.trim())
  const headerIndex = lines.findIndex((line) => line === APPROVAL_HEADER)
  if (headerIndex === -1) return []

  const rows: ApprovalRow[] = []
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) break
    if (!line.startsWith("|")) break
    if (line.includes("---")) break

    const cells = line.split("|").map((cell) => cell.trim())
    if (cells.length < 7) continue

    const [, domain, requiredApprover, status, approvedBy, date] = cells
    if (!domain || !requiredApprover || !status || !approvedBy || !date) {
      continue
    }
    rows.push({
      domain,
      requiredApprover,
      status,
      approvedBy,
      date,
    })
  }

  return rows
}

function applyApprovalUpdates(
  rows: ApprovalRow[],
  updates: ApprovalUpdate[],
  allowAppend: boolean,
): ApprovalRow[] {
  const updated = rows.map((row) => ({ ...row }))
  const rowIndexByDomain = new Map(
    updated.map((row, index) => [row.domain.toLowerCase(), index]),
  )

  for (const update of updates) {
    const key = update.domain.toLowerCase()
    const index = rowIndexByDomain.get(key)

    if (index === undefined) {
      if (!allowAppend) {
        continue
      }
      updated.push({
        domain: update.domain,
        requiredApprover: update.requiredApprover ?? "-",
        status: update.status ?? "Pending",
        approvedBy: update.approvedBy ?? "-",
        date: update.date ?? "-",
      })
      rowIndexByDomain.set(key, updated.length - 1)
      continue
    }

    const current = updated[index]
    if (!current) {
      continue
    }
    updated[index] = {
      domain: update.domain,
      requiredApprover: update.requiredApprover ?? current.requiredApprover,
      status: update.status ?? current.status,
      approvedBy: update.approvedBy ?? current.approvedBy,
      date: update.date ?? current.date,
    }
  }

  return updated
}

export function createApprovalTable(rows: ApprovalRow[]): string {
  return buildApprovalTableMarkdown(rows)
}

export function getApprovalTable(body: string): ApprovalTable | null {
  const section = extractApprovalSection(body)
  if (!section) return null

  return {
    rows: parseApprovalRows(section),
    markdown: section,
  }
}

interface UpdateApprovalTableOptions {
  createIfMissing?: boolean
  defaultRows?: ApprovalRow[]
  allowAppend?: boolean
}

export function updateApprovalTable(
  body: string,
  updates: ApprovalUpdate[],
  options: UpdateApprovalTableOptions = {},
): { body: string; rows: ApprovalRow[] } {
  const existing = getApprovalTable(body)
  const allowAppend = options.allowAppend ?? false

  if (!existing) {
    if (!options.createIfMissing) {
      throw new Error("Approval table not found in PR body.")
    }

    const baseRows = options.defaultRows ?? []
    const mergedRows = applyApprovalUpdates(baseRows, updates, true)
    const newTable = buildApprovalTableMarkdown(mergedRows)
    const delimiter = body.trim().length > 0 ? "\n\n" : ""

    return {
      body: `${body.trim()}${delimiter}${newTable}`,
      rows: mergedRows,
    }
  }

  const mergedRows = applyApprovalUpdates(existing.rows, updates, allowAppend)
  const newTable = buildApprovalTableMarkdown(mergedRows)

  return {
    body: body.replace(existing.markdown, newTable),
    rows: mergedRows,
  }
}
