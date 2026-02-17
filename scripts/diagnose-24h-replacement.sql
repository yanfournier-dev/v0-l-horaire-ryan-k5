-- Diagnostic pour vérifier l'état des remplacement 24h après ajout R2

-- Chercher les quarts 24h
SELECT id, shift_type, start_time, end_time
FROM shifts
WHERE start_time = end_time
LIMIT 5;

-- Pour chaque quart 24h, voir les shift_assignments (remplacement)
SELECT 
  sa.id,
  sa.shift_id,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time,
  sa.end_time,
  sa.is_partial,
  sa.replacement_order,
  sa.is_direct_assignment,
  u.first_name,
  u.last_name
FROM shift_assignments sa
LEFT JOIN users u ON sa.user_id = u.id
WHERE sa.shift_id IN (
  SELECT id FROM shifts WHERE start_time = end_time
)
ORDER BY sa.shift_id, sa.replacement_order;
