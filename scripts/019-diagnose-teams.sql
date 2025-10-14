-- Check for duplicate teams
SELECT name, type, COUNT(*) as count
FROM teams
GROUP BY name, type
HAVING COUNT(*) > 1;

-- List all teams with their member counts
SELECT 
  t.id,
  t.name,
  t.type,
  t.capacity,
  COUNT(tm.user_id) as member_count
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
GROUP BY t.id, t.name, t.type, t.capacity
ORDER BY t.name;

-- Check team names that might match "Pompiers réguliers"
SELECT id, name, type, LENGTH(name) as name_length
FROM teams
WHERE name ILIKE '%pompier%' OR name ILIKE '%régulier%';

-- Check users who are members of multiple teams including "Pompiers réguliers"
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  STRING_AGG(t.name, ', ' ORDER BY t.name) as teams
FROM users u
JOIN team_members tm ON u.id = tm.user_id
JOIN teams t ON tm.team_id = t.id
GROUP BY u.id, u.first_name, u.last_name
HAVING COUNT(DISTINCT tm.team_id) > 1
  AND STRING_AGG(t.name, ', ') ILIKE '%pompier%régulier%'
ORDER BY u.last_name;
