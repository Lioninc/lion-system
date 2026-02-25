/**
 * DB面談数とスプシの残り差分(+14件)を調査
 * 主に2025年2月の+16を調べる
 *
 * 仮説1: result='完了'のレコードが別バッチのインポートで重複
 * 仮説2: 同一application_idに複数interviewが紐づいている重複
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

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
  const [interviews, apps, jobSeekers] = await Promise.all([
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result'),
    fetchAllRows('applications', 'id, job_seeker_id'),
    fetchAllRows('job_seekers', 'id, phone, name_kana'),
  ])

  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))
  const jsMap = new Map<string, any>()
  jobSeekers.forEach(js => jsMap.set(js.id, js))

  const conducted = interviews.filter(iv => iv.conducted_at)
  console.log(`conducted_at NOT NULL: ${conducted.length}`)

  // 1. result別の月別内訳
  console.log('\n--- 1. result別の月別内訳 ---')
  const resultByMonth = new Map<string, Map<string, number>>()
  for (const iv of conducted) {
    const m = iv.scheduled_at?.substring(0, 7) || 'unknown'
    const r = iv.result || '(null)'
    if (!resultByMonth.has(m)) resultByMonth.set(m, new Map())
    const rm = resultByMonth.get(m)!
    rm.set(r, (rm.get(r) || 0) + 1)
  }
  console.log('Month     | completed | 完了  | other')
  for (const [m, rm] of [...resultByMonth.entries()].filter(([m]) => m.startsWith('2025')).sort()) {
    const completed = rm.get('completed') || 0
    const kanryo = rm.get('完了') || 0
    const other = [...rm.entries()].filter(([r]) => r !== 'completed' && r !== '完了').reduce((s, [, c]) => s + c, 0)
    console.log(`${m.padEnd(10)}| ${String(completed).padStart(9)} | ${String(kanryo).padStart(5)} | ${String(other).padStart(5)}`)
  }

  // 2. 同一application_idで複数のconducted interview
  console.log('\n--- 2. 同一application_idに複数interview ---')
  const byApp = new Map<string, typeof conducted>()
  for (const iv of conducted) {
    const arr = byApp.get(iv.application_id) || []
    arr.push(iv)
    byApp.set(iv.application_id, arr)
  }
  const dupApps = [...byApp.entries()].filter(([, arr]) => arr.length > 1)
  console.log(`重複application_id: ${dupApps.length}グループ`)
  const dupAppTotal = dupApps.reduce((s, [, arr]) => s + arr.length, 0)
  console.log(`重複レコード総数: ${dupAppTotal} (余分: ${dupAppTotal - dupApps.length})`)

  // 重複の月別内訳
  const dupByMonth = new Map<string, number>()
  for (const [, arr] of dupApps) {
    // 2件目以降が余分
    for (let i = 1; i < arr.length; i++) {
      const m = arr[i].scheduled_at?.substring(0, 7) || 'unknown'
      dupByMonth.set(m, (dupByMonth.get(m) || 0) + 1)
    }
  }
  if (dupByMonth.size > 0) {
    console.log('\n重複（余分）の月別:')
    for (const [m, c] of [...dupByMonth.entries()].sort()) {
      console.log(`  ${m}: ${c}件`)
    }
  }

  // 3. 同一job_seeker + 同日 の重複（conducted_atベース）
  console.log('\n--- 3. 同一求職者+同日の重複 ---')
  const byJsDate = new Map<string, typeof conducted>()
  for (const iv of conducted) {
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const jsId = app.job_seeker_id
    const date = iv.scheduled_at?.substring(0, 10) || ''
    const key = `${jsId}:${date}`
    const arr = byJsDate.get(key) || []
    arr.push(iv)
    byJsDate.set(key, arr)
  }
  const dupJsGroups = [...byJsDate.entries()].filter(([, arr]) => arr.length > 1)
  const dupJsExtra = dupJsGroups.reduce((s, [, arr]) => s + arr.length - 1, 0)
  console.log(`重複グループ: ${dupJsGroups.length}, 余分レコード: ${dupJsExtra}`)

  // 月別
  const dupJsByMonth = new Map<string, number>()
  for (const [, arr] of dupJsGroups) {
    for (let i = 1; i < arr.length; i++) {
      const m = arr[i].scheduled_at?.substring(0, 7) || 'unknown'
      dupJsByMonth.set(m, (dupJsByMonth.get(m) || 0) + 1)
    }
  }
  if (dupJsByMonth.size > 0) {
    console.log('\n求職者重複（余分）の月別:')
    for (const [m, c] of [...dupJsByMonth.entries()].sort()) {
      console.log(`  ${m}: ${c}件`)
    }
  }

  // 4. "完了" レコードの重複チェック: 同じapplication_idで"completed"と"完了"の両方がある？
  console.log('\n--- 4. 完了+completed 重複チェック ---')
  let bothCount = 0
  for (const [appId, arr] of byApp) {
    const hasCompleted = arr.some(iv => iv.result === 'completed')
    const hasKanryo = arr.some(iv => iv.result === '完了')
    if (hasCompleted && hasKanryo) {
      bothCount++
      if (bothCount <= 5) {
        const app = appMap.get(appId)
        const js = app ? jsMap.get(app.job_seeker_id) : null
        console.log(`  ${js?.name_kana || '?'} (${js?.phone || '?'})`)
        for (const iv of arr) {
          console.log(`    id=${iv.id.substring(0, 8)} result=${iv.result} scheduled=${iv.scheduled_at?.substring(0, 10)}`)
        }
      }
    }
  }
  console.log(`completed+完了の両方あるapplication: ${bothCount}`)

  // 5. "完了" レコードの分析
  console.log('\n--- 5. "完了"レコードの月別 ---')
  const kanryoByMonth = new Map<string, number>()
  for (const iv of conducted) {
    if (iv.result !== '完了') continue
    const m = iv.scheduled_at?.substring(0, 7) || 'unknown'
    kanryoByMonth.set(m, (kanryoByMonth.get(m) || 0) + 1)
  }
  for (const [m, c] of [...kanryoByMonth.entries()].sort()) {
    console.log(`  ${m}: ${c}件`)
  }
}

main()
