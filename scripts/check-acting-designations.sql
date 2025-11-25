-- Diagnostic: Vérifier toutes les désignations Lt/Cpt intérimaires
SELECT 
    sa.id,
    sa.shift_date,
    sa.shift_id,
    sa.user_id,
    u.first_name || ' ' || u.last_name as firefighter_name,
    sa.is_acting_lieutenant,
    sa.is_acting_captain,
    s.shift_type,
    s.team_id,
    t.name as team_name
FROM shift_assignments sa
JOIN users u ON sa.user_id = u.id
JOIN shifts s ON sa.shift_id = s.id
JOIN teams t ON s.team_id = t.id
WHERE sa.shift_date >= '2025-11-01' 
  AND sa.shift_date <= '2025-12-31'
  AND (sa.is_acting_lieutenant = true OR sa.is_acting_captain = true)
ORDER BY sa.shift_date, s.shift_type, t.name;
