-- Insert cycle configuration (starts August 24, 2025)
INSERT INTO cycle_config (start_date, cycle_length_days, is_active)
VALUES ('2025-08-24', 28, TRUE);

-- Create 4 permanent teams (8 members each)
INSERT INTO teams (name, type, capacity) VALUES
  ('Équipe Permanente 1', 'permanent', 8),
  ('Équipe Permanente 2', 'permanent', 8),
  ('Équipe Permanente 3', 'permanent', 8),
  ('Équipe Permanente 4', 'permanent', 8);

-- Create 4 part-time teams (4 members each)
INSERT INTO teams (name, type, capacity) VALUES
  ('Équipe Temps Partiel 1', 'part_time', 4),
  ('Équipe Temps Partiel 2', 'part_time', 4),
  ('Équipe Temps Partiel 3', 'part_time', 4),
  ('Équipe Temps Partiel 4', 'part_time', 4);

-- Create temporary team (8 members)
INSERT INTO teams (name, type, capacity) VALUES
  ('Pompiers Temporaires', 'temporary', 8);

-- Removed admin user creation - will be created by setup-admin.ts script
-- Note: Run the setup-admin.ts script to create the admin user with proper password hashing
