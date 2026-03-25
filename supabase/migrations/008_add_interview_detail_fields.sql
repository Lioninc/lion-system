-- Add detail fields to interviews table
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS employment_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS available_from VARCHAR(100),
  ADD COLUMN IF NOT EXISTS work_period VARCHAR(20),
  ADD COLUMN IF NOT EXISTS has_side_job BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS family_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS health_notes TEXT;
