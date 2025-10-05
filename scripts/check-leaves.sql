-- Check all leaves for Marc-André Dubois
SELECT 
  l.id,
  l.user_id,
  u.first_name,
  u.last_name,
  l.start_date,
  l.end_date,
  l.start_time,
  l.end_time,
  l.leave_type,
  l.status,
  l.created_at
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' 
  AND u.last_name = 'Dubois'
ORDER BY l.start_date DESC;

-- Check all leaves in October 2025
SELECT 
  l.id,
  l.user_id,
  u.first_name,
  u.last_name,
  l.start_date,
  l.end_date,
  l.start_time,
  l.end_time,
  l.leave_type,
  l.status
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE l.start_date >= '2025-10-01' 
  AND l.start_date <= '2025-10-31'
ORDER BY l.start_date, u.last_name;
