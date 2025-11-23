-- Add replacement_order column to replacements table
-- This allows us to distinguish between regular replacement requests (order 1)
-- and second replacement requests (order 2)

ALTER TABLE replacements 
ADD COLUMN IF NOT EXISTS replacement_order INTEGER DEFAULT 1;

-- Update existing records to have replacement_order = 1
UPDATE replacements 
SET replacement_order = 1 
WHERE replacement_order IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_replacements_order 
ON replacements(replacement_order);
