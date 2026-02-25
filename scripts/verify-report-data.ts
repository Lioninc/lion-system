/**
 * バックフィル後のレポートデータ検証
 * ReportsPageと同じロジックで集計し、月別データを表示
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
  const [apps, interviews, referrals, sales] = await Promise.all([
    fetchAllRows('applications', 'id, applied_at'),
    fetchAllRows('interviews', 'id, application_id, conducted_at'),
    fetchAllRows('referrals', 'id, application_id, referred_at, dispatch_interview_at, hired_at, start_work_date, referral_status'),
    fetchAllRows('sales', 'id, referral_id, amount, status, expected_date, confirmed_date, paid_date'),
  ])

  console.log(`apps=${apps.length} interviews=${interviews.length} referrals=${referrals.length} sales=${sales.length}`)

  const appIdSet = new Set(apps.map(a => a.id))

  // Filter by apps
  const filteredIv = interviews.filter(iv => appIdSet.has(iv.application_id))
  const filteredRef = referrals.filter(r => appIdSet.has(r.application_id))
  const refIdSet = new Set(filteredRef.map(r => r.id))
  const filteredSales = sales.filter(s => refIdSet.has(s.referral_id))

  // Build maps
  const salesByRef = new Map<string, typeof filteredSales>()
  for (const s of filteredSales) {
    const arr = salesByRef.get(s.referral_id) || []
    arr.push(s)
    salesByRef.set(s.referral_id, arr)
  }

  // Interview gate
  const appHasInterview = new Set<string>()
  for (const iv of filteredIv) {
    if (iv.conducted_at) appHasInterview.add(iv.application_id)
  }

  // Aggregate (same logic as ReportsPage)
  interface Metrics {
    interviewsDone: number
    referrals: number
    dispatchInterviewScheduled: number
    dispatchInterviewDone: number
    hired: number
    prospect: number
    working: number
    salesExpectedAmount: number
    salesConfirmedAmount: number
    salesPaidAmount: number
  }

  const monthMap = new Map<string, Metrics>()
  const emptyMetrics = (): Metrics => ({
    interviewsDone: 0, referrals: 0, dispatchInterviewScheduled: 0,
    dispatchInterviewDone: 0, hired: 0, prospect: 0, working: 0,
    salesExpectedAmount: 0, salesConfirmedAmount: 0, salesPaidAmount: 0,
  })

  const ensureMonth = (month: string) => {
    if (!monthMap.has(month)) monthMap.set(month, emptyMetrics())
    return monthMap.get(month)!
  }

  const DONE_STATUSES = ['interview_done', 'hired', 'pre_assignment', 'assigned', 'working']

  // 1. Interviews
  for (const iv of filteredIv) {
    if (iv.conducted_at) {
      ensureMonth(iv.conducted_at.substring(0, 7)).interviewsDone += 1
    }
  }

  // 2. Referrals
  for (const ref of filteredRef) {
    if (!appHasInterview.has(ref.application_id)) continue

    if (ref.referred_at) {
      ensureMonth(ref.referred_at.substring(0, 7)).referrals += 1
    }

    if (ref.dispatch_interview_at) {
      const diMonth = ref.dispatch_interview_at.substring(0, 7)
      ensureMonth(diMonth).dispatchInterviewScheduled += 1
      if (DONE_STATUSES.includes(ref.referral_status)) {
        ensureMonth(diMonth).dispatchInterviewDone += 1
      }
    }

    if (ref.hired_at) {
      ensureMonth(ref.hired_at.substring(0, 7)).hired += 1
    }

    const refSales = salesByRef.get(ref.id) || []

    // 見込み → expected_date
    const expectedSale = refSales.find(s => s.status === 'expected')
    if (expectedSale) {
      const pMonth = (expectedSale.expected_date || ref.hired_at || ref.referred_at)?.substring(0, 7)
      if (pMonth) ensureMonth(pMonth).prospect += 1
    }

    // 稼働 → confirmed_date
    const confirmedSale = refSales.find(s => s.status === 'confirmed' || s.status === 'paid')
    if (confirmedSale) {
      const wMonth = (confirmedSale.confirmed_date || ref.start_work_date || ref.hired_at)?.substring(0, 7)
      if (wMonth) ensureMonth(wMonth).working += 1
    }

    // 金額
    for (const sale of refSales) {
      if (sale.status === 'expected') {
        const m = (sale.expected_date || ref.hired_at || ref.referred_at)?.substring(0, 7)
        if (m) ensureMonth(m).salesExpectedAmount += Number(sale.amount)
      }
      if (sale.status === 'confirmed') {
        const m = (sale.confirmed_date || ref.start_work_date || ref.hired_at)?.substring(0, 7)
        if (m) ensureMonth(m).salesConfirmedAmount += Number(sale.amount)
      }
      if (sale.status === 'paid') {
        const m = (sale.paid_date || ref.start_work_date || ref.hired_at)?.substring(0, 7)
        if (m) ensureMonth(m).salesPaidAmount += Number(sale.amount)
      }
    }
  }

  // Display
  console.log('\n' + '='.repeat(130))
  console.log('【バックフィル後 月次レポート（アクション日ベース）】')
  console.log('='.repeat(130))
  const hdr = 'Month    | 面談  | 繋ぎ  | 面接予定| 面接数| 採用  | 見込  | 稼働  | 売上見込    | 売上確定    | 入金済'
  console.log(hdr)
  console.log('-'.repeat(130))

  const total = emptyMetrics()
  for (const [month, m] of [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    Object.keys(total).forEach(k => (total as any)[k] += (m as any)[k])
    const fmt = (n: number) => n > 0 ? String(n).padStart(6) : '     -'
    const fmtY = (n: number) => n > 0 ? ('¥' + Math.round(n).toLocaleString()).padStart(12) : '          -'
    console.log(
      `${month.padEnd(9)}| ${fmt(m.interviewsDone)} | ${fmt(m.referrals)} | ${fmt(m.dispatchInterviewScheduled)} | ${fmt(m.dispatchInterviewDone)} | ${fmt(m.hired)} | ${fmt(m.prospect)} | ${fmt(m.working)} | ${fmtY(m.salesExpectedAmount)} | ${fmtY(m.salesConfirmedAmount)} | ${fmtY(m.salesPaidAmount)}`
    )
  }
  console.log('-'.repeat(130))
  const fmt = (n: number) => String(n).padStart(6)
  const fmtY = (n: number) => ('¥' + Math.round(n).toLocaleString()).padStart(12)
  console.log(
    `${'TOTAL'.padEnd(9)}| ${fmt(total.interviewsDone)} | ${fmt(total.referrals)} | ${fmt(total.dispatchInterviewScheduled)} | ${fmt(total.dispatchInterviewDone)} | ${fmt(total.hired)} | ${fmt(total.prospect)} | ${fmt(total.working)} | ${fmtY(total.salesExpectedAmount)} | ${fmtY(total.salesConfirmedAmount)} | ${fmtY(total.salesPaidAmount)}`
  )

  // Highlight: sales null check after backfill
  console.log('\n【Sales日付null率（バックフィル後）】')
  const expNull = filteredSales.filter(s => s.status === 'expected' && !s.expected_date).length
  const confNull = filteredSales.filter(s => s.status === 'confirmed' && !s.confirmed_date).length
  const paidNull = filteredSales.filter(s => s.status === 'paid' && !s.paid_date).length
  console.log(`  expected (${filteredSales.filter(s => s.status === 'expected').length}件): ${expNull}件 null`)
  console.log(`  confirmed (${filteredSales.filter(s => s.status === 'confirmed').length}件): ${confNull}件 null`)
  console.log(`  paid (${filteredSales.filter(s => s.status === 'paid').length}件): ${paidNull}件 null`)
}

main()
