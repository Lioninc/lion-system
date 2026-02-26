import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const PASSWORD = 'Lion0401'

async function main() {
  // 全ユーザー取得
  const { data: users } = await supabase.from('users').select('id, employee_id, name, email, role').order('employee_id')
  if (!users) { console.error('users取得失敗'); return }

  // Auth全ユーザー取得
  const { data: authData } = await supabase.auth.admin.listUsers()
  const authById = new Map<string, any>()
  authData?.users?.forEach(au => authById.set(au.id, au))

  console.log(`usersテーブル: ${users.length}件, Auth: ${authById.size}件\n`)

  for (const user of users) {
    const empId = user.employee_id || '?'
    const expectedEmail = `emp${empId}@gmail.com`
    const authUser = authById.get(user.id)

    process.stdout.write(`${empId} ${user.name.padEnd(12)}`)

    if (!authUser) {
      // Authアカウントがない → 作成
      // usersテーブルのidに合わせるためadmin.createUserを使用
      console.log(` Auth未作成 → 新規作成`)
      // Note: createUser doesn't allow setting id, so we need a different approach
      // Delete the users row, create auth user, then re-insert with new id
      // Actually, let's just update the email in auth if it exists by email
      const existingByEmail = authData?.users?.find(au => au.email === expectedEmail)
      if (existingByEmail) {
        // Authにemailは存在するがidが違う
        const { error } = await supabase.auth.admin.updateUserById(existingByEmail.id, {
          password: PASSWORD,
          email_confirm: true,
        })
        console.log(`    → Auth email存在(別ID), パスワード更新: ${error ? 'FAIL ' + error.message : 'OK'}`)
      } else {
        console.log(`    → Auth未登録、スキップ（手動対応が必要）`)
      }
      continue
    }

    // Authアカウントあり
    const currentEmail = authUser.email

    if (currentEmail !== expectedEmail) {
      // email変更 + パスワード変更
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        email: expectedEmail,
        password: PASSWORD,
        email_confirm: true,
      })
      console.log(` email変更: ${currentEmail} → ${expectedEmail}, pw設定: ${error ? 'FAIL ' + error.message : 'OK'}`)

      // usersテーブルも更新
      if (!error) {
        await supabase.from('users').update({ email: expectedEmail }).eq('id', user.id)
      }
    } else {
      // パスワードのみ変更
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: PASSWORD,
        email_confirm: true,
      })
      console.log(` pw設定: ${error ? 'FAIL ' + error.message : 'OK'}`)
    }
  }

  // ログインテスト
  console.log('\n=== ログインテスト ===')
  for (const user of users) {
    const empId = user.employee_id || '?'
    const email = `emp${empId}@gmail.com`
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password: PASSWORD,
    })
    const status = loginErr ? `FAIL (${loginErr.message})` : 'OK'
    console.log(`  ${empId} ${user.name.padEnd(12)} ${email.padEnd(22)} ${status}`)
    if (loginData?.session) await supabase.auth.signOut()
  }

  console.log('\n✅ 完了')
}

main()
