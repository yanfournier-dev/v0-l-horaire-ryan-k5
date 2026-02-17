-- Diagnostic pour le remplacement double du 9 février 2026
-- On cherche le jour 9 février 2026 pour vérifier la structure

SELECT 
  s.id as shift_id,
  s.shift_date,
  s.shift_type,
  s.start_time as shift_start,
  s.end_time as shift_end,
  sa.id as sa_id,
  u.first_name as pompier,
  replaced.first_name as personne_remplacee,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time as sa_start,
  sa.end_time as sa_end,
  sa.replacement_order,
  sa.is_partial
FROM shifts s
LEFT JOIN shift_assignments sa ON s.id = sa.shift_id
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
WHERE DATE(s.shift_date) = '2026-02-09'
  AND s.shift_type = 'Jour'
  AND sa.is_direct_assignment = true
ORDER BY s.id, sa.replacement_order ASC
LIMIT 50;
