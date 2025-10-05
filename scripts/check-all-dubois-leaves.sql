-- Vérifier tous les congés de Marc-André Dubois (tous statuts)
SELECT 
  l.id,
  l.user_id,
  l.start_date,
  l.end_date,
  l.leave_type,
  l.start_time,
  l.end_time,
  l.status,
  l.created_at,
  u.first_name,
  u.last_name
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' 
  AND u.last_name = 'Dubois'
ORDER BY l.start_date DESC;

-- Vérifier l'ID de Marc-André Dubois
SELECT id, first_name, last_name, email 
FROM users 
WHERE first_name = 'Marc-André' AND last_name = 'Dubois';

-- Vérifier tous les congés d'octobre 2025 (tous statuts)
SELECT 
  l.id,
  u.first_name,
  u.last_name,
  l.start_date,
  l.end_date,
  l.leave_type,
  l.start_time,
  l.end_time,
  l.status
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE l.start_date >= '2025-10-01' 
  AND l.start_date < '2025-11-01'
ORDER BY l.start_date, u.last_name;
