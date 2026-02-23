-- Vérifier si on peut voir la trace du R2 (shift_id 37 pour David Labbé)
-- Si R2 a été supprimé, chercher tous les shift_assignments du shift 37

SELECT 
  id,
  shift_id,
  user_id,
  replaced_user_id,
  replacement_order,
  is_partial,
  is_direct_assignment,
  start_time,
  end_time,
  original_start_time,
  original_end_time
FROM shift_assignments
WHERE shift_id = 37
ORDER BY id DESC;
