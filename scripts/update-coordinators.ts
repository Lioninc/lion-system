/**
 * 既存の応募データの担当者を一括更新するスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/update-coordinators.ts <CSVファイルパス>
 *
 * 処理内容:
 *   1. CSVから電話番号→担当CD（名字）のマップを作成
 *   2. ユーザーマスターから名字→フルネーム(user_id)のマップを作成
 *   3. applicationsテーブルのcoordinator_idを更新
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
import * as dotenv from 'dotenv'

// 環境変数を読み込み
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSVカラムインデックス（0始まり）
const COL = {
  DATE: 5,           // 応募日 [6]
  PHONE: 19,         // 電話番号 [20]
  COORDINATOR: 53,   // 担当CD [54]
}

// 電話番号を正規化
function normalizePhone(phone: string): string {
  if (!phone) return ''
  const normalized = phone.replace(/[-\s　]/g, '').trim()
  return normalized.slice(0, 20)
}

// 日付を正規化（YYYY-MM-DD形式に統一）
function normalizeDate(dateStr: string): string {
  if (!dateStr) return ''
  // 様々な形式を処理: "2024/01/15", "2024-01-15", "2024.01.15" など
  const cleaned = dateStr.trim().replace(/[\/\.]/g, '-')
  // YYYY-MM-DD 形式の最初の10文字を取得
  const match = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const year = match[1]
    const month = match[2].padStart(2, '0')
    const day = match[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return ''
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/update-coordinators.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 担当者データの更新を開始します...\n')

  try {
    // CSVを読み込み
    const fileContent = fs.readFileSync(absolutePath, 'utf-8')
    const records = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][]

    // 最初の2行（集計行+ヘッダー行）をスキップ
    const dataRows = records.slice(2)
    console.log(`📝 CSV総行数: ${dataRows.length}`)

    // CSVから電話番号+応募日→担当CD（名字）のマップを作成
    // キー形式: "電話番号|応募日" (例: "09012345678|2024-01-15")
    const phoneAndDateToCoordinator = new Map<string, string>()
    for (const row of dataRows) {
      const phone = normalizePhone(row[COL.PHONE] || '')
      const date = normalizeDate(row[COL.DATE] || '')
      const coordinator = row[COL.COORDINATOR]?.trim() || ''

      if (phone && date && coordinator) {
        const key = `${phone}|${date}`
        phoneAndDateToCoordinator.set(key, coordinator)
      }
    }

    console.log(`📞 CSV内の担当者付きレコード: ${phoneAndDateToCoordinator.size}件`)

    // テナントIDを取得
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
    const tenantId = tenants[0].id

    // ユーザーマスターを取得
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)

    if (!users || users.length === 0) {
      console.error('ユーザーが見つかりません')
      process.exit(1)
    }

    console.log(`👥 登録ユーザー数: ${users.length}`)
    users.forEach(u => console.log(`   - ${u.name}`))

    // 名字からuser_idを検索する関数
    function findCoordinatorByLastName(lastName: string): string | null {
      if (!lastName) return null
      // 完全一致を先に確認
      const exactMatch = users.find(u => u.name === lastName)
      if (exactMatch) return exactMatch.id
      // フルネームに名字が含まれている人を検索
      const matches = users.filter(u => u.name.startsWith(lastName))
      if (matches.length === 1) {
        return matches[0].id
      }
      return null
    }

    // 求職者を全件取得（ページング対応）
    console.log('\n📋 求職者データを取得中...')
    const allJobSeekers: { id: string; phone: string }[] = []
    let jobSeekerOffset = 0
    const pageSize = 1000

    while (true) {
      const { data: batch } = await supabase
        .from('job_seekers')
        .select('id, phone')
        .eq('tenant_id', tenantId)
        .range(jobSeekerOffset, jobSeekerOffset + pageSize - 1)

      if (!batch || batch.length === 0) break
      allJobSeekers.push(...batch)
      jobSeekerOffset += batch.length
      if (batch.length < pageSize) break
    }

    const phoneToJobSeekerId = new Map<string, string>()
    allJobSeekers.forEach(js => {
      const normalizedPhone = normalizePhone(js.phone)
      if (normalizedPhone) {
        phoneToJobSeekerId.set(normalizedPhone, js.id)
      }
    })

    console.log(`📋 求職者数: ${allJobSeekers.length}`)

    // 応募データを全件取得（ページング対応）
    console.log('📝 応募データを取得中...')
    const allApplications: { id: string; job_seeker_id: string; coordinator_id: string | null; applied_at: string }[] = []
    let appOffset = 0

    while (true) {
      const { data: batch } = await supabase
        .from('applications')
        .select('id, job_seeker_id, coordinator_id, applied_at')
        .eq('tenant_id', tenantId)
        .range(appOffset, appOffset + pageSize - 1)

      if (!batch || batch.length === 0) break
      allApplications.push(...batch)
      appOffset += batch.length
      if (batch.length < pageSize) break
    }

    console.log(`📝 応募数: ${allApplications.length}`)

    // job_seeker_id → phoneの逆引きマップ
    const jobSeekerIdToPhone = new Map<string, string>()
    allJobSeekers.forEach(js => {
      const normalizedPhone = normalizePhone(js.phone)
      if (normalizedPhone) {
        jobSeekerIdToPhone.set(js.id, normalizedPhone)
      }
    })

    // 更新処理
    let updatedCount = 0
    let alreadySetCount = 0
    let notFoundCount = 0
    let noCoordinatorCount = 0
    const errors: string[] = []

    console.log('\n⏳ 更新処理中...')

    for (const app of allApplications) {
      // 求職者の電話番号を取得
      const phone = jobSeekerIdToPhone.get(app.job_seeker_id)
      if (!phone) {
        notFoundCount++
        continue
      }

      // 応募日を正規化してキーを作成
      const appDate = normalizeDate(app.applied_at)
      const key = `${phone}|${appDate}`

      // CSVから担当CD（名字）を取得（電話番号+応募日でマッチング）
      const coordinatorLastName = phoneAndDateToCoordinator.get(key)
      if (!coordinatorLastName) {
        noCoordinatorCount++
        continue
      }

      // 名字からuser_idを検索
      const coordinatorId = findCoordinatorByLastName(coordinatorLastName)
      if (!coordinatorId) {
        notFoundCount++
        continue
      }

      // 既に正しい担当者が設定されている場合はスキップ
      if (app.coordinator_id === coordinatorId) {
        alreadySetCount++
        continue
      }

      // 更新
      const { error: updateError } = await supabase
        .from('applications')
        .update({ coordinator_id: coordinatorId })
        .eq('id', app.id)

      if (updateError) {
        errors.push(`${app.id}: ${updateError.message}`)
      } else {
        updatedCount++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 更新結果')
    console.log('='.repeat(50))
    console.log(`応募総数:           ${allApplications.length}件`)
    console.log(`担当者更新:         ${updatedCount}件`)
    console.log(`既に設定済み:       ${alreadySetCount}件`)
    console.log(`CSV担当者なし:      ${noCoordinatorCount}件`)
    console.log(`マッチングなし:     ${notFoundCount}件`)
    console.log(`エラー:             ${errors.length}件`)

    if (errors.length > 0) {
      console.log('\n⚠️  エラー詳細（最初の5件）:')
      errors.slice(0, 5).forEach(err => console.log(`  - ${err}`))
    }

    // 担当者別の件数を確認
    console.log('\n📈 担当者別応募件数:')
    const { data: stats } = await supabase
      .from('applications')
      .select(`
        coordinator_id,
        coordinator:users!applications_coordinator_id_fkey (name)
      `)
      .eq('tenant_id', tenantId)

    const coordinatorCounts: Record<string, number> = {}
    stats?.forEach(s => {
      const name = (s.coordinator as any)?.name || '未設定'
      coordinatorCounts[name] = (coordinatorCounts[name] || 0) + 1
    })

    Object.entries(coordinatorCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`   ${name}: ${count}件`)
      })

    console.log('\n✅ 担当者更新完了!')

  } catch (err: any) {
    console.error('\n❌ 更新失敗:', err.message)
    process.exit(1)
  }
}

main()
