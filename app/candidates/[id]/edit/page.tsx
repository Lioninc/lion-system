'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
}

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

const tattooOptions = [
  { value: '', label: '選択してください' },
  { value: 'なし', label: 'なし' },
  { value: 'あり（露出なし）', label: 'あり（露出なし）' },
  { value: 'あり（露出あり）', label: 'あり（露出あり）' },
]

const boolOptions = [
  { value: '', label: '選択してください' },
  { value: 'true', label: 'あり' },
  { value: 'false', label: 'なし' },
]

export default function EditCandidatePage() {
  const params = useParams()
  const router = useRouter()
  const candidateId = params.id as string

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    furigana: '',
    gender: '',
    birth_date: '',
    phone: '',
    phone_2: '',
    email: '',
    line_id: '',
    postal_code: '',
    address: '',
    nearest_station: '',
    preferred_job: '',
    preferred_location: '',
    preferred_salary_min: '',
    preferred_salary_max: '',
    available_date: '',
    height: '',
    weight: '',
    tattoo: '',
    disability_certificate: '',
    medical_condition: '',
    has_spouse: '',
    has_children: '',
    stage: '',
    stage_reason: '',
    staff_id: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [candidateId])

  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null
    const today = new Date()
    const birth = new Date(birthDate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age >= 0 ? age : null
  }

  async function fetchData() {
    const supabase = createClient()

    const [candidateResult, employeesResult] = await Promise.all([
      supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single(),
      supabase
        .from('employees')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ])

    if (employeesResult.error) {
      console.error('Error fetching employees:', employeesResult.error)
    } else {
      setEmployees(employeesResult.data || [])
    }

    if (candidateResult.error) {
      console.error('Error fetching candidate:', candidateResult.error)
      setLoading(false)
      return
    }

    const c = candidateResult.data as any
    setFormData({
      name: c.name || '',
      furigana: c.furigana || '',
      gender: c.gender || '',
      birth_date: c.birth_date || '',
      phone: c.phone || '',
      phone_2: c.phone_2 || '',
      email: c.email || '',
      line_id: c.line_id || '',
      postal_code: c.postal_code || '',
      address: c.address || '',
      nearest_station: c.nearest_station || '',
      preferred_job: c.preferred_job || '',
      preferred_location: c.preferred_location || '',
      preferred_salary_min: c.preferred_salary_min?.toString() || '',
      preferred_salary_max: c.preferred_salary_max?.toString() || '',
      available_date: c.available_date || '',
      height: c.height?.toString() || '',
      weight: c.weight?.toString() || '',
      tattoo: c.tattoo || '',
      disability_certificate: c.disability_certificate || '',
      medical_condition: c.medical_condition || '',
      has_spouse: c.has_spouse === true ? 'true' : c.has_spouse === false ? 'false' : '',
      has_children: c.has_children === true ? 'true' : c.has_children === false ? 'false' : '',
      stage: c.stage || '',
      stage_reason: c.stage_reason || '',
      staff_id: c.staff_id || '',
      notes: c.notes || '',
    })

    if (c.birth_date) {
      setCalculatedAge(calculateAge(c.birth_date))
    }

    setLoading(false)
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, birth_date: value }))
    setCalculatedAge(calculateAge(value))
  }

  const handlePostalCodeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cleanedValue = value.replace(/[^0-9]/g, '')

    let displayValue = cleanedValue
    if (cleanedValue.length > 3) {
      displayValue = cleanedValue.slice(0, 3) + '-' + cleanedValue.slice(3, 7)
    }
    setFormData((prev) => ({ ...prev, postal_code: displayValue }))

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

    const payload = {
      name: formData.name,
      furigana: formData.furigana || null,
      gender: formData.gender || null,
      birth_date: formData.birth_date || null,
      age: calculatedAge,
      phone: formData.phone || null,
      phone_2: formData.phone_2 || null,
      email: formData.email || null,
      line_id: formData.line_id || null,
      postal_code: formData.postal_code || null,
      address: formData.address || null,
      nearest_station: formData.nearest_station || null,
      preferred_job: formData.preferred_job || null,
      preferred_location: formData.preferred_location || null,
      preferred_salary_min: formData.preferred_salary_min ? parseInt(formData.preferred_salary_min) : null,
      preferred_salary_max: formData.preferred_salary_max ? parseInt(formData.preferred_salary_max) : null,
      available_date: formData.available_date || null,
      height: formData.height ? parseInt(formData.height) : null,
      weight: formData.weight ? parseInt(formData.weight) : null,
      tattoo: formData.tattoo || null,
      disability_certificate: formData.disability_certificate || null,
      medical_condition: formData.medical_condition || null,
      has_spouse: formData.has_spouse === 'true' ? true : formData.has_spouse === 'false' ? false : null,
      has_children: formData.has_children === 'true' ? true : formData.has_children === 'false' ? false : null,
      stage: formData.stage || '新規',
      stage_reason: formData.stage_reason || null,
      staff_id: formData.staff_id || null,
      notes: formData.notes || null,
    }

    const { error } = await (supabase.from('candidates') as any)
      .update(payload)
      .eq('id', candidateId)

    if (error) {
      console.error('Error updating candidate:', error)
      alert('更新に失敗しました')
      setSubmitting(false)
      return
    }

    router.push(`/candidates/${candidateId}`)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/candidates/${candidateId}`}
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>詳細に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">求職者 編集</h1>
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="生年月日"
                name="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={handleBirthDateChange}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">年齢</label>
                <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded-md text-sm text-slate-700">
                  {calculatedAge !== null ? `${calculatedAge}歳` : '-'}
                </div>
              </div>
            </div>
            <Input
              label="電話番号"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
            />
            <Input
              label="電話番号2"
              name="phone_2"
              type="tel"
              value={formData.phone_2}
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
              label="LINE ID"
              name="line_id"
              value={formData.line_id}
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
            <Input
              label="最寄り駅"
              name="nearest_station"
              value={formData.nearest_station}
              onChange={handleChange}
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4">身体情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="身長 (cm)"
              name="height"
              type="number"
              value={formData.height}
              onChange={handleChange}
            />
            <Input
              label="体重 (kg)"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
            />
            <Select
              label="タトゥー"
              name="tattoo"
              options={tattooOptions}
              value={formData.tattoo}
              onChange={handleChange}
            />
            <Input
              label="障害者手帳"
              name="disability_certificate"
              value={formData.disability_certificate}
              onChange={handleChange}
              placeholder="例: なし、あり（3級）"
            />
            <Input
              label="持病"
              name="medical_condition"
              value={formData.medical_condition}
              onChange={handleChange}
              placeholder="例: なし、腰痛"
            />
            <Select
              label="配偶者"
              name="has_spouse"
              options={boolOptions}
              value={formData.has_spouse}
              onChange={handleChange}
            />
            <Select
              label="子供"
              name="has_children"
              options={boolOptions}
              value={formData.has_children}
              onChange={handleChange}
            />
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
              label="希望給与（最小）"
              name="preferred_salary_min"
              type="number"
              value={formData.preferred_salary_min}
              onChange={handleChange}
            />
            <Input
              label="希望給与（最大）"
              name="preferred_salary_max"
              type="number"
              value={formData.preferred_salary_max}
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4">管理情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="ステージ"
              name="stage"
              options={stageOptions}
              value={formData.stage}
              onChange={handleChange}
            />
            <Input
              label="ステージ理由"
              name="stage_reason"
              value={formData.stage_reason}
              onChange={handleChange}
              placeholder="例: 就業開始待ち"
            />
            <Select
              label="担当者"
              name="staff_id"
              options={[
                { value: '', label: '選択してください' },
                ...employees.map((e) => ({ value: e.id, label: e.name })),
              ]}
              value={formData.staff_id}
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
          <Link href={`/candidates/${candidateId}`}>
            <Button type="button" variant="secondary">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? '更新中...' : '更新する'}
          </Button>
        </div>
      </form>
    </div>
  )
}
