/**
 * ユーザー一括登録スクリプト（メール送信制限回避版）
 *
 * 使用方法:
 *   npx tsx scripts/batch-create-users.ts
 *
 * 特徴:
 * - 登録間隔を3秒空けてレート制限を回避
 * - 失敗したユーザーは自動リトライ
 * - Email confirmationをスキップ（autoConfirm: true）
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  console.error('SUPABASE_SERVICE_ROLE_KEY はSupabaseダッシュボードの Settings > API から取得できます')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// 登録するユーザー一覧
// 必要に応じて追加・編集してください
const USERS_TO_CREATE = [
  { employeeId: '016', name: '西村', password: 'password123' },
  { employeeId: '017', name: '浅川', password: 'password123' },
  { employeeId: '018', name: '富岡', password: 'password123' },
  { employeeId: '019', name: '森', password: 'password123' },
  { employeeId: '020', name: '倉田', password: 'password123' },
]

// 社員番号からメールアドレスを生成
function employeeIdToEmail(employeeId: string): string {
  return `emp${employeeId}@gmail.com`
}

// 指定ミリ秒待機
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('========================================')
  console.log('  ユーザー一括登録スクリプト')
  console.log('========================================\n')

  // テナントIDを取得
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)

  const tenantId = tenants?.[0]?.id || null
  console.log(`テナントID: ${tenantId || '(なし)'}\n`)

  // 既存ユーザーを確認
  const { data: existingUsers } = await supabase
    .from('users')
    .select('employee_id, name')

  const existingIds = new Set(existingUsers?.map(u => u.employee_id) || [])
  console.log(`既存ユーザー: ${existingUsers?.length || 0}人\n`)

  const results: { success: string[]; failed: { name: string; error: string }[] } = {
    success: [],
    failed: [],
  }

  for (let i = 0; i < USERS_TO_CREATE.length; i++) {
    const user = USERS_TO_CREATE[i]
    const email = employeeIdToEmail(user.employeeId)

    console.log(`[${i + 1}/${USERS_TO_CREATE.length}] ${user.name} (${user.employeeId}) を登録中...`)

    // 既に存在する場合はスキップ
    if (existingIds.has(user.employeeId)) {
      console.log(`   ⏭️  社員番号 ${user.employeeId} は既に存在します。スキップ。\n`)
      continue
    }

    try {
      // Admin APIを使ってユーザー作成（メール確認をスキップ）
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true, // メール確認済みとしてマーク
        user_metadata: { name: user.name },
      })

      if (authError) {
        // レート制限エラーの場合は長めに待機してリトライ
        if (authError.message.includes('rate') || authError.message.includes('limit')) {
          console.log(`   ⏳ レート制限検出。10秒待機してリトライ...`)
          await sleep(10000)

          const { data: retryData, error: retryError } = await supabase.auth.admin.createUser({
            email,
            password: user.password,
            email_confirm: true,
            user_metadata: { name: user.name },
          })

          if (retryError) {
            throw retryError
          }

          if (!retryData.user) {
            throw new Error('ユーザー作成に失敗しました')
          }

          // usersテーブルに登録
          await insertUserRecord(retryData.user.id, user, email, tenantId)
          results.success.push(user.name)
          console.log(`   ✅ ${user.name} を登録しました（リトライ成功）\n`)
        } else {
          throw authError
        }
      } else {
        if (!authData.user) {
          throw new Error('ユーザー作成に失敗しました')
        }

        // usersテーブルに登録
        await insertUserRecord(authData.user.id, user, email, tenantId)
        results.success.push(user.name)
        console.log(`   ✅ ${user.name} を登録しました\n`)
      }
    } catch (err: any) {
      console.log(`   ❌ ${user.name} の登録に失敗: ${err.message}\n`)
      results.failed.push({ name: user.name, error: err.message })
    }

    // 次のユーザーまで3秒待機（最後のユーザー以外）
    if (i < USERS_TO_CREATE.length - 1) {
      console.log('   ⏳ レート制限回避のため3秒待機...\n')
      await sleep(3000)
    }
  }

  // 結果サマリー
  console.log('========================================')
  console.log('  登録結果サマリー')
  console.log('========================================')
  console.log(`✅ 成功: ${results.success.length}人`)
  if (results.success.length > 0) {
    results.success.forEach(name => console.log(`   - ${name}`))
  }
  console.log(`❌ 失敗: ${results.failed.length}人`)
  if (results.failed.length > 0) {
    results.failed.forEach(({ name, error }) => console.log(`   - ${name}: ${error}`))
  }
}

async function insertUserRecord(
  userId: string,
  user: { employeeId: string; name: string },
  email: string,
  tenantId: string | null
) {
  const { error } = await supabase.from('users').insert({
    id: userId,
    email,
    employee_id: user.employeeId,
    name: user.name,
    role: 'coordinator',
    employment_status: 'active',
    tenant_id: tenantId,
    is_active: true,
  })

  if (error) {
    throw error
  }
}

main()
