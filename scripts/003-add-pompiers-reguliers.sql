-- Add the 10th team: "Pompiers Réguliers" with unlimited capacity
-- Using 999 as unlimited capacity since the database doesn't allow NULL
INSERT INTO teams (name, type, capacity, color) VALUES
  ('Pompiers Réguliers', 'permanent', 999, '#f59e0b')
ON CONFLICT (name) DO NOTHING;
