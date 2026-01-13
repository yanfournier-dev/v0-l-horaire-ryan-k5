-- Script to verify and set Michel Ruel as captain
-- This ensures he can see the full notification history like other admins

-- First, let's check Michel Ruel's current role
SELECT id, first_name, last_name, email, role 
FROM users 
WHERE email = 'michel.ruel@victoriaville.ca' 
OR last_name = 'Ruel';

-- Update Michel Ruel to captain role if not already set
UPDATE users 
SET role = 'captain'
WHERE (email = 'michel.ruel@victoriaville.ca' OR (first_name = 'Michel' AND last_name = 'Ruel'))
AND role != 'captain';

-- Verify the update
SELECT id, first_name, last_name, email, role 
FROM users 
WHERE email = 'michel.ruel@victoriaville.ca' 
OR (first_name = 'Michel' AND last_name = 'Ruel');
