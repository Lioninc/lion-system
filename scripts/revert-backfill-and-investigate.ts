/**
 * 1. バックフィルした55件を特定（result='completed' & conducted_at=scheduled_at で元がNULLだったもの）
 * 2. これらを元に戻す（conducted_at=NULL, result=NULL）
 * 3. 残りの差分を調査
 *
 * npx tsx scripts/revert-backfill-and-investigate.ts          # dry-run
 * npx tsx scripts/revert-backfill-and-investigate.ts --apply   # 実行
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

  const interviews = await fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result')

  // バックフィルで設定したレコード: result='completed' AND conducted_at = scheduled_at
  // (通常のインポートではconducted_atはCSVのAY列から設定されるが、バックフィルではscheduled_atをコピーした)
  const backfilled = interviews.filter(iv =>
    iv.result === 'completed' &&
    iv.conducted_at &&
    iv.scheduled_at &&
    iv.conducted_at === iv.scheduled_at
  )

  console.log(`result='completed' & conducted_at=scheduled_at のレコード: ${backfilled.length}件`)

  // 月別内訳
  const byMonth = new Map<string, number>()
  for (const iv of backfilled) {
    const m = iv.scheduled_at.substring(0, 7)
    byMonth.set(m, (byMonth.get(m) || 0) + 1)
  }
  console.log('\n月別内訳:')
  for (const [m, c] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: ${c}件`)
  }

  // しかしこれだと、正常にインポートされたレコードも含まれる可能性がある
  // （CSVでAY=scheduled_atで、conducted_at=AYで設定されたケース）
  // より正確な特定: 元のCSVのAZ=「済み」でないレコードを特定する必要がある

  // 別のアプローチ: DBの面談数 vs CSVのAZ=済み数を月別に合わせる
  // DBからconducted_atありを数える代わりに、「結果がcancelled/declined/辞退でないもの」を数えつつ
  // conducted_atがNULLのものは除外する

  // 実際のCSV AZ=済みベースの数: 全期間で3,755件
  // DB conducted_at NOT NULL: 3,811件（バックフィル後）
  // 差: 56件 → ≈ バックフィルした55件

  // result='completed' かつ元々conducted_at=NULLだったものを見つける
  // バックフィルスクリプトでは: conducted_at = scheduled_at, result = 'completed' に設定
  // 正常インポートでは: conducted_at = CSVのAY列値, result = CSVのAZ列値（'済み'等）

  // DBで result='completed' のレコード数
  const completedCount = interviews.filter(iv => iv.result === 'completed').length
  console.log(`\nresult='completed' のレコード数: ${completedCount}`)

  // result値の分布
  const resultDist = new Map<string, number>()
  for (const iv of interviews) {
    const r = iv.result || '(null)'
    resultDist.set(r, (resultDist.get(r) || 0) + 1)
  }
  console.log('\nresult値の分布:')
  for (const [r, c] of [...resultDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${r}": ${c}`)
  }

  // conducted_at NOT NULL かつ result別
  console.log('\n\nconducted_at NOT NULL の result分布:')
  const conductedResultDist = new Map<string, number>()
  for (const iv of interviews) {
    if (!iv.conducted_at) continue
    const r = iv.result || '(null)'
    conductedResultDist.set(r, (conductedResultDist.get(r) || 0) + 1)
  }
  for (const [r, c] of [...conductedResultDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${r}": ${c}`)
  }

  // バックフィルの特定: result='completed'のものだけをrevertすれば良い
  // import-csv.tsではresultに'completed'を設定していない（CSVのAZ値をそのまま使用）
  // よってresult='completed'はバックフィルスクリプトで設定されたものだけ

  const toRevert = interviews.filter(iv => iv.result === 'completed')
  console.log(`\n\nrevert対象（result='completed'）: ${toRevert.length}件`)

  if (doApply) {
    console.log('\nreverting...')
    let success = 0, errors = 0
    for (const iv of toRevert) {
      const { error } = await supabase
        .from('interviews')
        .update({ conducted_at: null, result: null })
        .eq('id', iv.id)
      if (error) { errors++; if (errors <= 3) console.error(`  Error: ${error.message}`) }
      else success++
    }
    console.log(`  成功: ${success}件, エラー: ${errors}件`)

    // 検証
    const after = await fetchAllRows('interviews', 'id, conducted_at')
    const nullCount = after.filter(iv => !iv.conducted_at).length
    const notNullCount = after.filter(iv => iv.conducted_at).length
    console.log(`\n  conducted_at NOT NULL: ${notNullCount}/${after.length}`)
    console.log(`  conducted_at NULL: ${nullCount}/${after.length}`)
  } else {
    console.log('\ndry-runモードです。実行するには:')
    console.log('  npx tsx scripts/revert-backfill-and-investigate.ts --apply')
  }
}

main()
