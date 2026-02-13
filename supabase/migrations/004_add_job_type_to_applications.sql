-- applicationsテーブルにjob_type（職種）カラムを追加
ALTER TABLE applications ADD COLUMN IF NOT EXISTS job_type VARCHAR(100);

-- インデックスを追加（検索用）
CREATE INDEX IF NOT EXISTS idx_applications_job_type ON applications(job_type);
