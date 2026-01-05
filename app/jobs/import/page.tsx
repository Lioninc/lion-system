'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button, Card, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  csv_mapping: { [key: string]: string } | null
}

interface ParsedJob {
  [key: string]: any
}

// CSV列名 → DBカラム マッピング
const CSV_TO_DB_MAPPING: { [key: string]: string } = {
  'スピード採用案件': 'title',
  '現場名': 'site_name',
  '紹介料': 'referral_fee',
  '雇用形態': 'employment_type',
  '職種': 'job_type',
  '給与': 'salary_breakdown',
  '月収': 'monthly_salary',
  '内訳': 'salary_breakdown',
  '勤務地': 'location',
  '最寄駅（駅）': 'nearest_station',
  '最寄駅（交通手段）': 'transportation',
  '勤務時間': 'working_hours',
  '休日': 'holidays',
  '応募資格': 'qualifications',
  'アピール': 'company_pr',
  '男女': 'gender_requirement',
  '寮': 'dormitory_available',
  '車通勤': 'car_commute_ok',
  '通勤交通費': 'transportation_paid',
  '送迎バス': 'shuttle_bus',
  '年齢下限': 'age_min',
  '年齢上限': 'age_max',
  '残欠員': 'remaining_slots',
  '基本寮費': 'dormitory_cost',
  '身長（下限）': 'height_min',
  '身長（上限）': 'height_max',
  'ウエスト': 'waist_max',
  'BMI': 'bmi_requirement',
  '外国籍': 'foreigner_ok',
  '喫煙': 'smoking_policy',
  '家族寮': 'family_dormitory',
  'カップル': 'couple_dormitory',
  '赴任日': 'start_date',
  '仕事内容詳細': 'job_details',
  '見習い期間': 'probation_period',
  '見習い給与': 'probation_salary',
  '動務地（詳細住所）': 'location_legacy',
  '勤務地（詳細住所）': 'location_legacy',
}

// 既知のDBカラム（エラー回避用）
const KNOWN_DB_COLUMNS = [
  'title', 'description', 'location', 'hourly_rate', 'employment_type',
  'requirements', 'benefits', 'working_hours', 'holidays', 'status',
  'site_name', 'referral_fee', 'job_type', 'salary_breakdown', 'monthly_salary',
  'nearest_station', 'transportation', 'qualifications', 'company_pr',
  'gender_requirement', 'dormitory_available', 'car_commute_ok', 'transportation_paid',
  'shuttle_bus', 'age_min', 'age_max', 'remaining_slots', 'dormitory_cost',
  'height_min', 'height_max', 'waist_max', 'bmi_requirement', 'foreigner_ok',
  'smoking_policy', 'family_dormitory', 'couple_dormitory', 'start_date',
  'job_details', 'probation_period', 'probation_salary', 'location_legacy',
]

// カラムの型定義
const BOOLEAN_COLUMNS = [
  'dormitory_available', 'car_commute_ok', 'transportation_paid',
  'shuttle_bus', 'foreigner_ok', 'family_dormitory', 'couple_dormitory',
  'social_insurance'
]

const INTEGER_COLUMNS = [
  'referral_fee', 'monthly_salary', 'age_min', 'age_max',
  'remaining_slots', 'dormitory_cost', 'height_min', 'height_max',
  'waist_max', 'hourly_rate', 'probation_salary', 'relocation_cost',
  'signing_bonus', 'salary_min', 'salary_max', 'interview_count', 'headcount'
]

const DATE_COLUMNS = ['start_date', 'deadline', 'publish_deadline']

const STRING_COLUMNS = [
  'title', 'description', 'location', 'employment_type', 'requirements',
  'benefits', 'working_hours', 'holidays', 'site_name', 'job_type',
  'salary_breakdown', 'nearest_station', 'transportation', 'qualifications',
  'company_pr', 'gender_requirement', 'bmi_requirement', 'smoking_policy',
  'job_details', 'probation_period', 'location_legacy', 'status'
]

// 値の変換（厳密な型変換）
function convertValue(value: string, columnName: string): any {
  if (!value || value.trim() === '') return undefined // undefinedを返してフィルタリングで除外

  const trimmed = value.trim()

  // Boolean変換（●、○、〇 → true, ×、✕、- → false）
  if (BOOLEAN_COLUMNS.includes(columnName)) {
    if (['●', '○', '〇', 'あり', '可', 'OK', 'ok', '有', 'TRUE', 'true', '1'].includes(trimmed)) return true
    if (['×', '✕', '-', 'なし', '不可', 'NG', 'ng', '無', 'FALSE', 'false', '0'].includes(trimmed)) return false
    // 認識できない値は除外
    return undefined
  }

  // 数値変換（整数）
  if (INTEGER_COLUMNS.includes(columnName)) {
    // 「20万円」→ 200000、「1,500円」→ 1500 などの変換
    let numStr = trimmed
      .replace(/,/g, '')
      .replace(/円/g, '')
      .replace(/万/g, '0000')
      .replace(/千/g, '000')
      .replace(/[^\d\-]/g, '') // 数字とマイナス以外を除去

    if (numStr === '' || numStr === '-') return undefined

    const num = parseInt(numStr, 10)
    if (isNaN(num)) return undefined
    return num
  }

  // 日付変換
  if (DATE_COLUMNS.includes(columnName)) {
    // YYYY/MM/DD or YYYY-MM-DD → YYYY-MM-DD
    const dateMatch = trimmed.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
    if (dateMatch) {
      const [, year, month, day] = dateMatch
      const m = parseInt(month, 10)
      const d = parseInt(day, 10)
      // 簡易バリデーション
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }
    return undefined
  }

  // 文字列カラム
  if (STRING_COLUMNS.includes(columnName)) {
    return trimmed
  }

  // その他は文字列として返す
  return trimmed
}

// CSVパース
function parseCSV(text: string): { headers: string[], rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  // ヘッダー行
  const headers = parseCSVLine(lines[0])

  // データ行
  const rows = lines.slice(1).map(line => parseCSVLine(line))

  return { headers, rows }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result.map(s => s.trim())
}

export default function JobsImportPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [csvText, setCsvText] = useState<string>('')
  const [parsedData, setParsedData] = useState<{ headers: string[], jobs: ParsedJob[] } | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number, failed: number } | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  // 企業選択時にマッピングを再適用
  useEffect(() => {
    if (selectedCompanyId && csvText) {
      const company = companies.find(c => c.id === selectedCompanyId)
      setSelectedCompany(company || null)
      parseAndMapCSV(csvText, company?.csv_mapping || null)
    }
  }, [selectedCompanyId])

  async function fetchCompanies() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, csv_mapping')
      .order('name')

    if (error) {
      console.error('Error fetching companies:', error)
      return
    }

    setCompanies(data || [])
  }

  // 企業のマッピングとデフォルトマッピングをマージしてCSVをパース
  function parseAndMapCSV(text: string, companyMapping: { [key: string]: string } | null) {
    const { headers, rows } = parseCSV(text)

    // 企業マッピングがあれば、それを使ってCSV列名→DBカラム変換テーブルを作成
    // 企業マッピング形式: { db_column: csv_column_name }
    // 例: { title: 'スピード採用案件', location: '勤務地' }
    let effectiveMapping: { [csvColumn: string]: string } = { ...CSV_TO_DB_MAPPING }

    if (companyMapping) {
      // 企業設定のマッピングを追加（CSV列名 → DBカラム）
      Object.entries(companyMapping).forEach(([dbColumn, csvColumnName]) => {
        if (csvColumnName) {
          effectiveMapping[csvColumnName] = dbColumn
        }
      })
    }

    // マッピングを適用（undefinedは除外）
    const jobs: ParsedJob[] = rows.map(row => {
      const job: ParsedJob = {}
      headers.forEach((header, index) => {
        const dbColumn = effectiveMapping[header]
        if (dbColumn && KNOWN_DB_COLUMNS.includes(dbColumn)) {
          const value = row[index]
          const converted = convertValue(value, dbColumn)
          // undefinedは除外、nullも除外（DBにnullを送らない）
          if (converted !== undefined && converted !== null) {
            job[dbColumn] = converted
          }
        }
      })
      return job
    }).filter(job => Object.keys(job).length > 0)

    setParsedData({ headers, jobs })
  }

  const handleFileChange = useCallback((selectedFile: File | null) => {
    if (!selectedFile) {
      setFile(null)
      setCsvText('')
      setParsedData(null)
      return
    }

    setFile(selectedFile)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvText(text)

      // 選択中の企業のマッピングを取得
      const company = companies.find(c => c.id === selectedCompanyId)
      parseAndMapCSV(text, company?.csv_mapping || null)
    }
    reader.readAsText(selectedFile, 'UTF-8')
  }, [companies, selectedCompanyId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      handleFileChange(droppedFile)
    }
  }, [handleFileChange])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleImport = async () => {
    if (!selectedCompanyId || !parsedData || parsedData.jobs.length === 0) return

    setImporting(true)
    setImportResult(null)
    const supabase = createClient()

    let success = 0
    let failed = 0
    const errors: { index: number; title: string; error: string }[] = []

    for (let i = 0; i < parsedData.jobs.length; i++) {
      const job = parsedData.jobs[i]

      // titleがない場合はsite_nameをtitleとして使用
      let title = job.title
      if (!title && job.site_name) {
        title = job.site_name
      }

      // titleが必須なのでなければスキップ
      if (!title) {
        failed++
        errors.push({ index: i + 1, title: '(タイトルなし)', error: 'タイトルが必須です' })
        continue
      }

      // クリーンなデータを構築（undefined/nullを除外し、既知のカラムのみ）
      const jobData: Record<string, any> = {
        company_id: selectedCompanyId,
        status: '募集中',
        title: title,
      }

      // job からデータをコピー（title以外）
      Object.entries(job).forEach(([key, value]) => {
        if (key !== 'title' && value !== undefined && value !== null && KNOWN_DB_COLUMNS.includes(key)) {
          jobData[key] = value
        }
      })

      console.log(`[Import ${i + 1}] Inserting job:`, JSON.stringify(jobData, null, 2))

      const { error } = await (supabase.from('jobs') as any).insert(jobData)

      if (error) {
        console.error(`[Import ${i + 1}] Error:`, error.message, error.details, error.hint)
        errors.push({ index: i + 1, title: title, error: error.message })
        failed++
      } else {
        success++
      }
    }

    // エラーがあればコンソールにまとめて出力
    if (errors.length > 0) {
      console.error('=== Import Errors Summary ===')
      errors.forEach(e => {
        console.error(`  Row ${e.index} (${e.title}): ${e.error}`)
      })
    }

    setImportResult({ success, failed })
    setImporting(false)
  }

  const getMappedColumns = () => {
    if (!parsedData) return []

    // 企業マッピングがあればマージ
    let effectiveMapping: { [csvColumn: string]: string } = { ...CSV_TO_DB_MAPPING }
    if (selectedCompany?.csv_mapping) {
      Object.entries(selectedCompany.csv_mapping).forEach(([dbColumn, csvColumnName]) => {
        if (csvColumnName) {
          effectiveMapping[csvColumnName] = dbColumn
        }
      })
    }

    return parsedData.headers
      .filter(h => effectiveMapping[h])
      .map(h => ({ csv: h, db: effectiveMapping[h] }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/jobs"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>一覧に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">案件CSVインポート</h1>
      </div>

      {/* 企業選択 */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">1. 企業を選択</h2>
        <Select
          label="企業"
          options={[
            { value: '', label: '選択してください' },
            ...companies.map(c => ({ value: c.id, label: c.name }))
          ]}
          value={selectedCompanyId}
          onChange={(e) => {
            const companyId = e.target.value
            setSelectedCompanyId(companyId)
            const company = companies.find(c => c.id === companyId)
            setSelectedCompany(company || null)
          }}
          required
        />
        <p className="text-sm text-slate-500 mt-2">
          インポートする案件に設定する企業を選択してください
        </p>
        {selectedCompany?.csv_mapping && Object.keys(selectedCompany.csv_mapping).length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              この企業にはCSVマッピング設定があります。設定されたマッピングを使用してインポートします。
            </p>
          </div>
        )}
      </Card>

      {/* CSVアップロード */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">2. CSVファイルをアップロード</h2>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-slate-600 mb-2">
              CSVファイルをドラッグ&ドロップ
            </p>
            <p className="text-sm text-slate-500 mb-4">または</p>
            <span className="text-blue-600 hover:underline">
              ファイルを選択
            </span>
          </label>
        </div>

        {file && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-slate-700">{file.name}</span>
            <button
              onClick={() => {
                setFile(null)
                setParsedData(null)
              }}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              削除
            </button>
          </div>
        )}
      </Card>

      {/* マッピング確認 */}
      {parsedData && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">3. マッピング確認</h2>
          <div className="mb-4">
            <p className="text-sm text-slate-600">
              認識された列: {parsedData.headers.length}列 /
              マッピング済み: {getMappedColumns().length}列 /
              インポート対象: {parsedData.jobs.length}件
            </p>
          </div>

          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-3 py-2 text-left">CSV列名</th>
                  <th className="px-3 py-2 text-left">DBカラム</th>
                </tr>
              </thead>
              <tbody>
                {getMappedColumns().map((mapping, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2">{mapping.csv}</td>
                    <td className="px-3 py-2 font-mono text-blue-600">{mapping.db}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-md font-semibold text-slate-700 mb-2">プレビュー（最初の10件）</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">タイトル</th>
                  <th className="px-3 py-2 text-left">現場名</th>
                  <th className="px-3 py-2 text-left">勤務地</th>
                  <th className="px-3 py-2 text-left">雇用形態</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.jobs.slice(0, 10).map((job, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{job.title || job.site_name || '-'}</td>
                    <td className="px-3 py-2">{job.site_name || '-'}</td>
                    <td className="px-3 py-2">{job.location || '-'}</td>
                    <td className="px-3 py-2">{job.employment_type || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* インポート結果 */}
      {importResult && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">インポート結果</h2>
          <div className="flex gap-4">
            <div className="p-4 bg-green-50 rounded-lg flex-1">
              <p className="text-sm text-green-600">成功</p>
              <p className="text-2xl font-bold text-green-700">{importResult.success}件</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg flex-1">
              <p className="text-sm text-red-600">失敗</p>
              <p className="text-2xl font-bold text-red-700">{importResult.failed}件</p>
            </div>
          </div>
          {importResult.success > 0 && (
            <div className="mt-4">
              <Link href="/jobs">
                <Button>案件一覧を確認</Button>
              </Link>
            </div>
          )}
        </Card>
      )}

      {/* インポートボタン */}
      <div className="flex gap-4 justify-end">
        <Link href="/jobs">
          <Button variant="secondary">キャンセル</Button>
        </Link>
        <Button
          onClick={handleImport}
          disabled={!selectedCompanyId || !parsedData || parsedData.jobs.length === 0 || importing}
        >
          {importing ? 'インポート中...' : `${parsedData?.jobs.length || 0}件をインポート`}
        </Button>
      </div>
    </div>
  )
}
