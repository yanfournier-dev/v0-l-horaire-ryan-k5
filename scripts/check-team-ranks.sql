-- Check if team_rank values exist in team_members table
SELECT 
  tm.id,
  tm.user_id,
  tm.team_id,
  tm.team_rank,
  u.first_name || ' ' || u.last_name as name,
  u.role,
  t.name as team_name
FROM team_members tm
JOIN users u ON tm.user_id = u.id
JOIN teams t ON tm.team_id = t.id
ORDER BY t.name, tm.team_rank NULLS LAST
LIMIT 30;
