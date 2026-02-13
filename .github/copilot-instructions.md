# Winston AI — Project Guidelines

This repository hosts **two integrated systems** currently in build:

1. **Winston AI Agent** — A general-purpose Mastra agent for all Wintech employees ([src/mastra/](src/mastra/))
2. **Document Governance Service** — A Hono API handling webhooks and automation for controlled document management

The first capability being built is **policy governance**: GitHub as source of truth → synced to SharePoint → searchable via AI agent.

---

## Quick Reference

| Command                      | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `bun run dev`                | Start Mastra dev server                  |
| `bun run build`              | Build for production                     |
| `bun run start`              | Run production build                     |
| `bun run typecheck`          | Type-check without emit                  |
| `bun run supabase:gen-types` | Regenerate DB types after schema changes |

---

## Code Style

- **Strict TypeScript** with ESM modules; follow [tsconfig.json](tsconfig.json)
- **Node >= 22.13.0**; imports/exports must be ESM-compatible
- Prefer `bun` for running scripts

## Project Structure

```
src/
├── mastra/           # Mastra agent configuration
│   ├── agents/       # Agent definitions
│   ├── tools/        # Mastra tools (GitHub ops, search, etc.)
│   ├── workflows/    # Multi-step workflows
│   └── index.ts      # Mastra instance export
├── types/            # Generated types (database.types.ts)
└── (planned)
    ├── api/          # Hono API routes (webhooks, health)
    └── services/     # SharePoint sync, PDF gen, indexing
```

## Architecture

- **GitHub** is the source of truth for policy content (frontmatter markdown)
- **Postgres + pgvector** for hybrid search (embeddings + keywords + metadata)
- **SharePoint** for publishing native pages
- **Browser extension** for the chat UI (Governance Assistant)
- **Azure AD** for identity; staff do not need GitHub accounts
- **Docs Bot** (GitHub App) performs all Git operations on behalf of users

See [architecture.md](docs/architecture.md) for full system design.

## Key Patterns

- **Frontmatter markdown**: one file per policy with YAML metadata + prose body; see [policy.schema.json](docs/specs/policy.schema.json)
- **Webhook-driven**: Central service receives GitHub webhooks and triggers sync/PDF/index pipelines
- **Mastra tools**: Agents call typed tools for all external operations (query, create branch, approve, etc.)
- **Attribution via metadata**: Bot commits include `Authored-by:` in commit messages for audit

## Integration Points

| System               | Purpose                     | Auth              |
| -------------------- | --------------------------- | ----------------- |
| GitHub API           | Content CRUD via Docs Bot   | GitHub App JWT    |
| SharePoint Graph API | Publish pages, manage PDFs  | Azure AD app      |
| Postgres (Supabase)  | Storage, embeddings, search | Connection string |

## Security

- Webhook signature verification required for all inbound GitHub events
- Role-based permissions checked before any write operation
- Sensitive keys stored in Azure Key Vault (production) or `.env` (local)

## Docs

- [Architecture overview](docs/architecture.md)
- [Roadmap & phases](docs/roadmap.md)
- [Mastra agent & tools](docs/stack/mastra-agent.md)
- [ADRs](docs/adrs.md)
- [All documentation](docs/README.md)
