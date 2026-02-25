/**
 * salesテーブルの日付カラムをバックフィルするスクリプト
 *
 * 現状: expected_date, confirmed_date, paid_date が全件null
 * 修正: referralの日付から推定して設定
 *
 * マッピング:
 *   expected (見込み) → expected_date = referral.hired_at || referral.referred_at
 *   confirmed (確定)  → confirmed_date = referral.start_work_date || referral.hired_at
 *   paid (入金)       → paid_date = referral.start_work_date || referral.hired_at
 *
 * 使用方法:
 *   npx tsx scripts/backfill-sales-dates.ts              # dry-run
 *   npx tsx scripts/backfill-sales-dates.ts --apply       # 実際に更新
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

  console.log(`\nsales日付バックフィル${doApply ? '（実行モード）' : '（dry-run）'}`)
  console.log('='.repeat(60))

  // Fetch data
  const [sales, referrals] = await Promise.all([
    fetchAllRows('sales', 'id, referral_id, status, expected_date, confirmed_date, paid_date'),
    fetchAllRows('referrals', 'id, referred_at, hired_at, assignment_date, start_work_date'),
  ])

  console.log(`sales: ${sales.length}件, referrals: ${referrals.length}件`)

  const refMap = new Map<string, any>()
  referrals.forEach(r => refMap.set(r.id, r))

  // Compute updates
  interface SaleUpdate {
    id: string
    expected_date?: string
    confirmed_date?: string
    paid_date?: string
  }

  const updates: SaleUpdate[] = []
  let noRef = 0
  let noDate = 0

  for (const sale of sales) {
    const ref = refMap.get(sale.referral_id)
    if (!ref) { noRef++; continue }

    const update: SaleUpdate = { id: sale.id }
    let hasUpdate = false

    if (sale.status === 'expected') {
      const date = ref.hired_at || ref.referred_at
      if (date && !sale.expected_date) {
        update.expected_date = date
        hasUpdate = true
      } else if (!date) {
        noDate++
      }
    }

    if (sale.status === 'confirmed') {
      const date = ref.start_work_date || ref.hired_at
      if (date && !sale.confirmed_date) {
        update.confirmed_date = date
        hasUpdate = true
      } else if (!date) {
        noDate++
      }
    }

    if (sale.status === 'paid') {
      const date = ref.start_work_date || ref.hired_at
      if (date && !sale.paid_date) {
        update.paid_date = date
        hasUpdate = true
      } else if (!date) {
        noDate++
      }
    }

    if (hasUpdate) updates.push(update)
  }

  // Summary
  const expectedUpdates = updates.filter(u => u.expected_date)
  const confirmedUpdates = updates.filter(u => u.confirmed_date)
  const paidUpdates = updates.filter(u => u.paid_date)

  console.log(`\n更新対象:`)
  console.log(`  expected_date 設定: ${expectedUpdates.length}件`)
  console.log(`  confirmed_date 設定: ${confirmedUpdates.length}件`)
  console.log(`  paid_date 設定: ${paidUpdates.length}件`)
  console.log(`  参照referralなし: ${noRef}件`)
  console.log(`  日付候補なし: ${noDate}件`)

  // Show distribution of dates to be set
  console.log('\n設定される日付の月別分布:')
  for (const [label, items, field] of [
    ['expected_date', expectedUpdates, 'expected_date'] as const,
    ['confirmed_date', confirmedUpdates, 'confirmed_date'] as const,
    ['paid_date', paidUpdates, 'paid_date'] as const,
  ]) {
    const byMonth = new Map<string, number>()
    items.forEach(u => {
      const m = ((u as any)[field] || '').substring(0, 7)
      if (m) byMonth.set(m, (byMonth.get(m) || 0) + 1)
    })
    console.log(`\n  ${label}:`)
    for (const [month, count] of [...byMonth.entries()].sort()) {
      console.log(`    ${month}: ${count}件`)
    }
  }

  if (!doApply) {
    console.log('\ndry-runモードです。実際に更新するには:')
    console.log('  npx tsx scripts/backfill-sales-dates.ts --apply')
    return
  }

  // Apply updates
  console.log('\n更新開始...')
  let success = 0, errors = 0

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i]
    const updateData: any = {}
    if (u.expected_date) updateData.expected_date = u.expected_date
    if (u.confirmed_date) updateData.confirmed_date = u.confirmed_date
    if (u.paid_date) updateData.paid_date = u.paid_date

    const { error } = await supabase.from('sales').update(updateData).eq('id', u.id)
    if (error) {
      errors++
      if (errors <= 5) console.error(`  エラー: ${error.message}`)
    } else {
      success++
    }

    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r  更新中... ${i + 1}/${updates.length}`)
    }
  }

  console.log(`\n\n更新完了: 成功=${success}, エラー=${errors}`)

  // Verify
  console.log('\n検証...')
  const afterSales = await fetchAllRows('sales', 'id, status, expected_date, confirmed_date, paid_date')
  const nullCounts = {
    expected_date: afterSales.filter(s => !s.expected_date).length,
    confirmed_date: afterSales.filter(s => !s.confirmed_date).length,
    paid_date: afterSales.filter(s => !s.paid_date).length,
  }
  console.log(`  expected_date null: ${nullCounts.expected_date}/${afterSales.length}`)
  console.log(`  confirmed_date null: ${nullCounts.confirmed_date}/${afterSales.length}`)
  console.log(`  paid_date null: ${nullCounts.paid_date}/${afterSales.length}`)
}

main()
