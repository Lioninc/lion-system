/**
 * usersテーブルのカラムを確認するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/check-users-columns.ts
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
  console.log('📊 usersテーブルのカラムを確認します...\n')

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .limit(1)

  if (error) {
    console.error('❌ エラー:', error.message)
    process.exit(1)
  }

  const columns = Object.keys(users?.[0] || {})
  console.log('📋 現在のカラム:')
  columns.forEach(col => console.log(`   - ${col}`))

  console.log('\n🔍 必要なカラムの確認:')

  const requiredColumns = ['is_active', 'employment_status', 'employee_id']
  const missingColumns: string[] = []

  for (const col of requiredColumns) {
    if (columns.includes(col)) {
      console.log(`   ✅ ${col} - 存在します`)
    } else {
      console.log(`   ❌ ${col} - 存在しません`)
      missingColumns.push(col)
    }
  }

  if (missingColumns.length > 0) {
    console.log('\n⚠️  不足しているカラムがあります')
    console.log('📝 以下のSQLをSupabaseダッシュボードで実行してください:\n')
    console.log('```sql')

    if (missingColumns.includes('is_active')) {
      console.log(`-- アカウント有効/無効フラグ
ALTER TABLE users ADD COLUMN is_active boolean DEFAULT true;
`)
    }

    if (missingColumns.includes('employment_status')) {
      console.log(`-- 在職ステータス
ALTER TABLE users ADD COLUMN employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'retired'));
`)
    }

    if (missingColumns.includes('employee_id')) {
      console.log(`-- 社員番号
ALTER TABLE users ADD COLUMN employee_id text UNIQUE;

-- 既存ユーザーに社員番号を自動割り当て
WITH numbered_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM users
)
UPDATE users
SET employee_id = LPAD(numbered_users.row_num::text, 3, '0')
FROM numbered_users
WHERE users.id = numbered_users.id;
`)
    }

    console.log('```')
  } else {
    console.log('\n✅ すべての必要なカラムが存在します')
  }

  // 既存ユーザーのデータを表示
  console.log('\n👥 既存ユーザー:')
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, employee_id, is_active, employment_status')
    .order('created_at')

  allUsers?.forEach(u => {
    console.log(`   - ${u.employee_id || '(未設定)'} | ${u.name} | ${u.email} | active: ${u.is_active ?? 'null'} | status: ${u.employment_status || 'null'}`)
  })
}

main()
