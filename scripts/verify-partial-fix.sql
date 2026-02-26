-- Diagnostic script to verify that original_start_time and original_end_time
-- are properly stored for partial replacements when adding second replacements

-- Find replacements with multiple assignments for Tommy Plouride on March 1st
SELECT 
  sa.id,
  sa.shift_id,
  sa.user_id,
  u.first_name,
  u.last_name,
  sa.replacement_order,
  sa.start_time,
  sa.end_time,
  sa.original_start_time,
  sa.original_end_time,
  sa.is_partial,
  s.shift_type,
  s.start_time as shift_start,
  s.end_time as shift_end,
  s.shift_date
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
JOIN shifts s ON sa.shift_id = s.id
WHERE sa.replaced_user_id = (SELECT id FROM users WHERE first_name = 'Tommy' AND last_name = 'Plouride' LIMIT 1)
  AND s.shift_date = '2026-03-01'::date
ORDER BY sa.shift_id, sa.replacement_order;
