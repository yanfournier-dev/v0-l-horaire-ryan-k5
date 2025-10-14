-- Add is_partial_interest field to replacement_applications table
ALTER TABLE replacement_applications
ADD COLUMN IF NOT EXISTS is_partial_interest BOOLEAN DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN replacement_applications.is_partial_interest IS 'Indicates if the applicant is interested in a partial replacement';
