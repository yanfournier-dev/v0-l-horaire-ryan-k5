-- Make Michel Ruel an administrator
UPDATE users 
SET is_admin = true 
WHERE email = 'michel.ruel@victoriaville.ca';
