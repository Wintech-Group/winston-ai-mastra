# Browser Extension (Chat UI)

> Manifest V3 browser extension replacing the previously planned SPFx web part.

| Attribute        | Value                                  |
| ---------------- | -------------------------------------- |
| Document Version | 1.0.0                                  |
| Last Updated     | 2026-02-13                             |
| Status           | Early stage — design decisions pending |
| Replaces         | SPFx Web Part (see ADR-013)            |

---

## Overview

The browser extension provides a lightweight chat interface for interacting with the Governance Assistant. It replaces the originally planned SPFx web part (see [ADR-013](../adrs.md#adr-013-browser-extension-over-spfx-web-part)).

The extension is available across all browser tabs — not just SharePoint — making the assistant accessible from any context where a staff member has a policy question.

---

## Why Browser Extension Over SPFx

| Factor               | SPFx Web Part               | Browser Extension           |
| -------------------- | --------------------------- | --------------------------- |
| Scope                | SharePoint only             | Any browser tab             |
| Deployment           | SharePoint App Catalog      | Enterprise policy / store   |
| Development          | SPFx framework, React       | Standard web technologies   |
| Auth                 | SharePoint context          | Azure AD (MSAL.js)          |
| Maintenance          | Tied to SharePoint releases | Independent lifecycle       |
| Context awareness    | SharePoint page metadata    | URL-based detection         |
| Offline / standalone | No                          | Side panel always available |

---

## Planned Features

### Chat Interface

- Text input with message history
- Streams responses from the Governance Assistant
- Citation links to specific rule IDs and SharePoint pages

### Canvas / Artifact Area

- Diff viewer for reviewing proposed changes
- Policy preview for edits before submission
- Approval cards for batch review

### Context Awareness

- Detects when user is on a SharePoint policy page
- Pre-populates policy context for questions
- "Suggest Change" button integration on policy pages

### Authentication

- Azure AD via MSAL.js browser library
- SSO with existing Microsoft session
- Passes user identity to Mastra agent for permission checks

---

## Architecture

```
┌───────────────────────────────┐
│     Browser Extension          │
│     (Manifest V3)              │
│                                │
│  ┌──────────────────────────┐ │
│  │ Side Panel / Popup       │ │
│  │                          │ │
│  │ • Chat messages          │ │
│  │ • Canvas area            │ │
│  │ • Auth status            │ │
│  └────────────┬─────────────┘ │
│               │                │
│  ┌────────────▼─────────────┐ │
│  │ Background Service Worker│ │
│  │                          │ │
│  │ • MSAL.js auth           │ │
│  │ • API communication      │ │
│  │ • Context detection      │ │
│  └────────────┬─────────────┘ │
└───────────────┼────────────────┘
                │
                ▼
        ┌──────────────┐
        │ Mastra Agent │
        │ (API)        │
        └──────────────┘
```

---

## Distribution

**Decision pending.** Options under consideration:

1. **Enterprise policy deployment** — Push to managed browsers via Intune/GPO
2. **Private web store listing** — Chrome Web Store / Edge Add-ons (unlisted)
3. **Self-hosted** — Host `.crx` / sideload for internal use

Enterprise policy deployment is likely the best fit since all staff use managed devices.

---

## Open Questions

| Question               | Notes                                             |
| ---------------------- | ------------------------------------------------- |
| Distribution method    | Enterprise policy vs store listing vs self-hosted |
| Side panel vs popup    | Side panel preferred for richer UI                |
| SharePoint integration | How to wire "Suggest Change" button to extension  |
| Offline behaviour      | Queue messages or require connectivity?           |
| Update mechanism       | Auto-update via store or enterprise policy push   |
