-- Convert applied_at column to timestamptz to always store in UTC
-- This fixes the issue where timestamps were being stored 5 hours ahead
ALTER TABLE replacement_applications 
ALTER COLUMN applied_at TYPE timestamptz 
USING applied_at AT TIME ZONE 'America/Toronto';

-- Convert existing timestamps: interpret them as EST/EDT and convert to UTC
-- This assumes all existing timestamps were recorded in Eastern Time
