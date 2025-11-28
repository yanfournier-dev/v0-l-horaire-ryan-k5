-- Script pour ajouter les colonnes d'audit aux tables existantes
-- Exécuté le: [Date d'exécution]

-- Ajouter les colonnes d'audit à la table shift_assignments
ALTER TABLE shift_assignments
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS created_at_audit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at_audit TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Ajouter les colonnes d'audit à la table replacements
ALTER TABLE replacements
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_by_audit INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id);

-- Ajouter les colonnes d'audit à la table leaves
ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Ajouter les colonnes d'audit à la table replacement_applications
ALTER TABLE replacement_applications
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Ajouter les colonnes d'audit à la table shift_exchanges
ALTER TABLE shift_exchanges
  ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Créer un index pour améliorer les performances des requêtes d'audit
CREATE INDEX IF NOT EXISTS idx_shift_assignments_created_by ON shift_assignments(created_by);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_updated_by ON shift_assignments(updated_by);
CREATE INDEX IF NOT EXISTS idx_replacements_created_by ON replacements(created_by);
CREATE INDEX IF NOT EXISTS idx_leaves_created_by ON leaves(created_by);
