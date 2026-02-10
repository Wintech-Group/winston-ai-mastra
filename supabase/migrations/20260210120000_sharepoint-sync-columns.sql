-- Add SharePoint sync configuration columns to repository_config
ALTER TABLE config.repository_config
  ADD COLUMN sp_sync_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN sp_site_url            TEXT,
  ADD COLUMN sp_library_name        TEXT,
  ADD COLUMN sp_archive_old_versions BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN sp_archive_site_url    TEXT,
  ADD COLUMN sp_archive_library_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN config.repository_config.sp_sync_enabled IS 'Whether SharePoint sync is enabled for this repository';
COMMENT ON COLUMN config.repository_config.sp_site_url IS 'SharePoint site URL for page publishing';
COMMENT ON COLUMN config.repository_config.sp_library_name IS 'Document library name for PDF uploads';
COMMENT ON COLUMN config.repository_config.sp_archive_old_versions IS 'Whether to archive old versions when documents are updated';
COMMENT ON COLUMN config.repository_config.sp_archive_site_url IS 'Optional separate SharePoint site URL for archived documents';
COMMENT ON COLUMN config.repository_config.sp_archive_library_name IS 'Optional document library name for archived documents';
