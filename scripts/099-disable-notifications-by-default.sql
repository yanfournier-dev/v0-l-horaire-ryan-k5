-- Disable all notification types by default for all users except Yan Fournier
-- This reduces the number of notifications created and lets users opt-in

-- Update all existing users to have notifications disabled
UPDATE notification_preferences
SET 
  notify_replacement_available = false,
  notify_replacement_accepted = false,
  notify_replacement_rejected = false,
  notify_leave_approved = false,
  notify_leave_rejected = false,
  notify_schedule_change = false,
  notify_shift_reminder = false,
  notify_application_approved = false,
  notify_application_rejected = false,
  notify_replacement_created = false,
  notify_replacement_assigned = false,
  enable_email = false
WHERE user_id NOT IN (
  SELECT id FROM users WHERE email = 'yan.fournier@victoriaville.ca'
);

-- Keep Yan Fournier's notifications enabled
UPDATE notification_preferences
SET 
  notify_replacement_available = true,
  notify_replacement_accepted = true,
  notify_replacement_rejected = true,
  notify_leave_approved = true,
  notify_leave_rejected = true,
  notify_schedule_change = true,
  notify_shift_reminder = true,
  notify_application_approved = true,
  notify_application_rejected = true,
  notify_replacement_created = true,
  notify_replacement_assigned = true,
  enable_email = true
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'yan.fournier@victoriaville.ca'
);

-- Change defaults for future users (ALTER TABLE to change column defaults)
ALTER TABLE notification_preferences ALTER COLUMN notify_replacement_available SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_replacement_accepted SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_replacement_rejected SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_leave_approved SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_leave_rejected SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_schedule_change SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN notify_shift_reminder SET DEFAULT false;
ALTER TABLE notification_preferences ALTER COLUMN enable_email SET DEFAULT false;
