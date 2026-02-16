# Winston AI

Central AI assistant for Wintech employees, powered by [Mastra](https://mastra.ai).

> **Status:** In active development. The first capability—controlled document management for policies—is currently being built.

---

## What This Repository Contains

This repo hosts two integrated systems:

| Component                       | Description                                                                                         | Status   |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| **Winston Agent**               | General-purpose Mastra AI agent with tools for policy search, suggestions, and approvals            | In build |
| **Document Governance Service** | Hono API receiving GitHub webhooks to sync content → SharePoint, generate PDFs, update search index | In build |

### Planned Capabilities

| Capability               | Description                                         | Status   |
| ------------------------ | --------------------------------------------------- | -------- |
| Policy Management        | Query, suggest, edit, and approve policies via chat | In build |
| Engineering Document RAG | Search engineering docs                             | Planned  |
| Project Document RAG     | Search project docs                                 | Planned  |

---

## Architecture

GitHub serves as the source of truth for policy content (frontmatter markdown). The central service handles automation:

```
GitHub (content repos)
    │
    │ webhooks
    ▼
Central Service (this repo)
    ├── Validate schema
    ├── Sync to SharePoint (native pages)
    ├── Generate & archive PDFs
    └── Update Postgres search index

Winston Agent (this repo)
    ├── Query policies (hybrid search)
    ├── Submit suggestions (creates GitHub Issues)
    ├── Create/approve changes (branches, PRs)
    └── Accessible via browser extension (chat UI)
```

See [Architecture](docs/architecture.md) for full details.

---

## Development

### Requirements

- Node.js >= 22.13.0
- [Bun](https://bun.sh) (recommended)
- Supabase CLI (for local DB and type generation)

### Scripts

```bash
bun run dev                     # Start Mastra dev server
bun run build                   # Build for production
bun run start                   # Run production build
bun run typecheck               # Type-check without emit
bun run supabase:gen-types      # Regenerate DB types after schema changes
bun run github-app:create       # Helper to create GitHub App from manifest
```

### Local Development Setup

For local testing with the Docs Bot (GitHub App), you'll need to use ngrok to expose your local server. See [LOCAL_DEV.md](LOCAL_DEV.md) for a complete step-by-step guide.

### Project Structure

```
src/
├── mastra/              # Mastra agent, tools, workflows
│   ├── agents/
│   ├── tools/
│   ├── workflows/
│   └── index.ts
├── types/               # Generated types (database.types.ts)
└── (planned)
    ├── api/             # Hono routes (webhooks, health)
    └── services/        # SharePoint sync, PDF, indexing

docs/
├── architecture.md      # System architecture
├── roadmap.md           # Phased implementation plan
├── adrs.md              # Architecture decision records
├── specs/               # Policy model, schema, template
├── stack/               # Per-component detail docs
└── reference/           # Example code, sample payloads

supabase/                # Local Supabase config
```

---

## Documentation

| Document                                                 | Purpose                              |
| -------------------------------------------------------- | ------------------------------------ |
| [Architecture](docs/architecture.md)                     | System design, components, data flow |
| [Roadmap](docs/roadmap.md)                               | Phased implementation plan           |
| [ADRs](docs/adrs.md)                                     | Architecture decision records        |
| [Policy Requirements](docs/specs/policy-requirements.md) | Policy model and system requirements |
| [Mastra Agent & Tools](docs/stack/mastra-agent.md)       | Agent definition and tool specs      |
| [All Docs](docs/README.md)                               | Documentation index                  |

---

## Auth & Permissions

- **Azure AD** is the identity provider; staff access SharePoint and the agent via SSO
- **Docs Bot** (GitHub App) performs all Git operations on behalf of users
- **SharePoint groups** control who can suggest vs. approve changes

Staff do not need GitHub accounts—all GitHub interactions are proxied through the Docs Bot with user attribution in commit metadata.
