-- Add team_rank column to team_members table
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS team_rank INTEGER;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_rank ON team_members(team_id, team_rank);
