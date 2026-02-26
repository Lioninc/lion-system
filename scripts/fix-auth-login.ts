import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function main() {
  const doApply = process.argv.includes('--apply')
  console.log(`モード: ${doApply ? '実行' : 'dry-run'}`)

  // 1. 山口達也(001): Auth email変更 + パスワード変更 + usersテーブル email変更
  const { data: yamaguchi } = await supabase
    .from('users')
    .select('id, employee_id, name, email')
    .eq('employee_id', '001')
    .single()

  if (!yamaguchi) {
    console.error('001のユーザーが見つかりません')
    return
  }

  console.log(`\n=== 1. 山口達也(001) ===`)
  console.log(`  現在: email=${yamaguchi.email}, id=${yamaguchi.id.substring(0, 8)}...`)
  console.log(`  変更後: email=emp001@gmail.com, password=Lion0401`)

  if (doApply) {
    // Auth email + password変更
    const { error: authErr } = await supabase.auth.admin.updateUserById(yamaguchi.id, {
      email: 'emp001@gmail.com',
      password: 'Lion0401',
      email_confirm: true,
    })
    if (authErr) {
      console.error(`  Auth更新エラー: ${authErr.message}`)
      return
    }
    console.log('  Auth: email + password 更新完了')

    // usersテーブル email変更
    const { error: dbErr } = await supabase
      .from('users')
      .update({ email: 'emp001@gmail.com' })
      .eq('id', yamaguchi.id)
    if (dbErr) {
      console.error(`  users更新エラー: ${dbErr.message}`)
      return
    }
    console.log('  users: email 更新完了')
  }

  // 2. 米澤菜々子(003): パスワード設定確認
  const { data: yonezawa } = await supabase
    .from('users')
    .select('id, employee_id, name, email')
    .eq('employee_id', '003')
    .single()

  if (!yonezawa) {
    console.error('003のユーザーが見つかりません')
    return
  }

  console.log(`\n=== 2. 米澤菜々子(003) ===`)
  console.log(`  現在: email=${yonezawa.email}, id=${yonezawa.id.substring(0, 8)}...`)

  // Auth側のemailがemp003@gmail.comであることを確認
  const { data: authUser003 } = await supabase.auth.admin.getUserById(yonezawa.id)
  console.log(`  Auth email: ${authUser003?.user?.email}`)

  if (doApply) {
    // パスワードをLion0401に設定（003も同じパスワードにする）
    const { error: authErr003 } = await supabase.auth.admin.updateUserById(yonezawa.id, {
      password: 'Lion0401',
      email_confirm: true,
    })
    if (authErr003) {
      console.error(`  Auth更新エラー: ${authErr003.message}`)
    } else {
      console.log('  Auth: password 更新完了')
    }
  }

  // 3. ログインテスト
  if (doApply) {
    console.log('\n=== ログインテスト ===')

    // 001テスト
    const { data: login001, error: err001 } = await supabase.auth.signInWithPassword({
      email: 'emp001@gmail.com',
      password: 'Lion0401',
    })
    console.log(`  001 (emp001@gmail.com): ${err001 ? 'FAIL - ' + err001.message : 'OK - ' + login001.user?.id.substring(0, 8) + '...'}`)
    if (login001?.session) await supabase.auth.signOut()

    // 003テスト
    const { data: login003, error: err003 } = await supabase.auth.signInWithPassword({
      email: 'emp003@gmail.com',
      password: 'Lion0401',
    })
    console.log(`  003 (emp003@gmail.com): ${err003 ? 'FAIL - ' + err003.message : 'OK - ' + login003.user?.id.substring(0, 8) + '...'}`)
    if (login003?.session) await supabase.auth.signOut()
  }

  if (!doApply) {
    console.log('\n--- dry-runモードです。実行するには: ---')
    console.log('  npx tsx scripts/fix-auth-login.ts --apply')
  }
}

main()
