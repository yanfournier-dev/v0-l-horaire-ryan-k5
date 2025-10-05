-- Find David Bois
SELECT 'David Bois User Info:' as info;
SELECT id, first_name, last_name, email, role 
FROM users 
WHERE first_name = 'David' AND last_name = 'Bois';

-- Get cycle config
SELECT 'Cycle Configuration:' as info;
SELECT * FROM cycle_config WHERE is_active = true;

-- Calculate cycle day for October 19, 2025
SELECT 'Cycle Day Calculation for 2025-10-19:' as info;
SELECT 
  start_date,
  '2025-10-19'::date as target_date,
  ('2025-10-19'::date - start_date::date) as days_diff,
  (('2025-10-19'::date - start_date::date) % cycle_length_days) as cycle_day_zero_based,
  (('2025-10-19'::date - start_date::date) % cycle_length_days) + 1 as cycle_day_one_based
FROM cycle_config 
WHERE is_active = true;

-- Get all shifts assigned to David Bois
SELECT 'All Shifts Assigned to David Bois:' as info;
SELECT 
  s.id as shift_id,
  s.cycle_day,
  s.shift_type,
  t.name as team_name,
  s.start_time,
  s.end_time
FROM shift_assignments sa
JOIN shifts s ON sa.shift_id = s.id
JOIN teams t ON s.team_id = t.id
JOIN users u ON sa.user_id = u.id
WHERE u.first_name = 'David' AND u.last_name = 'Bois'
ORDER BY s.cycle_day, s.shift_type;

-- Check if David Bois is assigned to cycle day 28
SELECT 'David Bois Shifts on Cycle Day 28:' as info;
SELECT 
  s.id as shift_id,
  s.cycle_day,
  s.shift_type,
  t.name as team_name,
  s.start_time,
  s.end_time
FROM shift_assignments sa
JOIN shifts s ON sa.shift_id = s.id
JOIN teams t ON s.team_id = t.id
JOIN users u ON sa.user_id = u.id
WHERE u.first_name = 'David' 
  AND u.last_name = 'Bois'
  AND s.cycle_day = 28;

-- Check if David Bois is assigned to cycle day 27 (in case calculation is off by one)
SELECT 'David Bois Shifts on Cycle Day 27:' as info;
SELECT 
  s.id as shift_id,
  s.cycle_day,
  s.shift_type,
  t.name as team_name,
  s.start_time,
  s.end_time
FROM shift_assignments sa
JOIN shifts s ON sa.shift_id = s.id
JOIN teams t ON s.team_id = t.id
JOIN users u ON sa.user_id = u.id
WHERE u.first_name = 'David' 
  AND u.last_name = 'Bois'
  AND s.cycle_day = 27;
