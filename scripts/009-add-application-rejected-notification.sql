-- Add notification preference for rejected applications
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS notify_application_rejected BOOLEAN DEFAULT true;

-- Update existing preferences to enable rejected application notifications by default
UPDATE notification_preferences 
SET notify_application_rejected = true 
WHERE notify_application_rejected IS NULL;
