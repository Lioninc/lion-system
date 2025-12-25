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

// 日付パース（YYYY/MM/DD, YYYY-MM-DD, YYYY年MM月DD日 などに対応）
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

  // 既に処理した電話番号を記録（同じ人の重複行対応）
  const processedPhones = new Map<string, string>() // phone -> candidateId

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      // 1. 電話番号で既存チェック
      const phone = normalizePhone(row['電話番号'])
      if (!phone) {
        results.errors.push({ row: i + 2, message: '電話番号が空です' })
        continue
      }

      let candidateId: string
      let isNewCandidate = false

      // 既にこのインポートで処理済みの電話番号かチェック
      if (processedPhones.has(phone)) {
        candidateId = processedPhones.get(phone)!
      } else {
        // DBで既存チェック
        const { data: existing } = await supabase
          .from('candidates')
          .select('id')
          .eq('phone', phone)
          .maybeSingle()

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
          isNewCandidate = true
        }

        // 処理済みとして記録
        processedPhones.set(phone, candidateId)
      }

      // 2. applications作成（行ごとに作成）
      if (row['年月日']) {
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

      // 3. interviews作成（面談日がある場合のみ、行ごとに作成）
      const interviewDate = parseDate(row['面談日'])
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
  // 氏名: 「氏名」列をそのまま使用
  const name = row['氏名'] || ''

  // 氏名カナ: 「氏名カナ」列をそのまま使用 → furigana
  const furigana = row['氏名カナ'] || ''

  // 住所
  const prefecture = row['都道府県'] || ''
  const city = row['市区町村群'] || ''
  const address = `${prefecture}${city}`.trim()

  return {
    name,
    name_kana: furigana || null,
    phone: normalizePhone(row['電話番号']),
    birth_date: parseDate(row['生年月日']),
    gender: row['性別'] || null,
    address: address || null,
    desired_occupation: row['職種'] || null,       // 職種 → desired_occupation
    desired_location: row['記事勤務地'] || null,   // 記事勤務地 → desired_location
    status: mapStatus(row['状態']),
    notes: row['備考'] || null,
    // staff_id は使わない（NULL）
  }
}

// applicationsデータを構築
function buildApplicationData(row: CsvRow, candidateId: string) {
  return {
    candidate_id: candidateId,
    applied_date: parseDate(row['年月日']) || new Date().toISOString().split('T')[0],
    source: row['応募対応媒体'] || 'その他',
    status: row['状態'] || '有効応募',
    notes: null,
  }
}

// interviewsデータを構築
function buildInterviewData(row: CsvRow, candidateId: string, interviewDate: string) {
  return {
    candidate_id: candidateId,
    interview_date: interviewDate,
    interview_time: null,
    interview_type: '面談',
    result: row['繋ぎ状況'] || null,
    // 担当CD → interviewer_id（将来的にemployeesテーブルと紐付け）
    // 紹介先 → referred_company（将来的にcompaniesテーブルと紐付け）
    notes: row['紹介先'] ? `紹介先: ${row['紹介先']}` : null,
  }
}

// プレビュー用に最初の10件を取得
export function getPreviewData(rows: CsvRow[], limit = 10) {
  return rows.slice(0, limit).map(row => {
    return {
      name: row['氏名'] || '',
      phone: row['電話番号'] || '',
      date: row['年月日'] || '',
      source: row['応募対応媒体'] || '',
      status: row['状態'] || '',
    }
  })
}
