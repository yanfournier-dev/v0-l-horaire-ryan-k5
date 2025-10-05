-- Vérifier les informations de David Bois
SELECT id, first_name, last_name, team_id
FROM users
WHERE first_name = 'David' AND last_name = 'Bois';

-- Vérifier les quarts assignés à David Bois
SELECT 
  sa.id,
  sa.user_id,
  sa.shift_id,
  s.shift_type,
  s.cycle_day,
  s.start_time,
  s.end_time,
  u.first_name,
  u.last_name
FROM shift_assignments sa
JOIN shifts s ON sa.shift_id = s.id
JOIN users u ON sa.user_id = u.id
WHERE u.first_name = 'David' AND u.last_name = 'Bois'
ORDER BY s.cycle_day, s.shift_type;

-- Vérifier la configuration du cycle
SELECT * FROM cycle_config WHERE is_active = true;

-- Calculer quel jour du cycle correspond au 19 octobre 2025
-- Start date: 2025-08-24, Target: 2025-10-19
-- Days diff: 55 days
-- Cycle day: (55 % 28) + 1 = 28 (si on compte à partir de 1)
-- Ou: 55 % 28 = 27 (si on compte à partir de 0)
SELECT 
  '2025-08-24'::date as start_date,
  '2025-10-19'::date as target_date,
  ('2025-10-19'::date - '2025-08-24'::date) as days_diff,
  (('2025-10-19'::date - '2025-08-24'::date) % 28) as cycle_day_zero_based,
  ((('2025-10-19'::date - '2025-08-24'::date) % 28) + 1) as cycle_day_one_based;
