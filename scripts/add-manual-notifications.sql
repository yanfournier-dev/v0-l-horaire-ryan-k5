-- Table pour stocker l'historique des notifications manuelles envoyées
CREATE TABLE IF NOT EXISTS manual_notifications (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  sent_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_ids INTEGER[] NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour rechercher rapidement les notifications envoyées par un admin
CREATE INDEX IF NOT EXISTS idx_manual_notifications_sent_by ON manual_notifications(sent_by);

-- Index pour rechercher rapidement les notifications par date
CREATE INDEX IF NOT EXISTS idx_manual_notifications_sent_at ON manual_notifications(sent_at DESC);

-- Commentaires pour documenter la table
COMMENT ON TABLE manual_notifications IS 'Historique des notifications manuelles envoyées par les administrateurs';
COMMENT ON COLUMN manual_notifications.message IS 'Contenu du message envoyé (max 500 caractères)';
COMMENT ON COLUMN manual_notifications.sent_by IS 'ID de l''administrateur qui a envoyé la notification';
COMMENT ON COLUMN manual_notifications.recipient_ids IS 'Array des IDs des pompiers qui ont reçu la notification';
COMMENT ON COLUMN manual_notifications.sent_at IS 'Date et heure d''envoi de la notification';
