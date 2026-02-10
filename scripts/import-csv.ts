/**
 * 応募シートCSVからSupabaseへの一括インポートスクリプト
 *
 * 使用方法:
 *   npx tsx scripts/import-csv.ts <CSVファイルパス>
 *
 * 環境変数(.envまたは.env.local):
 *   VITE_SUPABASE_URL=your-supabase-url
 *   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
 *   IMPORT_TENANT_ID=your-tenant-id (オプション、デフォルトは最初のテナント)
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
// Service Role Keyを優先使用（RLSをバイパス）、なければAnon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（または VITE_SUPABASE_ANON_KEY）を設定してください')
  console.error('※ 大量インポートにはService Role Keyの使用を推奨します')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Service Role Keyが設定されていません。RLSポリシーが適用されます。')
  console.warn('   テナント作成などが失敗する可能性があります。')
  console.warn('   .env.localにSUPABASE_SERVICE_ROLE_KEYを追加してください。\n')
}

const supabase = createClient(supabaseUrl, supabaseKey)

// CSVカラムインデックス（0始まり）
// 1行目=集計行、2行目=ヘッダー、3行目以降=データ
// カラム番号（1始まり）から-1してインデックスを求める
const COL = {
  // 基本情報
  DATE: 5,           // 日付 [6]
  NOTES: 7,          // 備考 [8]
  SOURCE: 9,         // 媒体 [10]
  JOB_TYPE: 10,      // 職種 [11]

  // 求職者情報
  NAME_LAST: 13,     // 氏名（姓）[14]
  NAME_FIRST: 14,    // 氏名（名）[15]
  NAME: 15,          // 氏名 [16]
  NAME_KANA_LAST: 16,  // カナ（姓）[17]
  NAME_KANA_FIRST: 17, // カナ（名）[18]
  NAME_KANA: 18,     // カナ [19]
  PHONE: 19,         // 電話番号 [20]
  BIRTH_DATE: 20,    // 生年月日 [21]
  POSTAL_CODE: 23,   // 郵便番号 [24]
  PREFECTURE: 24,    // 都道府県 [25]
  CITY: 25,          // 市区町村群 [26]
  GENDER: 26,        // 性別 [27]
  TATTOO: 27,        // タトゥー [28]
  DISABILITY: 28,    // 障害者手帳 [29]
  MEDICAL: 29,       // 持病 [30]
  SPOUSE: 30,        // 配偶者 [31]
  CHILDREN: 31,      // 子供 [32]
  HEIGHT: 32,        // 身長 [33]
  WEIGHT: 33,        // 体重 [34]

  // 応募ステータス
  STATUS: 35,        // 問い合わせ状態 [36]
  COORDINATOR: 53,   // 担当CD [54]

  // 紹介情報
  REFERRAL_STATUS: 57,  // 繋ぎ状況 [58]
  INTERVIEW_DATE: 61,   // 面接日 [62]
  COMPANY: 63,          // 紹介先 [64]
  PROGRESS: 64,         // 進捗 [65]
  RESULT: 65,           // 合否 [66]
  JOB: 66,              // 案件 [67]

  // 売上情報
  SALES_AMOUNT: 84,     // 確定売上 [85]
  PAID_AMOUNT: 85,      // 入金金額 [86]
  PAYMENT_STATUS: 87,   // 入金進捗 [88]
}

// ステータスマッピング
const STATUS_MAP: Record<string, string> = {
  '新規': 'new',
  '有効': 'valid',
  '有効応募': 'valid',
  '無効': 'invalid',
  '無効応募': 'invalid',
  '不通': 'no_answer',
  '電話出ず': 'no_answer',
  '繋ぎ済み': 'connected',
  '繋ぎ': 'connected',
  '稼働中': 'working',
  '稼働前': 'working',
  '完了': 'completed',
}

// 進捗ステータスマッピング
const PROGRESS_MAP: Record<string, string> = {
  '電話面談予約済み': 'phone_interview_scheduled',
  '電話面談済み': 'phone_interview_done',
  '紹介済み': 'referred',
  '繋ぎ': 'referred',
  '派遣面接予定': 'dispatch_interview_scheduled',
  '派遣面接済み': 'dispatch_interview_done',
  '済み': 'dispatch_interview_done',
  '採用': 'hired',
  '赴任前': 'pre_assignment',
  '赴任済み': 'assigned',
  '稼働中': 'working',
  '全額入金': 'full_paid',
  '確定': 'full_paid',
}

// 紹介ステータスマッピング
const REFERRAL_STATUS_MAP: Record<string, string> = {
  '紹介済み': 'referred',
  '繋ぎ': 'referred',
  '面接予定': 'interview_scheduled',
  '面接済み': 'interview_done',
  '済み': 'interview_done',
  '採用': 'hired',
  '赴任前': 'pre_assignment',
  '赴任済み': 'assigned',
  '稼働中': 'working',
  'キャンセル': 'cancelled',
  '不採用': 'declined',
}

interface ImportStats {
  totalRows: number
  newJobSeekers: number
  existingJobSeekers: number
  newApplications: number
  newReferrals: number
  newSales: number
  errors: string[]
}

// 電話番号を正規化（最大20文字に切り詰め）
function normalizePhone(phone: string): string {
  if (!phone) return ''
  const normalized = phone.replace(/[-\s　]/g, '').trim()
  // DBのvarchar(20)制限に合わせて切り詰め
  return normalized.slice(0, 20)
}

// 日付をパース
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null

  // 様々な形式に対応
  const formats = [
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,  // 2025/1/15
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,    // 2025-1-15
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // 1/15/2025
    /^(\d{1,2})\/(\d{1,2})\s?$/,        // 12/05 (月/日のみ、今年とみなす)
  ]

  for (let idx = 0; idx < formats.length; idx++) {
    const fmt = formats[idx]
    const match = dateStr.trim().match(fmt)
    if (match) {
      let year: number, month: number, day: number
      if (idx === 2) {
        // MM/DD/YYYY形式
        ;[, month, day, year] = match.map(Number)
      } else if (idx === 3) {
        // MM/DD形式（今年とみなす）
        year = new Date().getFullYear()
        ;[, month, day] = match.map(Number)
      } else {
        // YYYY/MM/DD or YYYY-MM-DD形式
        ;[, year, month, day] = match.map(Number)
      }
      // 年が2桁の場合
      if (year < 100) {
        year += year < 50 ? 2000 : 1900
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  return null
}

// 性別を変換
function parseGender(gender: string): 'male' | 'female' | null {
  if (!gender) return null
  if (gender.includes('男')) return 'male'
  if (gender.includes('女')) return 'female'
  return null
}

// 真偽値を変換
function parseBoolean(value: string): boolean {
  if (!value) return false
  const lower = value.toLowerCase()
  return lower.includes('あり') || lower.includes('有') || lower === 'true' || lower === '○' || lower === 'yes'
}

// 数値を変換
function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const num = parseFloat(value.replace(/[,，]/g, ''))
  return isNaN(num) ? null : num
}

// 金額を変換
function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null
  // カンマや円記号を除去
  const cleaned = value.replace(/[,，円¥\\\"]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function main() {
  const csvPath = process.argv[2]

  if (!csvPath) {
    console.error('使用方法: npx tsx scripts/import-csv.ts <CSVファイルパス>')
    process.exit(1)
  }

  const absolutePath = path.resolve(csvPath)

  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイルが見つかりません: ${absolutePath}`)
    process.exit(1)
  }

  console.log(`\n📂 CSVファイル: ${absolutePath}`)
  console.log('📊 インポートを開始します...\n')

  const stats: ImportStats = {
    totalRows: 0,
    newJobSeekers: 0,
    existingJobSeekers: 0,
    newApplications: 0,
    newReferrals: 0,
    newSales: 0,
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

    // テナントIDを取得または作成
    let tenantId = process.env.IMPORT_TENANT_ID
    if (!tenantId) {
      const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
      if (tenants && tenants.length > 0) {
        tenantId = tenants[0].id
      } else {
        // テナントを新規作成
        console.log('テナントが見つかりません。新規作成します...')
        const { data: newTenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            name: 'リオン',
            code: 'lion',
            tenant_type: 'main',
            is_active: true,
          })
          .select('id')
          .single()

        if (tenantError || !newTenant) {
          console.error('テナント作成エラー:', tenantError?.message)
          process.exit(1)
        }
        tenantId = newTenant.id
        console.log('✅ テナント作成完了')
      }
    }
    console.log(`🏢 テナントID: ${tenantId}`)

    // 流入元マスターを取得/作成
    const sourceMap = new Map<string, string>()
    const { data: existingSources } = await supabase
      .from('sources')
      .select('id, name')
      .eq('tenant_id', tenantId)

    existingSources?.forEach(s => sourceMap.set(s.name, s.id))

    // 担当者マスターを取得（名字→フルネームでマッチング）
    // CSVの担当CD[53]は名字のみ（例：山田）→ システムの「山田太郎」に自動マッチング
    const coordinatorMap = new Map<string, string>()
    const coordinatorFullNames: { id: string; name: string }[] = []
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .eq('tenant_id', tenantId)

    users?.forEach(u => {
      coordinatorFullNames.push({ id: u.id, name: u.name })
      // フルネームでもマッチできるように登録
      coordinatorMap.set(u.name, u.id)
    })

    // 名字からフルネームを検索する関数
    function findCoordinatorByLastName(lastName: string): string | null {
      if (!lastName) return null
      // 完全一致を先に確認
      if (coordinatorMap.has(lastName)) {
        return coordinatorMap.get(lastName)!
      }
      // フルネームに名字が含まれている人を検索
      const matches = coordinatorFullNames.filter(u => u.name.startsWith(lastName))
      if (matches.length === 1) {
        return matches[0].id
      }
      return null
    }

    // 派遣会社マスターを取得/作成
    const companyMap = new Map<string, string>()
    const { data: existingCompanies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('tenant_id', tenantId)

    existingCompanies?.forEach(c => companyMap.set(c.name, c.id))

    // 求人マスターを取得/作成
    const jobMap = new Map<string, string>()
    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('id, title, company_id')
      .eq('tenant_id', tenantId)

    existingJobs?.forEach(j => jobMap.set(`${j.company_id}:${j.title}`, j.id))

    // 既存の求職者を電話番号でマッピング
    const existingJobSeekers = new Map<string, string>()
    const { data: jobSeekers } = await supabase
      .from('job_seekers')
      .select('id, phone')
      .eq('tenant_id', tenantId)

    jobSeekers?.forEach(js => {
      const normalizedPhone = normalizePhone(js.phone)
      if (normalizedPhone) {
        existingJobSeekers.set(normalizedPhone, js.id)
      }
    })

    console.log(`📞 既存求職者数: ${existingJobSeekers.size}`)
    console.log('')

    // バッチ処理用
    const BATCH_SIZE = 50
    let processed = 0

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE)

      for (const row of batch) {
        try {
          const phone = normalizePhone(row[COL.PHONE] || '')

          // 名前を組み立て（優先順位）：
          // 1. 氏名[15] → 2. 姓+名 → 3. 姓のみ → 4. 名のみ
          // 5. カナ[18] → 6. カナ姓+カナ名 → 7. カナ姓のみ → 8. カナ名のみ
          let name = ''
          const fullName = row[COL.NAME]?.trim() || ''
          const lastName = row[COL.NAME_LAST]?.trim() || ''
          const firstName = row[COL.NAME_FIRST]?.trim() || ''
          const fullKana = row[COL.NAME_KANA]?.trim() || ''
          const lastKana = row[COL.NAME_KANA_LAST]?.trim() || ''
          const firstKana = row[COL.NAME_KANA_FIRST]?.trim() || ''

          if (fullName) {
            name = fullName
          } else if (lastName && firstName) {
            name = `${lastName} ${firstName}`
          } else if (lastName) {
            name = lastName
          } else if (firstName) {
            name = firstName
          } else if (fullKana) {
            name = fullKana
          } else if (lastKana && firstKana) {
            name = `${lastKana} ${firstKana}`
          } else if (lastKana) {
            name = lastKana
          } else if (firstKana) {
            name = firstKana
          }

          // 電話番号も名前もない行はスキップ
          if (!phone && !name) {
            processed++
            continue
          }

          let jobSeekerId: string

          // 電話番号で既存チェック
          if (phone && existingJobSeekers.has(phone)) {
            jobSeekerId = existingJobSeekers.get(phone)!
            stats.existingJobSeekers++
          } else {
            // 新規求職者を作成
            const jobSeekerData = {
              tenant_id: tenantId,
              phone: phone || `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: name || '名前不明',
              name_kana: row[COL.NAME_KANA]?.trim() || null,
              birth_date: parseDate(row[COL.BIRTH_DATE]),
              gender: parseGender(row[COL.GENDER]),
              postal_code: row[COL.POSTAL_CODE]?.trim() || null,
              prefecture: row[COL.PREFECTURE]?.trim() || null,
              city: row[COL.CITY]?.trim() || null,
              height: parseNumber(row[COL.HEIGHT]),
              weight: parseNumber(row[COL.WEIGHT]),
              has_tattoo: parseBoolean(row[COL.TATTOO]),
              has_medical_condition: parseBoolean(row[COL.MEDICAL]),
              medical_condition_detail: row[COL.MEDICAL]?.trim() || null,
              has_spouse: parseBoolean(row[COL.SPOUSE]),
              has_children: parseBoolean(row[COL.CHILDREN]),
            }

            const { data: newJobSeeker, error: jsError } = await supabase
              .from('job_seekers')
              .insert(jobSeekerData)
              .select('id')
              .single()

            if (jsError) {
              stats.errors.push(`Row ${i + processed + 3}: 求職者作成エラー - ${jsError.message}`)
              processed++
              continue
            }

            jobSeekerId = newJobSeeker.id
            if (phone) {
              existingJobSeekers.set(phone, jobSeekerId)
            }
            stats.newJobSeekers++
          }

          // 流入元を取得/作成
          let sourceId: string | null = null
          const sourceName = row[COL.SOURCE]?.trim()
          if (sourceName) {
            if (sourceMap.has(sourceName)) {
              sourceId = sourceMap.get(sourceName)!
            } else {
              const { data: newSource } = await supabase
                .from('sources')
                .insert({ tenant_id: tenantId, name: sourceName, is_active: true })
                .select('id')
                .single()

              if (newSource) {
                sourceId = newSource.id
                sourceMap.set(sourceName, newSource.id)
              }
            }
          }

          // 担当者IDを取得（名字からフルネームでマッチング）
          let coordinatorId: string | null = null
          const coordinatorName = row[COL.COORDINATOR]?.trim()
          if (coordinatorName) {
            coordinatorId = findCoordinatorByLastName(coordinatorName)
          }

          // ステータスを変換
          const statusRaw = row[COL.STATUS]?.trim() || ''
          const applicationStatus = STATUS_MAP[statusRaw] || 'new'

          // 進捗ステータスを判定
          let progressStatus: string | null = null
          const referralStatusRaw = row[COL.REFERRAL_STATUS]?.trim()
          const progressRaw = row[COL.PROGRESS]?.trim()
          const paymentStatusRaw = row[COL.PAYMENT_STATUS]?.trim()

          if (paymentStatusRaw && paymentStatusRaw.includes('確定')) {
            progressStatus = 'full_paid'
          } else if (progressRaw) {
            progressStatus = PROGRESS_MAP[progressRaw] || null
          } else if (referralStatusRaw) {
            progressStatus = PROGRESS_MAP[referralStatusRaw] || 'referred'
          }

          // 応募を作成
          const appliedAt = parseDate(row[COL.DATE]) || new Date().toISOString().split('T')[0]

          const applicationData = {
            tenant_id: tenantId,
            job_seeker_id: jobSeekerId,
            source_id: sourceId,
            coordinator_id: coordinatorId,
            application_status: applicationStatus,
            progress_status: progressStatus,
            applied_at: appliedAt,
            notes: row[COL.NOTES]?.trim() || null,
          }

          const { data: newApplication, error: appError } = await supabase
            .from('applications')
            .insert(applicationData)
            .select('id')
            .single()

          if (appError) {
            stats.errors.push(`Row ${i + processed + 3}: 応募作成エラー - ${appError.message}`)
            processed++
            continue
          }

          stats.newApplications++

          // 紹介情報がある場合
          if (referralStatusRaw && referralStatusRaw.trim() !== '') {
            const companyName = row[COL.COMPANY]?.trim()
            const jobTitle = row[COL.JOB]?.trim()

            if (companyName) {
              // 会社を取得/作成
              let companyId: string
              if (companyMap.has(companyName)) {
                companyId = companyMap.get(companyName)!
              } else {
                const { data: newCompany } = await supabase
                  .from('companies')
                  .insert({ tenant_id: tenantId, name: companyName, is_active: true })
                  .select('id')
                  .single()

                if (newCompany) {
                  companyId = newCompany.id
                  companyMap.set(companyName, companyId)
                } else {
                  processed++
                  continue
                }
              }

              // 求人を取得/作成
              let jobId: string
              const jobKey = `${companyId}:${jobTitle || companyName}`
              if (jobMap.has(jobKey)) {
                jobId = jobMap.get(jobKey)!
              } else {
                const { data: newJob } = await supabase
                  .from('jobs')
                  .insert({
                    tenant_id: tenantId,
                    company_id: companyId,
                    title: jobTitle || companyName,
                    status: 'open',
                  })
                  .select('id')
                  .single()

                if (newJob) {
                  jobId = newJob.id
                  jobMap.set(jobKey, jobId)
                } else {
                  processed++
                  continue
                }
              }

              // 紹介を作成
              const referralStatus = REFERRAL_STATUS_MAP[referralStatusRaw] || REFERRAL_STATUS_MAP[progressRaw] || 'referred'
              const interviewDate = parseDate(row[COL.INTERVIEW_DATE])

              const referralData = {
                tenant_id: tenantId,
                application_id: newApplication.id,
                job_id: jobId,
                referral_status: referralStatus,
                referred_at: appliedAt,
                dispatch_interview_at: interviewDate,
              }

              const { data: newReferral, error: refError } = await supabase
                .from('referrals')
                .insert(referralData)
                .select('id')
                .single()

              if (!refError && newReferral) {
                stats.newReferrals++

                // 売上情報がある場合
                const salesAmount = parseAmount(row[COL.SALES_AMOUNT])
                if (salesAmount && salesAmount > 0) {
                  const paidAmount = parseAmount(row[COL.PAID_AMOUNT])

                  let saleStatus = 'expected'
                  if (paymentStatusRaw?.includes('入金済') || (paidAmount && paidAmount >= salesAmount)) {
                    saleStatus = 'paid'
                  } else if (paymentStatusRaw?.includes('請求')) {
                    saleStatus = 'invoiced'
                  } else if (paymentStatusRaw?.includes('確定')) {
                    saleStatus = 'confirmed'
                  }

                  const { error: saleError } = await supabase
                    .from('sales')
                    .insert({
                      tenant_id: tenantId,
                      referral_id: newReferral.id,
                      amount: salesAmount,
                      status: saleStatus,
                    })

                  if (!saleError) {
                    stats.newSales++
                  }
                }
              }
            }
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
    console.log('=' .repeat(50))
    console.log('📊 インポート結果')
    console.log('=' .repeat(50))
    console.log(`総行数:           ${stats.totalRows}`)
    console.log(`新規求職者:       ${stats.newJobSeekers}`)
    console.log(`既存求職者:       ${stats.existingJobSeekers}`)
    console.log(`新規応募:         ${stats.newApplications}`)
    console.log(`新規紹介:         ${stats.newReferrals}`)
    console.log(`新規売上:         ${stats.newSales}`)
    console.log(`エラー数:         ${stats.errors.length}`)

    if (stats.errors.length > 0) {
      console.log('\n⚠️  エラー詳細（最初の10件）:')
      stats.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`))
      if (stats.errors.length > 10) {
        console.log(`  ... 他 ${stats.errors.length - 10} 件`)
      }
    }

    console.log('\n✅ インポート完了!')

  } catch (err: any) {
    console.error('\n❌ インポート失敗:', err.message)
    process.exit(1)
  }
}

main()
