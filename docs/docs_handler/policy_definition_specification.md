# Policy Definition Specification

**Source of Truth for Governance System**

| Attribute | Value |
|-----------|-------|
| Document Version | 0.1.0 |
| Status | Draft |
| Created | 2026-01-26 |
| Last Updated | 2026-01-26 |
| Purpose | Define the structure and requirements for all company policies to enable both human and AI agent compliance |

---

## 1. Introduction

This document establishes the definitive specification for how policies are structured, managed, and consumed within the organisation. It serves as the foundation for a governance system that works equally well for human employees and AI agents.

Traditional document formats (Word, PDF) are inefficient for automated processing. Code formats are inaccessible to non-technical staff. This specification defines a middle ground—structured, unambiguous definitions that serve both audiences.

---

## 2. Core Definition

**A policy is a defined set of rules for business governance.**

Policies establish the boundaries and expectations within which the organisation operates. They are distinct from procedures, which define ordered steps to accomplish tasks.

---

## 3. Identity & Metadata Requirements

Every policy must maintain clear identification and tracking information.

### POL-ID-01: Unique Identifier
A policy **MUST** have a unique identifier that can be used for cross-referencing between policies, procedures, and other governance documents.

### POL-ID-02: Version Number
A policy **MUST** have a version number to track changes over time.

### POL-ID-03: Effective Date
A policy **MUST** have an effective date indicating when the current version comes into force.

### POL-ID-04: Status
A policy **MUST** have a status from the following values:
- **Draft** — Under initial development
- **Under Review** — Awaiting stakeholder approval
- **Active** — Currently in force
- **Superseded** — Replaced by a newer version or different policy
- **Archived** — No longer applicable

### POL-ID-05: Purpose Statement
A policy **SHOULD** have a plain-language summary explaining its purpose and intent, written for both human and machine consumption.

---

## 4. Scope & Applicability Requirements

Policies must clearly define who and what they govern.

### POL-SCOPE-01: Subject Definition
A policy **MUST** define who or what it applies to, including specific:
- Roles
- Departments
- Systems
- AI agents

### POL-SCOPE-02: Context Conditions
A policy **MAY** define contexts where it does or does not apply (e.g., "only when handling customer data", "excludes emergency situations").

### POL-SCOPE-03: Jurisdiction
A policy **SHOULD** define its jurisdiction or boundary:
- Entire company
- Specific region
- Specific function
- Specific system or platform

---

## 5. Rule Requirements

Rules are the atomic units of a policy. They must be clear, evaluable, and well-structured.

### POL-RULE-01: Evaluability
A rule **MUST** be evaluable as true or false against a given situation. This is critical for AI interpretation and automated compliance checking.

### POL-RULE-02: Exceptions
Rules **MAY** contain exceptions. When they do:
- An exception **MUST** define its conditions explicitly
- An exception **MUST** define who can invoke it
- An exception **SHOULD** define the process for invoking it

### POL-RULE-03: Non-Contradiction
Rules **MUST NOT** contradict one another within the same policy or across related policies.

### POL-RULE-04: Authority Reference
A rule **SHOULD** reference the authority or rationale behind it:
- Legal requirement
- Regulatory compliance
- Industry standard
- Best practice
- Risk mitigation

### POL-RULE-05: Severity Classification
A rule **SHOULD** have a severity or priority level:
- **MUST** — Mandatory requirement; violation is non-compliant
- **SHOULD** — Strong recommendation; deviation requires justification
- **MAY** — Optional guidance; discretionary

---

## 6. Relationship & Dependency Requirements

Policies do not exist in isolation. Their connections must be explicit.

### POL-REL-01: Policy Extension
Some policies **MAY** be extensions of others (e.g., BYOD Policy extends IT Policy). When this occurs:
- The parent policy **MUST** be explicitly referenced
- The child policy inherits all rules from the parent unless explicitly overridden
- Override rules **MUST** be clearly marked

### POL-REL-02: External Dependencies
A policy **MAY** depend on external references:
- Laws and legislation
- Regulations
- Industry standards (ISO, NIST, etc.)
- Contractual obligations

These **MUST** be explicitly listed with version or date references where applicable.

### POL-REL-03: Related Policies
A policy **MUST** declare which other internal policies it relates to or interacts with.

### POL-REL-04: Precedence Mechanism
When policies conflict, there **MUST** be a defined precedence mechanism to determine which takes priority. This may be defined at:
- Organisation level (a global precedence hierarchy)
- Policy level (explicit precedence statements)

---

## 7. Ownership & Responsibility Requirements

Policies require clear accountability.

### POL-OWN-01: Content Owners
One or more staff members or managers **MUST** be designated as responsible for the content of a policy.

### POL-OWN-02: Multi-Stakeholder Input
A policy **MAY** require input from multiple stakeholders (e.g., a Travel Policy may need input from HR, Finance, and IT). When this applies:
- All required stakeholders **MUST** be listed
- Approval from all stakeholders **MUST** be obtained before the policy becomes Active

### POL-OWN-03: Approval Authority
A policy **MUST** define who has authority to approve changes.

---

## 8. Lifecycle Requirements

Policies are living documents that evolve over time.

### POL-LIFE-01: Review Schedule
A policy **MUST** have a defined review schedule (e.g., annually, bi-annually). Reviews ensure ongoing relevance and accuracy.

### POL-LIFE-02: Update Triggers
A policy **SHOULD** define triggers for unscheduled review:
- Regulatory or legal changes
- Incident or breach related to the policy area
- Organisational restructure
- Technology changes
- Stakeholder request

### POL-LIFE-03: Change Approval
A policy update **MUST** be approved by designated stakeholders before becoming Active.

### POL-LIFE-04: Audit Trail
A policy **MUST** retain an audit trail of changes, including:
- What changed
- When it changed
- Who approved the change
- Rationale for the change

---

## 9. Consumption & Accessibility Requirements

Policies must be usable by both humans and machines.

### POL-ACCESS-01: Dual Format
A policy **MUST** be available in both:
- Human-readable format (clear, plain language)
- Machine-parseable format (structured data for AI agents)

### POL-ACCESS-02: Examples and Scenarios
A policy **SHOULD** include examples or scenarios illustrating how rules apply in practice. These aid both human understanding and AI training.

### POL-ACCESS-03: Compliance Verification
A policy **SHOULD** define how compliance is verified or measured, enabling:
- Self-assessment by employees
- Automated compliance checking by AI agents
- Audit and assurance activities

---

## 10. Terminology

| Term | Definition |
|------|------------|
| Policy | A defined set of rules for business governance |
| Rule | An atomic, evaluable statement within a policy |
| Exception | A defined condition under which a rule does not apply |
| Procedure | A set of ordered steps with conditions (defined separately) |
| Stakeholder | An individual or group with responsibility for or interest in a policy |
| AI Agent | An automated system that operates within the organisation and must comply with policies |

---

## 11. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1.0 | 2026-01-26 | Duncan / Claude | Initial draft |

---

## 12. Next Steps

- [ ] Define procedure specification (ordered steps with conditions)
- [ ] Define machine-parseable format schema
- [ ] Establish policy template based on this specification
- [ ] Pilot with one existing policy conversion
- [ ] Gather feedback and iterate
