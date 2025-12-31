-- Ajouter les colonnes de banques de congé à la table replacements
-- Ces colonnes sont optionnelles (NULL par défaut)

ALTER TABLE replacements 
ADD COLUMN IF NOT EXISTS leave_bank_1 VARCHAR(50),
ADD COLUMN IF NOT EXISTS leave_hours_1 NUMERIC(4,1),
ADD COLUMN IF NOT EXISTS leave_bank_2 VARCHAR(50),
ADD COLUMN IF NOT EXISTS leave_hours_2 NUMERIC(4,1);

-- Commentaires pour documentation
COMMENT ON COLUMN replacements.leave_bank_1 IS 'Première banque de congé (Vacances, Maladie, etc.)';
COMMENT ON COLUMN replacements.leave_hours_1 IS 'Nombre d''heures pour la première banque (optionnel)';
COMMENT ON COLUMN replacements.leave_bank_2 IS 'Deuxième banque de congé (optionnel)';
COMMENT ON COLUMN replacements.leave_hours_2 IS 'Nombre d''heures pour la deuxième banque (optionnel)';
