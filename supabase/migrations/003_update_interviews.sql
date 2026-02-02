-- interviews テーブルに不足カラムを追加

-- contact_log_id: 対応記録との紐づけ
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS contact_log_id UUID REFERENCES contact_logs(id);

-- 面談評価関連カラム
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS eval_hearing INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS eval_proposal INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS eval_closing INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS eval_impression INTEGER;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS eval_comment TEXT;

-- interview_type を nullable に変更（電話面談予約時はtypeを指定しないため）
ALTER TABLE interviews ALTER COLUMN interview_type DROP NOT NULL;
ALTER TABLE interviews ALTER COLUMN interview_type DROP DEFAULT;

-- interview_type の CHECK 制約を削除して再作成（新しい値を許容）
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_interview_type_check;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_interviews_contact_log ON interviews(contact_log_id);
