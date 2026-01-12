-- Migration: Fix user_name column to be nullable
-- This fixes the NOT NULL constraint issue on manual_notification_deliveries

ALTER TABLE manual_notification_deliveries 
ALTER COLUMN user_name DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'manual_notification_deliveries' 
AND column_name = 'user_name';
