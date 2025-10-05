-- Diagnostic complet pour comprendre le problème

-- 1. Vérifier la configuration du cycle
SELECT 
  'Cycle Configuration' as info,
  cycle_start_date,
  cycle_length_days,
  DATE_PART('day', '2025-10-19'::date - cycle_start_date::date) as days_diff,
  (DATE_PART('day', '2025-10-19'::date - cycle_start_date::date)::int % cycle_length_days) + 1 as calculated_cycle_day
FROM cycle_config
LIMIT 1;

-- 2. Vérifier David Bois et ses équipes
SELECT 
  'David Bois Teams' as info,
  u.id as user_id,
  u.first_name,
  u.last_name,
  array_agg(tm.team_id) as team_ids
FROM users u
LEFT JOIN team_members tm ON u.id = tm.user_id
WHERE u.first_name = 'David' AND u.last_name = 'Bois'
GROUP BY u.id, u.first_name, u.last_name;

-- 3. Lister TOUS les quarts pour les équipes de David Bois
SELECT 
  'All Shifts for David Bois Teams' as info,
  s.id,
  s.team_id,
  t.name as team_name,
  s.cycle_day,
  s.shift_type,
  s.start_time,
  s.end_time
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE s.team_id IN (
  SELECT tm.team_id 
  FROM users u
  JOIN team_members tm ON u.id = tm.user_id
  WHERE u.first_name = 'David' AND u.last_name = 'Bois'
)
ORDER BY s.cycle_day, s.shift_type;

-- 4. Vérifier s'il y a des quarts au jour 28 du cycle
SELECT 
  'Shifts on Cycle Day 28' as info,
  s.id,
  s.team_id,
  t.name as team_name,
  s.cycle_day,
  s.shift_type,
  s.start_time,
  s.end_time
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE s.cycle_day = 28
ORDER BY s.team_id, s.shift_type;

-- 5. Vérifier s'il y a des quarts aux jours 27, 28, 1 du cycle
SELECT 
  'Shifts on Cycle Days 27, 28, 1' as info,
  s.cycle_day,
  COUNT(*) as shift_count,
  array_agg(DISTINCT s.team_id) as team_ids
FROM shifts s
WHERE s.cycle_day IN (27, 28, 1)
GROUP BY s.cycle_day
ORDER BY s.cycle_day;
