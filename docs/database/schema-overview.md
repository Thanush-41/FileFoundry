# File Vault System - Database Schema

## Overview

The database schema is designed to support file deduplication, efficient searching, secure sharing, and comprehensive analytics.

## Entity Relationship Diagram

```
Users (1) ----< (N) UserFiles (N) >---- (1) Files
  |                                         |
  |                                         |
  v                                         v
Roles (1) ----< (N) UserRoles        FileHashes (1:1)
  |                                         |
  |                                         v
  v                                   FileReferences (N)
Permissions                               |
                                         v
                                   SharedLinks (N)
                                         |
                                         v
                                   DownloadStats (N)
```

## Tables

### users
- Primary user information and authentication
- Stores username, email, password hash, storage quota
- Tracks created_at, updated_at, last_login

### roles
- Defines user roles (admin, user)
- Extensible for future role additions

### user_roles
- Junction table for user-role relationships
- Supports multiple roles per user

### files
- Core file metadata table
- Stores original filename, MIME type, size, tags
- References file_hash for actual file content

### file_hashes
- Stores unique file content (SHA-256 hash)
- Physical file storage path
- Reference count for deduplication

### user_files
- Junction table linking users to files
- Tracks upload timestamp and ownership

### folders (Optional/Bonus)
- Hierarchical folder structure
- Parent-child relationships for organization

### shared_links
- Public and private sharing configurations
- Expiration dates and access controls

### download_stats
- Tracks file download events
- Aggregated for analytics and statistics

### audit_logs (Bonus)
- Comprehensive activity logging
- User actions, timestamps, IP addresses

## Indexes

### Performance Optimization
- `idx_files_filename` - Fast filename searches
- `idx_files_mime_type` - MIME type filtering
- `idx_files_size` - Size-based queries
- `idx_files_created_at` - Date range searches
- `idx_file_hashes_hash` - Deduplication lookup
- `idx_shared_links_token` - Share link resolution
- `idx_download_stats_file_id` - Download analytics

### Full-Text Search
- `idx_files_filename_gin` - GIN index for advanced text search
- `idx_files_tags_gin` - Tag-based filtering

## Migration Strategy

1. **Initial Schema** - Core tables and relationships
2. **Indexes** - Performance optimization indexes
3. **Constraints** - Foreign keys and data validation
4. **Seed Data** - Default roles and admin user
5. **Extensions** - PostgreSQL extensions (if needed)

## Storage Calculations

### Deduplication Metrics
- Original storage: Sum of all uploaded file sizes
- Actual storage: Sum of unique file hash sizes
- Space saved: Original - Actual
- Savings percentage: (Space saved / Original) * 100

### Quota Tracking
- Per-user storage: Sum of file sizes owned by user
- Available quota: User limit - Used storage
- Quota warnings at 80% and 95% usage