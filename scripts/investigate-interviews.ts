/**
 * interviews テーブル詳細調査
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
  // Fetch all interviews with all columns
  const interviews = await fetchAllRows('interviews', '*')
  const apps = await fetchAllRows('applications', 'id, applied_at')

  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))

  console.log('='.repeat(70))
  console.log('【interviews テーブル詳細調査】')
  console.log('='.repeat(70))

  // 1. conducted_at NULL vs 全体
  const total = interviews.length
  const conductedNull = interviews.filter(iv => !iv.conducted_at).length
  const conductedNotNull = total - conductedNull
  console.log(`\n1. conducted_at:`)
  console.log(`   全体: ${total}件`)
  console.log(`   NOT NULL: ${conductedNotNull}件 (${(conductedNotNull/total*100).toFixed(1)}%)`)
  console.log(`   NULL: ${conductedNull}件 (${(conductedNull/total*100).toFixed(1)}%)`)

  // 2. scheduled_at NULL vs 全体
  const scheduledNull = interviews.filter(iv => !iv.scheduled_at).length
  const scheduledNotNull = total - scheduledNull
  console.log(`\n2. scheduled_at:`)
  console.log(`   NOT NULL: ${scheduledNotNull}件 (${(scheduledNotNull/total*100).toFixed(1)}%)`)
  console.log(`   NULL: ${scheduledNull}件 (${(scheduledNull/total*100).toFixed(1)}%)`)

  // 3. Check all column names to find any "interview_date" field
  console.log(`\n3. interviews テーブルの全カラム:`)
  if (interviews.length > 0) {
    const cols = Object.keys(interviews[0])
    cols.forEach(col => {
      const nullCount = interviews.filter(iv => iv[col] === null || iv[col] === undefined).length
      const notNullCount = total - nullCount
      console.log(`   ${col.padEnd(25)} NOT NULL: ${notNullCount}/${total}`)
    })
  }

  // 4. conducted_at NULL のレコードの scheduled_at 状況
  const nullConducted = interviews.filter(iv => !iv.conducted_at)
  const nullConductedWithScheduled = nullConducted.filter(iv => iv.scheduled_at)
  console.log(`\n4. conducted_at=NULLのレコード (${nullConducted.length}件):`)
  console.log(`   scheduled_at あり: ${nullConductedWithScheduled.length}件`)
  console.log(`   scheduled_at なし: ${nullConducted.length - nullConductedWithScheduled.length}件`)

  // 5. result分布（conducted_at NULLのもの）
  console.log(`\n5. conducted_at=NULLの result 分布:`)
  const resultDist = new Map<string, number>()
  nullConducted.forEach(iv => {
    const key = iv.result || '(null)'
    resultDist.set(key, (resultDist.get(key) || 0) + 1)
  })
  for (const [result, count] of [...resultDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${result}: ${count}件`)
  }

  // 6. result分布（全体）
  console.log(`\n6. 全体の result 分布:`)
  const allResultDist = new Map<string, number>()
  interviews.forEach(iv => {
    const key = iv.result || '(null)'
    allResultDist.set(key, (allResultDist.get(key) || 0) + 1)
  })
  for (const [result, count] of [...allResultDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${result}: ${count}件`)
  }

  // 7. 月別集計: conducted_at vs scheduled_at
  console.log('\n' + '='.repeat(70))
  console.log('【月別 conducted_at vs scheduled_at 比較】')
  console.log('='.repeat(70))

  const byMonthConducted = new Map<string, number>()
  const byMonthScheduled = new Map<string, number>()
  const byMonthScheduledAll = new Map<string, number>() // including conducted_at NULL
  const byMonthApplied = new Map<string, number>() // by applied_at for all interviews

  interviews.forEach(iv => {
    // conducted_at
    if (iv.conducted_at) {
      const m = iv.conducted_at.substring(0, 7)
      byMonthConducted.set(m, (byMonthConducted.get(m) || 0) + 1)
    }
    // scheduled_at (all)
    if (iv.scheduled_at) {
      const m = iv.scheduled_at.substring(0, 7)
      byMonthScheduledAll.set(m, (byMonthScheduledAll.get(m) || 0) + 1)
    }
    // scheduled_at (only for conducted_at NULL)
    if (!iv.conducted_at && iv.scheduled_at) {
      const m = iv.scheduled_at.substring(0, 7)
      byMonthScheduled.set(m, (byMonthScheduled.get(m) || 0) + 1)
    }
    // applied_at
    const app = appMap.get(iv.application_id)
    if (app?.applied_at) {
      const m = app.applied_at.substring(0, 7)
      byMonthApplied.set(m, (byMonthApplied.get(m) || 0) + 1)
    }
  })

  const allMonths = new Set([...byMonthConducted.keys(), ...byMonthScheduledAll.keys(), ...byMonthApplied.keys()])
  console.log('Month    | conducted_at | scheduled_at(全) | scheduled(conducted=NULL) | 応募月ベース')
  console.log('-'.repeat(90))
  let tCond = 0, tSched = 0, tSchedNull = 0, tApp = 0
  for (const month of [...allMonths].sort()) {
    const c = byMonthConducted.get(month) || 0
    const sa = byMonthScheduledAll.get(month) || 0
    const sn = byMonthScheduled.get(month) || 0
    const ap = byMonthApplied.get(month) || 0
    tCond += c; tSched += sa; tSchedNull += sn; tApp += ap
    console.log(`${month.padEnd(9)}| ${String(c).padStart(12)} | ${String(sa).padStart(16)} | ${String(sn).padStart(24)} | ${String(ap).padStart(12)}`)
  }
  console.log('-'.repeat(90))
  console.log(`${'TOTAL'.padEnd(9)}| ${String(tCond).padStart(12)} | ${String(tSched).padStart(16)} | ${String(tSchedNull).padStart(24)} | ${String(tApp).padStart(12)}`)

  // 8. Sample: conducted_at NULL records
  console.log('\n【conducted_at=NULL のサンプル（5件）】')
  for (const iv of nullConducted.slice(0, 5)) {
    const app = appMap.get(iv.application_id)
    console.log(`  id=${iv.id.substring(0, 8)} scheduled=${iv.scheduled_at?.substring(0, 10)} result=${iv.result} applied=${app?.applied_at?.substring(0, 10)}`)
  }
}

main()
