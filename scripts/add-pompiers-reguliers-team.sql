-- Add the "Pompiers Réguliers" team
INSERT INTO teams (name, type, capacity, color)
VALUES ('Pompiers Réguliers', 'permanent', 10, '#10b981')
ON CONFLICT (name) DO NOTHING;
