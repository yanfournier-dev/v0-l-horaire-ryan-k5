-- Vérifier qui est l'utilisateur avec id 69 et ses replacements pour le shift 37

SELECT 
  u.id,
  u.first_name,
  u.last_name,
  sa.id as sa_id,
  sa.shift_id,
  sa.replacement_order,
  replaced.first_name || ' ' || replaced.last_name as personne_remplacee,
  sa.start_time,
  sa.end_time,
  sa.is_direct_assignment,
  sa.replaced_user_id
FROM users u
LEFT JOIN shift_assignments sa ON u.id = sa.user_id
LEFT JOIN users replaced ON sa.replaced_user_id = replaced.id
WHERE u.id = 69
ORDER BY sa.shift_id, sa.replacement_order;
