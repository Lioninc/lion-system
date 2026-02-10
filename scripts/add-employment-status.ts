/**
 * usersテーブルにemployment_statusカラムを追加するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/add-employment-status.ts
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
  console.log('📊 usersテーブルにemployment_statusカラムを追加します...\n')

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

  if (columns.includes('employment_status')) {
    console.log('\n✅ employment_statusカラムは既に存在します')
    return
  }

  console.log('\n⚠️  employment_statusカラムが存在しません')
  console.log('📝 Supabaseダッシュボードで以下のSQLを実行してください:\n')
  console.log('```sql')
  console.log(`ALTER TABLE users
ADD COLUMN employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'retired'));`)
  console.log('```')
  console.log('\n実行後、再度このスクリプトを実行して確認してください。')
}

main()
