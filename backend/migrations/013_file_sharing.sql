-- File Sharing Tables
-- This migration adds support for internal user file sharing and external link sharing

-- Table for internal file shares between users
CREATE TABLE IF NOT EXISTS file_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(20) NOT NULL DEFAULT 'view', -- 'view', 'download'
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(file_id, shared_by, shared_with)
);

-- Table for external shareable links
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_token VARCHAR(128) UNIQUE NOT NULL,
    permission VARCHAR(20) NOT NULL DEFAULT 'view', -- 'view', 'download'
    password_hash VARCHAR(255), -- Optional password protection
    max_downloads INTEGER, -- NULL for unlimited
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    last_accessed_at TIMESTAMP WITH TIME ZONE
);

-- Table for tracking share link access logs
CREATE TABLE IF NOT EXISTS share_link_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_link_id UUID NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(50) NOT NULL -- 'view', 'download'
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_by ON file_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with ON file_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_file_shares_active ON file_shares(is_active);

CREATE INDEX IF NOT EXISTS idx_share_links_file_id ON share_links(file_id);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(share_token);
CREATE INDEX IF NOT EXISTS idx_share_links_active ON share_links(is_active);

CREATE INDEX IF NOT EXISTS idx_share_link_access_logs_link_id ON share_link_access_logs(share_link_id);
CREATE INDEX IF NOT EXISTS idx_share_link_access_logs_accessed_at ON share_link_access_logs(accessed_at);

-- Add sharing statistics columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Function to update file sharing statistics
CREATE OR REPLACE FUNCTION update_file_sharing_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE files 
        SET share_count = (
            SELECT COUNT(*) FROM file_shares 
            WHERE file_id = NEW.file_id AND is_active = true
        ) + (
            SELECT COUNT(*) FROM share_links 
            WHERE file_id = NEW.file_id AND is_active = true
        ),
        is_shared = true
        WHERE id = NEW.file_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE files 
        SET share_count = (
            SELECT COUNT(*) FROM file_shares 
            WHERE file_id = OLD.file_id AND is_active = true
        ) + (
            SELECT COUNT(*) FROM share_links 
            WHERE file_id = OLD.file_id AND is_active = true
        ),
        is_shared = CASE WHEN (
            SELECT COUNT(*) FROM file_shares 
            WHERE file_id = OLD.file_id AND is_active = true
        ) + (
            SELECT COUNT(*) FROM share_links 
            WHERE file_id = OLD.file_id AND is_active = true
        ) > 0 THEN true ELSE false END
        WHERE id = OLD.file_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE files 
        SET share_count = (
            SELECT COUNT(*) FROM file_shares 
            WHERE file_id = NEW.file_id AND is_active = true
        ) + (
            SELECT COUNT(*) FROM share_links 
            WHERE file_id = NEW.file_id AND is_active = true
        ),
        is_shared = CASE WHEN (
            SELECT COUNT(*) FROM file_shares 
            WHERE file_id = NEW.file_id AND is_active = true
        ) + (
            SELECT COUNT(*) FROM share_links 
            WHERE file_id = NEW.file_id AND is_active = true
        ) > 0 THEN true ELSE false END
        WHERE id = NEW.file_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update file sharing statistics
DROP TRIGGER IF EXISTS trigger_update_file_sharing_stats_file_shares ON file_shares;
CREATE TRIGGER trigger_update_file_sharing_stats_file_shares
    AFTER INSERT OR UPDATE OR DELETE ON file_shares
    FOR EACH ROW EXECUTE FUNCTION update_file_sharing_stats();

DROP TRIGGER IF EXISTS trigger_update_file_sharing_stats_share_links ON share_links;
CREATE TRIGGER trigger_update_file_sharing_stats_share_links
    AFTER INSERT OR UPDATE OR DELETE ON share_links
    FOR EACH ROW EXECUTE FUNCTION update_file_sharing_stats();