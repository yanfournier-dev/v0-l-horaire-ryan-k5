-- Add fields for partial replacements
ALTER TABLE replacements
ADD COLUMN is_partial BOOLEAN DEFAULT FALSE,
ADD COLUMN start_time TIME,
ADD COLUMN end_time TIME;

-- Add a check constraint to ensure start_time and end_time are provided for partial replacements
ALTER TABLE replacements
ADD CONSTRAINT check_partial_times CHECK (
  (is_partial = FALSE AND start_time IS NULL AND end_time IS NULL) OR
  (is_partial = TRUE AND start_time IS NOT NULL AND end_time IS NOT NULL)
);
