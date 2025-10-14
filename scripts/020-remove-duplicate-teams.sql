-- Script to remove duplicate teams
-- This script identifies duplicate teams by name and removes the ones without members

-- First, let's see which teams are duplicated
SELECT name, COUNT(*) as count, array_agg(id ORDER BY id) as team_ids
FROM teams
GROUP BY name
HAVING COUNT(*) > 1;

-- For each duplicate team, keep the one with members (or the oldest one if none have members)
-- and delete the others

WITH duplicate_teams AS (
  SELECT 
    name,
    id,
    ROW_NUMBER() OVER (
      PARTITION BY name 
      ORDER BY 
        (SELECT COUNT(*) FROM team_members WHERE team_id = teams.id) DESC,
        id ASC
    ) as rn
  FROM teams
)
DELETE FROM teams
WHERE id IN (
  SELECT id 
  FROM duplicate_teams 
  WHERE rn > 1
);

-- Verify the result
SELECT name, COUNT(*) as count
FROM teams
GROUP BY name
ORDER BY name;
