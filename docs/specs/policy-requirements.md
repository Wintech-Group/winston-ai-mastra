# Policy Requirements & Specification

> Merged from: Policy Definition Specification v0.1.0 + Policy System Requirements v0.1.0

| Attribute        | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Document Version | 1.0.0                                                      |
| Created          | 2026-01-26                                                 |
| Last Updated     | 2026-02-13                                                 |
| Purpose          | Define the policy model and system functional requirements |

---

## Part 1: Policy Model

This section defines _what a policy is_ — the structure, rules, and requirements that all policies must satisfy. It uses RFC 2119 language (MUST, SHOULD, MAY).

### 1.1 Core Definition

**A policy is a defined set of rules for business governance.**

Policies establish the boundaries and expectations within which the organisation operates. They are distinct from procedures, which define ordered steps to accomplish tasks.

### 1.2 Identity & Metadata

| ID        | Requirement                                                                                   | Level  |
| --------- | --------------------------------------------------------------------------------------------- | ------ |
| POL-ID-01 | A policy **MUST** have a unique identifier for cross-referencing                              | MUST   |
| POL-ID-02 | A policy **MUST** have a version number to track changes                                      | MUST   |
| POL-ID-03 | A policy **MUST** have an effective date indicating when the current version comes into force | MUST   |
| POL-ID-04 | A policy **MUST** have a status: Draft, Under Review, Active, Superseded, or Archived         | MUST   |
| POL-ID-05 | A policy **SHOULD** have a plain-language purpose statement                                   | SHOULD |

### 1.3 Scope & Applicability

| ID           | Requirement                                                                                 | Level  |
| ------------ | ------------------------------------------------------------------------------------------- | ------ |
| POL-SCOPE-01 | A policy **MUST** define who or what it applies to (roles, departments, systems, AI agents) | MUST   |
| POL-SCOPE-02 | A policy **MAY** define contexts where it does or does not apply                            | MAY    |
| POL-SCOPE-03 | A policy **SHOULD** define its jurisdiction or boundary                                     | SHOULD |

### 1.4 Rule Requirements

Rules are the atomic units of a policy. They must be clear, evaluable, and well-structured.

| ID          | Requirement                                                                                              | Level       |
| ----------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| POL-RULE-01 | A rule **MUST** be evaluable as true or false against a given situation                                  | MUST        |
| POL-RULE-02 | Exceptions **MUST** define conditions, who can invoke them, and **SHOULD** define the invocation process | MUST/SHOULD |
| POL-RULE-03 | Rules **MUST NOT** contradict one another within or across related policies                              | MUST NOT    |
| POL-RULE-04 | A rule **SHOULD** reference authority or rationale (legal, regulatory, best practice)                    | SHOULD      |
| POL-RULE-05 | A rule **SHOULD** have a severity: MUST, MUST NOT, SHOULD, SHOULD NOT, or MAY                            | SHOULD      |

### 1.5 Relationships & Dependencies

| ID         | Requirement                                                                                                     | Level |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| POL-REL-01 | Extension policies **MUST** reference the parent; overrides **MUST** be clearly marked                          | MUST  |
| POL-REL-02 | External dependencies (laws, regulations, standards) **MUST** be explicitly listed with version/date references | MUST  |
| POL-REL-03 | A policy **MUST** declare which other internal policies it relates to                                           | MUST  |
| POL-REL-04 | There **MUST** be a defined precedence mechanism when policies conflict                                         | MUST  |

### 1.6 Ownership & Responsibility

| ID         | Requirement                                                                                                   | Level |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ----- |
| POL-OWN-01 | One or more staff members **MUST** be designated as content owners                                            | MUST  |
| POL-OWN-02 | Multi-stakeholder policies **MUST** list all required stakeholders; all **MUST** approve before Active status | MUST  |
| POL-OWN-03 | A policy **MUST** define who has authority to approve changes                                                 | MUST  |

### 1.7 Lifecycle

| ID          | Requirement                                                                                      | Level  |
| ----------- | ------------------------------------------------------------------------------------------------ | ------ |
| POL-LIFE-01 | A policy **MUST** have a defined review schedule                                                 | MUST   |
| POL-LIFE-02 | A policy **SHOULD** define triggers for unscheduled review (regulatory changes, incidents, etc.) | SHOULD |
| POL-LIFE-03 | Updates **MUST** be approved by designated stakeholders before becoming Active                   | MUST   |
| POL-LIFE-04 | A policy **MUST** retain an audit trail (what, when, who, why)                                   | MUST   |

### 1.8 Consumption & Accessibility

| ID            | Requirement                                                                         | Level  |
| ------------- | ----------------------------------------------------------------------------------- | ------ |
| POL-ACCESS-01 | A policy **MUST** be available in both human-readable and machine-parseable formats | MUST   |
| POL-ACCESS-02 | A policy **SHOULD** include examples or scenarios                                   | SHOULD |
| POL-ACCESS-03 | A policy **SHOULD** define how compliance is verified or measured                   | SHOULD |

### 1.9 Terminology

| Term        | Definition                                                             |
| ----------- | ---------------------------------------------------------------------- |
| Policy      | A defined set of rules for business governance                         |
| Rule        | An atomic, evaluable statement within a policy                         |
| Exception   | A defined condition under which a rule does not apply                  |
| Procedure   | A set of ordered steps with conditions (defined separately)            |
| Stakeholder | An individual or group with responsibility for or interest in a policy |
| AI Agent    | An automated system that must comply with policies                     |

---

## Part 2: System Requirements

This section defines the functional requirements for the policy management system.

### 2.1 Design Principles

- **Dual-audience**: Every policy must be consumable by humans and machines
- **Non-technical first**: The primary interface must be usable by staff without technical knowledge
- **Auditable**: All changes, approvals, and reviews must be tracked and reportable
- **Configurable**: Workflows, approvals, and features should be configurable per policy

### 2.2 Available Systems

| System        | Purpose                                                     |
| ------------- | ----------------------------------------------------------- |
| Microsoft 365 | Productivity suite, notifications, collaboration            |
| SharePoint    | Document hosting, viewing, permissions                      |
| GitHub        | Version control, structured data storage, change tracking   |
| Azure AD      | Identity, authentication, role-based access                 |
| People First  | HR system with job titles and org structure (API available) |
| Mastra        | Agent framework for AI tooling                              |

### R01: Viewability & Hosting

| ID    | Requirement                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------- | -------- |
| R01.1 | Policies must be viewable via SharePoint without specialist software         | MUST     |
| R01.2 | Policies must render correctly on desktop and mobile                         | MUST     |
| R01.3 | Policies must be accessible to staff with appropriate permissions (Azure AD) | MUST     |
| R01.4 | The canonical version must be clearly identifiable                           | MUST     |
| R01.5 | Previous versions must be accessible but clearly marked as superseded        | MUST     |

### R02: Traditional Document Output

| ID    | Requirement                                                     | Priority |
| ----- | --------------------------------------------------------------- | -------- |
| R02.1 | A PDF must be generatable on-demand from the source policy data | MUST     |
| R02.2 | The PDF must include all compliance metadata                    | MUST     |
| R02.3 | The PDF must be visually consistent with company branding       | SHOULD   |
| R02.4 | PDF generation must be automated                                | MUST     |
| R02.5 | The PDF must be suitable for submission to external auditors    | MUST     |
| R02.6 | Bulk PDF generation should be supported                         | SHOULD   |

### R03: Non-Technical Authoring & Workflow

| ID    | Requirement                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------- | -------- |
| R03.1 | Any staff member must be able to suggest a policy change                     | MUST     |
| R03.2 | Staff must be able to see the status of their change requests                | MUST     |
| R03.3 | Policy owners must be able to draft and edit in a familiar interface         | MUST     |
| R03.4 | The system must support comparison between current and proposed versions     | MUST     |
| R03.5 | Policy owners must be able to review, comment on, and approve/reject changes | MUST     |
| R03.6 | Delegation of approval authority should be supported                         | SHOULD   |
| R03.7 | The system must notify relevant parties when action is required              | MUST     |
| R03.8 | The system must prevent publication without all required approvals           | MUST     |

**Roles:**

| Role             | Can Suggest | Can Edit/Draft | Can Approve |
| ---------------- | ----------- | -------------- | ----------- |
| Any staff member | Yes         | No             | No          |
| Policy owner     | Yes         | Yes            | Yes         |

### R04: AI Agent Accessibility

| ID     | Requirement                                                                  | Priority |
| ------ | ---------------------------------------------------------------------------- | -------- |
| R04.1  | Policies must be available in a structured, machine-parseable format         | MUST     |
| R04.2  | Individual rules must be independently addressable                           | MUST     |
| R04.3  | AI agents must be able to query by subject, scope, keyword, or applicability | MUST     |
| R04.4  | AI agents must determine which version is currently active                   | MUST     |
| R04.5  | AI agents must trace rule authority (legal basis, rationale)                 | SHOULD   |
| R04.6  | AI agents must identify exceptions and their conditions                      | MUST     |
| R04.7  | AI agents must follow policy relationships (parent, related, overrides)      | MUST     |
| R04.8  | The system must provide an API or tool interface for AI agent access         | MUST     |
| R04.9  | AI agents must be able to suggest changes (subject to owner approval)        | MUST     |
| R04.10 | AI agent suggestions must follow the same approval workflow                  | MUST     |

### R05: Review Reminders & Scheduling

| ID    | Requirement                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------- | -------- |
| R05.1 | The system must track scheduled review dates                                 | MUST     |
| R05.2 | The system must send reminders to owners in advance of review due dates      | MUST     |
| R05.3 | The system should escalate overdue reviews                                   | SHOULD   |
| R05.4 | The system must support ad-hoc review triggers                               | MUST     |
| R05.5 | The system must track review completion                                      | MUST     |
| R05.6 | The system must distinguish "reviewed and confirmed" from "not yet reviewed" | MUST     |
| R05.7 | Policies past review date without action must enter "Review Overdue" status  | MUST     |

**Review Outcomes:** Confirmed | Minor Update | Major Revision | Review Overdue

### R06: Granular Approval Routing

| ID     | Requirement                                                         | Priority |
| ------ | ------------------------------------------------------------------- | -------- |
| R06.1  | Rules must be taggable by domain/ownership                          | MUST     |
| R06.2  | Changes to a rule must route to the domain owner(s)                 | MUST     |
| R06.3  | Multi-domain changes must require all domain owners                 | MUST     |
| R06.4  | Partial publication must be prevented                               | MUST     |
| R06.5  | Approval requirements must be configurable per policy or rule       | MUST     |
| R06.6  | Approval decisions must be logged with timestamp and identity       | MUST     |
| R06.8  | Disagreements must keep change in editing/review state              | MUST     |
| R06.9  | Conflicting approvers must be able to collaborate within the system | MUST     |
| R06.10 | Change may only proceed when all approvers approve the same version | MUST     |

### R07: Search & Discovery

| ID    | Requirement                                                          | Priority |
| ----- | -------------------------------------------------------------------- | -------- |
| R07.1 | Staff must be able to search by keyword, topic, or applicability     | MUST     |
| R07.2 | Search results should show relevant policy and section/rule          | SHOULD   |
| R07.3 | Staff should be able to browse by category, department, or hierarchy | SHOULD   |

### R08: Acknowledgement Tracking

| ID    | Requirement                                              | Priority |
| ----- | -------------------------------------------------------- | -------- |
| R08.1 | Acknowledgement tracking must be configurable per policy | MUST     |
| R08.2 | The system must track which staff have acknowledged      | MUST     |
| R08.3 | Material updates must trigger re-acknowledgement         | MUST     |
| R08.4 | The system must report on acknowledgement status         | MUST     |
| R08.5 | Should integrate with People First for targeting         | SHOULD   |

### R09: Conflict Detection

| ID    | Requirement                                                     | Priority |
| ----- | --------------------------------------------------------------- | -------- |
| R09.1 | The system should detect potential contradictions between rules | SHOULD   |
| R09.2 | Conflict detection may be AI-assisted                           | SHOULD   |
| R09.3 | Flagged conflicts must be surfaced to policy owners             | SHOULD   |

### R10: Audit & Compliance Reporting

| ID    | Requirement                                               | Priority |
| ----- | --------------------------------------------------------- | -------- |
| R10.1 | Full audit trail for any policy (complete change history) | MUST     |
| R10.2 | Report on policy status across the organisation           | MUST     |
| R10.3 | Demonstrate compliance workflow to external auditors      | MUST     |
| R10.4 | Audit logs must be immutable                              | MUST     |

### R11: Integration

| ID    | Requirement                                             | Priority |
| ----- | ------------------------------------------------------- | -------- |
| R11.1 | Authentication must integrate with Azure AD             | MUST     |
| R11.2 | Notifications must integrate with M365 (email, Teams)   | MUST     |
| R11.3 | Org structure must be retrievable from People First API | MUST     |
| R11.4 | AI agent tooling must use Mastra framework              | MUST     |
| R11.5 | Version control should use GitHub                       | SHOULD   |
| R11.6 | Human-facing viewing must use SharePoint                | MUST     |

---

## Glossary

| Term            | Definition                                                                  |
| --------------- | --------------------------------------------------------------------------- |
| Policy          | A defined set of rules for business governance                              |
| Rule            | An atomic, evaluable statement within a policy                              |
| Policy Owner    | A designated individual with authority to edit and approve a policy         |
| Domain Owner    | An individual responsible for rules within a specific domain (IT, HR, etc.) |
| Suggestion      | A proposed change submitted by any staff member                             |
| Draft           | A proposed change being edited by a policy owner                            |
| Acknowledgement | A recorded confirmation that a staff member has read a policy               |
| Review          | A scheduled or triggered assessment of whether a policy remains current     |

---

## Change Log

| Version | Date       | Author | Changes                                                                           |
| ------- | ---------- | ------ | --------------------------------------------------------------------------------- |
| 0.1.0   | 2026-01-26 | Duncan | Initial drafts (separate documents)                                               |
| 1.0.0   | 2026-02-13 | Duncan | Merged Policy Definition Specification + System Requirements into single document |
