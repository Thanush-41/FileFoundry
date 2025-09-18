-- Fix storage calculation for existing users
-- This migration recalculates storage_used based on actual file uploads

-- First, let's recalculate storage for each user based on their files
UPDATE users 
SET storage_used = (
    SELECT COALESCE(SUM(files.size), 0) 
    FROM files 
    WHERE files.owner_id = users.id 
    AND files.deleted_at IS NULL
)
WHERE users.id IN (
    SELECT DISTINCT owner_id 
    FROM files 
    WHERE deleted_at IS NULL
);

-- Also update actual_storage_bytes to match for now (can be optimized later with deduplication)
UPDATE users 
SET actual_storage_bytes = storage_used
WHERE actual_storage_bytes = 0 OR actual_storage_bytes IS NULL;

-- Ensure admin user has reasonable default storage quota if not set
UPDATE users 
SET storage_quota = 107374182400  -- 100GB for admin
WHERE (username = 'admin' OR email = 'admin@gmail.com' OR role = 'admin') 
AND (storage_quota = 0 OR storage_quota IS NULL);

-- Ensure regular users have default quota
UPDATE users 
SET storage_quota = 1073741824  -- 1GB for regular users
WHERE role = 'user' 
AND (storage_quota = 0 OR storage_quota IS NULL);