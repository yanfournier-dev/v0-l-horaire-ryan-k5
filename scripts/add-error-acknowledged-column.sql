-- Add error_acknowledged column to notifications table
-- This column tracks whether an admin has acknowledged an error notification
-- Default to false (not yet acknowledged)

ALTER TABLE notifications
ADD COLUMN error_acknowledged BOOLEAN DEFAULT FALSE;

-- Add index for faster queries filtering by this column
CREATE INDEX idx_notifications_error_acknowledged 
ON notifications(error_acknowledged) 
WHERE channels_failed IS NOT NULL AND array_length(channels_failed, 1) > 0;
