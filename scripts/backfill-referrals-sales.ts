/**
 * 既存のreferrals/salesデータをCSVの正しい値にバックフィルするスクリプト
 *
 * 修正内容:
 * - referral_status: BM(進捗)列から正しく設定
 * - hired_at: BN(合否)=「採用」の場合に設定
 * - assignment_date: BS(赴任予定日)から設定
 * - start_work_date: CF(稼働日)から設定
 * - sales: BX(見込み)/CG(確定)/CH(入金)を別レコードで再作成
 *
 * 使用方法:
 *   npx tsx scripts/backfill-referrals-sales.ts <CSVファイルパス> [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const COL = {
  DATE: 5,
  PHONE: 19,
  REFERRAL_STATUS: 57,
  INTERVIEW_DATE: 61,
  PROGRESS: 64,
  RESULT: 65,
  ASSIGNMENT_DATE: 70,
  WORK_START_DATE: 83,
  EXPECTED_SALES: 75,
  SALES_AMOUNT: 84,
  PAID_AMOUNT: 85,
}

const REFERRAL_STATUS_MAP: Record<string, string> = {
  '紹介済み': 'referred',
  '繋ぎ': 'referred',
  '面接予定': 'interview_scheduled',
  '面接済み': 'interview_done',
  '済み': 'interview_done',
  '採用': 'hired',
  '赴任前': 'pre_assignment',
  '赴任済み': 'assigned',
  '稼働中': 'working',
  'キャンセル': 'cancelled',
  '不採用': 'declined',
  '辞退': 'declined',
  '流れ': 'cancelled',
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
      if (idx === 2) { ;[, month, day, year] = match.map(Number) }
      else if (idx === 3) { year = new Date().getFullYear(); ;[, month, day] = match.map(Number) }
      else { ;[, year, month, day] = match.map(Number) }
      if (year < 100) year += year < 50 ? 2000 : 1900
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  return null
}

function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null
  const cleaned = value.replace(/[,，円¥\\"]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function fetchAllRows(table: string, select: string, filters?: (q: any) => any): Promise<any[]> {
  const rows: any[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    let q = supabase.from(table).select(select)
    if (filters) q = filters(q)
    const { data, error } = await q.range(offset, offset + pageSize - 1)
    if (error) { console.error(`Fetch error (${table}):`, error.message); break }
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
    console.error('使用方法: npx tsx scripts/backfill-referrals-sales.ts <CSVファイルパス> [--dry-run]')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)
  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log(`📊 referrals/salesバックフィル${dryRun ? '（dry-run）' : ''}を開始します...\n`)

  const fileContent = fs.readFileSync(absolutePath, 'utf-8')
  const records = parse(fileContent, { skip_empty_lines: true, relax_column_count: true }) as string[][]
  const dataRows = records.slice(2)
  console.log(`📝 CSV行数: ${dataRows.length}`)

  // テナントID
  let tenantId = process.env.IMPORT_TENANT_ID
  if (!tenantId) {
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    tenantId = tenants?.[0]?.id
  }
  if (!tenantId) { console.error('テナントが見つかりません'); process.exit(1) }

  // 既存データ読み込み
  console.log('\n📥 既存データを読み込み中...')
  const allApps = await fetchAllRows('applications', 'id, job_seeker_id, applied_at')
  const allJobSeekers = await fetchAllRows('job_seekers', 'id, phone')
  const allReferrals = await fetchAllRows('referrals', 'id, application_id, referral_status, hired_at, assignment_date, start_work_date')
  const allSales = await fetchAllRows('sales', 'id, referral_id, amount, status')
  console.log(`  応募: ${allApps.length}, 求職者: ${allJobSeekers.length}, 紹介: ${allReferrals.length}, 売上: ${allSales.length}`)

  // マッピング
  const jsPhoneMap = new Map<string, string>()
  allJobSeekers.forEach((js: any) => { if (js.phone) jsPhoneMap.set(js.id, normalizePhone(js.phone)) })

  const appLookup = new Map<string, string>()
  allApps.forEach((app: any) => {
    const phone = jsPhoneMap.get(app.job_seeker_id)
    if (phone) {
      const dateOnly = app.applied_at?.split('T')[0] || ''
      appLookup.set(`${phone}:${dateOnly}`, app.id)
    }
  })

  // application_id → referral のマップ
  const refByApp = new Map<string, any>()
  allReferrals.forEach((ref: any) => refByApp.set(ref.application_id, ref))

  // referral_id → sales[] のマップ
  const salesByRef = new Map<string, any[]>()
  allSales.forEach((s: any) => {
    const arr = salesByRef.get(s.referral_id) || []
    arr.push(s)
    salesByRef.set(s.referral_id, arr)
  })

  console.log(`  マッチングキー数: ${appLookup.size}`)

  let refUpdated = 0
  let salesDeleted = 0
  let salesCreated = 0
  let skipped = 0
  let noMatch = 0
  let processed = 0

  for (let i = 0; i < dataRows.length; i += 50) {
    const batch = dataRows.slice(i, i + 50)

    for (const row of batch) {
      const referralStatusRaw = row[COL.REFERRAL_STATUS]?.trim()
      if (!referralStatusRaw || referralStatusRaw === '繋げず' || referralStatusRaw === '状態') {
        skipped++
        processed++
        continue
      }

      const phone = normalizePhone(row[COL.PHONE] || '')
      const appliedAt = parseDate(row[COL.DATE]) || ''
      if (!phone || !appliedAt) { noMatch++; processed++; continue }

      const appId = appLookup.get(`${phone}:${appliedAt}`)
      if (!appId) { noMatch++; processed++; continue }

      const ref = refByApp.get(appId)
      if (!ref) { noMatch++; processed++; continue }

      // === referralフィールド更新 ===
      const progressRaw = row[COL.PROGRESS]?.trim()
      const resultRaw = row[COL.RESULT]?.trim()
      const interviewDate = parseDate(row[COL.INTERVIEW_DATE])
      const assignmentDate = parseDate(row[COL.ASSIGNMENT_DATE])
      const workStartDate = parseDate(row[COL.WORK_START_DATE])

      // referral_status: BMから設定
      let newStatus = 'referred'
      if (progressRaw) {
        newStatus = REFERRAL_STATUS_MAP[progressRaw] || 'referred'
      }

      // hired_at: BN=採用
      const hiredAt = (resultRaw === '採用') ? (interviewDate || appliedAt) : null

      const updates: Record<string, any> = {}
      if (newStatus !== ref.referral_status) updates.referral_status = newStatus
      if (hiredAt && !ref.hired_at) updates.hired_at = hiredAt
      if (assignmentDate && !ref.assignment_date) updates.assignment_date = assignmentDate
      if (workStartDate && !ref.start_work_date) updates.start_work_date = workStartDate

      if (!dryRun && Object.keys(updates).length > 0) {
        await supabase.from('referrals').update(updates).eq('id', ref.id)
      }
      if (Object.keys(updates).length > 0) refUpdated++

      // === sales再作成 ===
      const expectedAmount = parseAmount(row[COL.EXPECTED_SALES])
      const confirmedAmount = parseAmount(row[COL.SALES_AMOUNT])
      const paidAmount = parseAmount(row[COL.PAID_AMOUNT])

      const existingSales = salesByRef.get(ref.id) || []
      const needsUpdate = (
        (expectedAmount && expectedAmount > 0) ||
        (confirmedAmount && confirmedAmount > 0) ||
        (paidAmount && paidAmount > 0)
      )

      if (needsUpdate) {
        // 既存salesを削除
        if (!dryRun && existingSales.length > 0) {
          for (const s of existingSales) {
            await supabase.from('sales').delete().eq('id', s.id)
            salesDeleted++
          }
        } else {
          salesDeleted += existingSales.length
        }

        // 新しいsalesを作成
        const newSales: { tenant_id: string; referral_id: string; amount: number; status: string }[] = []
        if (expectedAmount && expectedAmount > 0) {
          newSales.push({ tenant_id: tenantId!, referral_id: ref.id, amount: expectedAmount, status: 'expected' })
        }
        if (confirmedAmount && confirmedAmount > 0) {
          newSales.push({ tenant_id: tenantId!, referral_id: ref.id, amount: confirmedAmount, status: 'confirmed' })
        }
        if (paidAmount && paidAmount > 0) {
          newSales.push({ tenant_id: tenantId!, referral_id: ref.id, amount: paidAmount, status: 'paid' })
        }

        if (!dryRun) {
          for (const sale of newSales) {
            await supabase.from('sales').insert(sale)
          }
        }
        salesCreated += newSales.length
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
  console.log(`CSV総行数:             ${dataRows.length}`)
  console.log(`スキップ(繋ぎなし):    ${skipped}`)
  console.log(`マッチ失敗:            ${noMatch}`)
  console.log(`referral更新:          ${refUpdated}`)
  console.log(`sales削除:             ${salesDeleted}`)
  console.log(`sales作成:             ${salesCreated}`)
  console.log(`\n✅ ${dryRun ? 'dry-run完了' : 'バックフィル完了!'}`)
}

main()
