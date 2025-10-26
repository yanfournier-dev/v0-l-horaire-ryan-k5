-- Add deadline columns to replacements table
ALTER TABLE replacements 
ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP,
ADD COLUMN IF NOT EXISTS deadline_duration INTEGER;

-- Add comment to explain the columns
COMMENT ON COLUMN replacements.application_deadline IS 'Timestamp when applications close for this replacement';
COMMENT ON COLUMN replacements.deadline_duration IS 'Duration in minutes for the application deadline (30s=0.5, 15min=15, 24h=1440)';
