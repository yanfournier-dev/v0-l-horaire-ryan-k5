-- Update deadline_duration column to store duration in seconds instead of minutes
-- This allows for more precise durations like 30 seconds

-- Add a comment to document that the column stores seconds
COMMENT ON COLUMN replacements.deadline_duration IS 'Duration in seconds for the application deadline (e.g., 30 for 30 seconds, 900 for 15 minutes, 86400 for 24 hours)';

-- No schema change needed, just documentation
-- The column is already INTEGER which is perfect for storing seconds
