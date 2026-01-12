-- Table pour suivre la livraison de chaque notification manuelle à chaque destinataire
CREATE TABLE IF NOT EXISTS manual_notification_deliveries (
  id SERIAL PRIMARY KEY,
  manual_notification_id INTEGER NOT NULL REFERENCES manual_notifications(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT, -- Nom complet pour l'historique
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('success', 'partial', 'failed', 'skipped')),
  channels_sent TEXT[] DEFAULT '{}', -- Canaux envoyés avec succès: 'in_app', 'email', 'telegram'
  channels_failed TEXT[] DEFAULT '{}', -- Canaux qui ont échoué
  error_message TEXT, -- Message d'erreur si applicable
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_manual_notification_deliveries_notification_id 
  ON manual_notification_deliveries(manual_notification_id);

CREATE INDEX IF NOT EXISTS idx_manual_notification_deliveries_user_id 
  ON manual_notification_deliveries(user_id);

CREATE INDEX IF NOT EXISTS idx_manual_notification_deliveries_status 
  ON manual_notification_deliveries(delivery_status);
