-- Script to enable email notifications for specific users (e.g., administrators)
-- Replace the email addresses with the actual admin emails

-- Enable email for administrators
UPDATE notification_preferences np
SET enable_email = true
FROM users u
WHERE np.user_id = u.id
  AND u.email IN (
    'yan.fournier@victoriaville.ca'
    -- Add more admin emails here if needed
    -- , 'another.admin@victoriaville.ca'
  );

-- If the admin doesn't have preferences yet, create them
INSERT INTO notification_preferences (
  user_id,
  enable_app,
  enable_email,
  notify_replacement_available,
  notify_replacement_accepted,
  notify_replacement_rejected,
  notify_leave_approved,
  notify_leave_rejected,
  notify_schedule_change,
  notify_shift_reminder,
  notify_application_approved,
  notify_application_rejected
)
SELECT 
  u.id,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true
FROM users u
WHERE u.email IN (
  'yan.fournier@victoriaville.ca'
  -- Add more admin emails here if needed
  -- , 'another.admin@victoriaville.ca'
)
AND NOT EXISTS (
  SELECT 1 FROM notification_preferences np WHERE np.user_id = u.id
);
