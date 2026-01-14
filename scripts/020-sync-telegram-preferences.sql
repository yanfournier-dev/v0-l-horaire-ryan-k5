-- Synchronize telegram preferences with telegram_required status
-- When telegram_required is true, enable_telegram must also be true

UPDATE notification_preferences 
SET enable_telegram = true
FROM users 
WHERE notification_preferences.user_id = users.id 
  AND users.telegram_required = true 
  AND notification_preferences.enable_telegram = false;
