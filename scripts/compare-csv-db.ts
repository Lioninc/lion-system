/**
 * CSV用ファイル vs DB の月別比較
 * CSV用ファイル列: 1:年月日, 23:面談日, 25:繋ぎ状況, 26:紹介先
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

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

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

async function main() {
  // Read all CSV files
  const csvDir = '/Users/yamaguchitatsuya/Downloads'
  const csvFiles = []
  for (let i = 1; i <= 12; i++) {
    const filePath = path.join(csvDir, `CSV用 - ${i}.csv`)
    if (fs.existsSync(filePath)) csvFiles.push({ month: i, path: filePath })
  }

  console.log(`CSV用ファイル: ${csvFiles.length}件`)

  // Parse all CSV rows
  interface CsvRow {
    appliedAt: string // 年月日
    interviewDate: string // 面談日
    tsunagiStatus: string // 繋ぎ状況
    company: string // 紹介先
    monthNum: number // which file
  }

  const allCsvRows: CsvRow[] = []
  for (const f of csvFiles) {
    const content = fs.readFileSync(f.path, 'utf-8')
    const lines = content.split('\n')
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const cols = parseCsvLine(lines[i])
      allCsvRows.push({
        appliedAt: cols[0] || '',
        interviewDate: cols[22] || '',
        tsunagiStatus: cols[24] || '',
        company: cols[25] || '',
        monthNum: f.month,
      })
    }
  }

  console.log(`CSV総行数: ${allCsvRows.length}`)

  // CSV月別集計
  const csvByMonth = new Map<string, {
    apps: number
    interviews: number
    tsunagi: number
    tsunagiWithCompany: number
  }>()

  for (const row of allCsvRows) {
    // Parse date: 2025/01/01 → 2025-01
    const m = row.appliedAt.replace(/\//g, '-').substring(0, 7)
    if (!m) continue
    if (!csvByMonth.has(m)) csvByMonth.set(m, { apps: 0, interviews: 0, tsunagi: 0, tsunagiWithCompany: 0 })
    const entry = csvByMonth.get(m)!
    entry.apps++
    if (row.interviewDate) entry.interviews++
    if (row.company) entry.tsunagiWithCompany++
    if (row.tsunagiStatus && row.tsunagiStatus !== '') entry.tsunagi++
  }

  // DB data
  const [apps, interviews, referrals, sales] = await Promise.all([
    fetchAllRows('applications', 'id, applied_at'),
    fetchAllRows('interviews', 'id, application_id, conducted_at'),
    fetchAllRows('referrals', 'id, application_id, referred_at, hired_at, start_work_date, referral_status'),
    fetchAllRows('sales', 'id, referral_id, status, amount'),
  ])

  // DB月別集計 (応募月ベース for comparison)
  const appById = new Map<string, any>()
  apps.forEach(a => appById.set(a.id, a))

  const dbAppsByMonth = new Map<string, number>()
  apps.forEach(a => {
    const m = (a.applied_at || '').substring(0, 7)
    if (m) dbAppsByMonth.set(m, (dbAppsByMonth.get(m) || 0) + 1)
  })

  // DB interviews by conducted_at month
  const dbIvByMonth = new Map<string, number>()
  interviews.forEach(iv => {
    if (iv.conducted_at) {
      const m = iv.conducted_at.substring(0, 7)
      dbIvByMonth.set(m, (dbIvByMonth.get(m) || 0) + 1)
    }
  })

  // DB interviews by applied_at month (for fairer comparison)
  const dbIvByAppliedMonth = new Map<string, number>()
  interviews.forEach(iv => {
    if (iv.conducted_at) {
      const app = appById.get(iv.application_id)
      const m = (app?.applied_at || '').substring(0, 7)
      if (m) dbIvByAppliedMonth.set(m, (dbIvByAppliedMonth.get(m) || 0) + 1)
    }
  })

  // DB referrals by referred_at month
  const dbRefByRefMonth = new Map<string, number>()
  referrals.forEach(r => {
    const m = (r.referred_at || '').substring(0, 7)
    if (m) dbRefByRefMonth.set(m, (dbRefByRefMonth.get(m) || 0) + 1)
  })

  // DB referrals by applied_at month
  const dbRefByAppliedMonth = new Map<string, number>()
  referrals.forEach(r => {
    const app = appById.get(r.application_id)
    const m = (app?.applied_at || '').substring(0, 7)
    if (m) dbRefByAppliedMonth.set(m, (dbRefByAppliedMonth.get(m) || 0) + 1)
  })

  // Comparison table
  console.log('\n' + '='.repeat(100))
  console.log('【CSV vs DB 月別比較】')
  console.log('='.repeat(100))
  console.log('Month    | CSV応募 | DB応募  | CSV面談 | DB面談(応募月)| DB面談(実施月)| CSV繋ぎ | DB繋ぎ(応募月)| DB繋ぎ(繋ぎ月)')
  console.log('-'.repeat(100))

  const allMonths = new Set([...csvByMonth.keys(), ...dbAppsByMonth.keys()])
  let totals = { csvApps: 0, dbApps: 0, csvIv: 0, dbIvApp: 0, dbIvCond: 0, csvRef: 0, dbRefApp: 0, dbRefRef: 0 }

  for (const month of [...allMonths].sort()) {
    const csv = csvByMonth.get(month) || { apps: 0, interviews: 0, tsunagi: 0, tsunagiWithCompany: 0 }
    const dbApps = dbAppsByMonth.get(month) || 0
    const dbIvApp = dbIvByAppliedMonth.get(month) || 0
    const dbIvCond = dbIvByMonth.get(month) || 0
    const dbRefApp = dbRefByAppliedMonth.get(month) || 0
    const dbRefRef = dbRefByRefMonth.get(month) || 0
    const csvRef = csv.tsunagiWithCompany

    totals.csvApps += csv.apps; totals.dbApps += dbApps
    totals.csvIv += csv.interviews; totals.dbIvApp += dbIvApp; totals.dbIvCond += dbIvCond
    totals.csvRef += csvRef; totals.dbRefApp += dbRefApp; totals.dbRefRef += dbRefRef

    console.log(
      `${month.padEnd(9)}| ${String(csv.apps).padStart(7)} | ${String(dbApps).padStart(7)} | ${String(csv.interviews).padStart(7)} | ${String(dbIvApp).padStart(13)} | ${String(dbIvCond).padStart(13)} | ${String(csvRef).padStart(7)} | ${String(dbRefApp).padStart(13)} | ${String(dbRefRef).padStart(13)}`
    )
  }
  console.log('-'.repeat(100))
  console.log(
    `${'TOTAL'.padEnd(9)}| ${String(totals.csvApps).padStart(7)} | ${String(totals.dbApps).padStart(7)} | ${String(totals.csvIv).padStart(7)} | ${String(totals.dbIvApp).padStart(13)} | ${String(totals.dbIvCond).padStart(13)} | ${String(totals.csvRef).padStart(7)} | ${String(totals.dbRefApp).padStart(13)} | ${String(totals.dbRefRef).padStart(13)}`
  )

  // Tsunagi status distribution in CSV
  console.log('\n【CSV 繋ぎ状況の分布】')
  const statusDist = new Map<string, number>()
  allCsvRows.forEach(r => {
    if (r.tsunagiStatus) statusDist.set(r.tsunagiStatus, (statusDist.get(r.tsunagiStatus) || 0) + 1)
  })
  for (const [status, count] of [...statusDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${status}": ${count}`)
  }

  // Check: CSV rows with company but different tsunagi status
  console.log('\n【CSV 紹介先ありの繋ぎ状況】')
  const companyStatusDist = new Map<string, number>()
  allCsvRows.filter(r => r.company).forEach(r => {
    const key = r.tsunagiStatus || '(空)'
    companyStatusDist.set(key, (companyStatusDist.get(key) || 0) + 1)
  })
  for (const [status, count] of [...companyStatusDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${status}": ${count}`)
  }
}

main()
