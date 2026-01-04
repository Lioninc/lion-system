'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

const genderOptions = [
  { value: '', label: '選択してください' },
  { value: '男性', label: '男性' },
  { value: '女性', label: '女性' },
  { value: 'その他', label: 'その他' },
]

const stageOptions = [
  { value: '', label: '選択してください' },
  { value: '新規', label: '新規' },
  { value: '電話出ず', label: '電話出ず' },
  { value: '連絡済み', label: '連絡済み' },
  { value: '面談予定', label: '面談予定' },
  { value: '面談済み', label: '面談済み' },
  { value: '紹介済み', label: '紹介済み' },
  { value: '面接予定', label: '面接予定' },
  { value: '面接済み', label: '面接済み' },
  { value: '採用決定', label: '採用決定' },
  { value: '稼働中', label: '稼働中' },
  { value: '保留', label: '保留' },
  { value: '就業時期が先', label: '就業時期が先' },
  { value: '不採用', label: '不採用' },
  { value: '辞退', label: '辞退' },
  { value: '飛び', label: '飛び' },
  { value: 'NG', label: 'NG' },
]

export default function NewCandidatePage() {
  const router = useRouter()
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: '選択してください' },
  ])
  const [employeeOptions, setEmployeeOptions] = useState<{ value: string; label: string }[]>([
    { value: '', label: '選択してください' },
  ])
  const [formData, setFormData] = useState({
    name: '',
    furigana: '',
    gender: '',
    birth_date: '',
    phone: '',
    email: '',
    postal_code: '',
    address: '',
    preferred_job: '',
    preferred_location: '',
    desired_salary: '',
    available_date: '',
    stage: '新規',
    source: '',
    employee_id: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchSources()
    fetchEmployees()
  }, [])

  async function fetchSources() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sources')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching sources:', error)
      return
    }

    setSourceOptions([
      { value: '', label: '選択してください' },
      ...(data || []).map((s: any) => ({ value: s.name, label: s.name })),
    ])
  }

  async function fetchEmployees() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    setEmployeeOptions([
      { value: '', label: '選択してください' },
      ...(data || []).map((e: any) => ({ value: e.id, label: e.name })),
    ])
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // ハイフンを除去して数字のみにする
    const cleanedValue = value.replace(/[^0-9]/g, '')

    // フォームデータを更新（ハイフン付きで表示）
    let displayValue = cleanedValue
    if (cleanedValue.length > 3) {
      displayValue = cleanedValue.slice(0, 3) + '-' + cleanedValue.slice(3, 7)
    }
    setFormData((prev) => ({ ...prev, postal_code: displayValue }))

    // 7桁入力されたら住所を取得
    if (cleanedValue.length === 7) {
      try {
        const response = await fetch(
          `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanedValue}`
        )
        const data = await response.json()

        if (data.results && data.results.length > 0) {
          const result = data.results[0]
          const address = `${result.address1}${result.address2}${result.address3}`
          setFormData((prev) => ({ ...prev, address }))
        }
      } catch (error) {
        console.error('郵便番号検索エラー:', error)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()

    // 求職者を作成
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({
        name: formData.name,
        furigana: formData.furigana || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
        phone: formData.phone || null,
        email: formData.email || null,
        postal_code: formData.postal_code || null,
        address: formData.address || null,
        preferred_job: formData.preferred_job || null,
        preferred_location: formData.preferred_location || null,
        desired_salary: formData.desired_salary ? parseInt(formData.desired_salary) : null,
        available_date: formData.available_date || null,
        stage: formData.stage || '新規',
        staff_id: formData.employee_id || null,
        notes: formData.notes || null,
      } as any)
      .select('id')
      .single()

    if (candidateError) {
      console.error('Error creating candidate:', candidateError)
      alert('登録に失敗しました')
      setSubmitting(false)
      return
    }

    // 応募履歴を作成
    if (formData.source && candidate) {
      const { error: appError } = await supabase.from('applications').insert({
        candidate_id: (candidate as any).id,
        source: formData.source,
        application_date: new Date().toISOString().split('T')[0],
        status: '有効応募',
      } as any)

      if (appError) {
        console.error('Error creating application:', appError)
      }
    }

    router.push('/candidates')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/candidates"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>一覧に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">求職者 新規登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="氏名"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <Input
              label="ふりがな"
              name="furigana"
              value={formData.furigana}
              onChange={handleChange}
            />
            <Select
              label="性別"
              name="gender"
              options={genderOptions}
              value={formData.gender}
              onChange={handleChange}
            />
            <Input
              label="生年月日"
              name="birth_date"
              type="date"
              value={formData.birth_date}
              onChange={handleChange}
            />
            <Input
              label="電話番号"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
            />
            <Input
              label="メールアドレス"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
            <Input
              label="郵便番号"
              name="postal_code"
              value={formData.postal_code}
              onChange={handlePostalCodeChange}
              placeholder="例: 530-0001"
              maxLength={8}
            />
            <div className="md:col-span-2">
              <Input
                label="住所"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="郵便番号を入力すると自動入力されます"
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">希望条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="希望職種"
              name="preferred_job"
              value={formData.preferred_job}
              onChange={handleChange}
            />
            <Input
              label="希望勤務地"
              name="preferred_location"
              value={formData.preferred_location}
              onChange={handleChange}
            />
            <Input
              label="希望給与（月額）"
              name="desired_salary"
              type="number"
              value={formData.desired_salary}
              onChange={handleChange}
            />
            <Input
              label="就業可能日"
              name="available_date"
              value={formData.available_date}
              onChange={handleChange}
              placeholder="例: 即日、2024年1月から"
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">応募情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="応募媒体"
              name="source"
              options={sourceOptions}
              value={formData.source}
              onChange={handleChange}
            />
            <Select
              label="ステージ"
              name="stage"
              options={stageOptions}
              value={formData.stage}
              onChange={handleChange}
            />
            <Select
              label="担当者"
              name="employee_id"
              options={employeeOptions}
              value={formData.employee_id}
              onChange={handleChange}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="備考があれば入力してください"
          />
        </Card>

        <div className="flex gap-4 justify-end">
          <Link href="/candidates">
            <Button type="button" variant="secondary">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? '登録中...' : '登録する'}
          </Button>
        </div>
      </form>
    </div>
  )
}
