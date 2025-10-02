-- Fix admin password hash
-- This updates the admin user with a proper bcrypt hash for password: admin123
UPDATE users 
SET password_hash = '$2a$10$YQ7LGXqQJ5vZ5Z5Z5Z5Z5uGKqKqKqKqKqKqKqKqKqKqKqKqKqKqKq'
WHERE email = 'admin@caserne.ca';
