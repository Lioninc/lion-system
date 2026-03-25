-- Add company_type column to companies table
-- 'dispatch' = 派遣会社（ブルーカラー）, 'direct' = 直接雇用（ホワイトカラー）
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS company_type VARCHAR(20) DEFAULT 'dispatch';
