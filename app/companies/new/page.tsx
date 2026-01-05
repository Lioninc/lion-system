'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
}

const industryOptions = [
  { value: '', label: '選択してください' },
  { value: '製造業', label: '製造業' },
  { value: '物流', label: '物流' },
  { value: '小売', label: '小売' },
  { value: 'IT', label: 'IT' },
  { value: '飲食', label: '飲食' },
  { value: 'その他', label: 'その他' },
]

const statusOptions = [
  { value: '', label: '選択してください' },
  { value: '新規', label: '新規' },
  { value: '取引中', label: '取引中' },
  { value: '取引停止', label: '取引停止' },
]

const tabs = [
  { id: 'basic', label: '基本情報' },
  { id: 'csv', label: 'CSV設定' },
]

// CSVマッピング設定項目
const csvMappingFields = [
  { key: 'title', label: '求人名（CSV列名）', required: true, placeholder: '例: スピード採用案件' },
  { key: 'location', label: '勤務地（CSV列名）', required: true, placeholder: '例: 勤務地' },
  { key: 'referral_fee', label: '紹介料（CSV列名）', required: false, placeholder: '例: 紹介料' },
  { key: 'job_number', label: 'お仕事No.（CSV列名）', required: false, placeholder: '例: お仕事No.' },
  { key: 'job_type', label: '職種（CSV列名）', required: false, placeholder: '例: 職種' },
  { key: 'monthly_salary', label: '月収（CSV列名）', required: false, placeholder: '例: 月収' },
  { key: 'working_hours', label: '勤務時間（CSV列名）', required: false, placeholder: '例: 勤務時間' },
  { key: 'holidays', label: '休日（CSV列名）', required: false, placeholder: '例: 休日' },
  { key: 'site_name', label: '現場名（CSV列名）', required: false, placeholder: '例: 現場名' },
]

export default function NewCompanyPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('basic')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    phone: '',
    contact_email: '',
    contact_person: '',
    staff_id: '',
    status: '新規',
    notes: '',
  })
  const [csvMapping, setCsvMapping] = useState<{ [key: string]: string }>({
    title: '',
    location: '',
    referral_fee: '',
    job_number: '',
    job_type: '',
    monthly_salary: '',
    working_hours: '',
    holidays: '',
    site_name: '',
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

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

    setEmployees(data || [])
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCsvMappingChange = (key: string, value: string) => {
    setCsvMapping((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()

    // 空の値を除いたCSVマッピングを作成
    const filteredMapping: { [key: string]: string } = {}
    Object.entries(csvMapping).forEach(([key, value]) => {
      if (value.trim()) {
        filteredMapping[key] = value.trim()
      }
    })

    const payload = {
      name: formData.name,
      industry: formData.industry || null,
      address: formData.address || null,
      phone: formData.phone || null,
      contact_email: formData.contact_email || null,
      contact_person: formData.contact_person || null,
      staff_id: formData.staff_id || null,
      status: formData.status || '新規',
      notes: formData.notes || null,
      csv_mapping: Object.keys(filteredMapping).length > 0 ? filteredMapping : null,
    }

    const { error } = await (supabase.from('companies') as any).insert(payload)

    if (error) {
      console.error('Error creating company:', error)
      alert('登録に失敗しました')
      setSubmitting(false)
      return
    }

    router.push('/companies')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/companies"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>一覧に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">企業 新規登録</h1>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本情報タブ */}
        {activeTab === 'basic' && (
          <>
            <Card>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">企業情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="企業名"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
                <Select
                  label="業界"
                  name="industry"
                  options={industryOptions}
                  value={formData.industry}
                  onChange={handleChange}
                />
                <div className="md:col-span-2">
                  <Input
                    label="住所"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <Input
                  label="電話番号"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                />
                <Input
                  label="メールアドレス"
                  name="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={handleChange}
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-slate-800 mb-4">担当者情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="先方担当者"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                />
                <Select
                  label="弊社担当"
                  name="staff_id"
                  options={[
                    { value: '', label: '選択してください' },
                    ...employees.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  value={formData.staff_id}
                  onChange={handleChange}
                />
                <Select
                  label="ステータス"
                  name="status"
                  options={statusOptions}
                  value={formData.status}
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
          </>
        )}

        {/* CSV設定タブ */}
        {activeTab === 'csv' && (
          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">CSVマッピング設定</h2>
            <p className="text-sm text-slate-600 mb-6">
              この企業の案件CSVに含まれる列名を設定してください。<br />
              案件インポート時に、ここで設定した列名を使用してデータを取り込みます。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {csvMappingFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type="text"
                    value={csvMapping[field.key] || ''}
                    onChange={(e) => handleCsvMappingChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 mb-2">設定例</h3>
              <p className="text-xs text-slate-600">
                CSVファイルのヘッダーが「スピード採用案件」の場合、「求人名」の欄に「スピード採用案件」と入力してください。<br />
                インポート時に自動的にマッピングされます。
              </p>
            </div>
          </Card>
        )}

        <div className="flex gap-4 justify-end">
          <Link href="/companies">
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
