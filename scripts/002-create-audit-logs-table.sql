-- Script pour créer la table audit_logs
-- Exécuté le: [Date d'exécution]

CREATE TYPE audit_action_type AS ENUM (
  'ASSIGNMENT_CREATED',
  'ASSIGNMENT_DELETED',
  'SECOND_REPLACEMENT_ADDED',
  'REPLACEMENT_CREATED',
  'REPLACEMENT_APPROVED',
  'REPLACEMENT_REJECTED',
  'REPLACEMENT_ASSIGNED',
  'EXCHANGE_CREATED',
  'EXCHANGE_APPROVED',
  'EXCHANGE_REJECTED',
  'LEAVE_CREATED',
  'LEAVE_APPROVED',
  'LEAVE_REJECTED',
  'LEAVE_UPDATED',
  'LEAVE_DELETED'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action_type audit_action_type NOT NULL,
  table_name VARCHAR(100),
  record_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  description TEXT NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Fonction pour nettoyer automatiquement les logs de plus d'1 an
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Commentaire sur la table pour documentation
COMMENT ON TABLE audit_logs IS 'Table centrale pour tracer toutes les actions importantes dans l''application. Rétention: 1 an.';
