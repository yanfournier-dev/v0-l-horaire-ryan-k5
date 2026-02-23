-- Diagnostic détaillé pour le 1er mars - remplacement de David Labbé
-- Cherche Adan Boucher comme remplaçant pour trouver le bon shift

SELECT 
  sa.id as sa_id,
  sa.shift_id,
  s.shift_type,
  s.start_time as shift_start,
  s.end_time as shift_end,
  u.first_name || ' ' || u.last_name as pompier,
  replaced.first_name || ' ' || replaced.last_name as personne_remplacee,
  sa.user_id,
  sa.replaced_user_id,
  sa.start_time as sa_start,
  sa.end_time as sa_end,
  sa.replacement_order,
  sa.is_partial,
  sa.is_direct_assignment,
  sa.original_start_time,
  sa.original_end_time,
  sa.created_at,
  sa.updated_at
FROM shift_assignments sa
LEFT JOIN users u ON sa.user_id = u.id
LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
LEFT JOIN shifts s ON sa.shift_id = s.id
WHERE replaced.first_name = 'David' 
  AND replaced.last_name = 'Labbé'
  AND sa.created_at >= '2026-03-01'::date
  AND sa.created_at < '2026-03-02'::date
ORDER BY sa.shift_id, sa.replacement_order ASC, sa.id DESC;
