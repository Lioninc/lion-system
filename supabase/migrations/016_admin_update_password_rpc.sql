-- ========================================
-- 管理者が他ユーザーのパスワードを直接更新する RPC
-- ========================================
-- auth.users.encrypted_password を crypt() で更新する。
-- SECURITY DEFINER で auth スキーマへのアクセスを許可し、
-- 関数内で呼び出し元の users.role が admin / super_admin であることを検証する。

CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  target_user_id UUID,
  new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- 1. 呼び出し元のロールを検証
  SELECT role INTO caller_role
  FROM public.users
  WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Caller user not found';
  END IF;

  IF caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  -- 2. パスワードの最低長チェック
  IF new_password IS NULL OR length(new_password) < 6 THEN
    RAISE EXCEPTION 'パスワードは6文字以上で入力してください';
  END IF;

  -- 3. auth.users の encrypted_password を bcrypt で更新
  UPDATE auth.users
  SET
    encrypted_password = crypt(new_password, gen_salt('bf')),
    updated_at = NOW()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found in auth.users';
  END IF;
END;
$$;

-- authenticated ロールに実行権限を付与
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) TO authenticated;
