-- Add user_id column to replacements table to track who is being replaced
-- This is needed for direct replacements (when leave_id is NULL)
ALTER TABLE replacements
ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_replacements_user ON replacements(user_id);

-- Update existing direct replacements to set user_id if possible
-- (This won't work for existing data, but ensures future data is correct)
