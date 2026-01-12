-- Désactiver les notifications par email pour tous les utilisateurs
-- Ce script met enable_email à false pour garantir qu'aucun email ne sera envoyé

UPDATE notification_preferences 
SET enable_email = false 
WHERE enable_email = true;

-- Afficher le nombre d'utilisateurs modifiés
SELECT 
  COUNT(*) as users_updated,
  'Email notifications disabled for all users' as message
FROM notification_preferences 
WHERE enable_email = false;
