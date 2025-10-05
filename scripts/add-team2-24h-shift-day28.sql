-- Ajouter le quart de 24h manquant pour l'Équipe Permanente 2 au jour 28 du cycle
-- Ce quart permettra à David Bois de créer des demandes de remplacement pour le 19 octobre 2025

INSERT INTO shifts (team_id, shift_type, cycle_day, start_time, end_time)
VALUES (
  2,           -- Équipe Permanente 2
  '24h',       -- Type de quart de 24 heures
  28,          -- Jour 28 du cycle (19 octobre 2025)
  '07:00:00',  -- Début à 7h du matin
  '07:00:00'   -- Fin à 7h le lendemain matin
)
ON CONFLICT DO NOTHING;

-- Vérifier que le quart a été ajouté
SELECT 
  s.id,
  t.name as team_name,
  s.shift_type,
  s.cycle_day,
  s.start_time,
  s.end_time
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE s.team_id = 2 AND s.cycle_day = 28;
