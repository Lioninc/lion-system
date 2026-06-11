-- ========================================
-- パートナー向け追加カラム
--   - lion_interview_done: リオン面談実施済み
--   - ttt_interview_done:  TTT面談実施済み
--   - partner_status:      パートナー側ステータス (未対応 / 問題なし / 今後連絡不要)
--
-- 注意: このマイグレーションは Supabase Dashboard の SQL Editor で
-- 手動実行する想定。`supabase db push` での自動反映は行わない。
-- ========================================

ALTER TABLE job_seekers
  ADD COLUMN IF NOT EXISTS lion_interview_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ttt_interview_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partner_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (partner_status IN ('pending', 'no_issue', 'no_contact'));

-- 既存の "Partner restricted update on job_seekers" ポリシー (015_add_partner_role.sql) は
-- 行レベルでの UPDATE 許可であり、カラム単位の制限はないため、追加された3カラムも
-- 自動的に partner ロールから更新可能。追加のポリシー変更は不要。
