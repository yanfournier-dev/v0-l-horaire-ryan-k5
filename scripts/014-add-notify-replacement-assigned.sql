-- Add missing notify_replacement_assigned column to notification_preferences table
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS notify_replacement_assigned BOOLEAN DEFAULT true;

-- Update existing rows to have the default value
UPDATE notification_preferences
SET notify_replacement_assigned = true
WHERE notify_replacement_assigned IS NULL;
