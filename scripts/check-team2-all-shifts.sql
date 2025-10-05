-- Vérifier tous les quarts de l'Équipe Permanente 2
SELECT 
    s.id,
    s.cycle_day,
    s.shift_type,
    s.start_time,
    s.end_time,
    t.name as team_name
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE t.id = 2
ORDER BY s.cycle_day, s.shift_type;

-- Vérifier tous les types de quarts qui existent dans le système
SELECT DISTINCT shift_type 
FROM shifts 
ORDER BY shift_type;

-- Vérifier si le jour 28 a des quarts pour n'importe quelle équipe
SELECT 
    s.id,
    s.cycle_day,
    s.shift_type,
    t.name as team_name
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE s.cycle_day = 28
ORDER BY t.name, s.shift_type;
