-- Add is_acting_captain column to shift_assignments table
ALTER TABLE shift_assignments
ADD COLUMN IF NOT EXISTS is_acting_captain BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_shift_assignments_acting_captain 
ON shift_assignments(shift_id, is_acting_captain) 
WHERE is_acting_captain = true;
