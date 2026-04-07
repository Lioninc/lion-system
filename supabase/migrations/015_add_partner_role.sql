-- ========================================
-- パートナーロール追加 + 専用RLSポリシー
-- ========================================

-- 1. users.role の CHECK 制約に 'partner' を追加
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'coordinator', 'clerk', 'viewer', 'partner'));

-- 2. job_seekers の既存 "Allow all" ポリシーを削除し、ロール別ポリシーに置き換え
DROP POLICY IF EXISTS "Allow all for authenticated users" ON job_seekers;

-- 2-1. パートナー以外: フルアクセス
CREATE POLICY "Non-partner full access on job_seekers"
  ON job_seekers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  );

-- 2-2. パートナー: 条件付き SELECT
--   - applied_at が 2ヶ月以上前の application が紐づいている
--   - 該当 application に referrals が無い、または referral_status が working/assigned 以外
CREATE POLICY "Partner restricted select on job_seekers"
  ON job_seekers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'partner'
    )
    AND EXISTS (
      SELECT 1
      FROM applications a
      WHERE a.job_seeker_id = job_seekers.id
        AND a.applied_at <= NOW() - INTERVAL '2 months'
        AND NOT EXISTS (
          SELECT 1 FROM referrals r
          WHERE r.application_id = a.id
            AND r.referral_status IN ('working', 'assigned')
        )
    )
  );

-- 2-3. パートナー: 条件付き UPDATE
CREATE POLICY "Partner restricted update on job_seekers"
  ON job_seekers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'partner'
    )
    AND EXISTS (
      SELECT 1
      FROM applications a
      WHERE a.job_seeker_id = job_seekers.id
        AND a.applied_at <= NOW() - INTERVAL '2 months'
        AND NOT EXISTS (
          SELECT 1 FROM referrals r
          WHERE r.application_id = a.id
            AND r.referral_status IN ('working', 'assigned')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'partner'
    )
    AND EXISTS (
      SELECT 1
      FROM applications a
      WHERE a.job_seeker_id = job_seekers.id
        AND a.applied_at <= NOW() - INTERVAL '2 months'
        AND NOT EXISTS (
          SELECT 1 FROM referrals r
          WHERE r.application_id = a.id
            AND r.referral_status IN ('working', 'assigned')
        )
    )
  );

-- 3. applications も同条件で参照のみ可能にする (PartnerJobSeekersPage で applied_at / referral 情報の表示用)
DROP POLICY IF EXISTS "Allow all for authenticated users" ON applications;

CREATE POLICY "Non-partner full access on applications"
  ON applications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  );

CREATE POLICY "Partner select on applications"
  ON applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'partner'
    )
    AND applied_at <= NOW() - INTERVAL '2 months'
    AND NOT EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.application_id = applications.id
        AND r.referral_status IN ('working', 'assigned')
    )
  );

-- 4. referrals は参照のみ (集計用) - 制約なしで SELECT を許可
DROP POLICY IF EXISTS "Allow all for authenticated users" ON referrals;

CREATE POLICY "Non-partner full access on referrals"
  ON referrals
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role <> 'partner'
    )
  );

CREATE POLICY "Partner select on referrals"
  ON referrals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role = 'partner'
    )
  );
