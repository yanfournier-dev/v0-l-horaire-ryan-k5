-- Delete existing admin user if exists
DELETE FROM users WHERE email = 'admin@caserne.ca';

-- Create admin user with a temporary password
-- Note: The password will be set by running the Node.js setup script
-- This is just a placeholder that will be updated
INSERT INTO users (email, password_hash, first_name, last_name, role, is_admin)
VALUES ('admin@caserne.ca', 'PLACEHOLDER', 'Admin', 'Système', 'captain', TRUE);
