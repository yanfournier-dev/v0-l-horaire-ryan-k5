-- Add a field to store which user is being replaced in direct assignments
ALTER TABLE shift_assignments
ADD COLUMN IF NOT EXISTS replaced_user_id INTEGER REFERENCES users(id);

COMMENT ON COLUMN shift_assignments.replaced_user_id IS 'For direct assignments: the user being replaced by this assignment';
