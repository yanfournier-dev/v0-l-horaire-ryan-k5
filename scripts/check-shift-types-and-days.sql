-- Vérifier tous les types de quarts qui existent
SELECT DISTINCT shift_type, COUNT(*) as count
FROM shifts
GROUP BY shift_type
ORDER BY shift_type;

-- Vérifier quels jours du cycle ont des quarts
SELECT cycle_day, COUNT(*) as shift_count, 
       STRING_AGG(DISTINCT shift_type, ', ') as shift_types,
       STRING_AGG(DISTINCT t.name, ', ') as teams
FROM shifts s
JOIN teams t ON s.team_id = t.id
GROUP BY cycle_day
ORDER BY cycle_day;

-- Vérifier spécifiquement le jour 28
SELECT s.*, t.name as team_name
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE cycle_day = 28;

-- Vérifier les équipes de David Bois
SELECT u.first_name, u.last_name, t.name as team_name, t.id as team_id
FROM users u
JOIN team_members tm ON u.id = tm.user_id
JOIN teams t ON tm.team_id = t.id
WHERE u.first_name = 'David' AND u.last_name = 'Bois';
