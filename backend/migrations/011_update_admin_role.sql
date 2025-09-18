-- Migration: 011_update_admin_role
-- Description: Update existing admin user to have admin role
-- Created: 2025-09-18

-- Update the admin user to have admin role
UPDATE users 
SET role = 'admin' 
WHERE email = 'admin@gmail.com' AND username = 'admin';