/**
 * 「名前不明」の求職者データをCSVから名前を更新するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/update-unknown-names.ts <CSVファイルパス>
 *
 * 処理内容:
 *   1. DBから「名前不明」の求職者を取得
 *   2. CSVから電話番号をキーに名前を検索
 *   3. 名前が見つかったらDBを更新
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

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
  NAME_LAST: 13,     // 氏名（姓）[14]
  NAME_FIRST: 14,    // 氏名（名）[15]
  NAME: 15,          // 氏名 [16]
  PHONE: 19,         // 電話番号 [20]
}

// 電話番号を正規化
function normalizePhone(phone: string): string {
  if (!phone) return ''
  const normalized = phone.replace(/[-\s　]/g, '').trim()
  return normalized.slice(0, 20)
}

// 名前を組み立て
function buildName(row: string[]): string {
  // まず氏名[15]を確認
  let name = row[COL.NAME]?.trim() || ''
  if (name) return name

  // 空なら姓[13] + 名[14]でフルネームを作成
  const lastName = row[COL.NAME_LAST]?.trim() || ''
  const firstName = row[COL.NAME_FIRST]?.trim() || ''
  if (lastName || firstName) {
    name = `${lastName} ${firstName}`.trim()
  }

  return name
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/update-unknown-names.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 「名前不明」データの更新を開始します...\n')

  try {
    // CSVを読み込み
    const fileContent = fs.readFileSync(absolutePath, 'utf-8')
    const records = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][]

    // 最初の2行（集計行+ヘッダー行）をスキップ
    const dataRows = records.slice(2)
    console.log(`📝 CSV総行数: ${dataRows.length}`)

    // CSVから電話番号→名前のマップを作成
    const phoneToName = new Map<string, string>()
    for (const row of dataRows) {
      const phone = normalizePhone(row[COL.PHONE] || '')
      const name = buildName(row)

      if (phone && name && name !== '名前不明') {
        phoneToName.set(phone, name)
      }
    }

    console.log(`📞 CSV内の名前付き電話番号: ${phoneToName.size}件`)

    // テナントIDを取得
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
    const tenantId = tenants[0].id

    // 「名前不明」の求職者を取得
    const { data: unknownJobSeekers, error } = await supabase
      .from('job_seekers')
      .select('id, phone, name')
      .eq('tenant_id', tenantId)
      .eq('name', '名前不明')

    if (error) {
      console.error('求職者取得エラー:', error.message)
      process.exit(1)
    }

    console.log(`🔍 「名前不明」の求職者: ${unknownJobSeekers?.length || 0}件`)

    if (!unknownJobSeekers || unknownJobSeekers.length === 0) {
      console.log('\n✅ 更新対象がありません')
      return
    }

    // 更新処理
    let updatedCount = 0
    let notFoundCount = 0
    const errors: string[] = []

    for (const js of unknownJobSeekers) {
      const normalizedPhone = normalizePhone(js.phone)
      const newName = phoneToName.get(normalizedPhone)

      if (newName) {
        const { error: updateError } = await supabase
          .from('job_seekers')
          .update({ name: newName })
          .eq('id', js.id)

        if (updateError) {
          errors.push(`${js.phone}: ${updateError.message}`)
        } else {
          updatedCount++
          if (updatedCount <= 10) {
            console.log(`  ✓ ${js.phone} → ${newName}`)
          }
        }
      } else {
        notFoundCount++
      }
    }

    if (updatedCount > 10) {
      console.log(`  ... 他 ${updatedCount - 10} 件更新`)
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 更新結果')
    console.log('='.repeat(50))
    console.log(`名前不明（更新前）: ${unknownJobSeekers.length}件`)
    console.log(`名前更新成功:       ${updatedCount}件`)
    console.log(`CSV内に名前なし:    ${notFoundCount}件`)
    console.log(`エラー:             ${errors.length}件`)

    if (errors.length > 0) {
      console.log('\n⚠️  エラー詳細（最初の5件）:')
      errors.slice(0, 5).forEach(err => console.log(`  - ${err}`))
    }

    // 更新後の「名前不明」件数を確認
    const { count: remainingCount } = await supabase
      .from('job_seekers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('name', '名前不明')

    console.log(`\n📈 残りの「名前不明」: ${remainingCount}件`)
    console.log('\n✅ 更新完了!')

  } catch (err: any) {
    console.error('\n❌ 更新失敗:', err.message)
    process.exit(1)
  }
}

main()
