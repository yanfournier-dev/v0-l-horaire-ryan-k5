-- Add shift_assignments table to track which 8 firefighters are assigned to each shift
CREATE TABLE IF NOT EXISTS shift_assignments (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shift_id, user_id)
);

-- Add time fields for partial leaves
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS end_time TIME;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user ON shift_assignments(user_id);
