-- Allow NULL values for password_hash to enable passwordless login during testing
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Set all existing passwords to NULL for easy testing
UPDATE users SET password_hash = NULL;
