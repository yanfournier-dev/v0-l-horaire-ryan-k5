-- Script pour debugger les assignations directes
-- Vérifier si l'assignation de Boucher existe pour remplacer Michaud

-- 1. Trouver le shift_id pour le 15 novembre 2025
SELECT 
  s.id as shift_id,
  s.cycle_day,
  s.shift_type,
  t.name as team_name
FROM shifts s
JOIN teams t ON s.team_id = t.id
WHERE t.name = 'Équipe Permanente 2'
  AND s.shift_type = 'day'
  AND s.cycle_day = 6;

-- 2. Trouver les IDs des pompiers
SELECT id, first_name, last_name, email
FROM users
WHERE last_name LIKE '%Michaud%' OR last_name LIKE '%Boucher%'
ORDER BY last_name;

-- 3. Vérifier les assignations directes existantes pour le shift 28
SELECT 
  sa.id,
  sa.shift_id,
  sa.user_id as assigned_user_id,
  u_assigned.first_name || ' ' || u_assigned.last_name as assigned_firefighter,
  sa.replaced_user_id,
  u_replaced.first_name || ' ' || u_replaced.last_name as replaced_firefighter,
  sa.is_direct_assignment,
  sa.is_extra,
  sa.assigned_at
FROM shift_assignments sa
LEFT JOIN users u_assigned ON sa.user_id = u_assigned.id
LEFT JOIN users u_replaced ON sa.replaced_user_id = u_replaced.id
WHERE sa.shift_id = 28
  AND sa.is_direct_assignment = true
ORDER BY sa.assigned_at DESC;

-- 4. Vérifier tous les membres de l'équipe 2
SELECT 
  tm.user_id,
  u.first_name || ' ' || u.last_name as firefighter,
  u.role
FROM team_members tm
JOIN users u ON tm.user_id = u.id
JOIN teams t ON tm.team_id = t.id
WHERE t.name = 'Équipe Permanente 2'
ORDER BY 
  CASE u.role 
    WHEN 'captain' THEN 1 
    WHEN 'lieutenant' THEN 2 
    ELSE 3 
  END,
  u.last_name;
