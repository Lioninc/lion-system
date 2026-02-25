import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

async function fetchAll(table: string, select: string) {
  const rows: any[] = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from(table).select(select).range(offset, offset + 999)
    if (!data || data.length === 0) break
    rows.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }
  return rows
}

async function main() {
  const refs = await fetchAll('referrals', 'id, start_work_date')
  const sales = await fetchAll('sales', 'referral_id, amount, status, expected_date, confirmed_date')

  const refById = new Map<string, any>()
  refs.forEach(r => refById.set(r.id, r))

  const byMonth = new Map<string, { prospect: number; working: number; expAmt: number; confAmt: number }>()

  for (const s of sales) {
    const ref = refById.get(s.referral_id)
    if (!ref) continue

    if (s.status === 'expected' && s.expected_date) {
      const m = s.expected_date.substring(0, 7)
      if (!byMonth.has(m)) byMonth.set(m, { prospect: 0, working: 0, expAmt: 0, confAmt: 0 })
      byMonth.get(m)!.prospect++
      byMonth.get(m)!.expAmt += Number(s.amount)
    }
    if (s.status === 'confirmed' && s.confirmed_date && ref.start_work_date) {
      const m = s.confirmed_date.substring(0, 7)
      if (!byMonth.has(m)) byMonth.set(m, { prospect: 0, working: 0, expAmt: 0, confAmt: 0 })
      byMonth.get(m)!.working++
      byMonth.get(m)!.confAmt += Number(s.amount)
    }
  }

  console.log('稼働月ベース (DB):')
  console.log('Month     | 見込件数 | 実働件数 | 売上見込      | 実働売上')
  console.log('-'.repeat(70))
  let tP = 0, tW = 0, tE = 0, tC = 0
  for (const [m, v] of [...byMonth.entries()].sort()) {
    tP += v.prospect; tW += v.working; tE += v.expAmt; tC += v.confAmt
    console.log(`${m.padEnd(10)}| ${String(v.prospect).padStart(8)} | ${String(v.working).padStart(8)} | ${v.expAmt.toLocaleString().padStart(13)} | ${v.confAmt.toLocaleString().padStart(13)}`)
  }
  console.log('-'.repeat(70))
  console.log(`${'TOTAL'.padEnd(10)}| ${String(tP).padStart(8)} | ${String(tW).padStart(8)} | ${tE.toLocaleString().padStart(13)} | ${tC.toLocaleString().padStart(13)}`)
}

main()
