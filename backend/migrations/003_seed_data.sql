-- Migration: 003_seed_data
-- Description: Insert default roles and admin user
-- Created: 2025-09-15

-- Insert default roles
INSERT INTO roles (id, name, description) VALUES 
    (uuid_generate_v4(), 'admin', 'System administrator with full access'),
    (uuid_generate_v4(), 'user', 'Regular user with standard file operations');

-- Insert default admin user (password: admin123 - should be changed in production)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (
    id, 
    username, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    storage_quota, 
    is_active, 
    email_verified
) VALUES (
    uuid_generate_v4(),
    'admin',
    'admin@gmail.com',
    '$2a$10$a6o1ftxj.ojK687/Ey1CUea8Wzb0ZDQKtzYVVAaxiIXwSfRDm2QoS', -- admin
    'System',
    'Administrator',
    1073741824, -- 1GB quota for admin
    true,
    true
);

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'admin' AND r.name = 'admin';

-- Create triggers for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update file hash reference count
CREATE OR REPLACE FUNCTION update_file_hash_ref_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE file_hashes 
        SET reference_count = reference_count + 1 
        WHERE id = NEW.file_hash_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE file_hashes 
        SET reference_count = reference_count - 1 
        WHERE id = OLD.file_hash_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply reference count trigger
CREATE TRIGGER update_file_hash_references 
    AFTER INSERT OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_file_hash_ref_count();

-- Create function to update user storage usage
CREATE OR REPLACE FUNCTION update_user_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE users 
        SET storage_used = storage_used + NEW.size 
        WHERE id = NEW.owner_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE users 
        SET storage_used = storage_used - OLD.size 
        WHERE id = OLD.owner_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle ownership changes
        IF OLD.owner_id != NEW.owner_id THEN
            UPDATE users 
            SET storage_used = storage_used - OLD.size 
            WHERE id = OLD.owner_id;
            
            UPDATE users 
            SET storage_used = storage_used + NEW.size 
            WHERE id = NEW.owner_id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply storage usage trigger
CREATE TRIGGER update_user_storage 
    AFTER INSERT OR UPDATE OR DELETE ON files
    FOR EACH ROW EXECUTE FUNCTION update_user_storage_usage();