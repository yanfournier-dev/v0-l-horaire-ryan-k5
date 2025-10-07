-- Allow NULL user_id in replacements table for "extra firefighter" requests
ALTER TABLE replacements ALTER COLUMN user_id DROP NOT NULL;
