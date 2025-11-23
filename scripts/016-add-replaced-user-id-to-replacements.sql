-- Add replaced_user_id column to replacements table
-- This column stores the original firefighter being replaced for replacement_order=2 requests

ALTER TABLE replacements 
ADD COLUMN IF NOT EXISTS replaced_user_id INTEGER REFERENCES users(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_replacements_replaced_user_id 
ON replacements(replaced_user_id);
