-- Vérifier si Marc-André Dubois existe
SELECT id, first_name, last_name, email 
FROM users 
WHERE first_name = 'Marc-André' AND last_name = 'Dubois';

-- Vérifier TOUS les congés de Marc-André Dubois (peu importe le statut)
SELECT l.*, u.first_name, u.last_name
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' AND u.last_name = 'Dubois'
ORDER BY l.start_date DESC;

-- Vérifier les congés approuvés en octobre 2025
SELECT l.*, u.first_name, u.last_name
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE l.status = 'approved'
  AND l.start_date >= '2025-10-01'
  AND l.start_date <= '2025-10-31'
ORDER BY l.start_date;
