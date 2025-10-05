-- Vérifier si Marc-André Dubois existe et obtenir son ID
SELECT id, first_name, last_name, email 
FROM users 
WHERE first_name = 'Marc-André' AND last_name = 'Dubois';

-- Vérifier les congés existants pour Marc-André Dubois en octobre 2025
SELECT l.*, u.first_name, u.last_name
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' 
  AND u.last_name = 'Dubois'
  AND l.start_date >= '2025-10-01'
  AND l.end_date <= '2025-10-31';

-- Créer un congé partiel pour Marc-André Dubois le 24 octobre 2025
-- (Remplacer USER_ID par l'ID réel de Marc-André Dubois obtenu ci-dessus)
-- Exemple: congé partiel de 08:00 à 16:00
INSERT INTO leaves (
  user_id,
  start_date,
  end_date,
  leave_type,
  start_time,
  end_time,
  status,
  reason
)
SELECT 
  id,
  '2025-10-24',
  '2025-10-24',
  'personal',
  '08:00:00',
  '16:00:00',
  'approved',
  'Congé partiel - remplacé par Yannick Dargy'
FROM users
WHERE first_name = 'Marc-André' AND last_name = 'Dubois'
ON CONFLICT DO NOTHING;

-- Vérifier que le congé a été créé
SELECT l.*, u.first_name, u.last_name
FROM leaves l
JOIN users u ON l.user_id = u.id
WHERE u.first_name = 'Marc-André' 
  AND u.last_name = 'Dubois'
  AND l.start_date = '2025-10-24';
