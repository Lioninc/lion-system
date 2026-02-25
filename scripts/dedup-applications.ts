/**
 * applications テーブルの重複レコードを検出・削除するスクリプト
 *
 * 背景: インポートが2回実行された（2026-02-04 と 2026-02-10）
 *   → applications 34,566件（本来 ~17,300件）
 *   → job_seekers も12,248件が電話番号重複
 *
 * 重複の定義: 電話番号(正規化) + applied_at(日付部分) + source_id が同一
 * 保持優先: 関連レコード(interviews/referrals/sales)が多い方を保持
 * 関連テーブル: interviews, referrals, sales も削除対象に連動
 * 最後に: 孤立したjob_seekersも整理
 *
 * 使用方法:
 *   npx tsx scripts/dedup-applications.ts              # dry-run（検出のみ）
 *   npx tsx scripts/dedup-applications.ts --merge      # 実際に削除
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[-\s　]/g, '').trim().slice(0, 20)
}

async function fetchAllRows(
  table: string,
  select: string,
  filters?: (q: any) => any,
): Promise<any[]> {
  const rows: any[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    let q = supabase.from(table).select(select)
    if (filters) q = filters(q)
    const { data, error } = await q.range(offset, offset + pageSize - 1)
    if (error) {
      console.error(`Fetch error (${table}):`, error.message)
      break
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    offset += data.length
    if (data.length < pageSize) break
  }
  return rows
}

async function batchDelete(table: string, ids: string[]): Promise<number> {
  let deleted = 0
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100)
    const { error } = await supabase.from(table).delete().in('id', batch)
    if (error) {
      console.error(`  ${table}削除エラー: ${error.message}`)
    } else {
      deleted += batch.length
    }
    if (i > 0 && i % 1000 === 0) {
      process.stdout.write(`\r  ${table}削除中... ${i}/${ids.length}`)
    }
  }
  return deleted
}

async function main() {
  const doMerge = process.argv.includes('--merge')

  console.log(`\n🔍 重複検出${doMerge ? '・削除' : '（dry-run）'}`)
  console.log('='.repeat(60))

  // ============================================================
  // 1. データ読み込み
  // ============================================================
  console.log('\n📥 データ読み込み中...')
  const [allApps, allJS, allInterviews, allReferrals, allSales] = await Promise.all([
    fetchAllRows('applications', 'id, job_seeker_id, applied_at, source_id, created_at'),
    fetchAllRows('job_seekers', 'id, phone, created_at'),
    fetchAllRows('interviews', 'id, application_id'),
    fetchAllRows('referrals', 'id, application_id'),
    fetchAllRows('sales', 'id, referral_id'),
  ])
  console.log(`  applications: ${allApps.length}`)
  console.log(`  job_seekers: ${allJS.length}`)
  console.log(`  interviews: ${allInterviews.length}`)
  console.log(`  referrals: ${allReferrals.length}`)
  console.log(`  sales: ${allSales.length}`)

  // ============================================================
  // 2. マッピング構築
  // ============================================================

  // job_seeker_id → normalized phone
  const jsPhoneMap = new Map<string, string>()
  allJS.forEach(js => {
    const phone = normalizePhone(js.phone || '')
    if (phone && !phone.startsWith('unknown')) {
      jsPhoneMap.set(js.id, phone)
    }
  })

  // application_id → 関連レコード数（interviews + referrals + sales）
  const appRelatedCount = new Map<string, number>()
  allApps.forEach(a => appRelatedCount.set(a.id, 0))
  allInterviews.forEach(iv => {
    appRelatedCount.set(iv.application_id, (appRelatedCount.get(iv.application_id) || 0) + 1)
  })

  const refByApp = new Map<string, string[]>()
  allReferrals.forEach(r => {
    const arr = refByApp.get(r.application_id) || []
    arr.push(r.id)
    refByApp.set(r.application_id, arr)
    appRelatedCount.set(r.application_id, (appRelatedCount.get(r.application_id) || 0) + 1)
  })

  const salesByRef = new Map<string, string[]>()
  allSales.forEach(s => {
    const arr = salesByRef.get(s.referral_id) || []
    arr.push(s.id)
    salesByRef.set(s.referral_id, arr)
  })
  // salesもapplicationの関連数に加算
  allReferrals.forEach(r => {
    const salesCount = (salesByRef.get(r.id) || []).length
    if (salesCount > 0) {
      appRelatedCount.set(r.application_id, (appRelatedCount.get(r.application_id) || 0) + salesCount)
    }
  })

  // ============================================================
  // 3. 電話番号ベースで重複検出
  // ============================================================
  const groups = new Map<string, typeof allApps>()
  for (const app of allApps) {
    const phone = jsPhoneMap.get(app.job_seeker_id) || ''
    if (!phone) continue
    const dateOnly = app.applied_at?.split('T')[0] || app.applied_at || ''
    const key = `${phone}:${dateOnly}:${app.source_id || 'null'}`
    const arr = groups.get(key) || []
    arr.push(app)
    groups.set(key, arr)
  }

  // 重複グループ抽出、関連レコード数でソート（多い方を先頭=保持）
  const dupGroups: { key: string; apps: typeof allApps }[] = []
  for (const [key, apps] of groups) {
    if (apps.length > 1) {
      apps.sort((a, b) => {
        // 関連レコードが多い方を優先保持
        const relA = appRelatedCount.get(a.id) || 0
        const relB = appRelatedCount.get(b.id) || 0
        if (relB !== relA) return relB - relA
        // 同数なら古い方を保持
        return (a.created_at || '').localeCompare(b.created_at || '')
      })
      dupGroups.push({ key, apps })
    }
  }

  // 削除対象
  const deleteAppIds: string[] = []
  for (const group of dupGroups) {
    for (let i = 1; i < group.apps.length; i++) {
      deleteAppIds.push(group.apps[i].id)
    }
  }

  console.log(`\n📊 重複検出結果:`)
  console.log(`  重複グループ: ${dupGroups.length}`)
  console.log(`  削除対象 applications: ${deleteAppIds.length}`)
  console.log(`  削除後 applications: ${allApps.length - deleteAppIds.length}`)

  // ============================================================
  // 4. 月別集計
  // ============================================================
  const monthTotal = new Map<string, number>()
  const monthDelete = new Map<string, number>()
  allApps.forEach(a => {
    const m = (a.applied_at || '').substring(0, 7)
    monthTotal.set(m, (monthTotal.get(m) || 0) + 1)
  })

  const deleteAppIdSet = new Set(deleteAppIds)
  for (const id of deleteAppIds) {
    const app = allApps.find(a => a.id === id)
    if (app) {
      const m = (app.applied_at || '').substring(0, 7)
      monthDelete.set(m, (monthDelete.get(m) || 0) + 1)
    }
  }

  console.log('\n📊 月別件数:')
  const hdr = 'Month       | DB全体  | 削除    | 削除後'
  console.log(hdr)
  console.log('-'.repeat(50))
  let tAll = 0, tDel = 0
  for (const month of [...monthTotal.keys()].sort()) {
    const total = monthTotal.get(month) || 0
    const del = monthDelete.get(month) || 0
    tAll += total; tDel += del
    console.log(`${month.padEnd(12)}| ${String(total).padStart(7)} | ${String(del).padStart(7)} | ${String(total - del).padStart(7)}`)
  }
  console.log('-'.repeat(50))
  console.log(`${'TOTAL'.padEnd(12)}| ${String(tAll).padStart(7)} | ${String(tDel).padStart(7)} | ${String(tAll - tDel).padStart(7)}`)

  // ============================================================
  // 5. 関連レコードの影響
  // ============================================================
  const delInterviews = allInterviews.filter(iv => deleteAppIdSet.has(iv.application_id))
  const delReferrals = allReferrals.filter(r => deleteAppIdSet.has(r.application_id))
  const delRefIds = new Set(delReferrals.map(r => r.id))
  const delSales = allSales.filter(s => delRefIds.has(s.referral_id))

  console.log('\n📋 関連テーブルへの影響:')
  console.log(`  interviews: ${allInterviews.length}件中 ${delInterviews.length}件を削除 → 残り${allInterviews.length - delInterviews.length}件`)
  console.log(`  referrals:  ${allReferrals.length}件中 ${delReferrals.length}件を削除 → 残り${allReferrals.length - delReferrals.length}件`)
  console.log(`  sales:      ${allSales.length}件中 ${delSales.length}件を削除 → 残り${allSales.length - delSales.length}件`)

  // ============================================================
  // 6. 孤立job_seekersの検出
  // ============================================================
  // 削除後に残るapplicationのjob_seeker_id
  const keepAppJSIds = new Set<string>()
  allApps.forEach(a => {
    if (!deleteAppIdSet.has(a.id)) keepAppJSIds.add(a.job_seeker_id)
  })
  const orphanedJS = allJS.filter(js => !keepAppJSIds.has(js.id))
  console.log(`\n  孤立job_seekers: ${orphanedJS.length}件（削除後に応募が0件になるJS）`)

  // 重複の例
  console.log('\n📋 重複例（先頭5件）:')
  for (let i = 0; i < Math.min(5, dupGroups.length); i++) {
    const g = dupGroups[i]
    console.log(`  グループ${i + 1}: ${g.apps.length}件`)
    for (const a of g.apps) {
      const isKeep = a.id === g.apps[0].id
      const rel = appRelatedCount.get(a.id) || 0
      console.log(`    ${isKeep ? '[KEEP]  ' : '[DELETE]'} id=${a.id.substring(0, 8)}... related=${rel} created=${a.created_at?.substring(0, 19)}`)
    }
  }

  if (!doMerge) {
    console.log('\n⚠️  dry-runモードです。実際に削除するには:')
    console.log('   npx tsx scripts/dedup-applications.ts --merge')
    return
  }

  // ============================================================
  // 7. 実際の削除実行
  // ============================================================
  console.log('\n🗑️  削除開始...')

  // sales → referrals → interviews → applications → job_seekers の順
  const salesDel = await batchDelete('sales', delSales.map(s => s.id))
  console.log(`  sales: ${salesDel}件削除`)

  const refsDel = await batchDelete('referrals', delReferrals.map(r => r.id))
  console.log(`\n  referrals: ${refsDel}件削除`)

  const ivsDel = await batchDelete('interviews', delInterviews.map(iv => iv.id))
  console.log(`\n  interviews: ${ivsDel}件削除`)

  const appsDel = await batchDelete('applications', deleteAppIds)
  console.log(`\n  applications: ${appsDel}件削除`)

  // 孤立job_seekersの削除
  const jsDel = await batchDelete('job_seekers', orphanedJS.map(js => js.id))
  console.log(`\n  job_seekers(孤立): ${jsDel}件削除`)

  // ============================================================
  // 8. 削除後の件数確認
  // ============================================================
  console.log('\n📊 削除後のテーブル件数:')
  const counts = await Promise.all([
    supabase.from('applications').select('*', { count: 'exact', head: true }),
    supabase.from('interviews').select('*', { count: 'exact', head: true }),
    supabase.from('referrals').select('*', { count: 'exact', head: true }),
    supabase.from('sales').select('*', { count: 'exact', head: true }),
    supabase.from('job_seekers').select('*', { count: 'exact', head: true }),
  ])
  console.log(`  applications: ${counts[0].count}`)
  console.log(`  interviews:   ${counts[1].count}`)
  console.log(`  referrals:    ${counts[2].count}`)
  console.log(`  sales:        ${counts[3].count}`)
  console.log(`  job_seekers:  ${counts[4].count}`)

  console.log('\n✅ 重複削除完了!')
}

main()
