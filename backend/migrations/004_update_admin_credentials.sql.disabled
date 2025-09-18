-- Migration: 004_update_admin_credentials
-- Description: Update admin user email and password
-- Created: 2025-09-17

-- Update admin user email and password
UPDATE users 
SET 
    email = 'admin@gmail.com',
    password_hash = '$2a$10$a6o1ftxj.ojK687/Ey1CUea8Wzb0ZDQKtzYVVAaxiIXwSfRDm2QoS' -- password: admin
WHERE username = 'admin';