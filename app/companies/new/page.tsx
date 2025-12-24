'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'

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

const employeeOptions = [
  { value: '', label: '選択してください' },
  { value: '1', label: '山田花子' },
  { value: '2', label: '鈴木一郎' },
  { value: '3', label: '佐藤美咲' },
]

export default function NewCompanyPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    address: '',
    phone: '',
    email: '',
    contact_person: '',
    employee_id: '',
    status: '',
    notes: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', formData)
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
              options={employeeOptions}
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

        <div className="flex gap-4 justify-end">
          <Link href="/companies">
            <Button type="button" variant="secondary">
              キャンセル
            </Button>
          </Link>
          <Button type="submit">登録する</Button>
        </div>
      </form>
    </div>
  )
}
