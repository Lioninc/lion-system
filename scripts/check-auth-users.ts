import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  // 1. usersテーブルの全ユーザー確認
  const { data: users } = await supabase.from('users').select('id, employee_id, name, email, role')
  console.log('=== usersテーブル ===')
  users?.forEach(u => {
    console.log(`  ${u.employee_id || '?'} | ${u.name} | ${u.email} | role=${u.role} | id=${u.id.substring(0, 8)}...`)
  })

  // 2. Supabase Auth のユーザー一覧（Admin API）
  console.log('\n=== Supabase Auth ユーザー ===')
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.error('Auth listUsers エラー:', authErr.message)
  } else {
    authUsers?.users?.forEach(au => {
      console.log(`  ${au.email} | id=${au.id.substring(0, 8)}... | created=${au.created_at}`)
    })
    console.log(`  合計: ${authUsers?.users?.length || 0}件`)
  }

  // 3. ログインフロー確認
  // 社員番号001 → emp001@gmail.com
  // 社員番号003 → emp003@gmail.com
  console.log('\n=== ログインフロー確認 ===')
  console.log('  社員番号001 → emp001@gmail.com')
  console.log('  社員番号003 → emp003@gmail.com')

  // usersテーブルのemailとAuth側のemailの対応を確認
  console.log('\n=== users.id と Auth.id の一致確認 ===')
  const authIdSet = new Set(authUsers?.users?.map(au => au.id) || [])
  users?.forEach(u => {
    const inAuth = authIdSet.has(u.id)
    console.log(`  ${u.name} (${u.employee_id}): users.id=${u.id.substring(0, 8)}... → Auth存在=${inAuth}`)
  })
}

main()
