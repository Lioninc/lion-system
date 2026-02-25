-- referralsテーブルに見込み売上カラムを追加（CSV BX列）
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS expected_sales_amount DECIMAL(12,2);

-- salesテーブルに入金金額カラムを追加（CSV CH列）
ALTER TABLE sales ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_referrals_expected_sales ON referrals(expected_sales_amount) WHERE expected_sales_amount IS NOT NULL;
