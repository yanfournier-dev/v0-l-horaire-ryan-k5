-- Fix the application_deadline column to use TIMESTAMPTZ for proper timezone handling
ALTER TABLE replacements 
ALTER COLUMN application_deadline TYPE TIMESTAMPTZ USING application_deadline AT TIME ZONE 'UTC';

-- Update comment to reflect that it's now timezone-aware
COMMENT ON COLUMN replacements.application_deadline IS 'Timestamp (with timezone) when applications close for this replacement';
