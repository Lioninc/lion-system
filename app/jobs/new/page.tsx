'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'

const companyOptions = [
  { value: '', label: '選択してください' },
  { value: '1', label: '株式会社ABC' },
  { value: '2', label: '株式会社XYZ' },
  { value: '3', label: '株式会社DEF' },
  { value: '4', label: '株式会社GHI' },
]

const employmentTypeOptions = [
  { value: '', label: '選択してください' },
  { value: '派遣', label: '派遣' },
  { value: '紹介予定派遣', label: '紹介予定派遣' },
  { value: '正社員', label: '正社員' },
  { value: 'パート・アルバイト', label: 'パート・アルバイト' },
]

const statusOptions = [
  { value: '', label: '選択してください' },
  { value: '募集中', label: '募集中' },
  { value: '募集停止', label: '募集停止' },
]

export default function NewJobPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    company_id: '',
    description: '',
    location: '',
    nearest_station: '',
    hourly_rate: '',
    employment_type: '',
    working_hours: '',
    holidays: '',
    requirements: '',
    benefits: '',
    status: '',
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
    router.push('/jobs')
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
        <h1 className="text-2xl font-bold text-slate-800">案件 新規登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="案件名"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
            <Select
              label="企業"
              name="company_id"
              options={companyOptions}
              value={formData.company_id}
              onChange={handleChange}
              required
            />
            <Input
              label="勤務地"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
            <Input
              label="最寄り駅"
              name="nearest_station"
              value={formData.nearest_station}
              onChange={handleChange}
            />
            <Input
              label="時給（円）"
              name="hourly_rate"
              type="number"
              value={formData.hourly_rate}
              onChange={handleChange}
            />
            <Select
              label="雇用形態"
              name="employment_type"
              options={employmentTypeOptions}
              value={formData.employment_type}
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
          <h2 className="text-lg font-semibold text-slate-800 mb-4">求人内容</h2>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="仕事内容を入力してください"
          />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">勤務条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="勤務時間"
              name="working_hours"
              value={formData.working_hours}
              onChange={handleChange}
              placeholder="例: 8:00〜17:00（休憩60分）"
            />
            <Input
              label="休日"
              name="holidays"
              value={formData.holidays}
              onChange={handleChange}
              placeholder="例: 土日祝、GW、夏季休暇"
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">待遇・福利厚生</h2>
          <textarea
            name="benefits"
            value={formData.benefits}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="待遇・福利厚生を入力してください"
          />
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">採用要件</h2>
          <textarea
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="採用要件を入力してください"
          />
        </Card>

        <div className="flex gap-4 justify-end">
          <Link href="/jobs">
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
