import { SupabaseClient } from '@supabase/supabase-js'

export interface CsvRow {
  [key: string]: string
}

export interface ImportResult {
  newCandidates: number
  updatedCandidates: number
  newApplications: number
  newInterviews: number
  errors: { row: number; message: string }[]
}

// ステータスマッピング
const statusMap: Record<string, string> = {
  '有効': '有効応募',
  '無効': '無効応募',
  '電話出ず': '電話出ず',
  '時期先': '就業時期が先',
}

// 電話番号正規化
export function normalizePhone(phone: string): string {
  return phone?.replace(/[-\s　]/g, '') || ''
}

// 日付パース
export function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null

  // 様々なフォーマットに対応
  const cleanDate = dateStr.replace(/[年月]/g, '/').replace(/日/g, '')
  const date = new Date(cleanDate)

  if (isNaN(date.getTime())) return null
  return date.toISOString().split('T')[0]
}

// ステータスマッピング
export function mapStatus(status: string): string {
  return statusMap[status] || status || '有効応募'
}

// CSVテキストをパース
export function parseCsv(csvText: string): CsvRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length === headers.length) {
      const row: CsvRow = {}
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim().replace(/^"|"$/g, '') || ''
      })
      rows.push(row)
    }
  }

  return rows
}

// CSV行をパース（ダブルクォート内のカンマを考慮）
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

// メインのインポート関数
export async function importCsv(
  supabase: SupabaseClient,
  rows: CsvRow[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const results: ImportResult = {
    newCandidates: 0,
    updatedCandidates: 0,
    newApplications: 0,
    newInterviews: 0,
    errors: [],
  }

  const batchSize = 100
  const total = rows.length

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      // 1. 電話番号で既存チェック
      const phone = normalizePhone(row['電話番号'])
      if (!phone) {
        results.errors.push({ row: i + 2, message: '電話番号が空です' })
        continue
      }

      const { data: existing } = await supabase
        .from('candidates')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      let candidateId: string

      if (existing) {
        // 既存の場合 → IDを取得
        candidateId = existing.id
        results.updatedCandidates++
      } else {
        // 新規の場合 → candidates作成
        const candidateData = buildCandidateData(row)

        const { data: newCandidate, error: insertError } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select('id')
          .single()

        if (insertError || !newCandidate) {
          results.errors.push({ row: i + 2, message: insertError?.message || '求職者の作成に失敗' })
          continue
        }

        candidateId = newCandidate.id
        results.newCandidates++
      }

      // 2. applications作成
      if (row['年月日'] || row['応募日']) {
        const applicationData = buildApplicationData(row, candidateId)

        const { error: appError } = await supabase
          .from('applications')
          .insert(applicationData)

        if (appError) {
          results.errors.push({ row: i + 2, message: `応募履歴エラー: ${appError.message}` })
        } else {
          results.newApplications++
        }
      }

      // 3. interviews作成（面談日がある場合のみ）
      const interviewDate = buildInterviewDate(row)
      if (interviewDate) {
        const interviewData = buildInterviewData(row, candidateId, interviewDate)

        const { error: intError } = await supabase
          .from('interviews')
          .insert(interviewData)

        if (intError) {
          results.errors.push({ row: i + 2, message: `面談エラー: ${intError.message}` })
        } else {
          results.newInterviews++
        }
      }

    } catch (error) {
      results.errors.push({
        row: i + 2,
        message: error instanceof Error ? error.message : '不明なエラー'
      })
    }

    // 進捗通知
    if (onProgress && (i + 1) % batchSize === 0) {
      onProgress(i + 1, total)
    }
  }

  if (onProgress) {
    onProgress(total, total)
  }

  return results
}

// candidatesデータを構築
function buildCandidateData(row: CsvRow) {
  const lastName = row['氏名(姓)'] || row['姓'] || ''
  const firstName = row['氏名(名)'] || row['名'] || ''
  const name = `${lastName} ${firstName}`.trim() || row['氏名'] || row['名前'] || ''

  const lastNameKana = row['氏名カナ(姓)'] || row['姓カナ'] || ''
  const firstNameKana = row['カナ(名)カナ'] || row['氏名カナ(名)'] || row['名カナ'] || ''
  const furigana = `${lastNameKana} ${firstNameKana}`.trim() || row['ふりがな'] || ''

  const prefecture = row['都道府県'] || ''
  const city = row['市区町村群'] || row['市区町村'] || ''
  const address = `${prefecture}${city}`.trim() || row['住所'] || ''

  return {
    name,
    name_kana: furigana || null,
    phone: normalizePhone(row['電話番号']),
    email: row['メールアドレス'] || row['メール'] || null,
    birth_date: parseDate(row['生年月日']),
    gender: row['性別'] || null,
    address: address || null,
    desired_occupation: row['職種'] || row['希望職種'] || null,
    desired_location: row['勤務地'] || row['希望勤務地'] || null,
    status: mapStatus(row['状態']),
    notes: row['備考'] || null,
  }
}

// applicationsデータを構築
function buildApplicationData(row: CsvRow, candidateId: string) {
  return {
    candidate_id: candidateId,
    applied_date: parseDate(row['年月日'] || row['応募日']) || new Date().toISOString().split('T')[0],
    source: row['応募対応媒体'] || row['媒体'] || row['応募媒体'] || 'その他',
    status: row['状態'] || '有効応募',
    notes: row['勤務地'] ? `勤務地: ${row['勤務地']}` : null,
  }
}

// 面談日を構築
function buildInterviewDate(row: CsvRow): string | null {
  // パターン1: 年月日が別カラム
  if (row['日程_年'] && row['日程_月'] && row['日程_日']) {
    const year = row['日程_年']
    const month = row['日程_月'].padStart(2, '0')
    const day = row['日程_日'].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // パターン2: 面談日カラム
  if (row['面談日']) {
    return parseDate(row['面談日'])
  }

  return null
}

// interviewsデータを構築
function buildInterviewData(row: CsvRow, candidateId: string, interviewDate: string) {
  return {
    candidate_id: candidateId,
    interview_date: interviewDate,
    interview_time: row['日程_時間'] || row['面談時間'] || null,
    interview_type: '面談',
    result: row['繋ぎ状況'] || row['結果'] || null,
    notes: row['備考'] || null,
  }
}

// プレビュー用に最初の10件を取得
export function getPreviewData(rows: CsvRow[], limit = 10) {
  return rows.slice(0, limit).map(row => {
    const lastName = row['氏名(姓)'] || row['姓'] || ''
    const firstName = row['氏名(名)'] || row['名'] || ''
    const name = `${lastName} ${firstName}`.trim() || row['氏名'] || row['名前'] || ''

    return {
      name,
      phone: row['電話番号'] || '',
      date: row['年月日'] || row['応募日'] || '',
      source: row['応募対応媒体'] || row['媒体'] || row['応募媒体'] || '',
      status: row['状態'] || '',
    }
  })
}
