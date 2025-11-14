-- Add replacement_order column to shift_assignments table
-- This allows tracking of Remplaçant 1 and Remplaçant 2 for the same shift

-- Add the column (nullable, can be 1, 2, or NULL)
ALTER TABLE shift_assignments
ADD COLUMN IF NOT EXISTS replacement_order INTEGER;

-- Migrate existing replacements to be "Remplaçant 1"
-- Any assignment with a replaced_user_id is a replacement
UPDATE shift_assignments
SET replacement_order = 1
WHERE replaced_user_id IS NOT NULL
  AND replacement_order IS NULL;

-- Add a check constraint to ensure only values 1 or 2 are allowed
ALTER TABLE shift_assignments
ADD CONSTRAINT check_replacement_order 
CHECK (replacement_order IN (1, 2) OR replacement_order IS NULL);

-- Create an index for faster queries on replacement_order
CREATE INDEX IF NOT EXISTS idx_shift_assignments_replacement_order 
ON shift_assignments(replacement_order);
