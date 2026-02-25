/**
 * conducted_at=NULL で result が cancelled/declined/辞退 以外のレコード調査
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
  const interviews = await fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result')

  const SKIP_RESULTS = ['cancelled', 'declined', '辞退']

  // 1. conducted_at=NULL で result が cancelled/declined/辞退 以外
  const nullConducted = interviews.filter(iv => !iv.conducted_at)
  const shouldHaveConducted = nullConducted.filter(iv => !SKIP_RESULTS.includes(iv.result))

  console.log('='.repeat(70))
  console.log('【conducted_at=NULL の内訳】')
  console.log('='.repeat(70))
  console.log(`  全interviews: ${interviews.length}`)
  console.log(`  conducted_at=NULL: ${nullConducted.length}`)
  console.log(`  うち cancelled/declined/辞退: ${nullConducted.length - shouldHaveConducted.length}`)
  console.log(`  うち それ以外（実施済みの可能性）: ${shouldHaveConducted.length}`)

  // result分布
  console.log('\n【該当レコードの result 分布】')
  const resultDist = new Map<string, number>()
  shouldHaveConducted.forEach(iv => {
    const key = iv.result || '(null)'
    resultDist.set(key, (resultDist.get(key) || 0) + 1)
  })
  for (const [result, count] of [...resultDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${result}: ${count}件`)
  }

  // 2. 月別集計（scheduled_atベース）
  console.log('\n【該当レコードの月別集計（scheduled_at）】')
  const byMonth = new Map<string, number>()
  shouldHaveConducted.forEach(iv => {
    const m = (iv.scheduled_at || '').substring(0, 7)
    if (m) byMonth.set(m, (byMonth.get(m) || 0) + 1)
  })
  console.log('Month    | 件数')
  console.log('-'.repeat(25))
  let total = 0
  for (const [month, count] of [...byMonth.entries()].sort()) {
    total += count
    console.log(`${month.padEnd(9)}| ${count}`)
  }
  console.log('-'.repeat(25))
  console.log(`${'TOTAL'.padEnd(9)}| ${total}`)

  // サンプル
  console.log('\n【サンプル（10件）】')
  for (const iv of shouldHaveConducted.slice(0, 10)) {
    console.log(`  id=${iv.id.substring(0, 8)} scheduled=${iv.scheduled_at?.substring(0, 10)} result=${iv.result}`)
  }

  // 3. バックフィル対象の確認
  // result が completed/完了 または null のもの
  const backfillTargets = shouldHaveConducted.filter(iv =>
    iv.result === 'completed' || iv.result === '完了' || iv.result === null
  )
  console.log(`\n【バックフィル対象（result=completed/完了/null）】: ${backfillTargets.length}件`)

  // Also check: result=completed but conducted_at already set (should be 0 extras)
  const completedWithConducted = interviews.filter(iv => iv.conducted_at && (iv.result === 'completed' || iv.result === '完了'))
  console.log(`  参考: result=completed/完了 で conducted_at あり: ${completedWithConducted.length}件`)
}

main()
