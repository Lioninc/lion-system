/**
 * CSVのAZ=「済み」レコードとDB interviewsを照合して、
 * DBにあるがCSVで済みでないレコードを特定する
 *
 * 照合キー: 電話番号 + scheduled_at(=AY)
 *
 * npx tsx scripts/find-backfilled-interviews.ts          # 調査のみ
 * npx tsx scripts/find-backfilled-interviews.ts --apply   # conducted_at=NULLにrevert
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

function normalizePhone(phone: string): string {
  return phone.replace(/[-\s\u3000()（）]/g, '').replace(/^0/, '')
}

function normalizeDate(dateStr: string): string {
  // "2025/1/7" → "2025-01-07", "2025-01-07T..." → "2025-01-07"
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  return dateStr.substring(0, 10)
}

async function main() {
  const doApply = process.argv.includes('--apply')

  // 1. CSVからAZ=「済み」の電話番号+AY日付を収集
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')

  const COL_PHONE = 19   // 電話番号
  const COL_AY = 50      // 面談日程
  const COL_AZ = 51      // 面談ステータス

  const csvSumiSet = new Set<string>()
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    const az = row[COL_AZ] || ''
    if (az !== '済み') continue
    const phone = normalizePhone(row[COL_PHONE] || '')
    const ay = row[COL_AY] || ''
    if (!phone || !ay) continue
    const dateKey = normalizeDate(ay)
    csvSumiSet.add(`${phone}:${dateKey}`)
  }
  console.log(`CSV AZ=済み のユニークな (電話番号+日付) ペア: ${csvSumiSet.size}`)

  // 2. DBからinterviews + applications + job_seekers取得
  const [interviews, apps, jobSeekers] = await Promise.all([
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result'),
    fetchAllRows('applications', 'id, job_seeker_id'),
    fetchAllRows('job_seekers', 'id, phone'),
  ])

  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))
  const jsMap = new Map<string, string>()
  jobSeekers.forEach(js => jsMap.set(js.id, js.phone || ''))

  // 3. conducted_at NOT NULLのinterviewsをCSVと照合
  const conducted = interviews.filter(iv => iv.conducted_at)
  console.log(`\nDB conducted_at NOT NULL: ${conducted.length}`)

  const matched: typeof interviews = []
  const unmatched: typeof interviews = []

  for (const iv of conducted) {
    const app = appMap.get(iv.application_id)
    if (!app) { unmatched.push(iv); continue }
    const rawPhone = jsMap.get(app.job_seeker_id) || ''
    const phone = normalizePhone(rawPhone)
    const dateKey = normalizeDate(iv.scheduled_at || '')
    const key = `${phone}:${dateKey}`
    if (csvSumiSet.has(key)) {
      matched.push(iv)
    } else {
      unmatched.push(iv)
    }
  }

  console.log(`CSV済みと一致: ${matched.length}`)
  console.log(`CSV済みに不一致: ${unmatched.length}`)

  // 不一致レコードの分析
  const unmatchedByResult = new Map<string, number>()
  const unmatchedByMonth = new Map<string, number>()
  for (const iv of unmatched) {
    const r = iv.result || '(null)'
    unmatchedByResult.set(r, (unmatchedByResult.get(r) || 0) + 1)
    const m = (iv.scheduled_at || iv.conducted_at).substring(0, 7)
    unmatchedByMonth.set(m, (unmatchedByMonth.get(m) || 0) + 1)
  }

  console.log('\n不一致レコードのresult分布:')
  for (const [r, c] of [...unmatchedByResult.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${r}": ${c}`)
  }

  console.log('\n不一致レコードの月別分布:')
  for (const [m, c] of [...unmatchedByMonth.entries()].sort()) {
    console.log(`  ${m}: ${c}`)
  }

  // 不一致の詳細（最初の10件）
  console.log('\n不一致の詳細（先頭10件）:')
  for (const iv of unmatched.slice(0, 10)) {
    const app = appMap.get(iv.application_id)
    const rawPhone = app ? (jsMap.get(app.job_seeker_id) || '?') : '?'
    console.log(`  id=${iv.id.substring(0, 8)} result=${iv.result} scheduled=${iv.scheduled_at?.substring(0, 10)} phone=${rawPhone}`)
  }

  if (doApply && unmatched.length > 0) {
    console.log(`\n不一致 ${unmatched.length}件のconducted_atをNULLにrevert中...`)
    let success = 0, errors = 0
    for (const iv of unmatched) {
      const { error } = await supabase
        .from('interviews')
        .update({ conducted_at: null, result: null })
        .eq('id', iv.id)
      if (error) { errors++; if (errors <= 3) console.error(`  Error: ${error.message}`) }
      else success++
    }
    console.log(`  成功: ${success}, エラー: ${errors}`)

    // 検証: revert後のscheduled_at月別集計
    const afterInterviews = await fetchAllRows('interviews', 'id, scheduled_at, conducted_at')
    const afterByMonth = new Map<string, number>()
    for (const iv of afterInterviews) {
      if (!iv.conducted_at) continue
      const m = iv.scheduled_at?.substring(0, 7)
      if (m) afterByMonth.set(m, (afterByMonth.get(m) || 0) + 1)
    }

    const expected: Record<string, number> = {
      '2025-01': 258, '2025-02': 266, '2025-03': 306,
      '2025-04': 332, '2025-05': 310, '2025-06': 385,
      '2025-07': 384, '2025-08': 306, '2025-09': 306,
      '2025-10': 293, '2025-11': 193, '2025-12': 172,
    }

    console.log('\n【revert後の検証】')
    console.log('Month     | スプシ | DB  | 差')
    console.log('-'.repeat(40))
    for (const month of Object.keys(expected).sort()) {
      const exp = expected[month]
      const db = afterByMonth.get(month) || 0
      console.log(`${month.padEnd(10)}| ${String(exp).padStart(5)} | ${String(db).padStart(3)} | ${String(db - exp).padStart(3)}`)
    }
  } else if (!doApply && unmatched.length > 0) {
    console.log('\ndry-runモードです。実行するには:')
    console.log('  npx tsx scripts/find-backfilled-interviews.ts --apply')
  }
}

main()
