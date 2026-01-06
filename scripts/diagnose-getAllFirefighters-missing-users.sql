-- Test la requête exacte utilisée par getAllFirefighters
SELECT 
  id, 
  first_name, 
  last_name, 
  email, 
  phone, 
  role
FROM users
ORDER BY last_name, first_name;

-- Compte le nombre total
SELECT COUNT(*) as total_users FROM users;

-- Vérifie spécifiquement Michel Ruel et Yan Fournier
SELECT id, first_name, last_name, email, role 
FROM users 
WHERE id IN (13, 20);

-- Liste TOUS les IDs pour voir s'il y a des manquants
SELECT id FROM users ORDER BY id;
