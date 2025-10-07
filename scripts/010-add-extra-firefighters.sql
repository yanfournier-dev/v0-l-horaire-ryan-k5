-- Add is_extra field to shift_assignments to track extra firefighters
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT FALSE;

-- Add index for better performance when querying extra firefighters
CREATE INDEX IF NOT EXISTS idx_shift_assignments_extra ON shift_assignments(shift_id, is_extra);
