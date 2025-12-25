'use client'

import { useState, useCallback, useRef } from 'react'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { parseCsv, getPreviewData, importCsv, CsvRow, ImportResult } from '@/lib/csv-import'
import { createClient } from '@/lib/supabase/client'

// テンプレートCSVのヘッダー（26列）
const TEMPLATE_HEADERS = [
  '年月日', '状態', '備考', '応募対応媒体', '職種', '記事勤務地',
  '氏名', '氏名カナ', '電話番号', '生年月日', '年齢',
  '郵便番号', '都道府県', '市区町村群', '性別', 'タトゥー', '障害者手帳', '持病', '配偶者', '子供',
  '身長', '体重', '面談日', '担当CD', '繋ぎ状況', '紹介先'
]

interface PreviewRow {
  name: string
  phone: string
  date: string
  source: string
  status: string
}

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete' | 'error'

export default function CsvImporter() {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMessage('CSVファイルを選択してください')
      setStatus('error')
      return
    }

    setStatus('parsing')
    setErrorMessage('')

    try {
      const text = await file.text()
      const rows = parseCsv(text)

      if (rows.length === 0) {
        setErrorMessage('CSVファイルにデータがありません')
        setStatus('error')
        return
      }

      setCsvRows(rows)
      setPreviewData(getPreviewData(rows))
      setStatus('preview')
    } catch (error) {
      setErrorMessage('CSVの解析に失敗しました')
      setStatus('error')
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleImport = async () => {
    if (csvRows.length === 0) return

    setStatus('importing')
    setProgress({ current: 0, total: csvRows.length })

    try {
      const supabase = createClient()
      const importResult = await importCsv(
        supabase,
        csvRows,
        (current, total) => setProgress({ current, total })
      )

      setResult(importResult)
      setStatus('complete')
    } catch (error) {
      setErrorMessage('インポート中にエラーが発生しました')
      setStatus('error')
    }
  }

  const handleReset = () => {
    setStatus('idle')
    setCsvRows([])
    setPreviewData([])
    setResult(null)
    setProgress({ current: 0, total: 0 })
    setErrorMessage('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDownloadTemplate = () => {
    // BOM付きUTF-8でCSVを作成（Excelで文字化けしないように）
    const bom = '\uFEFF'
    const csvContent = bom + TEMPLATE_HEADERS.join(',')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'import-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* ドロップゾーン */}
      {(status === 'idle' || status === 'error') && (
        <Card>
          {/* テンプレートダウンロードボタン */}
          <div className="mb-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
              <span className="mr-1">📄</span>
              テンプレートをダウンロード
            </Button>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="text-4xl mb-4">📥</div>
            <p className="text-lg font-medium text-slate-700 mb-2">
              CSVファイルをドラッグ&ドロップ
            </p>
            <p className="text-sm text-slate-500">
              または クリックして選択
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}
        </Card>
      )}

      {/* パース中 */}
      {status === 'parsing' && (
        <Card>
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">CSVを解析中...</p>
          </div>
        </Card>
      )}

      {/* プレビュー */}
      {status === 'preview' && (
        <>
          <Card padding="none">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                プレビュー（最初の10件）
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                読み込み件数: <span className="font-medium text-blue-600">{csvRows.length.toLocaleString()}件</span>
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>応募日</TableHead>
                  <TableHead>媒体</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.name || '-'}</TableCell>
                    <TableCell>{row.phone || '-'}</TableCell>
                    <TableCell>{row.date || '-'}</TableCell>
                    <TableCell>{row.source || '-'}</TableCell>
                    <TableCell>
                      {row.status ? (
                        <Badge variant={row.status === '有効' ? 'success' : 'default'}>
                          {row.status}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleReset}>
              キャンセル
            </Button>
            <Button onClick={handleImport}>
              インポート実行
            </Button>
          </div>
        </>
      )}

      {/* インポート中 */}
      {status === 'importing' && (
        <Card>
          <div className="py-8">
            <div className="text-center mb-4">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-600">インポート中...</p>
            </div>
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-slate-500 mb-2">
                <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()}件</span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 完了 */}
      {status === 'complete' && result && (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">インポート結果</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-600">新規求職者</p>
                <p className="text-2xl font-bold text-emerald-700">
                  {result.newCandidates.toLocaleString()}件
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">既存に応募追加</p>
                <p className="text-2xl font-bold text-blue-700">
                  {result.updatedCandidates.toLocaleString()}件
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600">面談記録追加</p>
                <p className="text-2xl font-bold text-purple-700">
                  {result.newInterviews.toLocaleString()}件
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">エラー</p>
                <p className="text-2xl font-bold text-red-700">
                  {result.errors.length.toLocaleString()}件
                </p>
              </div>
            </div>
          </Card>

          {/* エラー詳細 */}
          {result.errors.length > 0 && (
            <Card padding="none">
              <div className="p-4 border-b border-slate-200">
                <h3 className="text-sm font-medium text-slate-800">エラー詳細</h3>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>行番号</TableHead>
                      <TableHead>エラー内容</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.slice(0, 50).map((error, index) => (
                      <TableRow key={index}>
                        <TableCell>{error.row}行目</TableCell>
                        <TableCell className="text-red-600">{error.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {result.errors.length > 50 && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    他 {result.errors.length - 50} 件のエラーがあります
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="flex gap-4">
            <Button variant="secondary" onClick={handleReset}>
              別のファイルをインポート
            </Button>
            <Button onClick={() => window.location.href = '/candidates'}>
              求職者一覧へ
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
