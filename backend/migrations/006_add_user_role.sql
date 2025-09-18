-- Migration: Add role column to users table
-- This migration adds a role field to the users table with default value 'user'

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- Create an index on the role column for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update any existing users to have 'user' role by default
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Add check constraint to ensure role is either 'user' or 'admin'
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_user_role' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT check_user_role 
        CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- Optional: Set the first user as admin (if exists)
-- UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);