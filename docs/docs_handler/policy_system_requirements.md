# Policy Management System Requirements

**Source of Truth for System Design**

| Attribute | Value |
|-----------|-------|
| Document Version | 0.1.0 |
| Status | Draft |
| Created | 2026-01-26 |
| Last Updated | 2026-01-26 |
| Related Documents | Policy Definition Specification v0.1.0 |
| Purpose | Define the functional and integration requirements for the policy management system |

---

## 1. Introduction

This document defines the requirements for a policy management system that serves both human staff and AI agents. The system must enable collaborative authoring, structured approval workflows, and machine-readable policy access while remaining accessible to non-technical users.

### 1.1 Design Principles

- **Dual-audience**: Every policy must be consumable by humans (readable, searchable) and machines (structured, queryable).
- **Non-technical first**: The primary interface must be usable by staff without technical knowledge.
- **Auditable**: All changes, approvals, and reviews must be tracked and reportable.
- **Configurable**: Workflows, approvals, and features should be configurable per policy, not hard-coded.

### 1.2 Available Systems

The following systems are available for use in the solution:

| System | Purpose |
|--------|---------|
| Microsoft 365 | Productivity suite, notifications, collaboration |
| SharePoint | Document hosting, viewing, permissions |
| GitHub | Version control, structured data storage, change tracking |
| Azure AD | Identity, authentication, role-based access |
| People First | HR system with job titles and org structure (API available) |
| Mastra | Agent framework for AI tooling |

---

## 2. Requirements

### R01: Viewability & Hosting

Policies must be accessible to all staff through a familiar interface.

| ID | Requirement | Priority |
|----|-------------|----------|
| R01.1 | Policies must be viewable via SharePoint without requiring specialist software or plugins | MUST |
| R01.2 | Policies must render correctly on desktop and mobile devices | MUST |
| R01.3 | Policies must be accessible to staff with appropriate permissions (role-based access via Azure AD) | MUST |
| R01.4 | The canonical/authoritative version must be clearly identifiable—no ambiguity about which copy is current | MUST |
| R01.5 | Previous versions must be accessible for reference but clearly marked as superseded | MUST |
| R01.6 | Offline viewing is not required; PDF export satisfies this need | N/A |

---

### R02: Traditional Document Output

The system must produce compliance-ready PDF documents on demand.

| ID | Requirement | Priority |
|----|-------------|----------|
| R02.1 | A PDF must be generatable on-demand from the source policy data | MUST |
| R02.2 | The PDF must include all required compliance metadata (version, effective date, approvals, ownership, etc.) | MUST |
| R02.3 | The PDF must be visually consistent with company branding/templates | SHOULD |
| R02.4 | PDF generation must be automated—no manual formatting or copy-paste | MUST |
| R02.5 | The PDF must be suitable for submission to external auditors and regulatory bodies | MUST |
| R02.6 | The system should support bulk PDF generation (e.g., "export all active policies") | SHOULD |
| R02.7 | Digital signatures are not required at this stage; may be added as future enhancement | N/A |

---

### R03: Non-Technical Authoring & Workflow

Staff must be able to participate in policy management without technical knowledge.

| ID | Requirement | Priority |
|----|-------------|----------|
| R03.1 | Any staff member must be able to suggest a policy change via a simple interface (form or guided workflow) | MUST |
| R03.2 | Staff must be able to see the current state of any change request they have submitted | MUST |
| R03.3 | Policy owners must be able to draft and edit changes in a familiar interface (not code, not raw data entry) | MUST |
| R03.4 | The system must support side-by-side or tracked-change comparison between current and proposed versions | MUST |
| R03.5 | Policy owners must be able to review, comment on, and approve/reject changes | MUST |
| R03.6 | The system must support delegation of approval authority (e.g., when an approver is on leave) | SHOULD |
| R03.7 | The system must notify relevant parties when action is required (change submitted, approval needed, etc.) | MUST |
| R03.8 | The system must prevent publication of changes without all required approvals | MUST |

#### Roles Summary

| Role | Can Suggest | Can Edit/Draft | Can Approve |
|------|-------------|----------------|-------------|
| Any staff member | Yes | No | No |
| Policy owner | Yes | Yes | Yes |

---

### R04: AI Agent Accessibility

AI agents must be able to read, query, and contribute to policies.

| ID | Requirement | Priority |
|----|-------------|----------|
| R04.1 | Policies must be available in a structured, machine-parseable format | MUST |
| R04.2 | Individual rules within a policy must be independently addressable and retrievable | MUST |
| R04.3 | AI agents must be able to query policies by subject, scope, keyword, or applicability | MUST |
| R04.4 | AI agents must be able to determine which version of a policy is currently active | MUST |
| R04.5 | AI agents must be able to trace rule authority (legal basis, rationale, source) | SHOULD |
| R04.6 | AI agents must be able to identify exceptions and their conditions | MUST |
| R04.7 | AI agents must be able to follow policy relationships (parent policies, related policies, overrides) | MUST |
| R04.8 | The system must provide an API or tool interface for AI agent access (not document parsing) | MUST |
| R04.9 | AI agents must be able to suggest changes to policies (subject to owner approval) | MUST |
| R04.10 | AI agent suggestions must follow the same approval workflow as human suggestions | MUST |

---

### R05: Review Reminders & Scheduling

The system must proactively manage policy review cycles.

| ID | Requirement | Priority |
|----|-------------|----------|
| R05.1 | The system must track the scheduled review date for each policy | MUST |
| R05.2 | The system must send reminders to policy owners in advance of review due dates (configurable lead time) | MUST |
| R05.3 | The system must escalate if a review is overdue (e.g., notify line manager, then senior leadership) | SHOULD |
| R05.4 | The system must support ad-hoc review triggers (regulatory change, incident, stakeholder request) | MUST |
| R05.5 | The system must track review completion (who reviewed, when, outcome) | MUST |
| R05.6 | The system must distinguish between "reviewed and confirmed unchanged" and "not yet reviewed" | MUST |
| R05.7 | Policies that pass their review date without action must enter a "Review Overdue" status | MUST |

#### Review Outcomes

| Outcome | Description |
|---------|-------------|
| Confirmed | Reviewed, no changes required |
| Minor Update | Reviewed, minor changes made and approved |
| Major Revision | Reviewed, significant changes requiring full approval workflow |
| Review Overdue | Review date passed without action |

---

### R06: Granular Approval Routing

Approvals must be routed to the appropriate domain owners based on what has changed.

| ID | Requirement | Priority |
|----|-------------|----------|
| R06.1 | Rules within a policy must be taggable by domain/ownership (IT, HR, Finance, Legal, etc.) | MUST |
| R06.2 | Changes to a rule must route for approval to the owner(s) of that rule's domain | MUST |
| R06.3 | Changes affecting multiple domains must require approval from all relevant domain owners | MUST |
| R06.4 | The system must prevent partial publication—updates only publish when all required approvals are obtained | MUST |
| R06.5 | Approval requirements must be configurable per policy or per rule | MUST |
| R06.6 | The system must log all approval decisions with timestamp and approver identity | MUST |
| R06.7 | Approval hierarchies (team lead vs department head) are not required | N/A |

#### Conflict Resolution

| ID | Requirement | Priority |
|----|-------------|----------|
| R06.8 | When approvers disagree (one approves, one rejects), the change must remain in editing/review state | MUST |
| R06.9 | Conflicting approvers must be able to discuss and collaborate on edits within the system | MUST |
| R06.10 | The change may only proceed when all required approvers have approved the same version | MUST |

---

### R07: Search & Discovery (Human)

Staff must be able to find relevant policies quickly.

| ID | Requirement | Priority |
|----|-------------|----------|
| R07.1 | Staff must be able to search policies by keyword, topic, or applicability | MUST |
| R07.2 | Search results must show which policy and which section/rule is relevant | SHOULD |
| R07.3 | Staff must be able to browse policies by category, department, or hierarchy | SHOULD |

---

### R08: Acknowledgement Tracking

The system must support tracking staff acknowledgement of policies where required.

| ID | Requirement | Priority |
|----|-------------|----------|
| R08.1 | Acknowledgement tracking must be configurable per policy (on or off) | MUST |
| R08.2 | When enabled, the system must track which staff have acknowledged the policy | MUST |
| R08.3 | When a policy with acknowledgement enabled is materially updated, re-acknowledgement must be triggered | MUST |
| R08.4 | The system must be able to report on acknowledgement status (who has/hasn't acknowledged) | MUST |
| R08.5 | The system should integrate with People First to determine which staff require acknowledgement (based on role, department, etc.) | SHOULD |

---

### R09: Conflict Detection

The system should help identify contradictions between rules.

| ID | Requirement | Priority |
|----|-------------|----------|
| R09.1 | The system should detect or flag potential contradictions between rules (within or across policies) | SHOULD |
| R09.2 | Conflict detection may be AI-assisted | SHOULD |
| R09.3 | Flagged conflicts must be surfaced to policy owners for resolution | SHOULD |

---

### R10: Audit & Compliance Reporting

The system must support audit and compliance activities.

| ID | Requirement | Priority |
|----|-------------|----------|
| R10.1 | The system must produce a full audit trail for any policy (complete change history) | MUST |
| R10.2 | The system must report on policy status across the organisation (active, draft, overdue, etc.) | MUST |
| R10.3 | The system must demonstrate compliance workflow to external auditors (approvals, reviews, acknowledgements) | MUST |
| R10.4 | Audit logs must be immutable (cannot be edited or deleted) | MUST |

---

### R11: Integration

The system must integrate with existing infrastructure.

| ID | Requirement | Priority |
|----|-------------|----------|
| R11.1 | Authentication and role mapping must integrate with Azure AD | MUST |
| R11.2 | Notifications and reminders must integrate with Microsoft 365 (email, Teams) | MUST |
| R11.3 | Org structure and job title data must be retrievable from People First API | MUST |
| R11.4 | AI agent tooling must be built using Mastra framework | MUST |
| R11.5 | Version control and structured data storage should use GitHub | SHOULD |
| R11.6 | Human-facing viewing and browsing must use SharePoint | MUST |

---

## 3. Glossary

| Term | Definition |
|------|------------|
| Policy | A defined set of rules for business governance |
| Rule | An atomic, evaluable statement within a policy |
| Policy Owner | A designated individual with authority to edit and approve a policy |
| Domain Owner | An individual responsible for rules within a specific domain (IT, HR, etc.) |
| Suggestion | A proposed change submitted by any staff member |
| Draft | A proposed change being edited by a policy owner |
| Acknowledgement | A recorded confirmation that a staff member has read a policy |
| Review | A scheduled or triggered assessment of whether a policy remains current |

---

## 4. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-01-26 | Duncan / Claude | Initial draft |

---

## 5. Next Steps

- [ ] Review and confirm requirements with stakeholders
- [ ] Prioritise any SHOULD requirements that should become MUST
- [ ] Design system architecture based on available systems
- [ ] Define machine-parseable policy format schema
- [ ] Prototype approval workflow
- [ ] Define AI agent tool specifications (Mastra)
