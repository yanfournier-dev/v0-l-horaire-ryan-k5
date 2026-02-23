-- Migration: Add original_start_time and original_end_time columns to shift_assignments
-- This allows storing the original hours of R1 before they are modified when adding R2
-- Used for 24h shift double replacements to properly restore R1 when R2 is removed

ALTER TABLE shift_assignments 
ADD COLUMN original_start_time TIME,
ADD COLUMN original_end_time TIME;

-- Add comments for documentation
COMMENT ON COLUMN shift_assignments.original_start_time IS 'Original start time of R1 before modification (used for 24h shift double replacements)';
COMMENT ON COLUMN shift_assignments.original_end_time IS 'Original end time of R1 before modification (used for 24h shift double replacements)';
