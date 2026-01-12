-- Migration: Add delivery tracking columns to notifications table
-- This allows tracking delivery status for ALL notifications (manual, replacements, etc.)

-- Add delivery tracking columns
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS delivery_status TEXT,
ADD COLUMN IF NOT EXISTS channels_sent TEXT[],
ADD COLUMN IF NOT EXISTS channels_failed TEXT[],
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS sent_by INTEGER REFERENCES users(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_by ON notifications(sent_by);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN notifications.delivery_status IS 'Status: success, partial, failed, skipped';
COMMENT ON COLUMN notifications.channels_sent IS 'Array of successful channels: in_app, email, telegram';
COMMENT ON COLUMN notifications.channels_failed IS 'Array of failed channels';
COMMENT ON COLUMN notifications.error_message IS 'Error details if delivery failed';
COMMENT ON COLUMN notifications.sent_by IS 'User ID who sent the notification (for manual messages)';
