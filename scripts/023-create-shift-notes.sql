-- Create shift_notes table for storing notes about specific shifts
CREATE TABLE shift_notes (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shift_id, shift_date)
);

-- Create index for better query performance
CREATE INDEX idx_shift_notes_shift_date ON shift_notes(shift_id, shift_date);
CREATE INDEX idx_shift_notes_date ON shift_notes(shift_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shift_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_shift_notes_updated_at
BEFORE UPDATE ON shift_notes
FOR EACH ROW
EXECUTE FUNCTION update_shift_notes_updated_at();
