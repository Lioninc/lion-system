/**
 * conducted_at=NULL & result=NULL のinterviewsに
 * scheduled_atの値をバックフィル
 *
 * npx tsx scripts/backfill-conducted-at.ts          # dry-run
 * npx tsx scripts/backfill-conducted-at.ts --apply   # 実行
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
  console.log(`\nconducted_at バックフィル${doApply ? '（実行モード）' : '（dry-run）'}`)
  console.log('='.repeat(60))

  const interviews = await fetchAllRows('interviews', 'id, scheduled_at, conducted_at, result')
  const SKIP_RESULTS = ['cancelled', 'declined', '辞退']

  const targets = interviews.filter(iv =>
    !iv.conducted_at && !SKIP_RESULTS.includes(iv.result)
  )

  console.log(`  対象: ${targets.length}件（conducted_at=NULL & result≠cancelled/declined/辞退）`)

  if (!doApply) {
    console.log('\ndry-runモードです。実行するには:')
    console.log('  npx tsx scripts/backfill-conducted-at.ts --apply')
    return
  }

  let success = 0, errors = 0
  for (const iv of targets) {
    const { error } = await supabase
      .from('interviews')
      .update({ conducted_at: iv.scheduled_at, result: 'completed' })
      .eq('id', iv.id)
    if (error) { errors++; if (errors <= 3) console.error(`  Error: ${error.message}`) }
    else success++
  }

  console.log(`\n  成功: ${success}件, エラー: ${errors}件`)

  // 検証
  const after = await fetchAllRows('interviews', 'id, conducted_at')
  const nullCount = after.filter(iv => !iv.conducted_at).length
  console.log(`\n  conducted_at NULL: ${nullCount}/${after.length} (バックフィル前: 984)`)
}

main()
