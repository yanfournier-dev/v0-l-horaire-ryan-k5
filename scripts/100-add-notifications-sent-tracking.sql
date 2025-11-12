-- Add notifications_sent_at column to track when notifications were manually sent for assigned replacements

ALTER TABLE replacements
ADD COLUMN IF NOT EXISTS notifications_sent_at TIMESTAMP;

COMMENT ON COLUMN replacements.notifications_sent_at IS 'Timestamp when assignment notifications (email/SMS) were manually sent to assigned firefighter';
