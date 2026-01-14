-- Add is_owner column to users table
-- This allows designation of system owners with critical permissions
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false;

-- Add telegram_required column to users table  
-- Controls whether Telegram connection is mandatory for this user
ALTER TABLE users
ADD COLUMN IF NOT EXISTS telegram_required BOOLEAN DEFAULT true;

-- Set Yan Fournier as owner (update email if different)
UPDATE users 
SET is_owner = true 
WHERE email = 'yan.fournier@victoriaville.ca';

-- Add new audit action type for telegram requirement changes
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'telegram_requirement_changed';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner);
CREATE INDEX IF NOT EXISTS idx_users_telegram_required ON users(telegram_required);
