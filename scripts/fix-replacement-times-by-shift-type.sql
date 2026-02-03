-- Fix replacement times based on shift_type
-- This script sets the correct start_time and end_time for replacements
-- based on the shift_type from the shifts table

-- For replacements table
UPDATE replacements r
SET 
  start_time = CASE 
    WHEN s.shift_type = 'day' THEN '07:00:00'
    WHEN s.shift_type = 'night' THEN '17:00:00'
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'
    ELSE '07:00:00'
  END,
  end_time = CASE 
    WHEN s.shift_type = 'day' THEN '17:00:00'
    WHEN s.shift_type = 'night' THEN '07:00:00'
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'
    ELSE '17:00:00'
  END
FROM shifts s
WHERE r.shift_id = s.id
  AND (r.start_time IS NULL OR r.start_time = '07:00:00' OR r.start_time = '19:00:00')
  AND (r.end_time IS NULL OR r.end_time = '17:00:00');

-- For shift_assignments table (partial replacements)
UPDATE shift_assignments sa
SET 
  start_time = CASE 
    WHEN s.shift_type = 'day' THEN '07:00:00'
    WHEN s.shift_type = 'night' THEN '17:00:00'
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'
    ELSE '07:00:00'
  END,
  end_time = CASE 
    WHEN s.shift_type = 'day' THEN '17:00:00'
    WHEN s.shift_type = 'night' THEN '07:00:00'
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'
    ELSE '17:00:00'
  END
FROM shifts s
WHERE sa.shift_id = s.id
  AND sa.is_partial = TRUE
  AND (sa.start_time IS NULL OR sa.start_time = '07:00:00' OR sa.start_time = '19:00:00')
  AND (sa.end_time IS NULL OR sa.end_time = '17:00:00');
