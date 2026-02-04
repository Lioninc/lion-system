/**
 * CSVから面談データをインポートするスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/import-interviews.ts <CSVファイルパス>
 *
 * 環境変数(.envまたは.env.local):
 *   VITE_SUPABASE_URL=your-supabase-url
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
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
// CSVの1行目=集計行, 2行目=ヘッダー, 3行目以降=データ
// カラム番号は1始まり→インデックスは-1
const COL = {
  PHONE: 19,           // 電話番号 [20]

  // 面談情報（実際のデータから確認した正しいインデックス）
  SCHEDULE_YEAR: 46,   // 日程_年 [47]
  SCHEDULE_MONTH: 47,  // 日程_月 [48]
  SCHEDULE_DAY: 48,    // 日程_日 [49]
  SCHEDULE_TIME: 49,   // 日程_時間 [50]
  INTERVIEW_DATE: 50,  // 面談日程 [51] (例: 2024/12/05)
  INTERVIEW_STATUS: 51, // 状態 [52] (済み/辞退 等)
}

// 面談ステータスマッピング
const INTERVIEW_STATUS_MAP: Record<string, string> = {
  '済み': 'completed',
  '完了': 'completed',
  '実施済み': 'completed',
  '辞退': 'cancelled',
  'キャンセル': 'cancelled',
  '中止': 'cancelled',
  '延期': 'rescheduled',
  '予定': 'scheduled',
  '': 'scheduled',
}

interface ImportStats {
  totalRows: number
  rowsWithInterview: number
  newInterviews: number
  skippedNoJobSeeker: number
  skippedNoApplication: number
  errors: string[]
}

// 電話番号を正規化
function normalizePhone(phone: string): string {
  if (!phone) return ''
  const normalized = phone.replace(/[-\s　]/g, '').trim()
  return normalized.slice(0, 20)
}

// 日付をパース
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null

  const formats = [
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,  // 2025/1/15
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,    // 2025-1-15
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // 1/15/2025
  ]

  for (let idx = 0; idx < formats.length; idx++) {
    const fmt = formats[idx]
    const match = dateStr.trim().match(fmt)
    if (match) {
      let year: number, month: number, day: number
      if (idx === 2) {
        ;[, month, day, year] = match.map(Number)
      } else {
        ;[, year, month, day] = match.map(Number)
      }
      if (year < 100) {
        year += year < 50 ? 2000 : 1900
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

// 年/月/日のカラムから日付を構築
function buildDateFromParts(year: string, month: string, day: string): string | null {
  if (!year && !month && !day) return null

  const y = parseInt(year) || new Date().getFullYear()
  const m = parseInt(month)
  const d = parseInt(day)

  if (!m || !d) return null

  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// 時間をパース
function parseTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null

  // 様々な形式に対応: "14:00", "14時", "14時00分", "1400"
  const cleaned = timeStr.trim()
    .replace(/時/g, ':')
    .replace(/分/g, '')
    .replace(/\s+/g, '')

  // "14:00" 形式
  const match1 = cleaned.match(/^(\d{1,2}):?(\d{2})?$/)
  if (match1) {
    const hour = match1[1].padStart(2, '0')
    const minute = match1[2] || '00'
    return `${hour}:${minute}`
  }

  // "1400" 形式
  const match2 = cleaned.match(/^(\d{2})(\d{2})$/)
  if (match2) {
    return `${match2[1]}:${match2[2]}`
  }

  return null
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/import-interviews.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 面談データのインポートを開始します...\n')

  const stats: ImportStats = {
    totalRows: 0,
    rowsWithInterview: 0,
    newInterviews: 0,
    skippedNoJobSeeker: 0,
    skippedNoApplication: 0,
    errors: [],
  }

  try {
    // CSVを読み込み
    const fileContent = fs.readFileSync(absolutePath, 'utf-8')
    const records = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][]

    // 最初の2行（集計行+ヘッダー行）をスキップ
    const dataRows = records.slice(2)
    stats.totalRows = dataRows.length

    console.log(`📝 総行数: ${stats.totalRows}`)

    // テナントIDを取得
    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
      console.error('テナントが見つかりません')
      process.exit(1)
    }
    const tenantId = tenants[0].id
    console.log(`🏢 テナントID: ${tenantId}`)

    // 既存の求職者を電話番号でマッピング
    const jobSeekerMap = new Map<string, string>()
    const { data: jobSeekers } = await supabase
      .from('job_seekers')
      .select('id, phone')
      .eq('tenant_id', tenantId)

    jobSeekers?.forEach(js => {
      const normalizedPhone = normalizePhone(js.phone)
      if (normalizedPhone) {
        jobSeekerMap.set(normalizedPhone, js.id)
      }
    })

    console.log(`📞 求職者数: ${jobSeekerMap.size}`)

    // 応募データを取得（job_seeker_idでマッピング）
    const applicationMap = new Map<string, string>()
    const { data: applications } = await supabase
      .from('applications')
      .select('id, job_seeker_id')
      .eq('tenant_id', tenantId)

    applications?.forEach(app => {
      // job_seeker_idごとに最初の応募IDを保持
      if (!applicationMap.has(app.job_seeker_id)) {
        applicationMap.set(app.job_seeker_id, app.id)
      }
    })

    console.log(`📋 応募数: ${applicationMap.size}`)

    // 既存の面談を取得（重複チェック用）
    const existingInterviews = new Set<string>()
    const { data: interviews } = await supabase
      .from('interviews')
      .select('application_id, scheduled_at')
      .eq('tenant_id', tenantId)

    interviews?.forEach(iv => {
      // application_id + scheduled_at の組み合わせをキーにする
      const key = `${iv.application_id}:${iv.scheduled_at?.split('T')[0]}`
      existingInterviews.add(key)
    })

    console.log(`📅 既存面談数: ${existingInterviews.size}`)
    console.log('')

    // バッチ処理
    const BATCH_SIZE = 50
    let processed = 0

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE)

      for (const row of batch) {
        try {
          const phone = normalizePhone(row[COL.PHONE] || '')

          // 面談日程を取得（[50]の面談日程カラムを優先、なければ年/月/日から構築）
          let interviewDate = parseDate(row[COL.INTERVIEW_DATE])
          if (!interviewDate) {
            interviewDate = buildDateFromParts(
              row[COL.SCHEDULE_YEAR],
              row[COL.SCHEDULE_MONTH],
              row[COL.SCHEDULE_DAY]
            )
          }

          // 面談日程がない行はスキップ
          if (!interviewDate) {
            processed++
            continue
          }

          stats.rowsWithInterview++

          // 電話番号がない行はスキップ
          if (!phone) {
            stats.skippedNoJobSeeker++
            processed++
            continue
          }

          // 求職者を検索
          const jobSeekerId = jobSeekerMap.get(phone)
          if (!jobSeekerId) {
            stats.skippedNoJobSeeker++
            processed++
            continue
          }

          // 応募を検索
          const applicationId = applicationMap.get(jobSeekerId)
          if (!applicationId) {
            stats.skippedNoApplication++
            processed++
            continue
          }

          // 重複チェック（application_id + 日付）
          const interviewKey = `${applicationId}:${interviewDate}`
          if (existingInterviews.has(interviewKey)) {
            processed++
            continue
          }

          // 面談時間
          const interviewTime = parseTime(row[COL.SCHEDULE_TIME])

          // 面談ステータス
          const statusRaw = row[COL.INTERVIEW_STATUS]?.trim() || ''
          const status = INTERVIEW_STATUS_MAP[statusRaw] || 'scheduled'

          // scheduled_atを構築
          let scheduledAt: string
          if (interviewTime) {
            scheduledAt = `${interviewDate}T${interviewTime}:00`
          } else {
            scheduledAt = `${interviewDate}T10:00:00` // デフォルト10時
          }

          // conducted_atを設定（完了の場合）
          let conductedAt: string | null = null
          if (status === 'completed') {
            conductedAt = scheduledAt
          }

          // 面談を作成（job_seeker_idはテーブルにないのでapplication_idのみ使用）
          const interviewData = {
            tenant_id: tenantId,
            application_id: applicationId,
            interview_type: 'phone', // 電話面談
            scheduled_at: scheduledAt,
            conducted_at: conductedAt,
            result: status === 'completed' ? '完了' : status === 'cancelled' ? '辞退' : null,
          }

          const { error: ivError } = await supabase
            .from('interviews')
            .insert(interviewData)

          if (ivError) {
            stats.errors.push(`Row ${i + processed + 3}: 面談作成エラー - ${ivError.message}`)
          } else {
            stats.newInterviews++
            existingInterviews.add(interviewKey)
          }

        } catch (err: any) {
          stats.errors.push(`Row ${i + processed + 3}: ${err.message}`)
        }

        processed++
      }

      // 進捗表示
      const progress = Math.min(100, Math.round((processed / stats.totalRows) * 100))
      process.stdout.write(`\r⏳ 処理中... ${processed}/${stats.totalRows} (${progress}%)`)
    }

    console.log('\n')
    console.log('='.repeat(50))
    console.log('📊 面談インポート結果')
    console.log('='.repeat(50))
    console.log(`総行数:               ${stats.totalRows}`)
    console.log(`面談データあり:       ${stats.rowsWithInterview}`)
    console.log(`新規面談登録:         ${stats.newInterviews}`)
    console.log(`求職者なし(スキップ): ${stats.skippedNoJobSeeker}`)
    console.log(`応募なし(スキップ):   ${stats.skippedNoApplication}`)
    console.log(`エラー数:             ${stats.errors.length}`)

    if (stats.errors.length > 0) {
      console.log('\n⚠️  エラー詳細（最初の10件）:')
      stats.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`))
      if (stats.errors.length > 10) {
        console.log(`  ... 他 ${stats.errors.length - 10} 件`)
      }
    }

    console.log('\n✅ 面談インポート完了!')

  } catch (err: any) {
    console.error('\n❌ インポート失敗:', err.message)
    process.exit(1)
  }
}

main()
