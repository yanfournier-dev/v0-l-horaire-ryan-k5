-- Add replacement_order column to replacements table
-- This column distinguishes between Replacement 1 and Replacement 2

ALTER TABLE replacements
ADD COLUMN IF NOT EXISTS replacement_order INTEGER DEFAULT 1;

-- Add comment
COMMENT ON COLUMN replacements.replacement_order IS 'Order of replacement: 1 for first replacement, 2 for second replacement';
