# Documentation Index

> **Winston AI** — Central AI assistant for Wintech employees, powered by Mastra.
> The first capability being built is **policy governance**: GitHub as source of truth → synced to SharePoint → searchable via AI agent.

---

## Top-Level Documents

| Document                           | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| [architecture.md](architecture.md) | System design, components, data flows, security model |
| [roadmap.md](roadmap.md)           | Phased global task list with links to detail docs     |
| [adrs.md](adrs.md)                 | Architecture Decision Records (ADR-001 – ADR-013)     |

## Specifications

| Document                                                     | Purpose                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| [specs/policy-requirements.md](specs/policy-requirements.md) | Policy model definition + system functional requirements |
| [specs/policy-template.md](specs/policy-template.md)         | Blank template for new policy files                      |
| [specs/policy.schema.json](specs/policy.schema.json)         | JSON Schema for policy frontmatter validation            |

## Stack Component Details

Each document covers one part of the system with implementation-level detail.

| Document                                                 | Component                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| [stack/github-app.md](stack/github-app.md)               | Docs Bot (GitHub App) — setup, auth, deployment, troubleshooting |
| [stack/mastra-agent.md](stack/mastra-agent.md)           | Governance Assistant agent, tools, skills                        |
| [stack/database.md](stack/database.md)                   | Postgres + pgvector — schemas, hybrid search, config tables      |
| [stack/sharepoint.md](stack/sharepoint.md)               | SharePoint integration — native pages, PDF gen, Graph API        |
| [stack/browser-extension.md](stack/browser-extension.md) | Browser extension — chat UI for policy interaction               |
| [stack/webhook-service.md](stack/webhook-service.md)     | Central Hono service — webhook handling, event pipelines         |

## Reference

| File                                                                         | Description                                        |
| ---------------------------------------------------------------------------- | -------------------------------------------------- |
| [reference/github-auth-example.ts](reference/github-auth-example.ts)         | GitHub App authentication code example             |
| [reference/sample-webhook-payload.txt](reference/sample-webhook-payload.txt) | Captured webhook payload for development reference |
