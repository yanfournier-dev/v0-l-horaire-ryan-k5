-- Fix for replacements with NULL start_time and end_time for full shift replacements
-- This addresses the bug where "Quart complet" replacements had NULL times instead of shift times

-- First, identify and fix replacements with is_partial = false but NULL times
UPDATE replacements
SET 
  start_time = COALESCE(start_time, '07:00'),
  end_time = COALESCE(end_time, '17:00')
WHERE 
  is_partial = false 
  AND (start_time IS NULL OR end_time IS NULL)
  AND shift_date >= '2025-01-20';

-- Verify the fix by showing updated records
SELECT 
  id, 
  shift_date, 
  shift_type, 
  is_partial, 
  start_time, 
  end_time,
  status
FROM replacements
WHERE 
  is_partial = false 
  AND shift_date >= '2025-01-20'
ORDER BY shift_date DESC
LIMIT 10;
