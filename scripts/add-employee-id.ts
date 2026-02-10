/**
 * usersテーブルにemployee_idカラムを追加するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/add-employee-id.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('📊 usersテーブルにemployee_idカラムを追加します...\n')

  // カラムが存在するか確認
  const { data: users, error: checkError } = await supabase
    .from('users')
    .select('*')
    .limit(1)

  if (checkError) {
    console.error('❌ エラー:', checkError.message)
    process.exit(1)
  }

  const columns = Object.keys(users?.[0] || {})
  console.log('📋 現在のカラム:', columns.join(', '))

  if (columns.includes('employee_id')) {
    console.log('\n✅ employee_idカラムは既に存在します')
    return
  }

  console.log('\n⚠️  employee_idカラムが存在しません')
  console.log('📝 Supabaseダッシュボードで以下のSQLを実行してください:\n')
  console.log('```sql')
  console.log(`-- 社員番号カラムを追加
ALTER TABLE users
ADD COLUMN employee_id text UNIQUE;

-- 既存ユーザーに社員番号を自動割り当て
WITH numbered_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM users
)
UPDATE users
SET employee_id = LPAD(numbered_users.row_num::text, 3, '0')
FROM numbered_users
WHERE users.id = numbered_users.id;

-- メールアドレスを社員番号ベースに更新（任意）
-- UPDATE users SET email = 'emp' || employee_id || '@example.com' WHERE employee_id IS NOT NULL;`)
  console.log('```')
  console.log('\n実行後、再度このスクリプトを実行して確認してください。')
}

main()
