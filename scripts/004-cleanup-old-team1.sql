-- Delete old "Équipe 1" team if it exists
-- This will also remove team members due to CASCADE constraints

DELETE FROM teams WHERE name = 'Équipe 1';
