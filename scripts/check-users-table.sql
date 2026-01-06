-- Check if Michel Ruel (id: 13) and Yan Fournier (id: 20) exist in users table
SELECT id, first_name, last_name, email, role
FROM users
WHERE id IN (13, 20)
ORDER BY id;

-- Check all users with IDs between 10 and 25
SELECT id, first_name, last_name, email, role
FROM users
WHERE id BETWEEN 10 AND 25
ORDER BY id;

-- Count total users
SELECT COUNT(*) as total_users FROM users;

-- Show first 20 users
SELECT id, first_name, last_name, email, role
FROM users
ORDER BY id
LIMIT 20;
