-- Create enum types for roles and statuses
CREATE TYPE user_role AS ENUM ('captain', 'lieutenant', 'firefighter');
CREATE TYPE team_type AS ENUM ('permanent', 'part_time', 'temporary');
CREATE TYPE shift_type AS ENUM ('day', 'night', 'full_24h');
CREATE TYPE leave_type AS ENUM ('full', 'partial');
CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE replacement_status AS ENUM ('open', 'assigned', 'completed', 'cancelled');

-- Users table (firefighters)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'firefighter',
  phone VARCHAR(20),
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type team_type NOT NULL,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members junction table
CREATE TABLE team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, user_id)
);

-- Cycle configuration (28-day cycle starting August 24, 2025)
CREATE TABLE cycle_config (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  cycle_length_days INTEGER NOT NULL DEFAULT 28,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shifts table (defines the 28-day pattern for each team)
CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  cycle_day INTEGER NOT NULL CHECK (cycle_day >= 1 AND cycle_day <= 28),
  shift_type shift_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, cycle_day)
);

-- Leaves table (absences)
CREATE TABLE leaves (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type leave_type NOT NULL,
  status leave_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Replacements table (when someone needs to be replaced)
CREATE TABLE replacements (
  id SERIAL PRIMARY KEY,
  leave_id INTEGER REFERENCES leaves(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type shift_type NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  status replacement_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Replacement applications
CREATE TABLE replacement_applications (
  id SERIAL PRIMARY KEY,
  replacement_id INTEGER REFERENCES replacements(id) ON DELETE CASCADE,
  applicant_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status leave_status NOT NULL DEFAULT 'pending',
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  UNIQUE(replacement_id, applicant_id)
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  related_id INTEGER,
  related_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_shifts_team ON shifts(team_id);
CREATE INDEX idx_leaves_user ON leaves(user_id);
CREATE INDEX idx_leaves_dates ON leaves(start_date, end_date);
CREATE INDEX idx_replacements_date ON replacements(shift_date);
CREATE INDEX idx_replacements_status ON replacements(status);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_replacement_applications_replacement ON replacement_applications(replacement_id);
