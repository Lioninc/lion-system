import { useState, useRef } from 'react'
import { Upload, Download, X, AlertCircle, CheckCircle2, FileText } from 'lucide-react'
import { Button } from './Button'

export type DuplicateAction = 'skip' | 'update' | 'create'

interface CSVImportModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  templateColumns: { key: string; label: string; required?: boolean }[]
  onImport: (data: Record<string, string>[], duplicateAction: DuplicateAction) => Promise<{ success: number; skipped: number; updated: number; errors: string[] }>
  templateFileName: string
  duplicateCheckKey?: string // e.g., 'phone' for job seekers
  duplicateCheckLabel?: string // e.g., '電話番号'
}

export function CSVImportModal({
  isOpen,
  onClose,
  title,
  templateColumns,
  onImport,
  templateFileName,
  duplicateCheckKey,
  duplicateCheckLabel,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; skipped: number; updated: number; errors: string[] } | null>(null)
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = parseCSV(text)
      setPreview(rows.slice(0, 5)) // Show first 5 rows as preview
    }
    reader.readAsText(selectedFile, 'UTF-8')
  }

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length < 2) return []

    const headers = parseCSVLine(lines[0])
    const data: Record<string, string>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}

      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || ''
      })

      data.push(row)
    }

    return data
  }

  function parseCSVLine(line: string): string[] {
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

  function downloadTemplate() {
    const headers = templateColumns.map((col) => col.label).join(',')
    const sampleRow = templateColumns.map((col) => {
      if (col.required) return `サンプル${col.label}`
      return ''
    }).join(',')

    const csv = `${headers}\n${sampleRow}`
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = templateFileName
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!file) return

    setImporting(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      const rows = parseCSV(text)

      // Map CSV labels to keys
      const mappedData = rows.map((row) => {
        const mapped: Record<string, string> = {}
        templateColumns.forEach((col) => {
          mapped[col.key] = row[col.label] || ''
        })
        return mapped
      })

      const importResult = await onImport(mappedData, duplicateAction)
      setResult(importResult)
      setImporting(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleClose() {
    setFile(null)
    setPreview([])
    setResult(null)
    setDuplicateAction('skip')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Template Download */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-800">テンプレートCSV</p>
                <p className="text-sm text-blue-600 mt-1">
                  まずテンプレートをダウンロードして、フォーマットに従ってデータを入力してください。
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={downloadTemplate}
                >
                  <Download className="w-4 h-4 mr-2" />
                  テンプレートをダウンロード
                </Button>
              </div>
            </div>
          </div>

          {/* Required Fields */}
          <div className="mb-6">
            <p className="text-sm font-medium text-slate-700 mb-2">必須項目</p>
            <div className="flex flex-wrap gap-2">
              {templateColumns.filter((col) => col.required).map((col) => (
                <span
                  key={col.key}
                  className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-md"
                >
                  {col.label}
                </span>
              ))}
            </div>
          </div>

          {/* Duplicate Action (only show if duplicateCheckKey is provided) */}
          {duplicateCheckKey && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-3">
                {duplicateCheckLabel || duplicateCheckKey}が重複している場合の処理
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="skip"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-slate-600">スキップする（既存データを保持）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="update"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-slate-600">更新する（CSVのデータで上書き）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="duplicateAction"
                    value="create"
                    checked={duplicateAction === 'create'}
                    onChange={() => setDuplicateAction('create')}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="text-sm text-slate-600">新規作成する（重複を許可）</span>
                </label>
              </div>
            </div>
          )}

          {/* File Upload */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-slate-50 transition-colors"
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600">
                クリックしてCSVファイルを選択
              </p>
              <p className="text-xs text-slate-400 mt-1">
                またはドラッグ＆ドロップ
              </p>
            </div>
            {file && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-slate-400">({Math.round(file.size / 1024)} KB)</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-700 mb-2">
                プレビュー（最初の5件）
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th
                          key={key}
                          className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value, j) => (
                          <td
                            key={j}
                            className="px-3 py-2 text-sm text-slate-600 whitespace-nowrap"
                          >
                            {value || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-lg ${
              result.errors.length === 0
                ? 'bg-emerald-50'
                : 'bg-amber-50'
            }`}>
              <div className="flex items-start gap-3">
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    result.errors.length === 0 ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    処理完了
                  </p>
                  <div className="mt-1 text-sm text-slate-600 space-y-1">
                    {result.success > 0 && (
                      <p className="text-emerald-700">{result.success}件 新規登録</p>
                    )}
                    {result.updated > 0 && (
                      <p className="text-blue-700">{result.updated}件 更新</p>
                    )}
                    {result.skipped > 0 && (
                      <p className="text-slate-500">{result.skipped}件 スキップ（重複）</p>
                    )}
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-amber-700">
                        {result.errors.length}件のエラー:
                      </p>
                      <ul className="mt-1 text-sm text-amber-600 list-disc list-inside">
                        {result.errors.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>...他 {result.errors.length - 5} 件</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" onClick={handleClose}>
            閉じる
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || importing}
            isLoading={importing}
          >
            <Upload className="w-4 h-4 mr-2" />
            インポート実行
          </Button>
        </div>
      </div>
    </div>
  )
}
