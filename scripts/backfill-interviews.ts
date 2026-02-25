/**
 * 既存の応募データに電話面談（interviews）レコードをバックフィルするスクリプト
 *
 * CSVの面談日程（col51）と面談の状態（col52/AZ列）を読み取り、
 * 既存のapplicationsに対応するinterviewsレコードを作成する。
 *
 * 使用方法:
 *   npx tsx scripts/backfill-interviews.ts <CSVファイルパス>
 *   npx tsx scripts/backfill-interviews.ts <CSVファイルパス> --dry-run  (確認のみ)
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
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSVカラムインデックス（import-csv.tsと同じ）
const COL = {
  DATE: 5,
  PHONE: 19,
  PHONE_INTERVIEW_DATE: 50,
  PHONE_INTERVIEW_STATUS: 51,
  COORDINATOR: 53,
}

function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[-\s　]/g, '').trim().slice(0, 20)
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null
  const formats = [
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\s?$/,
  ]
  for (let idx = 0; idx < formats.length; idx++) {
    const match = dateStr.trim().match(formats[idx])
    if (match) {
      let year: number, month: number, day: number
      if (idx === 2) {
        ;[, month, day, year] = match.map(Number)
      } else if (idx === 3) {
        year = new Date().getFullYear()
        ;[, month, day] = match.map(Number)
      } else {
        ;[, year, month, day] = match.map(Number)
      }
      if (year < 100) year += year < 50 ? 2000 : 1900
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

// ページネーション付きフェッチ
async function fetchAllRows(table: string, select: string, filters?: (q: any) => any): Promise<any[]> {
  const rows: any[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    let q = supabase.from(table).select(select)
    if (filters) q = filters(q)
    const { data, error } = await q.range(offset, offset + pageSize - 1)
    if (error) {
      console.error(`Fetch error (${table}):`, error.message)
      break
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }
  return rows
}

async function main() {
  const csvPath = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/backfill-interviews.ts <CSVファイルパス> [--dry-run]')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log(`📊 面談データバックフィル${dryRun ? '（dry-run）' : ''}を開始します...\n`)

  // CSVを読み込み
  const fileContent = fs.readFileSync(absolutePath, 'utf-8')
  const records = parse(fileContent, {
    skip_empty_lines: true,
    relax_column_count: true,
  }) as string[][]
  const dataRows = records.slice(2)
  console.log(`📝 CSV行数: ${dataRows.length}`)

  // テナントID取得
  let tenantId = process.env.IMPORT_TENANT_ID
  if (!tenantId) {
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id
    } else {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
  }
  console.log(`🏢 テナントID: ${tenantId}`)

  // 担当者マスターを取得
  const coordinatorFullNames: { id: string; name: string }[] = []
  const coordinatorMap = new Map<string, string>()
  const { data: users } = await supabase.from('users').select('id, name').eq('tenant_id', tenantId)
  users?.forEach(u => {
    coordinatorFullNames.push({ id: u.id, name: u.name })
    coordinatorMap.set(u.name, u.id)
  })

  function findCoordinatorByLastName(lastName: string): string | null {
    if (!lastName) return null
    if (coordinatorMap.has(lastName)) return coordinatorMap.get(lastName)!
    const matches = coordinatorFullNames.filter(u => u.name.startsWith(lastName))
    if (matches.length === 1) return matches[0].id
    return null
  }

  // 既存のapplicationsを取得（電話番号+applied_atでCSV行とマッチング）
  console.log('\n📥 既存データを読み込み中...')
  const allApplications = await fetchAllRows('applications', 'id, job_seeker_id, applied_at')
  console.log(`  応募: ${allApplications.length}件`)

  // job_seekersの電話番号を取得
  const allJobSeekers = await fetchAllRows('job_seekers', 'id, phone')
  console.log(`  求職者: ${allJobSeekers.length}件`)

  // 既存のinterviewsを取得（重複防止）
  const existingInterviews = await fetchAllRows('interviews', 'application_id')
  const existingInterviewAppIds = new Set(existingInterviews.map((iv: any) => iv.application_id))
  console.log(`  既存面談: ${existingInterviews.length}件`)

  // job_seeker_id → phone のマップ
  const jsPhoneMap = new Map<string, string>()
  allJobSeekers.forEach((js: any) => {
    if (js.phone) jsPhoneMap.set(js.id, normalizePhone(js.phone))
  })

  // phone+applied_at → application_id のマップ
  // DBのapplied_atはISO形式 (2025-01-23T00:00:00+00:00)、CSVはYYYY-MM-DD
  // → 日付部分のみ (YYYY-MM-DD) で比較
  const appLookup = new Map<string, string>()
  allApplications.forEach((app: any) => {
    const phone = jsPhoneMap.get(app.job_seeker_id)
    if (phone) {
      const dateOnly = app.applied_at?.split('T')[0] || ''
      const key = `${phone}:${dateOnly}`
      appLookup.set(key, app.id)
    }
  })
  console.log(`  マッチングキー数: ${appLookup.size}`)

  // CSVからマッチングして面談レコードを準備
  let matched = 0
  let skippedNoStatus = 0
  let skippedAlreadyExists = 0
  let skippedNoMatch = 0
  let created = 0
  let errors = 0

  const BATCH_SIZE = 50
  let processed = 0

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const phoneInterviewStatus = row[COL.PHONE_INTERVIEW_STATUS]?.trim()

      // 面談ステータスがない行はスキップ
      if (!phoneInterviewStatus || (phoneInterviewStatus !== '済み' && phoneInterviewStatus !== '流れ' && phoneInterviewStatus !== '辞退')) {
        skippedNoStatus++
        processed++
        continue
      }

      const phone = normalizePhone(row[COL.PHONE] || '')
      const appliedAt = parseDate(row[COL.DATE]) || ''

      if (!phone || !appliedAt) {
        skippedNoMatch++
        processed++
        continue
      }

      // applicationsとマッチング
      const key = `${phone}:${appliedAt}`
      const applicationId = appLookup.get(key)

      if (!applicationId) {
        skippedNoMatch++
        processed++
        continue
      }

      matched++

      // 既にinterviewsがある場合はスキップ
      if (existingInterviewAppIds.has(applicationId)) {
        skippedAlreadyExists++
        processed++
        continue
      }

      if (!dryRun) {
        const phoneInterviewDate = parseDate(row[COL.PHONE_INTERVIEW_DATE])
        const scheduledAt = phoneInterviewDate || appliedAt
        const coordinatorName = row[COL.COORDINATOR]?.trim()
        const coordinatorId = coordinatorName ? findCoordinatorByLastName(coordinatorName) : null

        const interviewData: Record<string, any> = {
          tenant_id: tenantId,
          application_id: applicationId,
          interview_type: 'phone',
          scheduled_at: scheduledAt,
          conducted_at: phoneInterviewStatus === '済み' ? scheduledAt : null,
          result: phoneInterviewStatus === '済み' ? 'completed' : phoneInterviewStatus === '流れ' ? 'cancelled' : 'declined',
        }

        if (coordinatorId) {
          interviewData.interviewer_id = coordinatorId
        }

        const { error: ivError } = await supabase
          .from('interviews')
          .insert(interviewData)

        if (ivError) {
          errors++
        } else {
          created++
          existingInterviewAppIds.add(applicationId)
        }
      } else {
        created++
      }

      processed++
    }

    const progress = Math.min(100, Math.round((processed / dataRows.length) * 100))
    process.stdout.write(`\r⏳ 処理中... ${processed}/${dataRows.length} (${progress}%)`)
  }

  console.log('\n')
  console.log('='.repeat(50))
  console.log(`📊 バックフィル結果${dryRun ? '（dry-run）' : ''}`)
  console.log('='.repeat(50))
  console.log(`CSV総行数:           ${dataRows.length}`)
  console.log(`面談ステータスなし:  ${skippedNoStatus}`)
  console.log(`マッチ成功:          ${matched}`)
  console.log(`既存面談あり(skip):  ${skippedAlreadyExists}`)
  console.log(`マッチ失敗:          ${skippedNoMatch}`)
  console.log(`${dryRun ? '作成予定' : '作成成功'}:          ${created}`)
  if (errors > 0) {
    console.log(`エラー:              ${errors}`)
  }

  // 内訳
  console.log('\n📋 面談ステータス内訳:')
  const statusCounts: Record<string, number> = {}
  for (const row of dataRows) {
    const s = row[COL.PHONE_INTERVIEW_STATUS]?.trim() || '（空欄）'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  }
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}件`)
    })

  console.log(`\n✅ ${dryRun ? 'dry-run完了（実際の変更はありません）' : 'バックフィル完了!'}`)
}

main()
