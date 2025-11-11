-- Fix timezone issue for replacements table
-- Convert created_at and updated_at from timestamp to timestamptz
-- Interpret existing timestamps as America/Toronto (EST/EDT) and convert to UTC

-- Add temporary columns with correct timezone type
ALTER TABLE replacements 
ADD COLUMN created_at_tz timestamptz,
ADD COLUMN updated_at_tz timestamptz;

-- Convert existing data: interpret as America/Toronto timezone and convert to UTC
UPDATE replacements
SET 
  created_at_tz = timezone('UTC', timezone('America/Toronto', created_at)),
  updated_at_tz = timezone('UTC', timezone('America/Toronto', updated_at));

-- Drop old columns
ALTER TABLE replacements
DROP COLUMN created_at,
DROP COLUMN updated_at;

-- Rename new columns to original names
ALTER TABLE replacements
RENAME COLUMN created_at_tz TO created_at;

ALTER TABLE replacements
RENAME COLUMN updated_at_tz TO updated_at;

-- Set defaults for future inserts (will automatically use UTC)
ALTER TABLE replacements
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- Make columns NOT NULL if they should be
ALTER TABLE replacements
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;
