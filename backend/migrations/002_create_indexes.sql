-- Migration: 002_create_indexes
-- Description: Create performance indexes for efficient querying
-- Created: 2025-09-15

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Indexes for files table
CREATE INDEX idx_files_filename ON files(filename);
CREATE INDEX idx_files_original_filename ON files(original_filename);
CREATE INDEX idx_files_mime_type ON files(mime_type);
CREATE INDEX idx_files_size ON files(size);
CREATE INDEX idx_files_owner_id ON files(owner_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_created_at ON files(created_at);
CREATE INDEX idx_files_updated_at ON files(updated_at);
CREATE INDEX idx_files_is_deleted ON files(is_deleted);

-- GIN indexes for advanced search
CREATE INDEX idx_files_tags_gin ON files USING GIN(tags);
CREATE INDEX idx_files_filename_gin ON files USING GIN(to_tsvector('english', filename));
CREATE INDEX idx_files_description_gin ON files USING GIN(to_tsvector('english', description));

-- Indexes for file_hashes table
CREATE UNIQUE INDEX idx_file_hashes_hash ON file_hashes(hash);
CREATE INDEX idx_file_hashes_size ON file_hashes(size);
CREATE INDEX idx_file_hashes_reference_count ON file_hashes(reference_count);

-- Indexes for folders table
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_owner_id ON folders(owner_id);
CREATE INDEX idx_folders_path ON folders(path);
CREATE INDEX idx_folders_name ON folders(name);

-- Indexes for shared_links table
CREATE UNIQUE INDEX idx_shared_links_token ON shared_links(token);
CREATE INDEX idx_shared_links_file_id ON shared_links(file_id);
CREATE INDEX idx_shared_links_folder_id ON shared_links(folder_id);
CREATE INDEX idx_shared_links_shared_by ON shared_links(shared_by);
CREATE INDEX idx_shared_links_expires_at ON shared_links(expires_at);
CREATE INDEX idx_shared_links_is_active ON shared_links(is_active);

-- Indexes for user_file_shares table
CREATE INDEX idx_user_file_shares_file_id ON user_file_shares(file_id);
CREATE INDEX idx_user_file_shares_shared_by ON user_file_shares(shared_by);
CREATE INDEX idx_user_file_shares_shared_with ON user_file_shares(shared_with);

-- Indexes for download_stats table
CREATE INDEX idx_download_stats_file_id ON download_stats(file_id);
CREATE INDEX idx_download_stats_downloaded_by ON download_stats(downloaded_by);
CREATE INDEX idx_download_stats_downloaded_at ON download_stats(downloaded_at);
CREATE INDEX idx_download_stats_shared_link_id ON download_stats(shared_link_id);

-- Indexes for audit_logs table
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Indexes for user_roles table
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- Indexes for api_rate_limits table
CREATE INDEX idx_api_rate_limits_user_id ON api_rate_limits(user_id);
CREATE INDEX idx_api_rate_limits_endpoint ON api_rate_limits(endpoint);
CREATE INDEX idx_api_rate_limits_window_start ON api_rate_limits(window_start);

-- Composite indexes for common query patterns
CREATE INDEX idx_files_owner_folder ON files(owner_id, folder_id) WHERE is_deleted = false;
CREATE INDEX idx_files_mime_size ON files(mime_type, size) WHERE is_deleted = false;
CREATE INDEX idx_files_created_owner ON files(created_at DESC, owner_id) WHERE is_deleted = false;
CREATE INDEX idx_shared_links_active_expires ON shared_links(is_active, expires_at) WHERE is_active = true;