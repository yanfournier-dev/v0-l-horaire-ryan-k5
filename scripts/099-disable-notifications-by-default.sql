-- Disable all notification types by default for all users except Yan Fournier
-- This reduces the number of notifications created and lets users opt-in

-- Update all existing users to have all notification preferences disabled
UPDATE notification_preferences
SET 
  notify_replacement_available = false,
  notify_replacement_accepted = false,
  notify_replacement_assigned = false,
  notify_replacement_rejected = false,
  notify_application_approved = false,
  notify_application_rejected = false,
  notify_leave_approved = false,
  notify_leave_rejected = false,
  notify_shift_reminder = false,
  notify_schedule_change = false,
  enable_app = true,  -- Keep app notifications enabled
  enable_email = false,
  enable_sms = false
WHERE user_id NOT IN (
  SELECT id FROM users WHERE email = 'yanfournier12@hotmail.com'
);

-- Change defaults for future users to have all notifications disabled
ALTER TABLE notification_preferences 
  ALTER COLUMN notify_replacement_available SET DEFAULT false,
  ALTER COLUMN notify_replacement_accepted SET DEFAULT false,
  ALTER COLUMN notify_replacement_assigned SET DEFAULT false,
  ALTER COLUMN notify_replacement_rejected SET DEFAULT false,
  ALTER COLUMN notify_application_approved SET DEFAULT false,
  ALTER COLUMN notify_application_rejected SET DEFAULT false,
  ALTER COLUMN notify_leave_approved SET DEFAULT false,
  ALTER COLUMN notify_leave_rejected SET DEFAULT false,
  ALTER COLUMN notify_shift_reminder SET DEFAULT false,
  ALTER COLUMN notify_schedule_change SET DEFAULT false,
  ALTER COLUMN enable_app SET DEFAULT true,
  ALTER COLUMN enable_email SET DEFAULT false,
  ALTER COLUMN enable_sms SET DEFAULT false;
