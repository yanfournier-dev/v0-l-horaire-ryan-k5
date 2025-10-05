-- Vérifier tous les jours du cycle qui ont des quarts programmés
SELECT 
  cycle_day,
  COUNT(*) as shift_count,
  STRING_AGG(DISTINCT t.name, ', ') as teams,
  STRING_AGG(DISTINCT s.shift_type::text, ', ') as shift_types
FROM shifts s
JOIN teams t ON s.team_id = t.id
GROUP BY cycle_day
ORDER BY cycle_day;

-- Vérifier spécifiquement les jours 27, 28, et 1
SELECT 
  s.cycle_day,
  t.name as team_name,
  s.shift_type,
  s.start_time,
  s.end_time
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE s.cycle_day IN (27, 28, 1)
ORDER BY s.cycle_day, t.name;

-- Vérifier la configuration du cycle
SELECT * FROM cycle_config WHERE is_active = true;

-- Calculer quel jour du cycle correspond au 19 octobre 2025
WITH cycle_info AS (
  SELECT 
    start_date,
    cycle_length_days,
    DATE '2025-10-19' - start_date::date as days_diff
  FROM cycle_config
  WHERE is_active = true
)
SELECT 
  start_date,
  cycle_length_days,
  days_diff,
  (days_diff % cycle_length_days) + 1 as calculated_cycle_day
FROM cycle_info;
