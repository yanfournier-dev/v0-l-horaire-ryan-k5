-- Add a field to mark direct assignments (no replacement process)
ALTER TABLE shift_assignments
ADD COLUMN IF NOT EXISTS is_direct_assignment BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN shift_assignments.is_direct_assignment IS 'True if this is a direct assignment bypassing the replacement candidacy process';
