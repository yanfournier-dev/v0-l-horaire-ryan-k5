-- Add is_acting_lieutenant column to shift_assignments table
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS is_acting_lieutenant BOOLEAN DEFAULT FALSE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shift_assignments_acting_lieutenant ON shift_assignments(shift_id, is_acting_lieutenant) WHERE is_acting_lieutenant = TRUE;

-- Add comment to explain the column
COMMENT ON COLUMN shift_assignments.is_acting_lieutenant IS 'Indicates if this firefighter is acting as lieutenant for this shift (used when a lieutenant is replaced)';
