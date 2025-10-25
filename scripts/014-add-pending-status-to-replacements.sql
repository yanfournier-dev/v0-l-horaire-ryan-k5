-- Add 'pending' status to replacement_status enum
ALTER TYPE replacement_status ADD VALUE IF NOT EXISTS 'pending';

-- Update existing replacements that were created via requestReplacement
-- to have 'pending' status if they don't have a leave_id (manual requests)
-- This is optional and can be commented out if not needed
-- UPDATE replacements SET status = 'pending' WHERE status = 'open' AND leave_id IS NULL AND created_at > NOW() - INTERVAL '1 day';
