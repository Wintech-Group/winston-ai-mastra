# SharePoint Integration

> Native pages, PDF archive, acknowledgement tracking, and Graph API operations.

| Attribute        | Value                     |
| ---------------- | ------------------------- |
| Document Version | 1.0.0                     |
| Last Updated     | 2026-02-13                |
| Site             | policies.company.com      |
| API              | Microsoft Graph API       |
| Auth             | Azure AD app registration |

---

## Overview

SharePoint is the single location for viewing policies and interacting with the system. Users never leave SharePoint to view, suggest, edit, or approve policies.

All content is synced from GitHub (source of truth) on merge via the central webhook service.

---

## Site Structure

```
policies.company.com/
├── Home                                  # Landing page with policy index + chat
├── SitePages/
│   ├── IT-001-information-security.aspx  # Native SP page (latest version)
│   ├── IT-002-acceptable-use.aspx
│   ├── HR-001-travel.aspx
│   └── ...
├── Archive/                              # Document library for archived PDFs
│   ├── IT-001-information-security-v2.0.0.pdf
│   ├── IT-001-information-security-v1.0.0.pdf
│   └── ...
├── Current/                              # Document library for current PDFs
│   ├── IT-001-information-security.pdf   # Latest version PDF
│   └── ...
└── Lists/
    └── Acknowledgements/                 # Tracks user acknowledgements
```

---

## Native SharePoint Pages

Each policy is published as a native SharePoint page, created/updated via Graph API on merge.

### Why Native Pages

| Aspect            | Static HTML Files        | Native SharePoint Pages       |
| ----------------- | ------------------------ | ----------------------------- |
| Search indexing   | Limited                  | Full                          |
| UX                | Opens in document viewer | Native page experience        |
| Metadata          | File properties only     | SharePoint columns, filtering |
| Mobile responsive | Manual                   | Automatic                     |
| Accessibility     | Manual                   | Built-in                      |

### Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ IT-001: Information Security Policy                             │
│                                                                 │
│ Version 2.1.0 | Effective: 2025-06-01 | Review: 2026-06-01     │
│ Owners: Jane Smith, Security Team                               │
│ Domain: IT | Status: Active                                     │
│                                                                 │
│ [Suggest Change]                      [Download PDF]            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ## 1. Purpose                                                   │
│ ...policy prose content from markdown...                        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Version History                                                 │
│ • v2.1.0 (Current) - 2025-06-01                                │
│ • v2.0.0 - 2024-06-01 [PDF]                                    │
│ • v1.0.0 - 2023-01-15 [PDF]                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Page Metadata (SharePoint Columns)

| Column        | Type   | Purpose                                           |
| ------------- | ------ | ------------------------------------------------- |
| PolicyID      | Text   | Unique identifier (IT-001)                        |
| Title         | Text   | Policy title                                      |
| Version       | Text   | Current version number                            |
| Status        | Choice | Active, Draft, Under Review, Superseded, Archived |
| EffectiveDate | Date   | When current version took effect                  |
| ReviewDate    | Date   | Next scheduled review                             |
| Domain        | Choice | Primary domain (IT, HR, Finance, etc.)            |
| Owners        | Person | Policy owners                                     |

These columns enable filtering and sorting in SharePoint views.

---

## Versioning Strategy

**Current version:** Native SharePoint page (always shows latest)

- URL: `/SitePages/IT-001-information-security.aspx`
- Fully searchable; updated in-place on each merge

**Archived versions:** PDF only

- URL: `/Archive/IT-001-information-security-v2.0.0.pdf`
- Sufficient for audit/compliance
- Not indexed in search
- Linked from "Version History" section on current page

**Rationale:** Archived versions are rarely accessed. PDF is sufficient for audit. Avoids search pollution from old versions. Can add versioned pages later if needed.

---

## Sync Process (On Merge)

Triggered by the [webhook service](webhook-service.md) push handler:

```
Changed policy file
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Extract metadata  Convert MD to     Generate PDF
                  SP page JSON
    │                  │                  │
    └──────────┬───────┘                  │
               ▼                          ▼
        Graph API:                  Archive prev
        Create/Update               Upload new
        SP Page
               │
        ┌──────┴──────┐
        ▼             ▼
  Set page       Add chat widget
  metadata       (if new page)
  columns
```

### Graph API Operations

| Operation         | Endpoint                                 | Purpose                     |
| ----------------- | ---------------------------------------- | --------------------------- |
| Check page exists | `GET /sites/{site-id}/pages`             | Determine create vs update  |
| Create page       | `POST /sites/{site-id}/pages`            | New policy                  |
| Update page       | `PATCH /sites/{site-id}/pages/{page-id}` | Policy update               |
| Set metadata      | Page properties in create/update         | Populate SharePoint columns |
| Upload PDF        | `PUT /drives/{drive-id}/items/...`       | Current + archive PDFs      |

### PDF Generation

- Render markdown body with metadata header
- Apply company branding template
- Suitable for external auditor submission
- Bulk generation supported

---

## Acknowledgement Tracking

Configurable per policy (via `acknowledgement_required` in frontmatter).

| Field          | Type     | Description      |
| -------------- | -------- | ---------------- |
| PolicyID       | Text     | Which policy     |
| UserEmail      | Text     | Who acknowledged |
| Version        | Text     | Which version    |
| AcknowledgedAt | DateTime | When             |

- Material updates trigger re-acknowledgement
- Reporting on acknowledgement status
- Integration with People First for targeting (which staff need to acknowledge)

---

## Native SharePoint Features Used

| Function                 | Implementation                                |
| ------------------------ | --------------------------------------------- |
| Policy viewing           | Native SharePoint pages                       |
| PDF download             | PDF files in document library                 |
| Search                   | SharePoint search (full page content indexed) |
| Browse/filter            | Page library with metadata columns            |
| Permissions              | Azure AD integration, SharePoint groups       |
| Acknowledgement tracking | SharePoint List                               |

---

## "Suggest Change" Button

A simple button on each policy page that:

1. Opens the chat agent (browser extension, if available)
2. Pre-populates context: "I want to suggest a change to [Policy Name]"
3. Agent guides staff through capturing the suggestion

Can be implemented as a native SharePoint button with JavaScript to trigger the browser extension.
