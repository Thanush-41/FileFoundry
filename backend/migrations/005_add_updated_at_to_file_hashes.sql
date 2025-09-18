-- Migration: 005_add_updated_at_to_file_hashes
-- Description: Add missing updated_at column to file_hashes table
-- Created: 2025-09-16

ALTER TABLE file_hashes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;