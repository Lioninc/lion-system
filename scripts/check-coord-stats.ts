import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')

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
  const apps = await fetchAll('applications', 'id, coordinator_id')
  const interviews = await fetchAll('interviews', 'id, application_id, conducted_at, interviewer_id')
  const referrals = await fetchAll('referrals', 'id, application_id, referral_status, dispatch_interview_at, hired_at')
  const sales = await fetchAll('sales', 'id, referral_id, amount, status')
  const users = await fetchAll('users', 'id, name')

  const nameMap = new Map<string, string>()
  users.forEach((u: any) => nameMap.set(u.id, u.name))

  const appCoordMap = new Map<string, string | null>()
  apps.forEach((a: any) => appCoordMap.set(a.id, a.coordinator_id))

  // interviews by coordinator
  const coordStats = new Map<string, { name: string; interviews: number; referrals: number; dispatchSched: number; dispatchDone: number; hired: number; paidAmt: number }>()

  const ensure = (coordId: string | null) => {
    const key = coordId || '_none'
    if (!coordStats.has(key)) {
      coordStats.set(key, {
        name: coordId ? (nameMap.get(coordId) || '不明') : '未設定',
        interviews: 0, referrals: 0, dispatchSched: 0, dispatchDone: 0, hired: 0, paidAmt: 0
      })
    }
    return coordStats.get(key)!
  }

  // 面談
  for (const iv of interviews) {
    if (iv.conducted_at) {
      const coordId = appCoordMap.get(iv.application_id)
      ensure(coordId).interviews += 1
    }
  }

  // referrals
  const DONE = ['interview_done', 'hired', 'pre_assignment', 'assigned', 'working', 'full_paid']
  const salesByRef = new Map<string, any[]>()
  sales.forEach((s: any) => {
    if (!salesByRef.has(s.referral_id)) salesByRef.set(s.referral_id, [])
    salesByRef.get(s.referral_id)!.push(s)
  })

  for (const ref of referrals) {
    const coordId = appCoordMap.get(ref.application_id)
    const c = ensure(coordId)
    c.referrals += 1
    if (ref.dispatch_interview_at) c.dispatchSched += 1
    if (DONE.includes(ref.referral_status)) c.dispatchDone += 1
    if (ref.hired_at) c.hired += 1
    const refSales = salesByRef.get(ref.id) || []
    for (const s of refSales) {
      if (s.status === 'paid') c.paidAmt += Number(s.amount)
    }
  }

  console.log('=== 担当者別実績 (DB集計) ===')
  console.log('担当者'.padEnd(16) + '| 面談  | 繋ぎ  | 面予  | 面済  | 採用  | 入金額')
  console.log('-'.repeat(85))
  for (const [, c] of [...coordStats.entries()].sort((a, b) => b[1].interviews - a[1].interviews)) {
    console.log(
      `${c.name.padEnd(16)}| ${String(c.interviews).padStart(5)} | ${String(c.referrals).padStart(5)} | ${String(c.dispatchSched).padStart(5)} | ${String(c.dispatchDone).padStart(5)} | ${String(c.hired).padStart(5)} | ${c.paidAmt.toLocaleString()}`
    )
  }
}
main()
