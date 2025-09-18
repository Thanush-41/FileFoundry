-- Migration: Add file deduplication support
-- This migration creates a file_contents table to store unique file data
-- and modifies the files table to reference content by hash

-- Create file_contents table to store unique file content
CREATE TABLE IF NOT EXISTS file_contents (
    id SERIAL PRIMARY KEY,
    content_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash
    file_data BYTEA NOT NULL, -- Actual file content
    size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reference_count INTEGER DEFAULT 0 -- Track how many files reference this content
);

-- Create index for content_hash
CREATE INDEX IF NOT EXISTS idx_content_hash ON file_contents(content_hash);

-- Add content_hash column to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Add foreign key constraint to reference file_contents
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_files_content_hash' 
        AND table_name = 'files'
    ) THEN
        ALTER TABLE files ADD CONSTRAINT fk_files_content_hash 
            FOREIGN KEY (content_hash) REFERENCES file_contents(content_hash) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);

-- Add storage savings tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_uploaded_bytes BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS actual_storage_bytes BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_bytes BIGINT DEFAULT 0;

-- Remove file_data column from files table as it's now in file_contents
-- (We'll handle this carefully to avoid data loss)
-- ALTER TABLE files DROP COLUMN IF EXISTS file_data;

-- Update existing files to calculate their content hash and move data
-- This will be handled by the application code for safety