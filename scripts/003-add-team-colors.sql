-- Add color column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS color VARCHAR(50);

-- Update team colors according to specifications
-- Team 1 = green, Team 2 = blue, Team 3 = yellow, Team 4 = red
UPDATE teams SET color = 'green' WHERE name = 'Équipe 1';
UPDATE teams SET color = 'blue' WHERE name = 'Équipe 2';
UPDATE teams SET color = 'yellow' WHERE name = 'Équipe 3';
UPDATE teams SET color = 'red' WHERE name = 'Équipe 4';

-- Set default colors for part-time teams
UPDATE teams SET color = 'gray' WHERE type = 'part_time';
UPDATE teams SET color = 'purple' WHERE type = 'temporary';
