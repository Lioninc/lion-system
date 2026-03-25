-- 履歴書アップロード・解析機能用フィールド追加
ALTER TABLE job_seekers
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS work_history_1 TEXT,
  ADD COLUMN IF NOT EXISTS work_history_2 TEXT,
  ADD COLUMN IF NOT EXISTS work_history_3 TEXT,
  ADD COLUMN IF NOT EXISTS qualifications TEXT,
  ADD COLUMN IF NOT EXISTS hobbies TEXT;

-- Supabase Storageバケット作成
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true) ON CONFLICT (id) DO NOTHING;

-- Storageポリシー: authenticated ユーザーがアップロード・閲覧可能
CREATE POLICY "Authenticated users can upload resumes" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Authenticated users can read resumes" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'resumes');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Anyone can read photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'photos');
