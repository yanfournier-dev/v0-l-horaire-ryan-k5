-- Vérifier toutes les assignations avec désignations Lt/Cpt
SELECT 
  sa.id,
  sa.shift_id,
  sa.user_id,
  sa.shift_date,
  sa.is_acting_lieutenant,
  sa.is_acting_captain,
  u.first_name || ' ' || u.last_name as user_name,
  s.cycle_day,
  s.shift_type
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
LEFT JOIN shifts s ON sa.shift_id = s.id
WHERE sa.is_acting_lieutenant = true 
   OR sa.is_acting_captain = true
ORDER BY sa.shift_id, sa.user_id
LIMIT 20;
