-- Diagnostic pour le remplacement double du 9 février 2026
-- Cherche TOUS les assignments pour shift 28 (incluant non-direct)

SELECT 
  sa.id as sa_id,
  sa.shift_id,
  u.first_name || ' ' || u.last_name as pompier,
  replaced.first_name || ' ' || replaced.last_name as personne_remplacee,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time as sa_start,
  sa.end_time as sa_end,
  sa.replacement_order,
  sa.is_partial,
  sa.is_direct_assignment,
  s.shift_type,
  s.start_time as shift_start,
  s.end_time as shift_end
FROM shift_assignments sa
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
LEFT JOIN shifts s ON sa.shift_id = s.id
WHERE sa.shift_id = 28
ORDER BY sa.replacement_order ASC, sa.id DESC;
