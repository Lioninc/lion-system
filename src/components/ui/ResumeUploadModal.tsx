import { useState, useRef } from 'react'
import { Upload, X, FileText, Loader2, Save, AlertCircle } from 'lucide-react'
import { Button } from './Button'
import { supabase } from '../../lib/supabase'
import type { JobSeeker } from '../../types/database'

export interface ResumeParseResult {
  name: string | null
  name_kana: string | null
  birth_date: string | null
  gender: 'male' | 'female' | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  education: string | null
  work_history_1: string | null
  work_history_2: string | null
  work_history_3: string | null
  qualifications: string | null
  hobbies: string | null
}

interface ResumeUploadModalProps {
  isOpen: boolean
  onClose: () => void
  jobSeeker: JobSeeker
  onSave: (data: Partial<JobSeeker> & { resume_url?: string }) => Promise<void>
}

type Step = 'upload' | 'parsing' | 'confirm'

const FIELD_LABELS: { key: keyof ResumeParseResult; label: string }[] = [
  { key: 'name', label: '氏名' },
  { key: 'name_kana', label: 'フリガナ' },
  { key: 'birth_date', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村' },
  { key: 'address', label: '番地' },
  { key: 'phone', label: '電話番号' },
  { key: 'email', label: 'メール' },
  { key: 'education', label: '学歴' },
  { key: 'work_history_1', label: '職歴1' },
  { key: 'work_history_2', label: '職歴2' },
  { key: 'work_history_3', label: '職歴3' },
  { key: 'qualifications', label: '資格' },
  { key: 'hobbies', label: '趣味・特技' },
]

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export function ResumeUploadModal({ isOpen, onClose, jobSeeker, onSave }: ResumeUploadModalProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ResumeParseResult | null>(null)
  const [editedData, setEditedData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('PDF、JPEG、PNG、WebPファイルのみアップロードできます')
      return
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('ファイルサイズは20MB以下にしてください')
      return
    }

    setFile(selectedFile)
    setError(null)
  }

  async function handleParse() {
    if (!file) return

    setStep('parsing')
    setError(null)

    try {
      // ファイルをbase64に変換
      const base64 = await fileToBase64(file)

      // Edge Functionで解析
      const { data, error: fnError } = await supabase.functions.invoke('parse-resume', {
        body: {
          fileBase64: base64,
          mediaType: file.type,
        },
      })

      if (fnError) {
        throw new Error(fnError.message || '解析に失敗しました')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      const result = data?.data as ResumeParseResult
      if (!result) {
        throw new Error('解析結果が取得できませんでした')
      }

      setParseResult(result)

      // 解析結果で編集データを初期化（nullでないフィールドのみ）
      const initial: Record<string, string> = {}
      for (const { key } of FIELD_LABELS) {
        const parsed = result[key]
        if (parsed) {
          initial[key] = String(parsed)
        }
      }
      setEditedData(initial)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析中にエラーが発生しました')
      setStep('upload')
    }
  }

  async function handleSave() {
    if (!file) return

    setSaving(true)
    setError(null)

    try {
      // Supabase Storageに履歴書をアップロード
      const ext = file.name.split('.').pop() || 'pdf'
      const filePath = `${jobSeeker.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`ファイルアップロードに失敗: ${uploadError.message}`)
      }

      // 保存データを構築
      const saveData: Partial<JobSeeker> & { resume_url?: string } = {
        resume_url: filePath,
      }

      // 編集済みデータから保存対象を抽出
      for (const { key } of FIELD_LABELS) {
        const value = editedData[key]
        if (value !== undefined && value !== '') {
          if (key === 'gender') {
            if (value === 'male' || value === 'female') {
              (saveData as any)[key] = value
            }
          } else {
            (saveData as any)[key] = value
          }
        }
      }

      await onSave(saveData)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存中にエラーが発生しました')
      setSaving(false)
    }
  }

  function handleClose() {
    setStep('upload')
    setFile(null)
    setParseResult(null)
    setEditedData({})
    setError(null)
    setSaving(false)
    onClose()
  }

  function getExistingValue(key: keyof ResumeParseResult): string {
    const val = (jobSeeker as any)[key]
    if (val === null || val === undefined) return ''
    if (key === 'gender') {
      return val === 'male' ? '男性' : val === 'female' ? '女性' : ''
    }
    return String(val)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-800">
              {step === 'upload' && '履歴書アップロード'}
              {step === 'parsing' && '履歴書を解析中'}
              {step === 'confirm' && '解析結果の確認'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-1">
                  クリックしてファイルを選択
                </p>
                <p className="text-xs text-slate-400">
                  PDF, JPEG, PNG, WebP（最大20MB）
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>キャンセル</Button>
                <Button onClick={handleParse} disabled={!file}>
                  <Upload className="w-4 h-4 mr-2" />
                  解析開始
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Parsing */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-slate-600 font-medium">履歴書を解析中...</p>
              <p className="text-sm text-slate-400 mt-1">Claude AIが内容を読み取っています</p>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && parseResult && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                解析結果を確認・修正してから保存してください。
              </p>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 w-24">項目</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 w-1/3">現在の値</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">解析結果（編集可）</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {FIELD_LABELS.map(({ key, label }) => {
                      const existing = getExistingValue(key)
                      const parsed = editedData[key] || ''
                      const isDiff = existing && parsed && existing !== parsed

                      return (
                        <tr key={key} className={isDiff ? 'bg-amber-50' : ''}>
                          <td className="px-4 py-2 text-xs font-medium text-slate-600">{label}</td>
                          <td className="px-4 py-2 text-sm text-slate-500">
                            {existing || <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-2">
                            {key === 'gender' ? (
                              <select
                                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                value={editedData[key] || ''}
                                onChange={(e) => setEditedData({ ...editedData, [key]: e.target.value })}
                              >
                                <option value="">-</option>
                                <option value="male">男性</option>
                                <option value="female">女性</option>
                              </select>
                            ) : (
                              <input
                                type="text"
                                className="w-full text-sm border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                                value={editedData[key] || ''}
                                onChange={(e) => setEditedData({ ...editedData, [key]: e.target.value })}
                                placeholder="-"
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => { setStep('upload'); setParseResult(null) }}>
                  戻る
                </Button>
                <Button onClick={handleSave} isLoading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // data:image/jpeg;base64,xxxxx → base64部分のみ抽出
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
