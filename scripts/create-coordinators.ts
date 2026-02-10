/**
 * CSVから担当者をシステムに登録するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/create-coordinators.ts <CSVファイルパス>
 *
 * 処理内容:
 *   1. CSVから担当者一覧を抽出
 *   2. 未登録の担当者をusersテーブルに追加
 *   3. 名字のみで登録（後でフルネームに更新可能）
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'
import { randomUUID } from 'crypto'

// 環境変数を読み込み
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSVカラムインデックス（0始まり）
const COL = {
  COORDINATOR: 53,   // 担当CD [54]
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/create-coordinators.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 担当者の登録を開始します...\n')

  try {
    // CSVを読み込み
    const fileContent = fs.readFileSync(absolutePath, 'utf-8')
    const records = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][]

    // 最初の2行（集計行+ヘッダー行）をスキップ
    const dataRows = records.slice(2)

    // CSVから担当者一覧を抽出
    const coordinators = new Map<string, number>()
    for (const row of dataRows) {
      const coordinator = row[COL.COORDINATOR]?.trim() || ''
      if (coordinator) {
        coordinators.set(coordinator, (coordinators.get(coordinator) || 0) + 1)
      }
    }

    console.log('📊 CSV内の担当者一覧:')
    Array.from(coordinators.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`   ${name}: ${count}件`)
      })

    // テナントIDを取得
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
    const tenantId = tenants[0].id

    // 既存ユーザーを取得
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)

    const existingNames = new Set(existingUsers?.map(u => u.name) || [])
    console.log(`\n👥 既存ユーザー: ${existingNames.size}名`)

    // 未登録の担当者を登録
    let createdCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const [name] of coordinators) {
      // 既存ユーザーの名前に含まれているかチェック
      const isRegistered = Array.from(existingNames).some(existingName =>
        existingName === name || existingName.startsWith(name)
      )

      if (isRegistered) {
        skippedCount++
        continue
      }

      // 新規ユーザーを作成（名字のみで登録）
      const email = `${name.toLowerCase()}@example.com`
      const { error } = await supabase
        .from('users')
        .insert({
          id: randomUUID(),
          tenant_id: tenantId,
          email: email,
          name: name,
          role: 'coordinator',
        })

      if (error) {
        // メールアドレス重複の場合はユニークなメールで再試行
        if (error.code === '23505') {
          const uniqueEmail = `${name.toLowerCase()}-${Date.now()}@example.com`
          const { error: retryError } = await supabase
            .from('users')
            .insert({
              id: randomUUID(),
              tenant_id: tenantId,
              email: uniqueEmail,
              name: name,
              role: 'coordinator',
            })

          if (retryError) {
            errors.push(`${name}: ${retryError.message}`)
          } else {
            createdCount++
            console.log(`   ✓ ${name} を登録しました`)
          }
        } else {
          errors.push(`${name}: ${error.message}`)
        }
      } else {
        createdCount++
        console.log(`   ✓ ${name} を登録しました`)
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 登録結果')
    console.log('='.repeat(50))
    console.log(`CSV内担当者数:     ${coordinators.size}名`)
    console.log(`新規登録:          ${createdCount}名`)
    console.log(`既存（スキップ）:  ${skippedCount}名`)
    console.log(`エラー:            ${errors.length}件`)

    if (errors.length > 0) {
      console.log('\n⚠️  エラー詳細:')
      errors.forEach(err => console.log(`   - ${err}`))
    }

    // 登録後のユーザー一覧を表示
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('tenant_id', tenantId)
      .order('name')

    console.log('\n👥 登録後のユーザー一覧:')
    allUsers?.forEach(u => {
      console.log(`   ${u.name} (${u.email}) - ${u.role}`)
    })

    console.log('\n✅ 担当者登録完了!')
    console.log('\n💡 ヒント: 名字のみで登録しました。')
    console.log('   設定画面のユーザー管理でフルネームに更新してください。')

  } catch (err: any) {
    console.error('\n❌ 登録失敗:', err.message)
    process.exit(1)
  }
}

main()
