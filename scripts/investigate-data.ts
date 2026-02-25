/**
 * データ調査スクリプト
 * - 各テーブルの日付カラムnull率
 * - 月別件数
 * - salesのexpected_date/confirmed_date/paid_dateの状況
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchAllRows(table: string, select: string): Promise<any[]> {
  const rows: any[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(offset, offset + pageSize - 1)
    if (error) { console.error(`Fetch error (${table}):`, error.message); break }
    if (!data || data.length === 0) break
    rows.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }
  return rows
}

async function main() {
  console.log('='.repeat(70))
  console.log('データ調査')
  console.log('='.repeat(70))

  // 1. Fetch all data
  const [apps, interviews, referrals, sales] = await Promise.all([
    fetchAllRows('applications', 'id, applied_at, created_at'),
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, created_at'),
    fetchAllRows('referrals', 'id, application_id, referred_at, dispatch_interview_at, hired_at, assignment_date, start_work_date, referral_status, created_at'),
    fetchAllRows('sales', 'id, referral_id, amount, status, expected_date, confirmed_date, invoiced_date, paid_date, created_at'),
  ])

  console.log(`\nテーブル件数: applications=${apps.length}, interviews=${interviews.length}, referrals=${referrals.length}, sales=${sales.length}`)

  // 2. Sales date column null率
  console.log('\n' + '='.repeat(70))
  console.log('【Sales 日付カラム null率】')
  console.log('='.repeat(70))
  const salesTotal = sales.length
  const nullCounts = {
    expected_date: sales.filter(s => !s.expected_date).length,
    confirmed_date: sales.filter(s => !s.confirmed_date).length,
    invoiced_date: sales.filter(s => !s.invoiced_date).length,
    paid_date: sales.filter(s => !s.paid_date).length,
  }
  for (const [col, nullCount] of Object.entries(nullCounts)) {
    const pct = salesTotal > 0 ? ((nullCount / salesTotal) * 100).toFixed(1) : '0'
    console.log(`  ${col}: ${nullCount}/${salesTotal} null (${pct}%)`)
  }

  // Non-null date examples
  const salesWithDates = sales.filter(s => s.expected_date || s.confirmed_date || s.paid_date)
  console.log(`\n  日付が1つでもあるsales: ${salesWithDates.length}件`)
  if (salesWithDates.length > 0) {
    console.log('  例:')
    for (const s of salesWithDates.slice(0, 5)) {
      console.log(`    status=${s.status} expected=${s.expected_date} confirmed=${s.confirmed_date} paid=${s.paid_date} amount=${s.amount}`)
    }
  }

  // 3. Sales by status
  console.log('\n【Sales status別件数】')
  const statusMap = new Map<string, number>()
  sales.forEach(s => statusMap.set(s.status, (statusMap.get(s.status) || 0) + 1))
  for (const [status, count] of [...statusMap.entries()].sort()) {
    console.log(`  ${status}: ${count}`)
  }

  // 4. Referrals date null率
  console.log('\n' + '='.repeat(70))
  console.log('【Referrals 日付カラム null率】')
  console.log('='.repeat(70))
  const refTotal = referrals.length
  const refNulls = {
    referred_at: referrals.filter(r => !r.referred_at).length,
    dispatch_interview_at: referrals.filter(r => !r.dispatch_interview_at).length,
    hired_at: referrals.filter(r => !r.hired_at).length,
    assignment_date: referrals.filter(r => !r.assignment_date).length,
    start_work_date: referrals.filter(r => !r.start_work_date).length,
  }
  for (const [col, nullCount] of Object.entries(refNulls)) {
    const pct = refTotal > 0 ? ((nullCount / refTotal) * 100).toFixed(1) : '0'
    console.log(`  ${col}: ${nullCount}/${refTotal} null (${pct}%)`)
  }

  // 5. Interviews date null率
  console.log('\n' + '='.repeat(70))
  console.log('【Interviews 日付カラム null率】')
  console.log('='.repeat(70))
  const ivTotal = interviews.length
  const ivNulls = {
    scheduled_at: interviews.filter(iv => !iv.scheduled_at).length,
    conducted_at: interviews.filter(iv => !iv.conducted_at).length,
  }
  for (const [col, nullCount] of Object.entries(ivNulls)) {
    const pct = ivTotal > 0 ? ((nullCount / ivTotal) * 100).toFixed(1) : '0'
    console.log(`  ${col}: ${nullCount}/${ivTotal} null (${pct}%)`)
  }

  // 6. 月別件数: interviews by conducted_at
  console.log('\n' + '='.repeat(70))
  console.log('【月別件数】')
  console.log('='.repeat(70))

  // Applications by applied_at
  const appsByMonth = new Map<string, number>()
  apps.forEach(a => {
    const m = (a.applied_at || '').substring(0, 7)
    if (m) appsByMonth.set(m, (appsByMonth.get(m) || 0) + 1)
  })

  // Interviews by conducted_at
  const ivByMonth = new Map<string, number>()
  interviews.forEach(iv => {
    const m = (iv.conducted_at || '').substring(0, 7)
    if (m) ivByMonth.set(m, (ivByMonth.get(m) || 0) + 1)
  })

  // Referrals by referred_at
  const refByMonth = new Map<string, number>()
  referrals.forEach(r => {
    const m = (r.referred_at || '').substring(0, 7)
    if (m) refByMonth.set(m, (refByMonth.get(m) || 0) + 1)
  })

  // Sales by status per month (using created_at since date columns may be null)
  const salesExpByMonth = new Map<string, number>()
  const salesConfByMonth = new Map<string, number>()
  const salesPaidByMonth = new Map<string, number>()
  // Also track by referral's referred_at as fallback
  const refIdToRef = new Map<string, any>()
  referrals.forEach(r => refIdToRef.set(r.id, r))

  sales.forEach(s => {
    const ref = refIdToRef.get(s.referral_id)
    const fallbackDate = ref?.hired_at || ref?.referred_at || ''
    if (s.status === 'expected') {
      const m = (s.expected_date || fallbackDate).substring(0, 7)
      if (m) salesExpByMonth.set(m, (salesExpByMonth.get(m) || 0) + 1)
    }
    if (s.status === 'confirmed') {
      const m = (s.confirmed_date || ref?.start_work_date || fallbackDate).substring(0, 7)
      if (m) salesConfByMonth.set(m, (salesConfByMonth.get(m) || 0) + 1)
    }
    if (s.status === 'paid') {
      const m = (s.paid_date || ref?.start_work_date || fallbackDate).substring(0, 7)
      if (m) salesPaidByMonth.set(m, (salesPaidByMonth.get(m) || 0) + 1)
    }
  })

  // Hired by month
  const hiredByMonth = new Map<string, number>()
  referrals.forEach(r => {
    if (r.hired_at) {
      const m = r.hired_at.substring(0, 7)
      hiredByMonth.set(m, (hiredByMonth.get(m) || 0) + 1)
    }
  })

  const allMonths = new Set<string>()
  ;[appsByMonth, ivByMonth, refByMonth, salesExpByMonth, salesConfByMonth, salesPaidByMonth, hiredByMonth].forEach(map => {
    for (const m of map.keys()) allMonths.add(m)
  })

  const hdr = 'Month    | 応募    | 面談    | 繋ぎ    | 採用    | 見込    | 確定    | 入金'
  console.log(hdr)
  console.log('-'.repeat(80))
  for (const month of [...allMonths].sort()) {
    const a = appsByMonth.get(month) || 0
    const iv = ivByMonth.get(month) || 0
    const ref = refByMonth.get(month) || 0
    const h = hiredByMonth.get(month) || 0
    const se = salesExpByMonth.get(month) || 0
    const sc = salesConfByMonth.get(month) || 0
    const sp = salesPaidByMonth.get(month) || 0
    console.log(`${month.padEnd(9)}| ${String(a).padStart(7)} | ${String(iv).padStart(7)} | ${String(ref).padStart(7)} | ${String(h).padStart(7)} | ${String(se).padStart(7)} | ${String(sc).padStart(7)} | ${String(sp).padStart(7)}`)
  }

  // 7. Interviews created_at distribution (to check if 2025-01/02 were imported)
  console.log('\n' + '='.repeat(70))
  console.log('【Interviews created_at 分布（インポート時期）】')
  console.log('='.repeat(70))
  const ivCreatedByMonth = new Map<string, number>()
  interviews.forEach(iv => {
    const m = (iv.created_at || '').substring(0, 10)
    ivCreatedByMonth.set(m, (ivCreatedByMonth.get(m) || 0) + 1)
  })
  for (const [date, count] of [...ivCreatedByMonth.entries()].sort()) {
    console.log(`  ${date}: ${count}件`)
  }

  // 8. Referrals created_at distribution
  console.log('\n【Referrals created_at 分布】')
  const refCreatedByDate = new Map<string, number>()
  referrals.forEach(r => {
    const m = (r.created_at || '').substring(0, 10)
    refCreatedByDate.set(m, (refCreatedByDate.get(m) || 0) + 1)
  })
  for (const [date, count] of [...refCreatedByDate.entries()].sort()) {
    console.log(`  ${date}: ${count}件`)
  }

  // 9. Sales created_at distribution
  console.log('\n【Sales created_at 分布】')
  const salesCreatedByDate = new Map<string, number>()
  sales.forEach(s => {
    const m = (s.created_at || '').substring(0, 10)
    salesCreatedByDate.set(m, (salesCreatedByDate.get(m) || 0) + 1)
  })
  for (const [date, count] of [...salesCreatedByDate.entries()].sort()) {
    console.log(`  ${date}: ${count}件`)
  }

  // 10. Check referral_status distribution
  console.log('\n【Referral status 分布】')
  const statusDist = new Map<string, number>()
  referrals.forEach(r => statusDist.set(r.referral_status, (statusDist.get(r.referral_status) || 0) + 1))
  for (const [status, count] of [...statusDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`)
  }
}

main()
