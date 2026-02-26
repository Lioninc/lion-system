/**
 * 全データ再インポート（バッチ最適化版）
 *
 * 1. sales → referrals → interviews → applications を全削除
 * 2. CSVから再インポート（バッチ挿入で高速化）
 * 3. 月別数値を検証
 *
 * 【集計定義】
 * - 面談:    AZ=「済み」、担当=BB、月=AU+AV
 * - 繋ぎ:    BF=「繋ぎ」、月=AU+AV
 * - 面接予定: BJ に値あり、月=AU+AV
 * - 面接済:  BM=「済み」、月=AU+AV
 * - 採用:    BN=「採用」、月=AU+AV
 * - 売上見込: BX金額、月=AU+AV
 * - 売上確定: CG金額、月=AU+AV
 * - 入金:    CH金額、月=AU+AV
 *
 * 使い方:
 *   npx tsx scripts/reimport-all.ts                     # dry-run (CSV解析のみ)
 *   npx tsx scripts/reimport-all.ts --apply             # 実行
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

// ============================================================
// CSV列マッピング (0-indexed)
// ============================================================
const COL = {
  NO: 0,
  DATE: 5,           // F: 日付（応募日）
  STATUS: 6,         // G: 状態
  NOTES: 7,          // H: 備考
  RESPONSE: 8,       // I: 応募対応
  SOURCE: 9,         // J: 媒体
  JOB_TYPE: 10,      // K: 職種
  LOCATION: 12,      // M: 勤務地
  NAME_LAST: 13,     // N: 氏名(姓)
  NAME_FIRST: 14,    // O: 氏名(名)
  NAME: 15,          // P: 氏名
  KANA_LAST: 16,     // Q: カナ(姓)
  KANA_FIRST: 17,    // R: カナ(名)
  KANA: 18,          // S: カナ
  PHONE: 19,         // T: 電話番号
  BIRTH_DATE: 20,    // U: 生年月日
  POSTAL: 23,        // X: 郵便番号
  PREF: 24,          // Y: 都道府県
  CITY: 25,          // Z: 市区町村群
  GENDER: 26,        // AA: 性別
  TATTOO: 27,        // AB: タトゥー
  DISABILITY: 28,    // AC: 障害者手帳
  MEDICAL: 29,       // AD: 持病
  SPOUSE: 30,        // AE: 配偶者
  CHILDREN: 31,      // AF: 子供
  HEIGHT: 32,        // AG: 身長
  WEIGHT: 33,        // AH: 体重
  INQUIRY_STATUS: 35, // AJ: 問い合わせ状態
  AU: 46,            // AU: 日程_年
  AV: 47,            // AV: 日程_月
  AX: 49,            // AX: 面談時間
  AY: 50,            // AY: 面談日程
  AZ: 51,            // AZ: 面談ステータス(済み/流れ/辞退)
  BB: 53,            // BB: 担当CD
  BF: 57,            // BF: 繋ぎ状況
  BG: 58,            // BG: 派遣予定_年
  BH: 59,            // BH: 派遣予定_月
  BJ: 61,            // BJ: 面接日
  BL: 63,            // BL: 紹介先（会社）
  BM: 64,            // BM: 進捗（面接済=「済み」）
  BN: 65,            // BN: 合否（採用/不採用）
  BO: 66,            // BO: 案件
  BS: 70,            // BS: 赴任予定日
  BX: 75,            // BX: 見込み売上
  CF: 83,            // CF: 稼働日
  CG: 84,            // CG: 確定売上
  CH: 85,            // CH: 入金金額
  CJ: 87,            // CJ: 入金進捗
}

// ============================================================
// Helpers
// ============================================================
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

function normalizePhone(phone: string): string {
  if (!phone) return ''
  return phone.replace(/[-\s\u3000()（）]/g, '').trim().slice(0, 20)
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null
  const s = dateStr.trim()
  // YYYY/M/D or YYYY-M-D
  let m = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // M/D (MM/DD only, year=current)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\s*$/)
  if (m) {
    const y = new Date().getFullYear()
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

function parseAmount(value: string): number | null {
  if (!value || value.trim() === '') return null
  const cleaned = value.replace(/[,，円¥\\"]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function parseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const num = parseFloat(value.replace(/[,，]/g, ''))
  return isNaN(num) ? null : num
}

function parseGender(g: string): 'male' | 'female' | null {
  if (!g) return null
  if (g.includes('男')) return 'male'
  if (g.includes('女')) return 'female'
  return null
}

function parseBool(v: string): boolean {
  if (!v) return false
  return v.includes('あり') || v.includes('有') || v === '○'
}

/** AU+AVからfiscal dateを構築 (YYYY-MM-15) */
function buildFiscalDate(au: string, av: string): string | null {
  if (!au || !av) return null
  const month = av.padStart(2, '0')
  return `${au}-${month}-15`
}

/**
 * 稼働月の日付を計算
 * CF列(MM/DD)の月、年はBG優先→AU
 * CFなければBG+BH列で代替
 * returns { workMonthDate: YYYY-MM-15, startWorkDate: YYYY-MM-DD | null (CF実日付) }
 */
function buildWorkMonth(cf: string, bg: string, bh: string, au: string): { workMonthDate: string | null; startWorkDate: string | null } {
  const year = bg || au
  if (!year) return { workMonthDate: null, startWorkDate: null }

  // CF = MM/DD形式 → 月を取得、実日付も保存
  if (cf) {
    const m = cf.match(/^(\d{1,2})\/(\d{1,2})/)
    if (m) {
      const mm = m[1].padStart(2, '0')
      const dd = m[2].padStart(2, '0')
      return {
        workMonthDate: `${year}-${mm}-15`,
        startWorkDate: `${year}-${mm}-${dd}`,
      }
    }
  }

  // CFなし → BG+BHで代替
  if (bh) {
    const mm = bh.padStart(2, '0')
    return { workMonthDate: `${year}-${mm}-15`, startWorkDate: null }
  }

  return { workMonthDate: null, startWorkDate: null }
}

const STATUS_MAP: Record<string, string> = {
  '新規': 'new', '有効': 'valid', '有効応募': 'valid',
  '無効': 'invalid', '無効応募': 'invalid',
  '不通': 'no_answer', '電話出ず': 'no_answer',
  '繋ぎ済み': 'connected', '繋ぎ': 'connected',
  '稼働中': 'working', '稼働前': 'working', '完了': 'completed',
}

const PROGRESS_MAP: Record<string, string> = {
  '電話面談予約済み': 'phone_interview_scheduled', '電話面談済み': 'phone_interview_done',
  '紹介済み': 'referred', '繋ぎ': 'referred',
  '派遣面接予定': 'dispatch_interview_scheduled', '派遣面接済み': 'dispatch_interview_done',
  '済み': 'dispatch_interview_done',
  '採用': 'hired', '赴任前': 'pre_assignment', '赴任済み': 'assigned',
  '稼働中': 'working', '全額入金': 'full_paid', '確定': 'full_paid',
}

const REFERRAL_STATUS_MAP: Record<string, string> = {
  '紹介済み': 'referred', '繋ぎ': 'referred',
  '面接予定': 'interview_scheduled', '面接済み': 'interview_done', '済み': 'interview_done',
  '採用': 'hired', '赴任前': 'pre_assignment', '赴任済み': 'assigned',
  '稼働中': 'working', 'キャンセル': 'cancelled', '不採用': 'declined',
  '辞退': 'declined', '流れ': 'cancelled',
}

// ============================================================
// DB helpers
// ============================================================
async function fetchAllRows(table: string, select: string): Promise<any[]> {
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

async function deleteAll(table: string): Promise<number> {
  let total = 0
  while (true) {
    const { data } = await supabase.from(table).select('id').limit(500)
    if (!data || data.length === 0) break
    const ids = data.map((r: any) => r.id)
    const { error } = await supabase.from(table).delete().in('id', ids)
    if (error) { console.error(`  Delete error (${table}):`, error.message); break }
    total += ids.length
    process.stdout.write(`\r  ${table}: ${total}件削除`)
  }
  if (total > 0) console.log('')
  return total
}

async function batchInsert(table: string, rows: any[], batchSize = 200): Promise<{ success: number; errors: number }> {
  let success = 0, errors = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)
    if (error) {
      // Retry one by one
      for (const row of batch) {
        const { error: e2 } = await supabase.from(table).insert(row)
        if (e2) { errors++ } else { success++ }
      }
    } else {
      success += batch.length
    }
    process.stdout.write(`\r  ${table}: ${success + errors}/${rows.length}`)
  }
  if (rows.length > 0) console.log(`  → 成功: ${success}, エラー: ${errors}`)
  return { success, errors }
}

// ============================================================
// Main
// ============================================================
async function main() {
  const doApply = process.argv.includes('--apply')
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025 (1).csv'

  if (!fs.existsSync(csvPath)) {
    console.error(`CSVファイルが見つかりません: ${csvPath}`)
    process.exit(1)
  }

  console.log(`CSV: ${csvPath}`)
  console.log(`モード: ${doApply ? '実行' : 'dry-run'}`)

  // ============================================================
  // Phase 0: CSV読み込み
  // ============================================================
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')
  const dataRows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    dataRows.push(parseCsvLine(lines[i]))
  }
  console.log(`\nCSVデータ行数: ${dataRows.length}`)

  // ============================================================
  // Phase 1: CSV解析 → マスターデータ収集
  // ============================================================
  console.log('\n=== Phase 1: CSV解析 ===')

  const uniqueSources = new Set<string>()
  const uniqueCompanies = new Set<string>()
  const uniqueJobs = new Map<string, Set<string>>() // company → Set<job>
  const uniquePhones = new Set<string>()

  // 集計用カウンタ（検証用）
  const csvCounts = {
    interviews: new Map<string, number>(),     // AZ=済み by AU+AV
    referrals: new Map<string, number>(),       // BF=繋ぎ by AU+AV
    dispatchScheduled: new Map<string, number>(), // BJ値あり by AU+AV
    dispatchDone: new Map<string, number>(),    // BM=済み by AU+AV
    hired: new Map<string, number>(),           // BN=採用 by AU+AV
  }

  function incMap(map: Map<string, number>, month: string) {
    map.set(month, (map.get(month) || 0) + 1)
  }

  for (const row of dataRows) {
    const phone = normalizePhone(row[COL.PHONE] || '')
    if (phone) uniquePhones.add(phone)

    const source = row[COL.SOURCE]?.trim()
    if (source) uniqueSources.add(source)

    const company = row[COL.BL]?.trim()
    if (company) {
      uniqueCompanies.add(company)
      const job = row[COL.BO]?.trim() || company
      if (!uniqueJobs.has(company)) uniqueJobs.set(company, new Set())
      uniqueJobs.get(company)!.add(job)
    }

    // 集計用
    const au = row[COL.AU] || ''
    const av = row[COL.AV] || ''
    const month = au && av ? `${au}-${av.padStart(2, '0')}` : ''

    if (month) {
      if (row[COL.AZ]?.trim() === '済み') incMap(csvCounts.interviews, month)
      if (row[COL.BF]?.trim() === '繋ぎ') incMap(csvCounts.referrals, month)
      if (row[COL.BJ]?.trim()) incMap(csvCounts.dispatchScheduled, month)
      if (row[COL.BM]?.trim() === '済み') incMap(csvCounts.dispatchDone, month)
      if (row[COL.BN]?.trim() === '採用') incMap(csvCounts.hired, month)
    }
  }

  console.log(`  ユニーク電話番号: ${uniquePhones.size}`)
  console.log(`  ユニーク媒体: ${uniqueSources.size}`)
  console.log(`  ユニーク会社: ${uniqueCompanies.size}`)

  // CSV月別集計（検証用）
  const expected = {
    '2025-01': { i: 258, r: 103 }, '2025-02': { i: 266, r: 93 },
    '2025-03': { i: 306, r: 118 }, '2025-04': { i: 332, r: 127 },
    '2025-05': { i: 310, r: 119 }, '2025-06': { i: 385, r: 164 },
    '2025-07': { i: 384, r: 168 }, '2025-08': { i: 306, r: 124 },
    '2025-09': { i: 306, r: 145 }, '2025-10': { i: 293, r: 149 },
    '2025-11': { i: 193, r: 86 }, '2025-12': { i: 172, r: 85 },
  } as Record<string, { i: number; r: number }>

  console.log('\n--- CSV集計（AZ=済み × AU+AV月） ---')
  console.log('Month     | 面談(CSV) | スプシ | 繋ぎ(CSV) | スプシ')
  for (const m of Object.keys(expected).sort()) {
    const iv = csvCounts.interviews.get(m) || 0
    const ref = csvCounts.referrals.get(m) || 0
    const e = expected[m]
    console.log(`${m.padEnd(10)}| ${String(iv).padStart(9)} | ${String(e.i).padStart(6)} | ${String(ref).padStart(9)} | ${String(e.r).padStart(6)}`)
  }

  if (!doApply) {
    console.log('\n--- dry-runモードです。実行するには: ---')
    console.log('  npx tsx scripts/reimport-all.ts --apply')
    return
  }

  // ============================================================
  // Phase 2: 既存データ削除
  // ============================================================
  console.log('\n=== Phase 2: 既存データ削除 ===')
  await deleteAll('sales')
  await deleteAll('referrals')
  await deleteAll('interviews')
  await deleteAll('applications')
  console.log('  削除完了')

  // ============================================================
  // Phase 3: マスターデータ準備
  // ============================================================
  console.log('\n=== Phase 3: マスターデータ準備 ===')

  // テナントID
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
  const tenantId = tenants?.[0]?.id
  if (!tenantId) { console.error('テナントが見つかりません'); return }
  console.log(`  テナント: ${tenantId}`)

  // 媒体
  const sourceMap = new Map<string, string>()
  const existingSources = await fetchAllRows('sources', 'id, name')
  existingSources.forEach(s => sourceMap.set(s.name, s.id))
  for (const name of uniqueSources) {
    if (!sourceMap.has(name)) {
      const { data } = await supabase.from('sources').insert({ tenant_id: tenantId, name, is_active: true }).select('id').single()
      if (data) sourceMap.set(name, data.id)
    }
  }
  console.log(`  媒体: ${sourceMap.size}`)

  // 担当者
  const coordMap = new Map<string, string>()
  const users = await fetchAllRows('users', 'id, name')
  users.forEach(u => coordMap.set(u.name, u.id))

  function findCoord(lastName: string): string | null {
    if (!lastName) return null
    if (coordMap.has(lastName)) return coordMap.get(lastName)!
    const match = users.filter(u => u.name.startsWith(lastName))
    if (match.length === 1) return match[0].id
    return null
  }

  // 会社
  const companyMap = new Map<string, string>()
  const existingCompanies = await fetchAllRows('companies', 'id, name')
  existingCompanies.forEach(c => companyMap.set(c.name, c.id))
  for (const name of uniqueCompanies) {
    if (!companyMap.has(name)) {
      const { data } = await supabase.from('companies').insert({ tenant_id: tenantId, name, is_active: true }).select('id').single()
      if (data) companyMap.set(name, data.id)
    }
  }
  console.log(`  会社: ${companyMap.size}`)

  // 求人
  const jobMap = new Map<string, string>() // "companyId:title" → jobId
  const existingJobs = await fetchAllRows('jobs', 'id, title, company_id')
  existingJobs.forEach(j => jobMap.set(`${j.company_id}:${j.title}`, j.id))
  for (const [companyName, jobTitles] of uniqueJobs) {
    const companyId = companyMap.get(companyName)
    if (!companyId) continue
    for (const title of jobTitles) {
      const key = `${companyId}:${title}`
      if (!jobMap.has(key)) {
        const { data } = await supabase.from('jobs').insert({ tenant_id: tenantId, company_id: companyId, title, status: 'open' }).select('id').single()
        if (data) jobMap.set(key, data.id)
      }
    }
  }
  console.log(`  求人: ${jobMap.size}`)

  // プレースホルダー会社/求人（紹介先なしのreferral用）
  let placeholderJobId: string
  if (!companyMap.has('未定')) {
    const { data } = await supabase.from('companies').insert({ tenant_id: tenantId, name: '未定', is_active: true }).select('id').single()
    if (data) companyMap.set('未定', data.id)
  }
  const placeholderCompanyId = companyMap.get('未定')!
  const placeholderJobKey = `${placeholderCompanyId}:未定`
  if (!jobMap.has(placeholderJobKey)) {
    const { data } = await supabase.from('jobs').insert({ tenant_id: tenantId, company_id: placeholderCompanyId, title: '未定', status: 'open' }).select('id').single()
    if (data) jobMap.set(placeholderJobKey, data.id)
  }
  placeholderJobId = jobMap.get(placeholderJobKey)!
  console.log(`  プレースホルダー求人: ${placeholderJobId.substring(0, 8)}...`)

  // 求職者
  const jsMap = new Map<string, string>() // phone → id
  const existingJS = await fetchAllRows('job_seekers', 'id, phone')
  existingJS.forEach(js => {
    const p = normalizePhone(js.phone)
    if (p) jsMap.set(p, js.id)
  })
  console.log(`  既存求職者: ${jsMap.size}`)

  // ============================================================
  // Phase 4: データ準備 + 挿入
  // ============================================================
  console.log('\n=== Phase 4: データインポート ===')

  const appRows: any[] = []
  const ivRows: any[] = []
  const refRows: any[] = []
  const salesRows: any[] = []

  let newJsCount = 0

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx]
    const phone = normalizePhone(row[COL.PHONE] || '')

    // 名前
    let name = row[COL.NAME]?.trim() || ''
    if (!name) {
      const l = row[COL.NAME_LAST]?.trim() || ''
      const f = row[COL.NAME_FIRST]?.trim() || ''
      name = l && f ? `${l} ${f}` : l || f || ''
    }
    if (!name) {
      name = row[COL.KANA]?.trim() || ''
      if (!name) {
        const kl = row[COL.KANA_LAST]?.trim() || ''
        const kf = row[COL.KANA_FIRST]?.trim() || ''
        name = kl && kf ? `${kl} ${kf}` : kl || kf || ''
      }
    }

    if (!phone && !name) continue

    // 求職者の取得/作成
    let jsId: string
    if (phone && jsMap.has(phone)) {
      jsId = jsMap.get(phone)!
    } else {
      // カナ
      let kana = row[COL.KANA]?.trim() || ''
      if (!kana) {
        const kl = row[COL.KANA_LAST]?.trim() || ''
        const kf = row[COL.KANA_FIRST]?.trim() || ''
        kana = kl && kf ? `${kl} ${kf}` : kl || kf || ''
      }

      const { data: newJS, error } = await supabase.from('job_seekers').insert({
        tenant_id: tenantId,
        phone: phone || `unknown-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: name || '名前不明',
        name_kana: kana || null,
        birth_date: parseDate(row[COL.BIRTH_DATE]),
        gender: parseGender(row[COL.GENDER]),
        postal_code: row[COL.POSTAL]?.trim() || null,
        prefecture: row[COL.PREF]?.trim() || null,
        city: row[COL.CITY]?.trim() || null,
        height: parseNumber(row[COL.HEIGHT]),
        weight: parseNumber(row[COL.WEIGHT]),
        has_tattoo: parseBool(row[COL.TATTOO]),
        has_medical_condition: parseBool(row[COL.MEDICAL]),
        medical_condition_detail: row[COL.MEDICAL]?.trim() || null,
        has_spouse: parseBool(row[COL.SPOUSE]),
        has_children: parseBool(row[COL.CHILDREN]),
      }).select('id').single()

      if (error || !newJS) continue
      jsId = newJS.id
      if (phone) jsMap.set(phone, jsId)
      newJsCount++
    }

    // 日付系
    const appliedAt = parseDate(row[COL.DATE]) || new Date().toISOString().split('T')[0]
    const au = row[COL.AU]?.trim() || ''
    const av = row[COL.AV]?.trim() || ''
    const ayDate = parseDate(row[COL.AY])
    const fiscalDate = ayDate || buildFiscalDate(au, av)

    // 担当者
    const coordId = findCoord(row[COL.BB]?.trim() || '')

    // ステータス
    const statusRaw = row[COL.INQUIRY_STATUS]?.trim() || ''
    const appStatus = STATUS_MAP[statusRaw] || 'new'

    const referralStatusRaw = row[COL.BF]?.trim() || ''
    const progressRaw = row[COL.BM]?.trim() || ''
    const paymentRaw = row[COL.CJ]?.trim() || ''

    let progressStatus: string | null = null
    if (paymentRaw?.includes('確定')) progressStatus = 'full_paid'
    else if (progressRaw) progressStatus = PROGRESS_MAP[progressRaw] || null
    else if (referralStatusRaw) progressStatus = PROGRESS_MAP[referralStatusRaw] || 'referred'

    // Application
    const appId = crypto.randomUUID()
    appRows.push({
      id: appId,
      tenant_id: tenantId,
      job_seeker_id: jsId,
      source_id: sourceMap.get(row[COL.SOURCE]?.trim() || '') || null,
      coordinator_id: coordId,
      application_status: appStatus,
      progress_status: progressStatus,
      job_type: row[COL.JOB_TYPE]?.trim() || null,
      applied_at: appliedAt,
      notes: row[COL.NOTES]?.trim() || null,
    })

    // Interview (AZ has value: 済み/流れ/辞退)
    const az = row[COL.AZ]?.trim() || ''
    if (az === '済み' || az === '流れ' || az === '辞退') {
      const scheduledDate = ayDate || buildFiscalDate(au, av) || appliedAt
      const axTime = row[COL.AX]?.trim() || ''
      // AX列の時間(HH:MM:SS)を組み合わせてJSTタイムスタンプに
      const scheduledAt = axTime
        ? `${scheduledDate}T${axTime.padStart(8, '0')}+09:00`
        : scheduledDate
      const conductedAt = az === '済み' ? scheduledAt : null
      const ivData: any = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        application_id: appId,
        interview_type: 'phone',
        scheduled_at: scheduledAt,
        conducted_at: conductedAt,
        result: az === '済み' ? 'completed' : az === '流れ' ? 'cancelled' : 'declined',
      }
      if (coordId) ivData.interviewer_id = coordId
      ivRows.push(ivData)
    }

    // Referral (BF=「繋ぎ」のみ。「繋げず」は紹介なし)
    if (referralStatusRaw === '繋ぎ') {
      const companyName = row[COL.BL]?.trim()
      // 紹介先あり → 対応する会社/求人、なし → プレースホルダー
      let jobId: string | null = null
      if (companyName) {
        const companyId = companyMap.get(companyName)
        if (companyId) {
          const jobTitle = row[COL.BO]?.trim() || companyName
          const jobKey = `${companyId}:${jobTitle}`
          jobId = jobMap.get(jobKey) || null
        }
      } else {
        jobId = placeholderJobId
      }

      if (jobId) {
        let refStatus = 'referred'
        if (progressRaw) refStatus = REFERRAL_STATUS_MAP[progressRaw] || PROGRESS_MAP[progressRaw] || 'referred'
        else if (referralStatusRaw) refStatus = REFERRAL_STATUS_MAP[referralStatusRaw] || 'referred'

        // BG/BH/CF を先に取得（BJ/CF両方で使う）
        const cfRaw = row[COL.CF]?.trim() || ''
        const bgRaw = row[COL.BG]?.trim() || ''
        const bhRaw = row[COL.BH]?.trim() || ''

        // BJ列（面接日）: YYYY/M/DはそのままparseDate、MM/DDはBG年を使用
        const bjRaw = row[COL.BJ]?.trim() || ''
        let interviewDate: string | null = null
        if (bjRaw) {
          const fullMatch = bjRaw.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/)
          if (fullMatch) {
            interviewDate = `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`
          } else {
            const mmddMatch = bjRaw.match(/^(\d{1,2})\/(\d{1,2})/)
            if (mmddMatch) {
              const bjYear = bgRaw || au
              if (bjYear) {
                interviewDate = `${bjYear}-${mmddMatch[1].padStart(2, '0')}-${mmddMatch[2].padStart(2, '0')}`
              }
            }
          }
        }

        const resultRaw = row[COL.BN]?.trim()
        const hiredAt = resultRaw === '採用' ? (interviewDate || appliedAt) : null

        // 稼働月: CF(稼働日)→BG+BH(派遣予定)→null
        const { workMonthDate, startWorkDate } = buildWorkMonth(cfRaw, bgRaw, bhRaw, au)

        // referred_at = fiscal date (AU+AV based) → 面談月ベースの月基準
        const refId = crypto.randomUUID()
        refRows.push({
          id: refId,
          tenant_id: tenantId,
          application_id: appId,
          job_id: jobId,
          referral_status: refStatus,
          referred_at: fiscalDate || appliedAt,
          dispatch_interview_at: interviewDate,
          hired_at: hiredAt,
          assignment_date: parseDate(row[COL.BS]),
          start_work_date: startWorkDate,  // CF実日付のみ（CFなし→null）
        })

        // Sales (日付フィールドに稼働月日付を格納、面談月ベースはreferred_atから取得)
        const expectedAmt = parseAmount(row[COL.BX])
        const confirmedAmt = parseAmount(row[COL.CG])
        const paidAmt = parseAmount(row[COL.CH])
        const workDate = workMonthDate || fiscalDate || appliedAt

        if (expectedAmt && expectedAmt > 0) {
          salesRows.push({
            tenant_id: tenantId, referral_id: refId,
            amount: expectedAmt, status: 'expected',
            expected_date: workDate,
          })
        }
        if (confirmedAmt && confirmedAmt > 0) {
          salesRows.push({
            tenant_id: tenantId, referral_id: refId,
            amount: confirmedAmt, status: 'confirmed',
            confirmed_date: workDate,
          })
        }
        if (paidAmt && paidAmt > 0) {
          salesRows.push({
            tenant_id: tenantId, referral_id: refId,
            amount: paidAmt, status: 'paid',
            paid_date: workDate,
          })
        }
      }
    }

    if ((idx + 1) % 2000 === 0) {
      process.stdout.write(`\r  CSV解析: ${idx + 1}/${dataRows.length}`)
    }
  }
  console.log(`\r  CSV解析完了: ${dataRows.length}行`)
  console.log(`  新規求職者: ${newJsCount}`)
  console.log(`  応募: ${appRows.length}, 面談: ${ivRows.length}, 紹介: ${refRows.length}, 売上: ${salesRows.length}`)

  // Batch insert
  console.log('\nバッチ挿入中...')
  await batchInsert('applications', appRows)
  await batchInsert('interviews', ivRows)
  await batchInsert('referrals', refRows)
  await batchInsert('sales', salesRows)

  // ============================================================
  // Phase 5: 検証
  // ============================================================
  console.log('\n=== Phase 5: 検証 ===')

  const dbInterviews = await fetchAllRows('interviews', 'id, scheduled_at, conducted_at')
  const dbReferrals = await fetchAllRows('referrals', 'id, application_id, referral_status, referred_at, dispatch_interview_at, hired_at, start_work_date')
  const dbSales = await fetchAllRows('sales', 'id, referral_id, amount, status')

  console.log(`  DB interviews: ${dbInterviews.length}`)
  console.log(`  DB referrals: ${dbReferrals.length}`)
  console.log(`  DB sales: ${dbSales.length}`)

  // 面談: conducted_at NOT NULL, month from scheduled_at
  const dbIvByMonth = new Map<string, number>()
  for (const iv of dbInterviews) {
    if (!iv.conducted_at) continue
    const m = iv.scheduled_at?.substring(0, 7)
    if (m) dbIvByMonth.set(m, (dbIvByMonth.get(m) || 0) + 1)
  }

  // 繋ぎ: all referrals, month from referred_at
  const dbRefByMonth = new Map<string, number>()
  for (const ref of dbReferrals) {
    const m = ref.referred_at?.substring(0, 7)
    if (m) dbRefByMonth.set(m, (dbRefByMonth.get(m) || 0) + 1)
  }

  // 面接予定: dispatch_interview_at NOT NULL
  const dbDispSchedByMonth = new Map<string, number>()
  for (const ref of dbReferrals) {
    if (!ref.dispatch_interview_at) continue
    const m = ref.referred_at?.substring(0, 7)
    if (m) dbDispSchedByMonth.set(m, (dbDispSchedByMonth.get(m) || 0) + 1)
  }

  // 面接済: referral_status in done statuses
  const DONE_STATUSES = ['interview_done', 'hired', 'pre_assignment', 'assigned', 'working', 'full_paid']
  const dbDispDoneByMonth = new Map<string, number>()
  for (const ref of dbReferrals) {
    if (!DONE_STATUSES.includes(ref.referral_status)) continue
    const m = ref.referred_at?.substring(0, 7)
    if (m) dbDispDoneByMonth.set(m, (dbDispDoneByMonth.get(m) || 0) + 1)
  }

  // 採用: hired_at NOT NULL
  const dbHiredByMonth = new Map<string, number>()
  for (const ref of dbReferrals) {
    if (!ref.hired_at) continue
    const m = ref.referred_at?.substring(0, 7)
    if (m) dbHiredByMonth.set(m, (dbHiredByMonth.get(m) || 0) + 1)
  }

  const spushi = {
    '2025-01': { i: 258, r: 103 }, '2025-02': { i: 266, r: 93 },
    '2025-03': { i: 306, r: 118 }, '2025-04': { i: 332, r: 127 },
    '2025-05': { i: 310, r: 119 }, '2025-06': { i: 385, r: 164 },
    '2025-07': { i: 384, r: 168 }, '2025-08': { i: 306, r: 124 },
    '2025-09': { i: 306, r: 145 }, '2025-10': { i: 293, r: 149 },
    '2025-11': { i: 193, r: 86 }, '2025-12': { i: 172, r: 85 },
  } as Record<string, { i: number; r: number }>

  console.log('\n--- DB vs スプシ ---')
  console.log('Month     | 面談DB | 面談SP | 差 | 繋DB | 繋SP | 差 | 面予DB | 面済DB | 採用DB')
  console.log('-'.repeat(90))
  for (const m of Object.keys(spushi).sort()) {
    const iv = dbIvByMonth.get(m) || 0
    const ref = dbRefByMonth.get(m) || 0
    const sp = spushi[m]
    const ds = dbDispSchedByMonth.get(m) || 0
    const dd = dbDispDoneByMonth.get(m) || 0
    const h = dbHiredByMonth.get(m) || 0
    console.log(
      `${m.padEnd(10)}| ${String(iv).padStart(6)} | ${String(sp.i).padStart(6)} | ${String(iv - sp.i).padStart(2)} | ${String(ref).padStart(4)} | ${String(sp.r).padStart(4)} | ${String(ref - sp.r).padStart(2)} | ${String(ds).padStart(6)} | ${String(dd).padStart(6)} | ${String(h).padStart(6)}`
    )
  }

  // 稼働月ベース検証
  const refById = new Map<string, any>()
  dbReferrals.forEach(r => refById.set(r.id, r))
  const dbSalesFull = await fetchAllRows('sales', 'id, referral_id, amount, status, expected_date, confirmed_date, paid_date')

  const workMonthProspect = new Map<string, number>()
  const workMonthWorking = new Map<string, number>()
  const workMonthExpAmt = new Map<string, number>()
  const workMonthConfAmt = new Map<string, number>()

  for (const sale of dbSalesFull) {
    const ref = refById.get(sale.referral_id)
    if (!ref) continue

    if (sale.status === 'expected' && sale.expected_date) {
      const m = sale.expected_date.substring(0, 7)
      workMonthProspect.set(m, (workMonthProspect.get(m) || 0) + 1)
      workMonthExpAmt.set(m, (workMonthExpAmt.get(m) || 0) + sale.amount)
    }
    if (sale.status === 'confirmed' && sale.confirmed_date && ref.start_work_date) {
      const m = sale.confirmed_date.substring(0, 7)
      workMonthWorking.set(m, (workMonthWorking.get(m) || 0) + 1)
      workMonthConfAmt.set(m, (workMonthConfAmt.get(m) || 0) + sale.amount)
    }
  }

  console.log('\n--- 稼働月ベース ---')
  console.log('Month     | 見込件数 | 実働件数 | 売上見込      | 実働売上')
  console.log('-'.repeat(70))
  const allWorkMonths = new Set([...workMonthProspect.keys(), ...workMonthWorking.keys()])
  for (const m of [...allWorkMonths].sort()) {
    const p = workMonthProspect.get(m) || 0
    const w = workMonthWorking.get(m) || 0
    const ea = workMonthExpAmt.get(m) || 0
    const ca = workMonthConfAmt.get(m) || 0
    console.log(`${m.padEnd(10)}| ${String(p).padStart(8)} | ${String(w).padStart(8)} | ${String(ea.toLocaleString()).padStart(13)} | ${String(ca.toLocaleString()).padStart(13)}`)
  }

  console.log('\n✅ 完了')
}

main().catch(console.error)
