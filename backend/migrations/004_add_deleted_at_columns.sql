-- Migration: 004_add_deleted_at_columns
-- Description: Add deleted_at columns for soft delete functionality
-- Created: 2025-09-16

-- Add deleted_at column to users table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_at column to roles table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='deleted_at') THEN
        ALTER TABLE roles ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_at column to file_hashes table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_hashes' AND column_name='deleted_at') THEN
        ALTER TABLE file_hashes ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_at column to shared_links table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shared_links' AND column_name='deleted_at') THEN
        ALTER TABLE shared_links ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_at column to download_stats table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='download_stats' AND column_name='deleted_at') THEN
        ALTER TABLE download_stats ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add deleted_at column to folders table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='folders' AND column_name='deleted_at') THEN
        ALTER TABLE folders ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create indexes on deleted_at columns if they don't exist
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);
CREATE INDEX IF NOT EXISTS idx_roles_deleted_at ON roles (deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON files (deleted_at);
CREATE INDEX IF NOT EXISTS idx_folders_deleted_at ON folders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_file_hashes_deleted_at ON file_hashes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_shared_links_deleted_at ON shared_links (deleted_at);
CREATE INDEX IF NOT EXISTS idx_download_stats_deleted_at ON download_stats (deleted_at);