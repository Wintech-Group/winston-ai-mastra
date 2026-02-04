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
    └── Embedded in SharePoint via SPFx web part
```

See [Architecture docs](docs/docs_handler/infra/policy_system_architecture.md) for full details.

---

## Development

### Requirements

- Node.js >= 22.13.0
- [Bun](https://bun.sh) (recommended)
- Supabase CLI (for local DB and type generation)

### Scripts

```bash
bun run dev              # Start Mastra dev server
bun run build            # Build for production
bun run start            # Run production build
bun run typecheck        # Type-check without emit
bun run supabase:gen-types  # Regenerate DB types after schema changes
```

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

docs/docs_handler/
├── infra/               # Architecture, implementation plan, ADRs
├── policy.schema.json   # JSON Schema for policy frontmatter
└── policy-template.md   # Template for new policies

supabase/                # Local Supabase config
```

---

## Documentation

| Document                                                                            | Purpose                              |
| ----------------------------------------------------------------------------------- | ------------------------------------ |
| [Architecture](docs/docs_handler/infra/policy_system_architecture.md)               | System design, components, data flow |
| [Implementation Plan](docs/docs_handler/infra/policy_system_implementation_plan.md) | Phased delivery roadmap              |
| [Mastra Spec](docs/docs_handler/infra/policy_system_mastra_spec.md)                 | Tool definitions and agent skills    |
| [ADRs](docs/docs_handler/infra/policy_system_adrs.md)                               | Architectural decision records       |

---

## Auth & Permissions

- **Azure AD** is the identity provider; staff access SharePoint and the agent via SSO
- **Docs Bot** (GitHub App) performs all Git operations on behalf of users
- **SharePoint groups** control who can suggest vs. approve changes

Staff do not need GitHub accounts—all GitHub interactions are proxied through the Docs Bot with user attribution in commit metadata.
