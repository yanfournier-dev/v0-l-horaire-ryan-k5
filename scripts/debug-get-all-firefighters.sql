-- Script pour déboguer pourquoi getAllFirefighters n'inclut pas les IDs 13 et 20

-- 1. Vérifier tous les utilisateurs
SELECT 
  id,
  first_name,
  last_name,
  role,
  email
FROM users
ORDER BY id;

-- 2. Compter combien il y en a
SELECT COUNT(*) as total_users FROM users;

-- 3. Vérifier spécifiquement les IDs 13 et 20
SELECT 
  id,
  first_name,
  last_name,
  role,
  email
FROM users
WHERE id IN (13, 20);

-- 4. Tester la requête exacte de getAllFirefighters
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone,
  u.role
FROM users u
ORDER BY u.last_name, u.first_name;

-- 5. Compter les résultats de cette requête
SELECT COUNT(*) as count_from_query
FROM users u;

-- 6. Vérifier s'il y a des utilisateurs qui seraient exclus
SELECT id, first_name, last_name, role
FROM users
WHERE id NOT IN (
  SELECT u.id FROM users u
);
