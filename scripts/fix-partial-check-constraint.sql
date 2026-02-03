-- Fix the check_partial_times constraint to allow full replacements to have times
-- This prevents the bug where full replacements have NULL times causing adjustment failures

-- First, drop the old constraint
ALTER TABLE replacements
DROP CONSTRAINT check_partial_times;

-- Add the new constraint that allows both cases:
-- 1. Partial replacements MUST have start_time and end_time
-- 2. Full replacements CAN have times (for adjustment logic to work correctly)
ALTER TABLE replacements
ADD CONSTRAINT check_partial_times CHECK (
  (is_partial = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL) OR
  (is_partial = FALSE)
);

-- Now fix all existing full replacements (is_partial = FALSE) that have NULL times
-- Set them to default shift hours (07:00 - 17:00 for 'day', specific times for other shifts)
UPDATE replacements
SET 
  start_time = CASE 
    WHEN shift_type = 'day' THEN '07:00:00'::time
    WHEN shift_type = 'night' THEN '19:00:00'::time
    WHEN shift_type = 'full_24h' THEN '07:00:00'::time
    ELSE '07:00:00'::time
  END,
  end_time = CASE 
    WHEN shift_type = 'day' THEN '17:00:00'::time
    WHEN shift_type = 'night' THEN '07:00:00'::time
    WHEN shift_type = 'full_24h' THEN '07:00:00'::time
    ELSE '17:00:00'::time
  END
WHERE is_partial = FALSE AND (start_time IS NULL OR end_time IS NULL);

-- Verify the fix
SELECT 
  id, shift_date, shift_type, is_partial, 
  start_time, end_time, status
FROM replacements
WHERE shift_date = '2025-01-21' OR (is_partial = FALSE AND (start_time IS NULL OR end_time IS NULL))
ORDER BY shift_date DESC, created_at DESC;
