-- Migration: Create admin user with username "admin" and role "admin"
-- This migration ensures there's always an admin user available

-- First, try to update existing admin user if exists
UPDATE users SET 
    role = 'admin',
    password_hash = '$2a$10$dummy.hash.for.admin.user',  -- This will be bypassed in login logic
    first_name = 'System',
    last_name = 'Administrator',
    is_active = true
WHERE username = 'admin';

-- If no admin user exists, create one
INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, storage_quota, storage_used, is_active, email_verified, created_at, updated_at)
SELECT 
    uuid_generate_v4(),
    'admin',
    'admin@filevault.system',
    '$2a$10$dummy.hash.for.admin.user',  -- This will be bypassed in login logic
    'System',
    'Administrator',
    'admin',
    1073741824,  -- 1GB storage quota for admin
    0,
    true,
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

-- Ensure all other users (not username 'admin') have 'user' role
UPDATE users SET role = 'user' WHERE username != 'admin' AND role = 'admin';