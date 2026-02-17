-- Diagnostic remplacement DOUBLE pour JOUR/NUIT
-- Cherche les shifts jour/nuit (7h-17h, 17h-7h) avec 2 remplacement directs

SELECT 
  s.id as shift_id,
  s.start_time as shift_start,
  s.end_time as shift_end,
  sa.id as sa_id,
  u.name as firefighter_name,
  replaced.name as replaced_name,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time as sa_start,
  sa.end_time as sa_end,
  sa.is_direct_assignment,
  sa.replacement_order,
  sa.is_partial
FROM shifts s
LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
WHERE s.id IN (
  -- Shifts jour/nuit avec 2 remplacement directs
  SELECT shift_id FROM shift_assignments 
  WHERE is_direct_assignment = true
  GROUP BY shift_id 
  HAVING COUNT(*) = 2
)
AND sa.is_direct_assignment = true
-- Exclure 24h (quand start = end)
AND NOT (s.start_time = s.end_time)
ORDER BY s.id, sa.replacement_order
LIMIT 20;
