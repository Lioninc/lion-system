/**
 * CSV と DB の電話番号・日付フォーマットをデバッグ
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
  // CSV サンプル
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')
  const COL_PHONE = 14
  const COL_AY = 50
  const COL_AZ = 51

  console.log('【CSV AZ=済み サンプル (先頭5件)】')
  let count = 0
  for (let i = 2; i < lines.length && count < 5; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    const az = row[COL_AZ] || ''
    if (az !== '済み') continue
    const phone = row[COL_PHONE] || ''
    const ay = row[COL_AY] || ''
    console.log(`  phone="${phone}" AY="${ay}" AZ="${az}"`)
    count++
  }

  // DB サンプル
  const [interviews, apps, jobSeekers] = await Promise.all([
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result'),
    fetchAllRows('applications', 'id, job_seeker_id'),
    fetchAllRows('job_seekers', 'id, phone'),
  ])
  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))
  const jsMap = new Map<string, string>()
  jobSeekers.forEach(js => jsMap.set(js.id, js.phone || ''))

  const conducted = interviews.filter(iv => iv.conducted_at)
  console.log('\n【DB conducted サンプル (先頭5件)】')
  for (const iv of conducted.slice(0, 5)) {
    const app = appMap.get(iv.application_id)
    const phone = app ? (jsMap.get(app.job_seeker_id) || '?') : '?'
    console.log(`  phone="${phone}" scheduled_at="${iv.scheduled_at}" result="${iv.result}"`)
  }

  // 照合テスト: 電話番号を正規化せずに生で比較
  const csvRawKeys = new Set<string>()
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    if (row[COL_AZ] !== '済み') continue
    const phone = (row[COL_PHONE] || '').replace(/[-\s\u3000()（）]/g, '')
    const ay = row[COL_AY] || ''
    if (!phone || !ay) continue
    // AY → YYYY-MM-DD
    const parts = ay.split('/')
    if (parts.length >= 3) {
      const dateKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      csvRawKeys.add(`${phone}:${dateKey}`)
    }
  }
  console.log(`\nCSV keys (with leading 0): ${csvRawKeys.size}`)

  // DB keys
  let matchCount = 0
  for (const iv of conducted.slice(0, 20)) {
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const phone = (jsMap.get(app.job_seeker_id) || '').replace(/[-\s\u3000()（）]/g, '')
    const dateKey = iv.scheduled_at?.substring(0, 10) || ''
    const key = `${phone}:${dateKey}`
    const found = csvRawKeys.has(key)
    if (matchCount < 5 || found) {
      console.log(`  DB key="${key}" → ${found ? 'MATCH' : 'NO MATCH'}`)
    }
    if (found) matchCount++
  }

  // 全体マッチ数
  let totalMatch = 0
  for (const iv of conducted) {
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const phone = (jsMap.get(app.job_seeker_id) || '').replace(/[-\s\u3000()（）]/g, '')
    const dateKey = iv.scheduled_at?.substring(0, 10) || ''
    const key = `${phone}:${dateKey}`
    if (csvRawKeys.has(key)) totalMatch++
  }
  console.log(`\n全体マッチ数（leading 0あり）: ${totalMatch}/${conducted.length}`)
}

main()
