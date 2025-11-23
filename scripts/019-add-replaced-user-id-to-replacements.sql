-- Add replaced_user_id column to replacements table
-- This column stores the ID of the firefighter being replaced
-- Used for Replacement 2 requests where user_id is NULL (open to all)

ALTER TABLE replacements
ADD COLUMN IF NOT EXISTS replaced_user_id INTEGER REFERENCES users(id);

-- Add comment
COMMENT ON COLUMN replacements.replaced_user_id IS 'ID of the firefighter being replaced (for Replacement 2 requests)';
