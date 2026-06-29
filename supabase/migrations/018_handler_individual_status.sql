-- ========================================
-- 担当者ごとの個別ステータス
--   - kato_status / taniguchi_status / watanabe_status
--   - 旧 partner_status は廃止 (017で追加したカラム)
--
-- 5択 (default 'pending'):
--   pending      = 未対応
--   absent       = 不在
--   immediate_ng = 即NG (ガチャ切り)
--   no_issue     = 問題なし
--   no_contact   = 今後連絡不要
--
-- 注意: Supabase Dashboard の SQL Editor で手動実行する想定。
--       既存の partner_status データは破棄される。
-- ========================================

ALTER TABLE job_seekers
  DROP COLUMN IF EXISTS partner_status;

ALTER TABLE job_seekers
  ADD COLUMN IF NOT EXISTS kato_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (kato_status IN ('pending', 'absent', 'immediate_ng', 'no_issue', 'no_contact')),
  ADD COLUMN IF NOT EXISTS taniguchi_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (taniguchi_status IN ('pending', 'absent', 'immediate_ng', 'no_issue', 'no_contact')),
  ADD COLUMN IF NOT EXISTS watanabe_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (watanabe_status IN ('pending', 'absent', 'immediate_ng', 'no_issue', 'no_contact'));

-- 既存の "Partner restricted update on job_seekers" ポリシー (015) は行レベル更新許可で
-- カラム単位の制限がないため、追加3カラムもそのまま partner ロールから更新可能。
