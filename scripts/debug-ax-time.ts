import * as fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += ch }
  }
  result.push(current)
  return result
}

const COL_NAME = 18   // S列: 名前
const COL_PHONE = 19  // T列: 電話番号
const COL_AX = 49     // AX: 面談時間
const COL_AY = 50     // AY: 面談日程
const COL_AZ = 51     // AZ: 状態
const COL_BB = 53     // BB: 担当CD

const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025 (1).csv'
const content = fs.readFileSync(csvPath, 'utf-8')
const lines = content.split('\n')

console.log('=== 1. AX列 生データ repr (最初の20件、AYあり) ===')
let shown = 0
for (let i = 2; i < lines.length && shown < 20; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const ay = row[COL_AY] || ''
  const ax = row[COL_AX] || ''
  if (ay.trim()) {
    const name = row[COL_NAME] || ''
    console.log(`  行${i+1}: AX=|${ax}| (len=${ax.length}, trimmed=|${ax.trim()}|, bytes=[${Buffer.from(ax).toString('hex')}]) AY=|${ay.trim()}| name=${name.trim()}`)
    shown++
  }
}

console.log('\n=== 2. 「まえじま」検索 ===')
for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const name = (row[COL_NAME] || '').trim()
  const ay = (row[COL_AY] || '').trim()
  if (name.includes('まえじま') || name.includes('前島') || name.includes('マエジマ')) {
    const ax = row[COL_AX] || ''
    const az = (row[COL_AZ] || '').trim()
    const bb = (row[COL_BB] || '').trim()
    console.log(`  行${i+1}: name=${name} AY=|${ay}| AX=|${ax.trim()}| (raw bytes=[${Buffer.from(ax).toString('hex')}]) AZ=${az} BB=${bb}`)
  }
}

// 火曜日(2/25)のデータを検索
console.log('\n=== 2b. 火曜(2/25)のデータ全件 ===')
let tueCount = 0
for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const ay = (row[COL_AY] || '').trim()
  if (ay === '2026/02/24' || ay === '2025/02/25' || ay === '2026/02/25') {
    const ax = row[COL_AX] || ''
    const name = (row[COL_NAME] || '').trim()
    const az = (row[COL_AZ] || '').trim()
    console.log(`  行${i+1}: name=${name} AY=${ay} AX=|${ax.trim()}| AZ=${az}`)
    tueCount++
  }
}
console.log(`  → ${tueCount}件`)

async function checkDB() {
  console.log('\n=== 3. DB scheduled_at サンプル(今週) ===')
  const { data } = await supabase
    .from('interviews')
    .select('id, scheduled_at, conducted_at, result, application:applications(job_seeker:job_seekers(name, phone))')
    .gte('scheduled_at', '2026-02-23')
    .lte('scheduled_at', '2026-02-28')
    .order('scheduled_at')
    .limit(20)

  data?.forEach(iv => {
    const js = (iv as any).application?.job_seeker
    console.log(`  ${iv.scheduled_at} | result=${iv.result} | name=${js?.name || '?'}`)
  })

  // scheduled_atのフォーマットパターン
  console.log('\n=== 3b. scheduled_at フォーマット分布 ===')
  const { data: sample } = await supabase
    .from('interviews')
    .select('scheduled_at')
    .limit(1000)

  const patterns = new Map<string, number>()
  sample?.forEach(iv => {
    const val = iv.scheduled_at || ''
    let pattern = 'unknown'
    if (val.includes('T') && val.includes('+')) pattern = 'ISO with TZ (e.g. 2025-01-01T10:00:00+00:00)'
    else if (val.includes('T') && val.endsWith('Z')) pattern = 'ISO with Z'
    else if (val.includes('T')) pattern = 'ISO no TZ'
    else if (val.match(/^\d{4}-\d{2}-\d{2}$/)) pattern = 'date only'
    else pattern = `other: ${val.substring(0, 30)}`
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1)
  })
  for (const [p, c] of patterns) {
    console.log(`  ${p}: ${c}件`)
  }

  // 00:00のデータがあるか
  console.log('\n=== 3c. 00:00:00のscheduled_atがあるか ===')
  const { data: midnight } = await supabase
    .from('interviews')
    .select('scheduled_at, result')
    .like('scheduled_at', '%T00:00:00%')
    .limit(10)

  console.log(`  T00:00:00 のレコード: ${midnight?.length || 0}件`)
  midnight?.forEach(iv => {
    console.log(`  ${iv.scheduled_at} | ${iv.result}`)
  })

  // 時間なし(日付のみ)のscheduled_at
  const { data: noTime } = await supabase
    .from('interviews')
    .select('scheduled_at')
    .not('scheduled_at', 'like', '%T%')
    .limit(5)

  console.log(`\n  時間なし(T含まない): ${noTime?.length || 0}件`)
  noTime?.forEach(iv => console.log(`  ${iv.scheduled_at}`))
}

checkDB()
