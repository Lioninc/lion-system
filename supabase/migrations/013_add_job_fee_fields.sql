-- Add fee fields to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS fee_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS fee_percentage DECIMAL(5,2);

-- Add additional job fields that may be missing
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS working_hours TEXT,
  ADD COLUMN IF NOT EXISTS holidays TEXT,
  ADD COLUMN IF NOT EXISTS benefits TEXT,
  ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS dormitory_details TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
