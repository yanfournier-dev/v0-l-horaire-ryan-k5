-- Script pour ajouter le support des notifications Telegram
-- Date: 2026-01-08
-- Description: Ajoute les colonnes nécessaires pour les notifications Telegram

-- Étape 1: Ajouter les colonnes Telegram à la table notification_preferences
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS enable_telegram BOOLEAN DEFAULT false;

-- Étape 2: Créer la table pour gérer les codes de liaison Telegram
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code VARCHAR(10) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user_id ON telegram_link_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires_at ON telegram_link_codes(expires_at);

-- Commentaires pour documentation
COMMENT ON COLUMN notification_preferences.telegram_chat_id IS 'ID de chat Telegram unique pour envoyer les notifications';
COMMENT ON COLUMN notification_preferences.enable_telegram IS 'Indique si les notifications Telegram sont activées pour cet utilisateur';
COMMENT ON TABLE telegram_link_codes IS 'Codes temporaires pour lier un compte utilisateur à un compte Telegram';
