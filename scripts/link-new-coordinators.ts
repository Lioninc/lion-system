/**
 * 新コーディネーター3名をCSVデータと紐付け
 * - 荒東 佑弥, 樫谷 蒼志, 岩梨 靖与
 * - applications.coordinator_id, interviews.interviewer_id を更新
 *
 * Usage:
 *   npx tsx scripts/link-new-coordinators.ts          # dry-run
 *   npx tsx scripts/link-new-coordinators.ts --apply   # 実行
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function normalizePhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/[^0-9]/g, '')
  if (digits.length >= 10) return digits
  return ''
}

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

const TARGET_NAMES = ['荒東', '樫谷', '岩梨']
const COL_BB = 53
const COL_PHONE = 19
const COL_AZ = 51
const COL_DATE = 5

async function main() {
  const doApply = process.argv.includes('--apply')
  console.log(`モード: ${doApply ? '実行' : 'dry-run'}`)

  // 1. usersテーブルで3名を確認
  const { data: users } = await supabase.from('users').select('id, name')
  if (!users) { console.error('users取得失敗'); return }

  const targetUsers = new Map<string, { id: string; name: string }>()
  for (const lastName of TARGET_NAMES) {
    const matched = users.filter(u => u.name.startsWith(lastName))
    if (matched.length === 1) {
      targetUsers.set(lastName, { id: matched[0].id, name: matched[0].name })
      console.log(`  ${lastName} → ${matched[0].name} (${matched[0].id.substring(0, 8)}...)`)
    } else {
      console.log(`  ${lastName} → マッチなし or 複数 (${matched.length}件)`)
    }
  }

  // 2. CSVでBB列から該当行を特定（電話番号で紐付け）
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')

  // BB列名 → { phone, appliedAt, hasAz }
  interface CsvMatch {
    phone: string
    appliedAt: string
    hasAz: boolean  // AZ=済み/流れ/辞退
    rowNum: number
  }
  const matchesByCoord = new Map<string, CsvMatch[]>()
  for (const name of TARGET_NAMES) matchesByCoord.set(name, [])

  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    const bb = row[COL_BB]?.trim() || ''
    if (!bb) continue

    for (const lastName of TARGET_NAMES) {
      if (bb.startsWith(lastName)) {
        const phone = normalizePhone(row[COL_PHONE] || '')
        const az = row[COL_AZ]?.trim() || ''
        matchesByCoord.get(lastName)!.push({
          phone,
          appliedAt: row[COL_DATE]?.trim() || '',
          hasAz: az === '済み' || az === '流れ' || az === '辞退',
          rowNum: i + 1,
        })
      }
    }
  }

  console.log('\n=== CSV該当件数 ===')
  for (const [name, matches] of matchesByCoord) {
    const withAz = matches.filter(m => m.hasAz).length
    console.log(`  ${name}: ${matches.length}件 (うちAZ済み/流れ/辞退: ${withAz}件)`)
  }

  // 3. DB: phone → application_id, interview_id のマッピング
  const allApps = await fetchAll('applications', 'id, job_seeker_id, applied_at, coordinator_id')
  const allInterviews = await fetchAll('interviews', 'id, application_id, interviewer_id')
  const allJobSeekers = await fetchAll('job_seekers', 'id, phone')

  const phoneToJsId = new Map<string, string>()
  allJobSeekers.forEach((js: any) => {
    const p = normalizePhone(js.phone)
    if (p) phoneToJsId.set(p, js.id)
  })

  // jsId → application_ids
  const jsToApps = new Map<string, any[]>()
  allApps.forEach((app: any) => {
    if (!jsToApps.has(app.job_seeker_id)) jsToApps.set(app.job_seeker_id, [])
    jsToApps.get(app.job_seeker_id)!.push(app)
  })

  // app_id → interviews
  const appToIvs = new Map<string, any[]>()
  allInterviews.forEach((iv: any) => {
    if (!appToIvs.has(iv.application_id)) appToIvs.set(iv.application_id, [])
    appToIvs.get(iv.application_id)!.push(iv)
  })

  // 4. 更新対象を特定
  let appUpdateCount = 0
  let ivUpdateCount = 0
  const appUpdates: { id: string; coordinator_id: string }[] = []
  const ivUpdates: { id: string; interviewer_id: string }[] = []

  for (const [lastName, matches] of matchesByCoord) {
    const user = targetUsers.get(lastName)
    if (!user) continue

    for (const match of matches) {
      if (!match.phone) continue
      const jsId = phoneToJsId.get(match.phone)
      if (!jsId) continue

      const apps = jsToApps.get(jsId) || []
      // applied_atで最も近い応募を探す（同じ電話番号で複数応募ある場合）
      // ここではcoordinator_id未設定 or 別の担当者の応募を全て対象にする
      for (const app of apps) {
        if (!app.coordinator_id) {
          appUpdates.push({ id: app.id, coordinator_id: user.id })
          appUpdateCount++

          // この応募に紐づくinterview
          const ivs = appToIvs.get(app.id) || []
          for (const iv of ivs) {
            if (!iv.interviewer_id) {
              ivUpdates.push({ id: iv.id, interviewer_id: user.id })
              ivUpdateCount++
            }
          }
        }
      }
    }
  }

  console.log('\n=== 更新対象 ===')
  console.log(`  applications.coordinator_id: ${appUpdateCount}件`)
  console.log(`  interviews.interviewer_id: ${ivUpdateCount}件`)

  if (!doApply) {
    console.log('\n--- dry-runモードです。実行するには: ---')
    console.log('  npx tsx scripts/link-new-coordinators.ts --apply')
    return
  }

  // 5. 実行
  console.log('\n=== 更新実行 ===')
  let appSuccess = 0, appErr = 0
  for (const upd of appUpdates) {
    const { error } = await supabase.from('applications').update({ coordinator_id: upd.coordinator_id }).eq('id', upd.id)
    if (error) { appErr++; console.error(`  app error: ${error.message}`) } else { appSuccess++ }
  }
  console.log(`  applications: 成功 ${appSuccess}, エラー ${appErr}`)

  let ivSuccess = 0, ivErr = 0
  for (const upd of ivUpdates) {
    const { error } = await supabase.from('interviews').update({ interviewer_id: upd.interviewer_id }).eq('id', upd.id)
    if (error) { ivErr++; console.error(`  iv error: ${error.message}`) } else { ivSuccess++ }
  }
  console.log(`  interviews: 成功 ${ivSuccess}, エラー ${ivErr}`)

  // 6. 検証
  console.log('\n=== 検証 ===')
  for (const [lastName] of targetUsers) {
    const user = targetUsers.get(lastName)!
    const { count: appCount } = await supabase.from('applications').select('*', { count: 'exact', head: true }).eq('coordinator_id', user.id)
    const { count: ivCount } = await supabase.from('interviews').select('*', { count: 'exact', head: true }).eq('interviewer_id', user.id)
    console.log(`  ${user.name}: applications=${appCount}, interviews=${ivCount}`)
  }

  console.log('\n✅ 完了')
}

main()
