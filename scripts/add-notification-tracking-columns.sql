-- Migration: Add notification tracking columns to replacements table
-- Date: 2026-01-07
-- Purpose: Enable manual notification sending for replacement assignments

-- Add columns for tracking notification status and details
ALTER TABLE replacements 
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_sent_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notification_types_sent JSONB DEFAULT '[]'::jsonb;

-- Set all existing replacements as "notification not sent"
-- This ensures admins can manually send notifications for existing assignments
UPDATE replacements 
SET notification_sent = false 
WHERE notification_sent IS NULL;

-- Add comment to columns for documentation
COMMENT ON COLUMN replacements.notification_sent IS 'Indicates if notification has been manually sent to the firefighter';
COMMENT ON COLUMN replacements.notification_sent_at IS 'Timestamp (UTC) when notification was sent';
COMMENT ON COLUMN replacements.notification_sent_by IS 'User ID of admin who sent the notification';
COMMENT ON COLUMN replacements.notification_types_sent IS 'Array of notification types sent: ["email", "sms", "telegram"]';
