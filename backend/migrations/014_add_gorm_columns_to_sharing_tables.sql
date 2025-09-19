-- Add GORM standard columns to sharing tables
-- This migration adds the updated_at and deleted_at columns that GORM expects

-- Add updated_at and deleted_at to file_shares table
ALTER TABLE file_shares 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add updated_at and deleted_at to share_links table  
ALTER TABLE share_links
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add updated_at and deleted_at to share_link_access_logs table
ALTER TABLE share_link_access_logs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for deleted_at columns for soft delete performance
CREATE INDEX IF NOT EXISTS idx_file_shares_deleted_at ON file_shares(deleted_at);
CREATE INDEX IF NOT EXISTS idx_share_links_deleted_at ON share_links(deleted_at);
CREATE INDEX IF NOT EXISTS idx_share_link_access_logs_deleted_at ON share_link_access_logs(deleted_at);

-- Create triggers to automatically update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for each table
DROP TRIGGER IF EXISTS update_file_shares_updated_at ON file_shares;
CREATE TRIGGER update_file_shares_updated_at
    BEFORE UPDATE ON file_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_share_links_updated_at ON share_links;
CREATE TRIGGER update_share_links_updated_at
    BEFORE UPDATE ON share_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_share_link_access_logs_updated_at ON share_link_access_logs;
CREATE TRIGGER update_share_link_access_logs_updated_at
    BEFORE UPDATE ON share_link_access_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();