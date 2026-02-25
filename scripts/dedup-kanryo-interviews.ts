/**
 * 同一電話番号+同日に「完了」と「completed」の両方がある場合、
 * 「完了」レコードのconducted_atをNULLにして重複を解消
 *
 * npx tsx scripts/dedup-kanryo-interviews.ts          # dry-run
 * npx tsx scripts/dedup-kanryo-interviews.ts --apply   # 実行
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
  const doApply = process.argv.includes('--apply')

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
  console.log(`conducted_at NOT NULL: ${conducted.length}`)

  // Group by phone+date
  const byPhoneDate = new Map<string, any[]>()
  for (const iv of conducted) {
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const phone = jsMap.get(app.job_seeker_id) || ''
    const date = iv.scheduled_at?.substring(0, 10) || ''
    const key = `${phone}:${date}`
    const arr = byPhoneDate.get(key) || []
    arr.push(iv)
    byPhoneDate.set(key, arr)
  }

  // Find groups with both 完了 and completed
  const toNullify: any[] = []
  for (const [key, arr] of byPhoneDate) {
    if (arr.length <= 1) continue
    const hasCompleted = arr.some(iv => iv.result === 'completed')
    const kanryoRecords = arr.filter(iv => iv.result === '完了')
    if (hasCompleted && kanryoRecords.length > 0) {
      // Keep 'completed', nullify '完了'
      toNullify.push(...kanryoRecords)
    }
  }

  console.log(`\n重複(completed+完了)で nullify対象: ${toNullify.length}件`)

  // 月別内訳
  const byMonth = new Map<string, number>()
  for (const iv of toNullify) {
    const m = iv.scheduled_at?.substring(0, 7) || 'unknown'
    byMonth.set(m, (byMonth.get(m) || 0) + 1)
  }
  console.log('\nnullify対象の月別:')
  for (const [m, c] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: ${c}件`)
  }

  if (doApply && toNullify.length > 0) {
    console.log('\nnullify実行中...')
    let success = 0, errors = 0
    for (const iv of toNullify) {
      const { error } = await supabase
        .from('interviews')
        .update({ conducted_at: null, result: null })
        .eq('id', iv.id)
      if (error) { errors++; if (errors <= 3) console.error(`  Error: ${error.message}`) }
      else success++
    }
    console.log(`  成功: ${success}, エラー: ${errors}`)
  }

  // 検証: dedup後のscheduled_at月別集計
  const afterConducted = conducted.filter(iv => !toNullify.some(t => t.id === iv.id))

  const expected: Record<string, number> = {
    '2025-01': 258, '2025-02': 266, '2025-03': 306,
    '2025-04': 332, '2025-05': 310, '2025-06': 385,
    '2025-07': 384, '2025-08': 306, '2025-09': 306,
    '2025-10': 293, '2025-11': 193, '2025-12': 172,
  }

  const afterByMonth = new Map<string, number>()
  for (const iv of afterConducted) {
    const m = iv.scheduled_at?.substring(0, 7) || ''
    if (m) afterByMonth.set(m, (afterByMonth.get(m) || 0) + 1)
  }

  console.log('\n【dedup後の検証】')
  console.log('Month     | スプシ | DB  | 差')
  console.log('-'.repeat(40))
  let totalExp = 0, totalDb = 0
  for (const month of Object.keys(expected).sort()) {
    const exp = expected[month]
    const db = afterByMonth.get(month) || 0
    totalExp += exp; totalDb += db
    console.log(`${month.padEnd(10)}| ${String(exp).padStart(5)} | ${String(db).padStart(3)} | ${String(db - exp).padStart(3)}`)
  }
  console.log('-'.repeat(40))
  console.log(`${'TOTAL'.padEnd(10)}| ${String(totalExp).padStart(5)} | ${String(totalDb).padStart(3)} | ${String(totalDb - totalExp).padStart(3)}`)

  if (!doApply && toNullify.length > 0) {
    console.log('\ndry-runモードです。実行するには:')
    console.log('  npx tsx scripts/dedup-kanryo-interviews.ts --apply')
  }
}

main()
