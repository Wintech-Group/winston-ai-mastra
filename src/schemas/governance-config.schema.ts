/**
 * Zod schema for governance.yaml configuration files
 *
 * This schema validates the YAML configuration that lives in each content repository.
 * It is derived from the structure defined in docs-policy-governance/metadata/governance.yaml
 */

import { z } from "zod"

// Document configuration
const DocumentConfigSchema = z.object({
  type: z.string().min(1),
  path: z.string().min(1), // e.g., "policies/"
})

// SharePoint sync configuration
const SharePointSyncConfigSchema = z.object({
  enabled: z.boolean(),
  site_url: z.string().url(),
  library_name: z.string().min(1),
  archive_old_versions: z.boolean().optional().default(false),
  archive_site_url: z.string().url().optional(),
  archive_library_name: z.string().optional(),
})

// Auto-merge settings
const AutoMergeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  after_hours: z.number().int().positive().optional().default(24),
})

// Approval configuration
const ApprovalConfigSchema = z.object({
  required: z.boolean().default(true),
  domain_approval: z.boolean().default(true),
  owner_approval: z.boolean().default(true),
  auto_merge: AutoMergeConfigSchema.optional().default({
    enabled: false,
    after_hours: 24,
  }),
})

// Notification channels
const NotificationChannelSchema = z.enum(["email", "teams", "slack"])

// Notifications configuration
const NotificationsConfigSchema = z.object({
  on_pr_open: z.boolean().default(true),
  channels: z.array(NotificationChannelSchema).default(["email"]),
  reminder_after_hours: z.number().int().positive().optional().default(48),
  escalate_after_hours: z.number().int().positive().optional().default(120),
})

// Cross-domain rule
const CrossDomainRuleSchema = z.object({
  pattern: z.string().min(1),
  domains: z.array(z.string().min(1)).min(2),
  description: z.string().optional(),
})

/**
 * Complete governance configuration schema
 */
export const GovernanceConfigSchema = z.object({
  document: DocumentConfigSchema,
  sharepoint_sync: SharePointSyncConfigSchema,
  approval: ApprovalConfigSchema.optional().default({
    required: true,
    domain_approval: true,
    owner_approval: true,
    auto_merge: { enabled: false, after_hours: 24 },
  }),
  notifications: NotificationsConfigSchema.optional().default({
    on_pr_open: true,
    channels: ["email"],
    reminder_after_hours: 48,
    escalate_after_hours: 120,
  }),
  cross_domain_rules: z
    .array(CrossDomainRuleSchema)
    .nullish()
    .default([])
    .transform((val) => val ?? []),
})

// Inferred types for use throughout the application
export type GovernanceConfig = z.infer<typeof GovernanceConfigSchema>
export type DocumentConfig = z.infer<typeof DocumentConfigSchema>
export type SharePointSyncConfig = z.infer<typeof SharePointSyncConfigSchema>
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>
export type NotificationsConfig = z.infer<typeof NotificationsConfigSchema>
export type CrossDomainRule = z.infer<typeof CrossDomainRuleSchema>
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>
