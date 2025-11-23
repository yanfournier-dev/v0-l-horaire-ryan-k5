-- Add requester_name column to store the firefighter name directly
-- This ensures the name is serialized correctly by Next.js
ALTER TABLE replacements
ADD COLUMN IF NOT EXISTS requester_name TEXT;

-- Update existing Replacement 2 requests with the name from replaced user
UPDATE replacements r
SET requester_name = CONCAT(u.first_name, ' ', u.last_name)
FROM users u
WHERE r.replaced_user_id = u.id
AND r.replacement_order = 2
AND r.requester_name IS NULL;
