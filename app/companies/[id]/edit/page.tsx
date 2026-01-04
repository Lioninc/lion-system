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

interface Company {
  id: string
  name: string
  industry: string | null
  address: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  employee_id: string | null
  status: string
  notes: string | null
  csv_mapping: { [key: string]: string } | null
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

export default function EditCompanyPage() {
  const params = useParams()
  const router = useRouter()
  const companyId = params.id as string
  const [activeTab, setActiveTab] = useState('basic')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    phone: '',
    email: '',
    contact_person: '',
    employee_id: '',
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
    fetchData()
  }, [companyId])

  async function fetchData() {
    const supabase = createClient()

    // 従業員と企業データを並行して取得
    const [employeesResult, companyResult] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single()
    ])

    if (employeesResult.error) {
      console.error('Error fetching employees:', employeesResult.error)
    } else {
      setEmployees(employeesResult.data || [])
    }

    if (companyResult.error) {
      console.error('Error fetching company:', companyResult.error)
      setLoading(false)
      return
    }

    const company = companyResult.data as Company
    setFormData({
      name: company.name || '',
      industry: company.industry || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || '',
      contact_person: company.contact_person || '',
      employee_id: company.employee_id || '',
      status: company.status || '新規',
      notes: company.notes || '',
    })

    if (company.csv_mapping) {
      setCsvMapping({
        title: company.csv_mapping.title || '',
        location: company.csv_mapping.location || '',
        referral_fee: company.csv_mapping.referral_fee || '',
        job_number: company.csv_mapping.job_number || '',
        job_type: company.csv_mapping.job_type || '',
        monthly_salary: company.csv_mapping.monthly_salary || '',
        working_hours: company.csv_mapping.working_hours || '',
        holidays: company.csv_mapping.holidays || '',
        site_name: company.csv_mapping.site_name || '',
      })
    }

    setLoading(false)
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
      email: formData.email || null,
      contact_person: formData.contact_person || null,
      employee_id: formData.employee_id || null,
      status: formData.status || '新規',
      notes: formData.notes || null,
      csv_mapping: Object.keys(filteredMapping).length > 0 ? filteredMapping : null,
    }

    const { error } = await (supabase.from('companies') as any)
      .update(payload)
      .eq('id', companyId)

    if (error) {
      console.error('Error updating company:', error)
      alert('更新に失敗しました')
      setSubmitting(false)
      return
    }

    router.push(`/companies/${companyId}`)
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
          href={`/companies/${companyId}`}
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>詳細に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">企業 編集</h1>
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
                  name="email"
                  type="email"
                  value={formData.email}
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
                  name="employee_id"
                  options={[
                    { value: '', label: '選択してください' },
                    ...employees.map((e) => ({ value: e.id, label: e.name })),
                  ]}
                  value={formData.employee_id}
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
          <Link href={`/companies/${companyId}`}>
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
