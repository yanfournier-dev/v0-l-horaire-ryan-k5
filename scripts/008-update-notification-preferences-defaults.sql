-- Update existing notification preferences to enable application_approved notifications by default
UPDATE notification_preferences
SET notify_application_approved = true
WHERE notify_application_approved IS NULL;

-- Also ensure all other notification types are enabled by default if NULL
UPDATE notification_preferences
SET 
  notify_leave_approved = COALESCE(notify_leave_approved, true),
  notify_leave_rejected = COALESCE(notify_leave_rejected, true),
  notify_replacement_available = COALESCE(notify_replacement_available, true),
  notify_replacement_assigned = COALESCE(notify_replacement_assigned, true),
  notify_application_approved = COALESCE(notify_application_approved, true),
  notify_application_rejected = COALESCE(notify_application_rejected, true),
  notify_shift_reminder = COALESCE(notify_shift_reminder, true);
