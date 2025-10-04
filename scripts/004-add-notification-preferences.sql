-- Add notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification channels
  enable_app BOOLEAN DEFAULT true,
  enable_email BOOLEAN DEFAULT false,
  enable_sms BOOLEAN DEFAULT false,
  
  -- Notification types
  notify_replacement_available BOOLEAN DEFAULT true,
  notify_replacement_accepted BOOLEAN DEFAULT true,
  notify_replacement_rejected BOOLEAN DEFAULT true,
  notify_leave_approved BOOLEAN DEFAULT true,
  notify_leave_rejected BOOLEAN DEFAULT true,
  notify_schedule_change BOOLEAN DEFAULT true,
  notify_shift_reminder BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Insert default preferences for existing users
INSERT INTO notification_preferences (user_id, enable_app, enable_email, enable_sms)
SELECT id, true, false, false
FROM users
ON CONFLICT (user_id) DO NOTHING;
