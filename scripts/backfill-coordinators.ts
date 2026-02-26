/**
 * CSVのI列（応募対応者）→ applications.coordinator_id
 * CSVのBB列（担当CD）→ interviews.interviewer_id
 * を正しく紐付けるバックフィルスクリプト
 *
 * 使い方:
 *   npx tsx scripts/backfill-coordinators.ts <CSVファイルパス>
 *   npx tsx scripts/backfill-coordinators.ts <CSVファイルパス> --apply
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: 環境変数を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const COL_APP_COORDINATOR = 8   // I列: 応募対応者
const COL_PHONE = 19            // T列: 電話番号
const COL_DATE = 5              // F列: 日付
const COL_INTERVIEW_COORDINATOR = 53  // BB列: 担当CD

function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[-\s　]/g, '').trim().slice(0, 20)
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null
  const formats = [
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ]
  for (const fmt of formats) {
    const match = dateStr.trim().match(fmt)
    if (match) {
      const [, year, month, day] = match.map(Number)
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

async function main() {
  const csvPath = process.argv[2]
  const dryRun = !process.argv.includes('--apply')

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/backfill-coordinators.ts <CSVファイルパス> [--apply]')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  if (dryRun) {
    console.log('=== DRY RUN モード（--apply で実行） ===\n')
  } else {
    console.log('=== 実行モード ===\n')
  }

  // CSV読み込み
  const fileContent = fs.readFileSync(absolutePath, 'utf-8')
  const records = parse(fileContent, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][]
  const dataRows = records.slice(2)

  // ユーザーマスター取得
  const { data: users } = await supabase.from('users').select('id, name')
  const userFullNames = users || []

  function findUserByLastName(lastName: string): { id: string; name: string } | null {
    if (!lastName) return null
    // 完全一致
    const exact = userFullNames.find(u => u.name === lastName)
    if (exact) return exact
    // 名字前方一致
    const matches = userFullNames.filter(u => u.name.startsWith(lastName))
    if (matches.length === 1) return matches[0]
    // 特殊ケース: 山口正 → 山口正悟
    if (lastName === '山口正') {
      const m = userFullNames.find(u => u.name.startsWith('山口正'))
      if (m) return m
    }
    return null
  }

  console.log(`ユーザー数: ${userFullNames.length}`)
  userFullNames.forEach(u => console.log(`  ${u.name} (${u.id})`))
  console.log()

  // 全applicationを取得（phone経由で紐付け）
  let allApplications: any[] = []
  let page = 0
  const PAGE_SIZE = 1000
  while (true) {
    const { data } = await supabase
      .from('applications')
      .select('id, applied_at, coordinator_id, job_seeker:job_seekers(phone), interviews(id, interviewer_id)')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    if (!data || data.length === 0) break
    allApplications = [...allApplications, ...data]
    if (data.length < PAGE_SIZE) break
    page++
  }

  console.log(`全応募数: ${allApplications.length}`)

  // phone+applied_at でマッピング
  const appMap = new Map<string, any[]>()
  for (const app of allApplications) {
    const phone = normalizePhone((app.job_seeker as any)?.phone || '')
    if (!phone) continue
    const dateKey = app.applied_at?.split('T')[0] || ''
    const key = `${phone}:${dateKey}`
    if (!appMap.has(key)) appMap.set(key, [])
    appMap.get(key)!.push(app)
  }

  let coordUpdated = 0
  let coordSkipped = 0
  let ivUpdated = 0
  let ivSkipped = 0
  let notFound = 0

  for (const row of dataRows) {
    const phone = normalizePhone(row[COL_PHONE] || '')
    if (!phone) continue

    const dateStr = parseDate(row[COL_DATE])
    if (!dateStr) continue

    const key = `${phone}:${dateStr}`
    const apps = appMap.get(key)
    if (!apps || apps.length === 0) {
      notFound++
      continue
    }

    // I列: 応募対応者 → coordinator_id
    const appCoordName = row[COL_APP_COORDINATOR]?.trim()
    if (appCoordName && appCoordName !== '応募対応者') {
      const user = findUserByLastName(appCoordName)
      if (user) {
        for (const app of apps) {
          if (app.coordinator_id !== user.id) {
            if (!dryRun) {
              await supabase
                .from('applications')
                .update({ coordinator_id: user.id })
                .eq('id', app.id)
            }
            coordUpdated++
          } else {
            coordSkipped++
          }
        }
      }
    }

    // BB列: 担当CD → interviews.interviewer_id
    const ivCoordName = row[COL_INTERVIEW_COORDINATOR]?.trim()
    if (ivCoordName) {
      const user = findUserByLastName(ivCoordName)
      if (user) {
        for (const app of apps) {
          const interviews = app.interviews || []
          for (const iv of interviews) {
            if (iv.interviewer_id !== user.id) {
              if (!dryRun) {
                await supabase
                  .from('interviews')
                  .update({ interviewer_id: user.id })
                  .eq('id', iv.id)
              }
              ivUpdated++
            } else {
              ivSkipped++
            }
          }
        }
      }
    }
  }

  console.log('\n=== 結果 ===')
  console.log(`応募担当者(coordinator_id) 更新: ${coordUpdated}`)
  console.log(`応募担当者(coordinator_id) スキップ(変更なし): ${coordSkipped}`)
  console.log(`面談担当者(interviewer_id) 更新: ${ivUpdated}`)
  console.log(`面談担当者(interviewer_id) スキップ(変更なし): ${ivSkipped}`)
  console.log(`マッチしなかった行: ${notFound}`)

  if (dryRun) {
    console.log('\n※ DRY RUNです。実際に更新するには --apply を追加してください')
  } else {
    console.log('\n✅ 更新完了!')
  }
}

main()
