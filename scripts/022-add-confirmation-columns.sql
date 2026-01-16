-- Add confirmation tracking columns to replacements table
-- These columns track when and how a firefighter confirmed receipt of their assignment

ALTER TABLE replacements
ADD COLUMN confirmed_at TIMESTAMP NULL,
ADD COLUMN confirmed_via VARCHAR(20) NULL;

-- confirmed_via possible values: 'telegram', 'manual'
-- Both columns are NULL by default (no impact on existing replacements)

COMMENT ON COLUMN replacements.confirmed_at IS 'Timestamp when the assigned firefighter confirmed receipt of the assignment';
COMMENT ON COLUMN replacements.confirmed_via IS 'Method of confirmation: telegram (via button) or manual (by admin)';
