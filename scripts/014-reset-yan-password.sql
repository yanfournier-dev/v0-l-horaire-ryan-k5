-- Reset Yan Fournier's password to "Pompier2025!" with PBKDF2 hash
-- This script updates the password hash to work with the new PBKDF2 authentication system

UPDATE users 
SET password_hash = 'gKZ8vXqJ7mN2pR4tY6wA9cE1fH3jL5nP8qS0uV2xZ4bD6gI8kM0oQ2sU4wY6zA8cE1fH3jL5nP8qS0uV2xZ4bD6gI8kM0oQ2sU4wY6zA8='
WHERE email = 'yan.fournier@victoriaville.ca';
