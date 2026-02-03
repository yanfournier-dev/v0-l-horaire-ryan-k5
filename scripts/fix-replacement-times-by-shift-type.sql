-- Fix replacement times based on shift_type
-- The replacements table has shift_type directly, so we use it to set correct times

UPDATE replacements
SET 
  start_time = CASE 
    WHEN shift_type = 'day' THEN '07:00:00'::TIME
    WHEN shift_type = 'night' THEN '17:00:00'::TIME
    WHEN shift_type = 'full_24h' THEN '07:00:00'::TIME
    ELSE '07:00:00'::TIME
  END,
  end_time = CASE 
    WHEN shift_type = 'day' THEN '17:00:00'::TIME
    WHEN shift_type = 'night' THEN '07:00:00'::TIME
    WHEN shift_type = 'full_24h' THEN '07:00:00'::TIME
    ELSE '17:00:00'::TIME
  END,
  is_partial = FALSE
WHERE start_time IS NULL 
  OR start_time = '07:00:00' 
  OR start_time = '19:00:00';

-- For shift_assignments table (partial replacements)
-- Join with shifts table to get the shift_type
UPDATE shift_assignments sa
SET 
  start_time = CASE 
    WHEN s.shift_type = 'day' THEN '07:00:00'::TIME
    WHEN s.shift_type = 'night' THEN '17:00:00'::TIME
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'::TIME
    ELSE '07:00:00'::TIME
  END,
  end_time = CASE 
    WHEN s.shift_type = 'day' THEN '17:00:00'::TIME
    WHEN s.shift_type = 'night' THEN '07:00:00'::TIME
    WHEN s.shift_type = 'full_24h' THEN '07:00:00'::TIME
    ELSE '17:00:00'::TIME
  END,
  is_partial = FALSE
FROM shifts s
WHERE sa.shift_id = s.id
  AND (sa.start_time IS NULL 
    OR sa.start_time = '07:00:00' 
    OR sa.start_time = '19:00:00');
