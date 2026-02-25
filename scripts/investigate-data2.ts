/**
 * 追加調査: sales紐づきreferralの日付状況 + CSV比較
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

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
  const [referrals, sales] = await Promise.all([
    fetchAllRows('referrals', 'id, application_id, referred_at, dispatch_interview_at, hired_at, assignment_date, start_work_date, referral_status'),
    fetchAllRows('sales', 'id, referral_id, amount, status, expected_date, confirmed_date, paid_date'),
  ])

  const refMap = new Map<string, any>()
  referrals.forEach(r => refMap.set(r.id, r))

  // Check: for each sales status, how many have usable fallback dates?
  console.log('='.repeat(70))
  console.log('【Sales紐づきReferralの日付状況】')
  console.log('='.repeat(70))

  for (const status of ['expected', 'confirmed', 'paid']) {
    const statusSales = sales.filter(s => s.status === status)
    let hasStartWork = 0, hasHired = 0, hasReferred = 0, hasNothing = 0
    for (const s of statusSales) {
      const ref = refMap.get(s.referral_id)
      if (!ref) { hasNothing++; continue }
      if (ref.start_work_date) hasStartWork++
      if (ref.hired_at) hasHired++
      if (ref.referred_at) hasReferred++
      if (!ref.start_work_date && !ref.hired_at && !ref.referred_at) hasNothing++
    }
    console.log(`\n  status='${status}' (${statusSales.length}件):`)
    console.log(`    start_work_date あり: ${hasStartWork} (${(hasStartWork/statusSales.length*100).toFixed(1)}%)`)
    console.log(`    hired_at あり: ${hasHired} (${(hasHired/statusSales.length*100).toFixed(1)}%)`)
    console.log(`    referred_at あり: ${hasReferred} (${(hasReferred/statusSales.length*100).toFixed(1)}%)`)
    console.log(`    全日付なし: ${hasNothing}`)
  }

  // Now check: what the ReportsPage fallback chain would produce
  console.log('\n' + '='.repeat(70))
  console.log('【ReportsPage fallback chain のシミュレーション】')
  console.log('='.repeat(70))

  // 見込み: expected_date || hired_at || referred_at
  const expectedSales = sales.filter(s => s.status === 'expected')
  let expHasDate = 0
  for (const s of expectedSales) {
    const ref = refMap.get(s.referral_id)
    const date = s.expected_date || ref?.hired_at || ref?.referred_at
    if (date) expHasDate++
  }
  console.log(`\n  見込み (expected): ${expHasDate}/${expectedSales.length} にfallback日付あり`)

  // 稼働: confirmed_date || start_work_date || hired_at
  const confirmedSales = sales.filter(s => s.status === 'confirmed' || s.status === 'paid')
  let confHasDate = 0, confNoDate = 0
  for (const s of confirmedSales) {
    const ref = refMap.get(s.referral_id)
    const date = s.confirmed_date || ref?.start_work_date || ref?.hired_at
    if (date) confHasDate++
    else {
      confNoDate++
      // Show what ref data looks like
      if (confNoDate <= 5) {
        console.log(`    日付なし例: referral_id=${s.referral_id?.substring(0,8)} ref exists=${!!ref} start_work=${ref?.start_work_date} hired=${ref?.hired_at} referred=${ref?.referred_at}`)
      }
    }
  }
  console.log(`  稼働 (confirmed/paid): ${confHasDate}/${confirmedSales.length} にfallback日付あり (${confNoDate}件が日付なし)`)

  // The REAL issue: in the ReportsPage, 稼働 count uses the referral loop
  // But the gate is: appHasInterview - check how many referrals with confirmed/paid sales pass the interview gate
  const interviews = await fetchAllRows('interviews', 'application_id, conducted_at')
  const appHasInterview = new Set<string>()
  for (const iv of interviews) {
    if (iv.conducted_at) appHasInterview.add(iv.application_id)
  }

  let gatePass = 0, gateFail = 0
  const uniqueRefIds = new Set<string>()
  for (const s of confirmedSales) {
    if (uniqueRefIds.has(s.referral_id)) continue
    uniqueRefIds.add(s.referral_id)
    const ref = refMap.get(s.referral_id)
    if (!ref) { gateFail++; continue }
    if (appHasInterview.has(ref.application_id)) gatePass++
    else gateFail++
  }
  console.log(`\n  稼働対象referrals: interview gate通過=${gatePass}, 不通過=${gateFail}`)

  // Same for all confirmed/paid sales
  console.log('\n' + '='.repeat(70))
  console.log('【稼働が0になる原因分析】')
  console.log('='.repeat(70))

  // Count by status
  for (const status of ['confirmed', 'paid']) {
    const sts = sales.filter(s => s.status === status)
    let passGate = 0, failGate = 0, hasDate = 0, noDate = 0
    for (const s of sts) {
      const ref = refMap.get(s.referral_id)
      if (!ref) { failGate++; continue }
      if (!appHasInterview.has(ref.application_id)) { failGate++; continue }
      passGate++
      const date = s.confirmed_date || ref.start_work_date || ref.hired_at
      if (date) hasDate++
      else noDate++
    }
    console.log(`\n  status='${status}' (${sts.length}件):`)
    console.log(`    interview gate通過: ${passGate}`)
    console.log(`    interview gate不通過: ${failGate}`)
    console.log(`    gate通過+日付あり: ${hasDate}`)
    console.log(`    gate通過+日付なし: ${noDate}`)
  }

  // Now compare with CSV
  console.log('\n' + '='.repeat(70))
  console.log('【CSV比較: 繋ぎ数の月別比較】')
  console.log('='.repeat(70))

  // Read CSV and count referrals by month
  const csvPath = '/Users/yamaguchitatsuya/Desktop/名称未設定フォルダ/リオン管理システム/data/master.csv'
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const lines = csvContent.split('\n')

    // COL mapping from import-csv.ts
    const COL_APPLIED_AT = 3  // D列: 応募日
    const COL_REFERRAL_STATUS = 57  // BF列: 派遣紹介ステータス
    const COL_REFERRED_AT = 58  // BG列: 繋ぎ日（推測）
    const COL_PHONE = 14  // O列: 電話番号
    const COL_INTERVIEW_DATE = 61  // BJ列: 派遣面接日
    const COL_COMPANY = 63  // BL列: 紹介先
    const COL_PROGRESS = 64  // BM列: 進捗

    // Count rows that have referral data
    const csvRefByMonth = new Map<string, number>()
    const csvInterviewByMonth = new Map<string, number>()
    let csvTotalRefs = 0

    for (let i = 2; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
      const appliedAt = row[COL_APPLIED_AT] || ''
      const company = row[COL_COMPANY] || ''
      const referralStatus = row[COL_REFERRAL_STATUS] || ''
      const progress = row[COL_PROGRESS] || ''

      // 繋ぎ = has company name (BL列)
      if (company) {
        csvTotalRefs++
        // Which month? Use applied_at for now
        const month = appliedAt.substring(0, 7)
        if (month) csvRefByMonth.set(month, (csvRefByMonth.get(month) || 0) + 1)
      }
    }

    console.log(`\n  CSV総繋ぎ数（会社名あり）: ${csvTotalRefs}`)

    // DB referrals by applied_at month (for comparison)
    const apps = await fetchAllRows('applications', 'id, applied_at')
    const appMap = new Map<string, string>()
    apps.forEach(a => appMap.set(a.id, a.applied_at))

    const dbRefByAppliedMonth = new Map<string, number>()
    referrals.forEach(r => {
      const appliedAt = appMap.get(r.application_id)
      const month = (appliedAt || '').substring(0, 7)
      if (month) dbRefByAppliedMonth.set(month, (dbRefByAppliedMonth.get(month) || 0) + 1)
    })

    const dbRefByReferredMonth = new Map<string, number>()
    referrals.forEach(r => {
      const month = (r.referred_at || '').substring(0, 7)
      if (month) dbRefByReferredMonth.set(month, (dbRefByReferredMonth.get(month) || 0) + 1)
    })

    console.log('\nMonth    | CSV繋ぎ  | DB(応募月) | DB(繋ぎ月) | 差分(応募月)')
    console.log('-'.repeat(65))
    const allMonths = new Set([...csvRefByMonth.keys(), ...dbRefByAppliedMonth.keys()])
    for (const month of [...allMonths].sort()) {
      const csv = csvRefByMonth.get(month) || 0
      const dbApp = dbRefByAppliedMonth.get(month) || 0
      const dbRef = dbRefByReferredMonth.get(month) || 0
      const diff = dbApp - csv
      console.log(`${month.padEnd(9)}| ${String(csv).padStart(8)} | ${String(dbApp).padStart(10)} | ${String(dbRef).padStart(10)} | ${String(diff).padStart(5)}`)
    }
  } else {
    console.log('  CSV file not found at:', csvPath)
  }
}

main()
