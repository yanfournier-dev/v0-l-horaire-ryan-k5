-- Add new status values to replacement_status enum for the replacement request system
-- This allows non-admins to request replacements that need admin approval

-- Add 'pending' status for replacement requests awaiting approval
ALTER TYPE replacement_status ADD VALUE IF NOT EXISTS 'pending';

-- Add 'approved' status for approved replacement requests
ALTER TYPE replacement_status ADD VALUE IF NOT EXISTS 'approved';

-- Add 'rejected' status for rejected replacement requests
ALTER TYPE replacement_status ADD VALUE IF NOT EXISTS 'rejected';

-- Verify the enum values
SELECT unnest(enum_range(NULL::replacement_status)) AS status;
