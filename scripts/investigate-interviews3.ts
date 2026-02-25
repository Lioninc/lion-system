/**
 * 2025年1月 interviews 詳細調査
 * 1. 担当者別件数
 * 2. 不明コーディネーター
 * 3. 同一求職者・同日の重複
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
  const [interviews, apps, users, jobSeekers] = await Promise.all([
    fetchAllRows('interviews', 'id, application_id, scheduled_at, conducted_at, result, interviewer_id'),
    fetchAllRows('applications', 'id, applied_at, coordinator_id, job_seeker_id'),
    fetchAllRows('users', 'id, name'),
    fetchAllRows('job_seekers', 'id, phone, name_kana'),
  ])

  const appMap = new Map<string, any>()
  apps.forEach(a => appMap.set(a.id, a))
  const userMap = new Map<string, string>()
  users.forEach(u => userMap.set(u.id, u.name))
  const jsMap = new Map<string, any>()
  jobSeekers.forEach(js => jsMap.set(js.id, js))

  // 2025年1月のconducted_atありinterviews
  const jan2025 = interviews.filter(iv =>
    iv.conducted_at && iv.conducted_at.startsWith('2025-01')
  )

  console.log('='.repeat(70))
  console.log('【2025年1月 conducted_atあり interviews】')
  console.log('='.repeat(70))
  console.log(`  件数: ${jan2025.length}`)

  // 1. 担当者別件数（interviewer_id + application.coordinator_id 両方確認）
  console.log('\n--- 1. 担当者別件数 ---')

  // By interviewer_id
  const byInterviewer = new Map<string, number>()
  jan2025.forEach(iv => {
    const name = iv.interviewer_id ? (userMap.get(iv.interviewer_id) || `不明(${iv.interviewer_id.substring(0, 8)})`) : '(未設定)'
    byInterviewer.set(name, (byInterviewer.get(name) || 0) + 1)
  })
  console.log('\n  interviewer_id ベース:')
  for (const [name, count] of [...byInterviewer.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name.padEnd(20)} ${count}件`)
  }

  // By application.coordinator_id
  const byCoordinator = new Map<string, number>()
  jan2025.forEach(iv => {
    const app = appMap.get(iv.application_id)
    const coordId = app?.coordinator_id
    const name = coordId ? (userMap.get(coordId) || `不明(${coordId.substring(0, 8)})`) : '(未設定)'
    byCoordinator.set(name, (byCoordinator.get(name) || 0) + 1)
  })
  console.log('\n  application.coordinator_id ベース:')
  for (const [name, count] of [...byCoordinator.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${name.padEnd(20)} ${count}件`)
  }

  // 2. 不明コーディネーター
  console.log('\n--- 2. スプシに存在しないコーディネーター ---')
  const unknownInterviewers = new Set<string>()
  const unknownCoordinators = new Set<string>()
  jan2025.forEach(iv => {
    if (iv.interviewer_id && !userMap.has(iv.interviewer_id)) {
      unknownInterviewers.add(iv.interviewer_id)
    }
    const app = appMap.get(iv.application_id)
    if (app?.coordinator_id && !userMap.has(app.coordinator_id)) {
      unknownCoordinators.add(app.coordinator_id)
    }
  })
  console.log(`  不明interviewer_id: ${unknownInterviewers.size}件`)
  unknownInterviewers.forEach(id => console.log(`    ${id}`))
  console.log(`  不明coordinator_id: ${unknownCoordinators.size}件`)
  unknownCoordinators.forEach(id => console.log(`    ${id}`))

  // 全月でも確認
  console.log('\n  （参考）全期間の不明コーディネーター:')
  const allUnknownCoord = new Map<string, number>()
  interviews.forEach(iv => {
    if (iv.conducted_at) {
      const app = appMap.get(iv.application_id)
      if (app?.coordinator_id && !userMap.has(app.coordinator_id)) {
        allUnknownCoord.set(app.coordinator_id, (allUnknownCoord.get(app.coordinator_id) || 0) + 1)
      }
    }
  })
  if (allUnknownCoord.size === 0) {
    console.log('    なし')
  } else {
    for (const [id, count] of [...allUnknownCoord.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${id.substring(0, 8)}...: ${count}件`)
    }
  }

  // 3. 同一求職者・同日の重複チェック
  console.log('\n--- 3. 同一求職者・同日の重複チェック ---')

  // 全interviews（全期間）で確認
  const dupKey = new Map<string, any[]>()
  for (const iv of interviews) {
    if (!iv.conducted_at) continue
    const app = appMap.get(iv.application_id)
    if (!app) continue
    const jsId = app.job_seeker_id
    const dateOnly = iv.conducted_at.substring(0, 10)
    const key = `${jsId}:${dateOnly}`
    const arr = dupKey.get(key) || []
    arr.push({ ...iv, app })
    dupKey.set(key, arr)
  }

  const dupGroups = [...dupKey.entries()].filter(([, arr]) => arr.length > 1)
  console.log(`  全期間 重複グループ数: ${dupGroups.length}`)
  const totalDupRecords = dupGroups.reduce((sum, [, arr]) => sum + arr.length, 0)
  console.log(`  重複レコード総数: ${totalDupRecords}（削除対象: ${totalDupRecords - dupGroups.length}）`)

  // 月別重複件数
  const dupByMonth = new Map<string, number>()
  for (const [, arr] of dupGroups) {
    const m = arr[0].conducted_at.substring(0, 7)
    dupByMonth.set(m, (dupByMonth.get(m) || 0) + (arr.length - 1))
  }
  if (dupByMonth.size > 0) {
    console.log('\n  月別重複（削除対象）:')
    for (const [month, count] of [...dupByMonth.entries()].sort()) {
      console.log(`    ${month}: ${count}件`)
    }
  }

  // 2025年1月の重複詳細
  const jan2025Dups = dupGroups.filter(([, arr]) => arr[0].conducted_at.startsWith('2025-01'))
  console.log(`\n  2025年1月 重複グループ: ${jan2025Dups.length}`)
  for (const [key, arr] of jan2025Dups.slice(0, 10)) {
    const jsId = key.split(':')[0]
    const js = jsMap.get(jsId)
    const phone = js?.phone || '?'
    const name = js?.name_kana || '?'
    console.log(`\n  グループ: ${name} (${phone}) - ${arr[0].conducted_at.substring(0, 10)}`)
    for (const iv of arr) {
      const interviewer = iv.interviewer_id ? (userMap.get(iv.interviewer_id) || '不明') : '未設定'
      console.log(`    id=${iv.id.substring(0, 8)} result=${iv.result} interviewer=${interviewer}`)
    }
  }

  // 同一application_idで同日の重複（より厳密）
  console.log('\n--- 3b. 同一application_id・同日の重複 ---')
  const dupByApp = new Map<string, any[]>()
  for (const iv of interviews) {
    if (!iv.conducted_at) continue
    const dateOnly = iv.conducted_at.substring(0, 10)
    const key = `${iv.application_id}:${dateOnly}`
    const arr = dupByApp.get(key) || []
    arr.push(iv)
    dupByApp.set(key, arr)
  }
  const appDupGroups = [...dupByApp.entries()].filter(([, arr]) => arr.length > 1)
  console.log(`  重複グループ数: ${appDupGroups.length}`)
  const appDupTotal = appDupGroups.reduce((sum, [, arr]) => sum + arr.length, 0)
  console.log(`  重複レコード総数: ${appDupTotal}（削除対象: ${appDupTotal - appDupGroups.length}）`)
}

main()
