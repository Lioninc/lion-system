/**
 * 既存の求職者データのカナ（フリガナ）を一括更新するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/update-name-kana.ts <CSVファイルパス>
 *
 * 処理内容:
 *   1. CSVからカナ情報を取得（優先順位：カナ[18] → カナ姓[16]+カナ名[17] → カナ姓のみ → カナ名のみ）
 *   2. 電話番号をキーに求職者を特定
 *   3. name_kanaが空の求職者のみ更新
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
  PHONE: 19,           // 電話番号 [20]
  NAME_KANA_LAST: 16,  // カナ（姓）[17]
  NAME_KANA_FIRST: 17, // カナ（名）[18]
  NAME_KANA: 18,       // カナ [19]
}

// 電話番号を正規化
function normalizePhone(phone: string): string {
  if (!phone) return ''
  const normalized = phone.replace(/[-\s　]/g, '').trim()
  return normalized.slice(0, 20)
}

// カナを組み立て（優先順位）
function buildNameKana(row: string[]): string | null {
  const fullKana = row[COL.NAME_KANA]?.trim() || ''
  const lastKana = row[COL.NAME_KANA_LAST]?.trim() || ''
  const firstKana = row[COL.NAME_KANA_FIRST]?.trim() || ''

  if (fullKana) {
    return fullKana
  } else if (lastKana && firstKana) {
    return `${lastKana} ${firstKana}`
  } else if (lastKana) {
    return lastKana
  } else if (firstKana) {
    return firstKana
  }
  return null
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/update-name-kana.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 カナデータの更新を開始します...\n')

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

    // CSVから電話番号→カナのマップを作成
    const phoneToKana = new Map<string, string>()
    for (const row of dataRows) {
      const phone = normalizePhone(row[COL.PHONE] || '')
      const kana = buildNameKana(row)

      if (phone && kana) {
        // 既に登録されている場合はスキップ（最初のデータを優先）
        if (!phoneToKana.has(phone)) {
          phoneToKana.set(phone, kana)
        }
      }
    }

    console.log(`📞 CSV内のカナ付きレコード: ${phoneToKana.size}件`)

    // テナントIDを取得
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
    const tenantId = tenants[0].id

    // 求職者を全件取得（ページング対応）
    console.log('\n📋 求職者データを取得中...')
    const allJobSeekers: { id: string; phone: string; name_kana: string | null }[] = []
    let offset = 0
    const pageSize = 1000

    while (true) {
      const { data: batch } = await supabase
        .from('job_seekers')
        .select('id, phone, name_kana')
        .eq('tenant_id', tenantId)
        .range(offset, offset + pageSize - 1)

      if (!batch || batch.length === 0) break
      allJobSeekers.push(...batch)
      offset += batch.length
      if (batch.length < pageSize) break
    }

    console.log(`📋 求職者数: ${allJobSeekers.length}`)

    // 更新処理
    let updatedCount = 0
    let alreadySetCount = 0
    let noKanaInCsvCount = 0
    const errors: string[] = []

    console.log('\n⏳ 更新処理中...')

    for (const js of allJobSeekers) {
      const normalizedPhone = normalizePhone(js.phone)

      // 既にカナが設定されている場合はスキップ
      if (js.name_kana && js.name_kana.trim() !== '') {
        alreadySetCount++
        continue
      }

      // CSVからカナを取得
      const kana = phoneToKana.get(normalizedPhone)
      if (!kana) {
        noKanaInCsvCount++
        continue
      }

      // 更新
      const { error: updateError } = await supabase
        .from('job_seekers')
        .update({ name_kana: kana })
        .eq('id', js.id)

      if (updateError) {
        errors.push(`${js.id}: ${updateError.message}`)
      } else {
        updatedCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 更新結果')
    console.log('='.repeat(50))
    console.log(`求職者総数:         ${allJobSeekers.length}人`)
    console.log(`カナ更新:           ${updatedCount}人`)
    console.log(`既にカナ設定済み:   ${alreadySetCount}人`)
    console.log(`CSVにカナなし:      ${noKanaInCsvCount}人`)
    console.log(`エラー:             ${errors.length}件`)

    if (errors.length > 0) {
      console.log('\n⚠️  エラー詳細（最初の5件）:')
      errors.slice(0, 5).forEach(err => console.log(`  - ${err}`))
    }

    console.log('\n✅ カナ更新完了!')

  } catch (err: any) {
    console.error('\n❌ 更新失敗:', err.message)
    process.exit(1)
  }
}

main()
