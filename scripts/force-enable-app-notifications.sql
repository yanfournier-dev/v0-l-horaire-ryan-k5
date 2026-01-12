-- Force enable in-app notifications for ALL users
-- In-app notifications are mandatory

UPDATE notification_preferences
SET enable_app = true
WHERE enable_app = false OR enable_app IS NULL;

-- Log the update
SELECT 
  COUNT(*) as users_updated,
  'All users now have enable_app = true' as message
FROM notification_preferences
WHERE enable_app = true;
