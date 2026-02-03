-- Fix for replacements with incorrect start_time and end_time
-- This corrects the previous script which hardcoded 07:00-17:00 for all shifts
-- Now we use the actual shift times based on shift_type

-- Fix replacements table: get times from shifts table based on shift_type
UPDATE replacements r
SET 
  start_time = CASE 
    WHEN r.shift_type = 'night' THEN '17:00'::time
    WHEN r.shift_type = 'day' THEN '07:00'::time
    WHEN r.shift_type = 'full_24h' THEN '00:00'::time
    ELSE '07:00'::time
  END,
  end_time = CASE 
    WHEN r.shift_type = 'night' THEN '07:00'::time
    WHEN r.shift_type = 'day' THEN '17:00'::time
    WHEN r.shift_type = 'full_24h' THEN '23:59'::time
    ELSE '17:00'::time
  END
WHERE 
  is_partial = false 
  AND (start_time IS NULL OR start_time IN ('07:00', '19:00'));

-- Fix shift_assignments table with same logic
UPDATE shift_assignments sa
SET 
  start_time = CASE 
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'night' THEN '17:00'::time
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'day' THEN '07:00'::time
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'full_24h' THEN '00:00'::time
    ELSE '07:00'::time
  END,
  end_time = CASE 
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'night' THEN '07:00'::time
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'day' THEN '17:00'::time
    WHEN (SELECT shift_type FROM shifts WHERE id = sa.shift_id) = 'full_24h' THEN '23:59'::time
    ELSE '17:00'::time
  END
WHERE 
  is_partial = false 
  AND (start_time IS NULL OR start_time IN ('07:00', '19:00'));

-- Verify the fix
SELECT 
  'replacements' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_partial = false AND shift_type = 'night' AND start_time = '17:00' THEN 1 END) as night_fixed,
  COUNT(CASE WHEN is_partial = false AND shift_type = 'day' AND start_time = '07:00' THEN 1 END) as day_fixed,
  COUNT(CASE WHEN is_partial = false AND shift_type = 'full_24h' AND start_time = '00:00' THEN 1 END) as full_24h_fixed
FROM replacements
UNION ALL
SELECT 
  'shift_assignments' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_partial = false AND (SELECT shift_type FROM shifts WHERE id = shift_id) = 'night' AND start_time = '17:00' THEN 1 END) as night_fixed,
  COUNT(CASE WHEN is_partial = false AND (SELECT shift_type FROM shifts WHERE id = shift_id) = 'day' AND start_time = '07:00' THEN 1 END) as day_fixed,
  COUNT(CASE WHEN is_partial = false AND (SELECT shift_type FROM shifts WHERE id = shift_id) = 'full_24h' AND start_time = '00:00' THEN 1 END) as full_24h_fixed
FROM shift_assignments;
