-- 求職者キャリア関連フィールド追加
ALTER TABLE job_seekers
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS education_school VARCHAR(100),
  ADD COLUMN IF NOT EXISTS education_faculty VARCHAR(100),
  ADD COLUMN IF NOT EXISTS graduation_year INTEGER,
  ADD COLUMN IF NOT EXISTS work_history TEXT,
  ADD COLUMN IF NOT EXISTS current_job_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reason_for_change TEXT,
  ADD COLUMN IF NOT EXISTS current_annual_income INTEGER,
  ADD COLUMN IF NOT EXISTS desired_annual_income INTEGER,
  ADD COLUMN IF NOT EXISTS desired_job_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS desired_employment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS desired_work_location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS remote_work_preference VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pc_skill_level VARCHAR(20),
  ADD COLUMN IF NOT EXISTS language_skill VARCHAR(50),
  ADD COLUMN IF NOT EXISTS toeic_score INTEGER,
  ADD COLUMN IF NOT EXISTS has_car_license BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_forklift BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS commute_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS commute_time INTEGER,
  ADD COLUMN IF NOT EXISTS other_job_hunting VARCHAR(100);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_job_seekers_desired_annual_income ON job_seekers (desired_annual_income);
CREATE INDEX IF NOT EXISTS idx_job_seekers_desired_job_type ON job_seekers (desired_job_type);
CREATE INDEX IF NOT EXISTS idx_job_seekers_desired_employment_type ON job_seekers (desired_employment_type);
CREATE INDEX IF NOT EXISTS idx_job_seekers_desired_work_location ON job_seekers (desired_work_location);
CREATE INDEX IF NOT EXISTS idx_job_seekers_qualifications ON job_seekers USING GIN (to_tsvector('simple', COALESCE(qualifications, '')));
