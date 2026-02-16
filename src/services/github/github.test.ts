import { beforeEach, describe, expect, mock, test } from "bun:test"
import {
  createApprovalTable,
  getApprovalTable,
  updateApprovalTable,
  type ApprovalRow,
} from "./approvals"

// ---------------------------------------------------------------------------
// Mock Octokit
// ---------------------------------------------------------------------------

const mockOctokit = {
  repos: {
    getContent: mock(),
  },
  git: {
    getRef: mock(),
    createRef: mock(),
  },
  pulls: {
    create: mock(),
    list: mock(),
    merge: mock(),
  },
}

mock.module("./client", () => ({
  getGitHubClient: async () => mockOctokit,
  resetGitHubClient: () => {},
}))

// Import AFTER the mock is registered so modules resolve the mock
const { fetchFileContent, fetchBinaryContent } = await import("./files")
const { createBranch } = await import("./branches")
const { createPullRequest, readPullRequests, mergePullRequest } =
  await import("./pull-requests")

beforeEach(() => {
  mockOctokit.repos.getContent.mockReset()
  mockOctokit.git.getRef.mockReset()
  mockOctokit.git.createRef.mockReset()
  mockOctokit.pulls.create.mockReset()
  mockOctokit.pulls.list.mockReset()
  mockOctokit.pulls.merge.mockReset()
})

// ---------------------------------------------------------------------------
// Approval table tests (pure functions, no mock needed)
// ---------------------------------------------------------------------------

describe("approval tables", () => {
  const baseRows: ApprovalRow[] = [
    {
      domain: "IT",
      requiredApprover: "it.security@company.com",
      status: "Pending",
      approvedBy: "-",
      date: "-",
    },
    {
      domain: "HR",
      requiredApprover: "hr.team@company.com",
      status: "Pending",
      approvedBy: "-",
      date: "-",
    },
  ]

  test("createApprovalTable renders markdown with rows", () => {
    const table = createApprovalTable(baseRows)

    expect(table).toContain("## Approval Status")
    expect(table).toContain("| IT | it.security@company.com | Pending")
    expect(table).toContain("| HR | hr.team@company.com | Pending")
    expect(table).toContain("_Managed by Docs Bot. Do not edit manually._")
  })

  test("createApprovalTable with empty rows renders header only", () => {
    const table = createApprovalTable([])
    expect(table).toContain("## Approval Status")
    expect(table).toContain("| Domain |")
    expect(table).not.toContain("| IT |")
  })

  test("getApprovalTable parses rows from body", () => {
    const body = `Intro text\n\n${createApprovalTable(baseRows)}`
    const parsed = getApprovalTable(body)

    expect(parsed).not.toBeNull()
    expect(parsed!.rows.length).toBe(2)
    expect(parsed!.rows[0]).toEqual(baseRows[0])
    expect(parsed!.rows[1]).toEqual(baseRows[1])
  })

  test("getApprovalTable returns null when no table", () => {
    expect(getApprovalTable("Just some text")).toBeNull()
  })

  test("updateApprovalTable updates existing row", () => {
    const body = `Intro text\n\n${createApprovalTable(baseRows)}`
    const result = updateApprovalTable(body, [
      {
        domain: "IT",
        status: "Approved",
        approvedBy: "alex@company.com",
        date: "2026-02-13",
      },
    ])

    const parsed = getApprovalTable(result.body)
    expect(parsed!.rows[0]!.status).toBe("Approved")
    expect(parsed!.rows[0]!.approvedBy).toBe("alex@company.com")
    expect(parsed!.rows[0]!.date).toBe("2026-02-13")
    // HR row unchanged
    expect(parsed!.rows[1]!.status).toBe("Pending")
  })

  test("updateApprovalTable preserves surrounding content", () => {
    const body = `# PR Description\n\nSome details\n\n${createApprovalTable(baseRows)}`
    const result = updateApprovalTable(body, [
      {
        domain: "HR",
        status: "Approved",
        approvedBy: "hr@co.com",
        date: "2026-02-13",
      },
    ])

    expect(result.body).toContain("# PR Description")
    expect(result.body).toContain("Some details")
  })

  test("updateApprovalTable throws when table missing and createIfMissing is false", () => {
    expect(() =>
      updateApprovalTable("No table here", [
        { domain: "IT", status: "Approved" },
      ]),
    ).toThrow("Approval table not found")
  })

  test("updateApprovalTable can create when missing", () => {
    const body = "Intro only"
    const result = updateApprovalTable(
      body,
      [{ domain: "IT", status: "Pending" }],
      { createIfMissing: true, defaultRows: baseRows },
    )

    expect(result.body).toContain("## Approval Status")
    expect(result.rows.length).toBe(2)
  })

  test("updateApprovalTable does not append by default", () => {
    const body = `Intro text\n\n${createApprovalTable(baseRows)}`
    const result = updateApprovalTable(body, [
      { domain: "Legal", status: "Pending" },
    ])

    const parsed = getApprovalTable(result.body)
    expect(parsed!.rows.length).toBe(2)
  })

  test("updateApprovalTable appends when allowAppend is true", () => {
    const body = `Intro text\n\n${createApprovalTable(baseRows)}`
    const result = updateApprovalTable(
      body,
      [
        {
          domain: "Legal",
          requiredApprover: "legal@co.com",
          status: "Pending",
        },
      ],
      { allowAppend: true },
    )

    expect(result.rows.length).toBe(3)
    expect(result.rows[2]!.domain).toBe("Legal")
  })

  test("updateApprovalTable domain matching is case-insensitive", () => {
    const body = `PR\n\n${createApprovalTable(baseRows)}`
    const result = updateApprovalTable(body, [
      {
        domain: "it",
        status: "Approved",
        approvedBy: "a@co.com",
        date: "2026-02-13",
      },
    ])

    const parsed = getApprovalTable(result.body)
    expect(parsed!.rows[0]!.status).toBe("Approved")
  })
})

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

describe("fetchFileContent", () => {
  test("returns decoded content and sha", async () => {
    const content = Buffer.from("hello world").toString("base64")
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: { type: "file", content, sha: "abc123" },
    })

    const result = await fetchFileContent("owner", "repo", "readme.md")

    expect(result).toEqual({ content: "hello world", sha: "abc123" })
    expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "readme.md",
      ref: undefined,
    })
  })

  test("passes ref when provided", async () => {
    const content = Buffer.from("data").toString("base64")
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: { type: "file", content, sha: "def456" },
    })

    await fetchFileContent("owner", "repo", "file.md", "feature-branch")

    expect(mockOctokit.repos.getContent).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "feature-branch" }),
    )
  })

  test("returns null for 404", async () => {
    const error = Object.assign(new Error("Not Found"), { status: 404 })
    mockOctokit.repos.getContent.mockRejectedValueOnce(error)

    const result = await fetchFileContent("owner", "repo", "missing.md")
    expect(result).toBeNull()
  })

  test("returns null for directory response", async () => {
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: [{ type: "dir", name: "subdir" }],
    })

    const result = await fetchFileContent("owner", "repo", "somedir")
    expect(result).toBeNull()
  })

  test("rethrows non-404 errors", async () => {
    const error = Object.assign(new Error("Server Error"), { status: 500 })
    mockOctokit.repos.getContent.mockRejectedValueOnce(error)

    expect(fetchFileContent("owner", "repo", "file.md")).rejects.toThrow(
      "Server Error",
    )
  })
})

describe("fetchBinaryContent", () => {
  test("returns Buffer and sha", async () => {
    const raw = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const content = raw.toString("base64")
    mockOctokit.repos.getContent.mockResolvedValueOnce({
      data: { type: "file", content, sha: "bin123" },
    })

    const result = await fetchBinaryContent("owner", "repo", "image.png")

    expect(result).not.toBeNull()
    expect(Buffer.isBuffer(result!.content)).toBe(true)
    expect(result!.content).toEqual(raw)
    expect(result!.sha).toBe("bin123")
  })

  test("returns null for 404", async () => {
    const error = Object.assign(new Error("Not Found"), { status: 404 })
    mockOctokit.repos.getContent.mockRejectedValueOnce(error)

    expect(await fetchBinaryContent("owner", "repo", "missing.png")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Branch helpers
// ---------------------------------------------------------------------------

describe("createBranch", () => {
  test("creates branch from main by default", async () => {
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: { object: { sha: "base-sha-123" } },
    })
    mockOctokit.git.createRef.mockResolvedValueOnce({
      data: { ref: "refs/heads/my-branch", object: { sha: "base-sha-123" } },
    })

    const result = await createBranch({
      owner: "owner",
      repo: "repo",
      branch: "my-branch",
    })

    expect(mockOctokit.git.getRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      ref: "heads/main",
    })
    expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      ref: "refs/heads/my-branch",
      sha: "base-sha-123",
    })
    expect(result).toEqual({ ref: "refs/heads/my-branch", sha: "base-sha-123" })
  })

  test("creates branch from custom base ref", async () => {
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: { object: { sha: "dev-sha" } },
    })
    mockOctokit.git.createRef.mockResolvedValueOnce({
      data: { ref: "refs/heads/feature", object: { sha: "dev-sha" } },
    })

    await createBranch({
      owner: "owner",
      repo: "repo",
      branch: "feature",
      baseRef: "develop",
    })

    expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/develop" }),
    )
  })

  test("handles refs/ prefix in baseRef", async () => {
    mockOctokit.git.getRef.mockResolvedValueOnce({
      data: { object: { sha: "sha1" } },
    })
    mockOctokit.git.createRef.mockResolvedValueOnce({
      data: { ref: "refs/heads/fix", object: { sha: "sha1" } },
    })

    await createBranch({
      owner: "o",
      repo: "r",
      branch: "fix",
      baseRef: "refs/heads/release",
    })

    expect(mockOctokit.git.getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/release" }),
    )
  })
})

// ---------------------------------------------------------------------------
// Pull request helpers
// ---------------------------------------------------------------------------

describe("createPullRequest", () => {
  test("creates PR with required fields", async () => {
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: { number: 42, html_url: "https://github.com/o/r/pull/42" },
    })

    const result = await createPullRequest({
      owner: "owner",
      repo: "repo",
      title: "Test PR",
      head: "feature",
      base: "main",
    })

    expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      title: "Test PR",
      head: "feature",
      base: "main",
      body: undefined,
      draft: undefined,
      maintainer_can_modify: undefined,
    })
    expect(result.number).toBe(42)
  })

  test("passes optional fields", async () => {
    mockOctokit.pulls.create.mockResolvedValueOnce({
      data: { number: 43 },
    })

    await createPullRequest({
      owner: "owner",
      repo: "repo",
      title: "Draft PR",
      head: "feat",
      base: "main",
      body: "Description",
      draft: true,
      maintainerCanModify: false,
    })

    expect(mockOctokit.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Description",
        draft: true,
        maintainer_can_modify: false,
      }),
    )
  })
})

describe("readPullRequests", () => {
  test("lists open PRs by default", async () => {
    mockOctokit.pulls.list.mockResolvedValueOnce({
      data: [{ number: 1 }, { number: 2 }],
    })

    const result = await readPullRequests({ owner: "o", repo: "r" })

    expect(mockOctokit.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({ state: "open" }),
    )
    expect(result.length).toBe(2)
  })

  test("passes filters and pagination", async () => {
    mockOctokit.pulls.list.mockResolvedValueOnce({ data: [] })

    await readPullRequests({
      owner: "o",
      repo: "r",
      state: "closed",
      base: "main",
      sort: "updated",
      direction: "desc",
      perPage: 10,
      page: 2,
    })

    expect(mockOctokit.pulls.list).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      state: "closed",
      head: undefined,
      base: "main",
      sort: "updated",
      direction: "desc",
      per_page: 10,
      page: 2,
    })
  })
})

describe("mergePullRequest", () => {
  test("merges PR with default method", async () => {
    mockOctokit.pulls.merge.mockResolvedValueOnce({
      data: { merged: true, sha: "merge-sha" },
    })

    const result = await mergePullRequest({
      owner: "o",
      repo: "r",
      pullNumber: 42,
    })

    expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      pull_number: 42,
      merge_method: undefined,
      commit_title: undefined,
      commit_message: undefined,
    })
    expect(result.merged).toBe(true)
  })

  test("merges with squash and custom commit", async () => {
    mockOctokit.pulls.merge.mockResolvedValueOnce({
      data: { merged: true, sha: "squash-sha" },
    })

    await mergePullRequest({
      owner: "o",
      repo: "r",
      pullNumber: 10,
      mergeMethod: "squash",
      commitTitle: "feat: thing",
      commitMessage: "Squashed",
    })

    expect(mockOctokit.pulls.merge).toHaveBeenCalledWith(
      expect.objectContaining({
        merge_method: "squash",
        commit_title: "feat: thing",
        commit_message: "Squashed",
      }),
    )
  })
})
