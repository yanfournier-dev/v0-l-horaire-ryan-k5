-- Test the exact query used in getAllFirefighters()
SELECT id, first_name, last_name, email, role
FROM users
ORDER BY last_name, first_name;

-- Count total users
SELECT COUNT(*) as total_from_query FROM users;

-- Check if Michel Ruel and Yan Fournier are in the results
SELECT id, first_name, last_name, email, role
FROM users
WHERE id IN (13, 20)
ORDER BY id;
