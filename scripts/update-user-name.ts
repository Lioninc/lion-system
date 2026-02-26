import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

async function main() {
  // test@example.com のユーザーを検索
  const { data: users, error: fetchErr } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'test@example.com')

  if (fetchErr) {
    console.error('検索エラー:', fetchErr.message)
    return
  }

  if (!users || users.length === 0) {
    console.log('test@example.com のユーザーが見つかりません')
    return
  }

  console.log(`対象ユーザー: ${users[0].name} (${users[0].email}) → 山口達也`)

  const { error: updateErr } = await supabase
    .from('users')
    .update({ name: '山口達也' })
    .eq('email', 'test@example.com')

  if (updateErr) {
    console.error('更新エラー:', updateErr.message)
    return
  }

  // 確認
  const { data: updated } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'test@example.com')
    .single()

  console.log(`✅ 更新完了: ${updated?.name} (${updated?.email})`)
}

main()
