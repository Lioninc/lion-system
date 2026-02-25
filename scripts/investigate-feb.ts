/**
 * 2025年2月の差分(DB=282 vs スプシ=266)を特定調査
 * DBの282件のうち、CSVのAU+AV=2025-2以外に由来するものを見つける
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

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
  // CSV: AZ=済み & AU+AV=2025-2 のレコード
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')

  const COL_PHONE = 19
  const COL_AU = 46
  const COL_AV = 47
  const COL_AY = 50
  const COL_AZ = 51

  // CSV 2月済みの電話番号+日付を収集
  const csvFebPhoneDates = new Map<string, number>()  // phone:date → count
  let csvFebTotal = 0
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    if (row[COL_AZ] !== '済み') continue
    const au = row[COL_AU] || ''
    const av = row[COL_AV] || ''
    if (au !== '2025' || av !== '2') continue
    csvFebTotal++
    const phone = (row[COL_PHONE] || '').replace(/[-\s\u3000()（）]/g, '')
    const ay = row[COL_AY] || ''
    if (!phone || !ay) continue
    const parts = ay.split('/')
    if (parts.length >= 3) {
      const dateKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      const key = `${phone}:${dateKey}`
      csvFebPhoneDates.set(key, (csvFebPhoneDates.get(key) || 0) + 1)
    }
  }
  console.log(`CSV AU+AV=2025-2 & AZ=済み: ${csvFebTotal}件`)
  console.log(`CSV unique phone:date keys: ${csvFebPhoneDates.size}`)

  // CSV全体の済みで、AY日付が2025-02のもの（AU+AVは別の月かもしれない）
  let csvAyFebCount = 0
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    if (row[COL_AZ] !== '済み') continue
    const ay = row[COL_AY] || ''
    if (ay.startsWith('2025/2/') || ay.startsWith('2025/02/')) csvAyFebCount++
  }
  console.log(`CSV AZ=済み & AY月=2025-02: ${csvAyFebCount}件`)

  // DB: 2025-02のconducted interviews
  const [interviews, apps, jobSeekers] = await Promise.all([
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result'),
    fetchAllRows('applications', 'id, job_seeker_id, applied_at'),
    fetchAllRows('job_seekers', 'id, phone, name_kana'),
  ])

  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))
  const jsMap = new Map<string, any>()
  jobSeekers.forEach(js => jsMap.set(js.id, js))

  const dbFeb = interviews.filter(iv =>
    iv.conducted_at && iv.scheduled_at?.startsWith('2025-02')
  )
  console.log(`\nDB scheduled_at 2025-02 & conducted: ${dbFeb.length}件`)

  // DB 2月のphone:date keys
  const dbFebPhoneDates = new Map<string, any[]>()
  for (const iv of dbFeb) {
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const js = jsMap.get(app.job_seeker_id)
    const phone = (js?.phone || '').replace(/[-\s\u3000()（）]/g, '')
    const dateKey = iv.scheduled_at?.substring(0, 10) || ''
    const key = `${phone}:${dateKey}`
    const arr = dbFebPhoneDates.get(key) || []
    arr.push({ ...iv, phone, applied_at: app.applied_at, name: js?.name_kana })
    dbFebPhoneDates.set(key, arr)
  }

  // DB keys that don't match CSV February
  let dbOnlyCount = 0
  const dbOnlyKeys: string[] = []
  for (const [key, arr] of dbFebPhoneDates) {
    const csvCount = csvFebPhoneDates.get(key) || 0
    if (arr.length > csvCount) {
      const extra = arr.length - csvCount
      dbOnlyCount += extra
      if (dbOnlyKeys.length < 20) {
        dbOnlyKeys.push(`${key}: DB=${arr.length}, CSV_Feb=${csvCount}`)
        for (const iv of arr) {
          dbOnlyKeys.push(`    result=${iv.result} applied=${iv.applied_at?.substring(0, 10)} name=${iv.name}`)
        }
      }
    }
  }
  console.log(`\nDBにあってCSV 2月にない（余分）: ${dbOnlyCount}件`)
  for (const line of dbOnlyKeys) {
    console.log(`  ${line}`)
  }

  // CSV keys not in DB
  let csvOnlyCount = 0
  for (const [key, count] of csvFebPhoneDates) {
    const dbArr = dbFebPhoneDates.get(key) || []
    if (count > dbArr.length) {
      csvOnlyCount += count - dbArr.length
    }
  }
  console.log(`\nCSV 2月にあってDBにない: ${csvOnlyCount}件`)

  // Summary
  console.log(`\n--- サマリ ---`)
  console.log(`CSV AZ=済み & AU+AV=2025-2: ${csvFebTotal}件`)
  console.log(`DB scheduled_at=2025-02 & conducted: ${dbFeb.length}件`)
  console.log(`差分: +${dbFeb.length - csvFebTotal}`)
  console.log(`DB余分: ${dbOnlyCount}件`)
  console.log(`CSV余分: ${csvOnlyCount}件`)
}

main()
