/**
 * Configuration service for documentation repository settings
 *
 * Handles parsing, validation, and database sync of repo-config.yaml files.
 * Provides fallback to database or defaults when config sync fails.
 */

import { parse as parseYaml } from "yaml"
import {
  DocumentRepoConfigurationSchema,
  type DocumentRepoConfig,
  type CrossDomainRule,
} from "../schemas/governance-config.schema"
import { getSupabaseClient } from "./supabase-client"
import { fetchFileContent } from "./github-client"
import type { Database } from "../types/database.types"

type RepositoryConfigRow =
  Database["config"]["Tables"]["repository_config"]["Row"]
type CrossDomainRuleRow =
  Database["config"]["Tables"]["cross_domain_rules"]["Row"]

/**
 * Runtime config used by handlers - combines DB row with document path
 */
/**
 * SharePoint sync settings in camelCase for runtime use
 */
export interface SharePointSync {
  enabled: boolean
  siteUrl: string
  libraryName: string
  archiveOldVersions: boolean
  archiveSiteUrl?: string | null
  archiveLibraryName?: string | null
}

export interface RepositoryConfig {
  repoFullName: string
  documentType: string
  documentPath: string
  sharepointSync: SharePointSync
  approvalRequired: boolean
  domainApproval: boolean
  ownerApproval: boolean
  autoMergeEnabled: boolean
  autoMergeAfterHours: number | null
  notifyOnPrOpen: boolean
  notificationChannels: string[]
  reminderAfterHours: number | null
  escalateAfterHours: number | null
  crossDomainRules: CrossDomainRule[]
}

// Standard config file path in content repositories
const CONFIG_FILE_PATH = "metadata/repo-config.yaml"

/**
 * Parse YAML content and validate against schema
 *
 * @returns Validated config or null if parsing/validation fails
 */
export function parseAndValidateConfig(
  yamlContent: string,
): DocumentRepoConfig | null {
  try {
    const parsed = parseYaml(yamlContent)
    const result = DocumentRepoConfigurationSchema.safeParse(parsed)

    if (!result.success) {
      console.error("Config validation failed:", result.error.issues)
      return null
    }

    return result.data
  } catch (error) {
    console.error("Failed to parse YAML:", error)
    return null
  }
}

/**
 * Sync validated config to the database
 *
 * Upserts repository_config and cross_domain_rules tables.
 */
export async function syncConfigToDatabase(
  repoFullName: string,
  config: DocumentRepoConfig,
  sha: string,
): Promise<void> {
  const supabase = getSupabaseClient()

  // Map governance config to database row
  const repositoryConfig: Database["config"]["Tables"]["repository_config"]["Insert"] =
    {
      repo_full_name: repoFullName,
      document_type: config.document.type,
      document_path: config.document.path,
      config_file_path: CONFIG_FILE_PATH,
      config_sha: sha,
      synced_at: new Date().toISOString(),
      approval_required: config.approval.required,
      domain_approval: config.approval.domain_approval,
      owner_approval: config.approval.owner_approval,
      auto_merge_enabled: config.approval.auto_merge.enabled,
      auto_merge_after_hours: config.approval.auto_merge.after_hours,
      notify_on_pr_open: config.notifications.on_pr_open,
      notification_channels: config.notifications.channels,
      reminder_after_hours: config.notifications.reminder_after_hours,
      escalate_after_hours: config.notifications.escalate_after_hours,
      sp_sync_enabled: config.sharepoint_sync.enabled,
      sp_site_url: config.sharepoint_sync.site_url,
      sp_library_name: config.sharepoint_sync.library_name,
      sp_archive_old_versions: config.sharepoint_sync.archive_old_versions,
      sp_archive_site_url: config.sharepoint_sync.archive_site_url ?? null,
      sp_archive_library_name:
        config.sharepoint_sync.archive_library_name ?? null,
    }

  // Upsert repository config
  const { error: configError } = await supabase
    .schema("config")
    .from("repository_config")
    .upsert(repositoryConfig, { onConflict: "repo_full_name" })

  if (configError) {
    throw new Error(
      `Failed to upsert repository config: ${configError.message}`,
    )
  }

  // Delete existing cross-domain rules for this repo
  const { error: deleteError } = await supabase
    .schema("config")
    .from("cross_domain_rules")
    .delete()
    .eq("repo_full_name", repoFullName)

  if (deleteError) {
    throw new Error(
      `Failed to delete existing cross-domain rules: ${deleteError.message}`,
    )
  }

  // Insert new cross-domain rules if any
  if (config.cross_domain_rules.length > 0) {
    const rules: Database["config"]["Tables"]["cross_domain_rules"]["Insert"][] =
      config.cross_domain_rules.map((rule) => ({
        repo_full_name: repoFullName,
        rule_pattern: rule.pattern,
        required_domains: rule.domains,
        description: rule.description ?? null,
      }))

    const { error: rulesError } = await supabase
      .schema("config")
      .from("cross_domain_rules")
      .insert(rules)

    if (rulesError) {
      throw new Error(
        `Failed to insert cross-domain rules: ${rulesError.message}`,
      )
    }
  }

  console.log(`Config synced to database for ${repoFullName}`)
}

/**
 * Get repository config from database
 *
 * @returns Config row or null if not found
 */
export async function getConfigFromDatabase(
  repoFullName: string,
): Promise<RepositoryConfig | null> {
  const supabase = getSupabaseClient()

  // Fetch repository config
  const { data: configRow, error: configError } = await supabase
    .schema("config")
    .from("repository_config")
    .select("*")
    .eq("repo_full_name", repoFullName)
    .single()

  if (configError) {
    if (configError.code === "PGRST116") {
      // No rows returned
      return null
    }
    throw new Error(`Failed to fetch repository config: ${configError.message}`)
  }

  // Fetch cross-domain rules
  const { data: rulesRows, error: rulesError } = await supabase
    .schema("config")
    .from("cross_domain_rules")
    .select("*")
    .eq("repo_full_name", repoFullName)

  if (rulesError) {
    throw new Error(`Failed to fetch cross-domain rules: ${rulesError.message}`)
  }

  return mapDbRowToConfig(configRow, rulesRows ?? [])
}

/**
 * Get default configuration when database lookup fails
 */
export function getDefaultConfig(repoFullName: string): RepositoryConfig {
  console.warn(
    `Using default config for ${repoFullName} - no config found in database`,
  )

  return {
    repoFullName,
    documentType: "policy",
    documentPath: "policies/",
    sharepointSync: {
      enabled: false,
      siteUrl: "",
      libraryName: "",
      archiveOldVersions: false,
    },
    approvalRequired: true,
    domainApproval: true,
    ownerApproval: true,
    autoMergeEnabled: false,
    autoMergeAfterHours: null,
    notifyOnPrOpen: true,
    notificationChannels: ["email"],
    reminderAfterHours: 48,
    escalateAfterHours: 120,
    crossDomainRules: [],
  }
}

/**
 * Map database row to RepositoryConfig
 */
function mapDbRowToConfig(
  row: RepositoryConfigRow,
  rules: CrossDomainRuleRow[],
): RepositoryConfig {
  return {
    repoFullName: row.repo_full_name,
    documentType: row.document_type,
    documentPath: row.document_path,
    sharepointSync: {
      enabled: row.sp_sync_enabled,
      siteUrl: row.sp_site_url ?? "",
      libraryName: row.sp_library_name ?? "",
      archiveOldVersions: row.sp_archive_old_versions,
      archiveSiteUrl: row.sp_archive_site_url ?? undefined,
      archiveLibraryName: row.sp_archive_library_name ?? undefined,
    },
    approvalRequired: row.approval_required,
    domainApproval: row.domain_approval,
    ownerApproval: row.owner_approval,
    autoMergeEnabled: row.auto_merge_enabled,
    autoMergeAfterHours: row.auto_merge_after_hours,
    notifyOnPrOpen: row.notify_on_pr_open,
    notificationChannels: row.notification_channels ?? [],
    reminderAfterHours: row.reminder_after_hours,
    escalateAfterHours: row.escalate_after_hours,
    crossDomainRules: rules.map((r) => ({
      pattern: r.rule_pattern,
      domains: r.required_domains,
      description: r.description ?? undefined,
    })),
  }
}

/**
 * Map validated GovernanceConfig to RepositoryConfig
 */
function mapGovernanceToConfig(
  repoFullName: string,
  config: DocumentRepoConfig,
): RepositoryConfig {
  return {
    repoFullName,
    documentType: config.document.type,
    documentPath: config.document.path,
    sharepointSync: {
      enabled: config.sharepoint_sync.enabled,
      siteUrl: config.sharepoint_sync.site_url,
      libraryName: config.sharepoint_sync.library_name,
      archiveOldVersions: config.sharepoint_sync.archive_old_versions,
      archiveSiteUrl: config.sharepoint_sync.archive_site_url,
      archiveLibraryName: config.sharepoint_sync.archive_library_name,
    },
    approvalRequired: config.approval.required,
    domainApproval: config.approval.domain_approval,
    ownerApproval: config.approval.owner_approval,
    autoMergeEnabled: config.approval.auto_merge.enabled,
    autoMergeAfterHours: config.approval.auto_merge.after_hours,
    notifyOnPrOpen: config.notifications.on_pr_open,
    notificationChannels: config.notifications.channels,
    reminderAfterHours: config.notifications.reminder_after_hours,
    escalateAfterHours: config.notifications.escalate_after_hours,
    crossDomainRules: config.cross_domain_rules,
  }
}

interface LoadOrSyncConfigArgs {
  repoFullName: string
  configFiles: string[]
  ref?: string
}

/**
 * Load or sync repository config
 *
 * If config files are in the changed files list:
 *   1. Fetch from GitHub
 *   2. Validate
 *   3. On success: sync to DB and return config
 *   4. On failure: log warning, try DB fallback
 *
 * If no config changes:
 *   1. Load from database
 *   2. If not found, return defaults
 */
export async function loadOrSyncConfig({
  repoFullName,
  configFiles,
  ref,
}: LoadOrSyncConfigArgs): Promise<RepositoryConfig> {
  const parts = repoFullName.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error(`Invalid repo full name: ${repoFullName}`)
    return getDefaultConfig(repoFullName)
  }
  const [owner, repo] = parts
  const hasConfigChange = configFiles.some((f) => f === CONFIG_FILE_PATH)

  if (hasConfigChange) {
    console.log(`Config change detected for ${repoFullName}, syncing...`)

    // Fetch config from GitHub
    const fileResult = await fetchFileContent(
      owner,
      repo,
      CONFIG_FILE_PATH,
      ref,
    )

    if (!fileResult) {
      console.warn(
        `Config file not found at ${CONFIG_FILE_PATH}, using DB fallback`,
      )
      return await loadFromDbOrDefault(repoFullName)
    }

    // Parse and validate
    const config = parseAndValidateConfig(fileResult.content)

    if (!config) {
      console.warn(
        `Config validation failed for ${repoFullName}, using DB fallback`,
      )
      return await loadFromDbOrDefault(repoFullName)
    }

    // Sync to database
    try {
      await syncConfigToDatabase(repoFullName, config, fileResult.sha)
    } catch (error) {
      console.error(`Failed to sync config to database:`, error)
      // Continue with the validated config even if DB sync fails
    }

    return mapGovernanceToConfig(repoFullName, config)
  }

  // No config change, load from database
  return await loadFromDbOrDefault(repoFullName)
}

/**
 * Load config from database with default fallback
 */
async function loadFromDbOrDefault(
  repoFullName: string,
): Promise<RepositoryConfig> {
  try {
    const dbConfig = await getConfigFromDatabase(repoFullName)
    if (dbConfig) {
      return dbConfig
    }
  } catch (error) {
    console.error(`Failed to load config from database:`, error)
  }

  return getDefaultConfig(repoFullName)
}
