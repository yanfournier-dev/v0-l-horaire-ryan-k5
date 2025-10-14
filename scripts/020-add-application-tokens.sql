-- Create table for storing one-time application tokens
CREATE TABLE IF NOT EXISTS application_tokens (
  id SERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  replacement_id INTEGER NOT NULL REFERENCES replacements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(replacement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_application_tokens_token ON application_tokens(token);
CREATE INDEX IF NOT EXISTS idx_application_tokens_expires ON application_tokens(expires_at);
