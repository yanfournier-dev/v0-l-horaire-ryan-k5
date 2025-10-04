-- Make Yan Fournier an administrator
UPDATE users
SET is_admin = true
WHERE first_name = 'Yan' AND last_name = 'Fournier';
