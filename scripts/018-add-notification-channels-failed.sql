-- Add column to track failed notification channels
ALTER TABLE replacements
ADD COLUMN IF NOT EXISTS notification_channels_failed jsonb DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN replacements.notification_channels_failed IS 'Array of failed notification channels (e.g. ["telegram"])';
