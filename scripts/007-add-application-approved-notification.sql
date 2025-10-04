-- Add missing notification preference for application_approved
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS notify_application_approved BOOLEAN DEFAULT true;

-- Update existing users to enable this notification by default
UPDATE notification_preferences 
SET notify_application_approved = true 
WHERE notify_application_approved IS NULL;
