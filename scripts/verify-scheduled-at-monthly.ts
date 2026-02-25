/**
 * DBのinterviewsをscheduled_atの月で集計し、スプシ数値と比較
 * スプシ面談数: 1月258, 2月266, 3月306, 4月332, 5月310, 6月385, 7月384, 8月306, 9月306, 10月293, 11月193, 12月172
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
  const interviews = await fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at')

  // スプシ目標値
  const expected: Record<string, number> = {
    '2025-01': 258, '2025-02': 266, '2025-03': 306,
    '2025-04': 332, '2025-05': 310, '2025-06': 385,
    '2025-07': 384, '2025-08': 306, '2025-09': 306,
    '2025-10': 293, '2025-11': 193, '2025-12': 172,
  }

  // conducted_atありのみ、scheduled_atの月で集計
  const byScheduledMonth = new Map<string, number>()
  const byConductedMonth = new Map<string, number>()

  for (const iv of interviews) {
    if (!iv.conducted_at) continue
    const sMonth = iv.scheduled_at?.substring(0, 7)
    const cMonth = iv.conducted_at.substring(0, 7)
    if (sMonth) byScheduledMonth.set(sMonth, (byScheduledMonth.get(sMonth) || 0) + 1)
    byConductedMonth.set(cMonth, (byConductedMonth.get(cMonth) || 0) + 1)
  }

  console.log('='.repeat(80))
  console.log('【DB interviews月別集計 vs スプシ】')
  console.log('='.repeat(80))
  console.log('Month     | スプシ | scheduled_at月 | 差  | conducted_at月 | 差')
  console.log('-'.repeat(80))

  let totalExp = 0, totalSch = 0, totalCon = 0
  for (const month of Object.keys(expected).sort()) {
    const exp = expected[month]
    const sch = byScheduledMonth.get(month) || 0
    const con = byConductedMonth.get(month) || 0
    const diffSch = sch - exp
    const diffCon = con - exp
    totalExp += exp; totalSch += sch; totalCon += con
    console.log(
      `${month.padEnd(10)}| ${String(exp).padStart(6)} | ${String(sch).padStart(14)} | ${String(diffSch).padStart(3)} | ${String(con).padStart(14)} | ${String(diffCon).padStart(3)}`
    )
  }
  console.log('-'.repeat(80))
  console.log(
    `${'TOTAL'.padEnd(10)}| ${String(totalExp).padStart(6)} | ${String(totalSch).padStart(14)} | ${String(totalSch - totalExp).padStart(3)} | ${String(totalCon).padStart(14)} | ${String(totalCon - totalExp).padStart(3)}`
  )

  // 2025年以外の月も表示
  console.log('\n【2024年のデータ】')
  const allMonths = new Set([...byScheduledMonth.keys(), ...byConductedMonth.keys()])
  for (const month of [...allMonths].filter(m => m.startsWith('2024')).sort()) {
    const sch = byScheduledMonth.get(month) || 0
    const con = byConductedMonth.get(month) || 0
    console.log(`  ${month}: scheduled_at=${sch}, conducted_at=${con}`)
  }
}

main()
