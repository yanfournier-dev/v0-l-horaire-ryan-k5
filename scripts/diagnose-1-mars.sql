-- Diagnostic pour le remplacement double du 1er mars 2026
-- D. Labbé remplacé par A. Boucher (R1) et F. Bédard (R2)

SELECT 
  sa.id as sa_id,
  sa.shift_id,
  u.first_name || ' ' || u.last_name as pompier,
  replaced.first_name || ' ' || replaced.last_name as personne_remplacee,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time as sa_start,
  sa.end_time as sa_end,
  sa.original_start_time,
  sa.original_end_time,
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
WHERE replaced.first_name = 'David' 
  AND replaced.last_name = 'Labbé'
  AND sa.is_direct_assignment = true
ORDER BY sa.shift_id DESC, sa.replacement_order ASC
LIMIT 20;
