-- Add partial replacement fields to shift_assignments table
ALTER TABLE shift_assignments
ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Add comment to explain the fields
COMMENT ON COLUMN shift_assignments.is_partial IS 'Indicates if this is a partial shift assignment';
COMMENT ON COLUMN shift_assignments.start_time IS 'Start time for partial assignments';
COMMENT ON COLUMN shift_assignments.end_time IS 'End time for partial assignments';
