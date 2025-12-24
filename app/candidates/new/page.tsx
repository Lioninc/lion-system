'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'

const genderOptions = [
  { value: '', label: '選択してください' },
  { value: '男性', label: '男性' },
  { value: '女性', label: '女性' },
  { value: 'その他', label: 'その他' },
]

const statusOptions = [
  { value: '', label: '選択してください' },
  { value: '有効応募', label: '有効応募' },
  { value: '無効応募', label: '無効応募' },
  { value: '電話出ず', label: '電話出ず' },
  { value: '就業時期が先', label: '就業時期が先' },
]

const sourceOptions = [
  { value: '', label: '選択してください' },
  { value: 'Indeed', label: 'Indeed' },
  { value: 'タウンワーク', label: 'タウンワーク' },
  { value: 'リクナビ', label: 'リクナビ' },
  { value: 'マイナビ', label: 'マイナビ' },
  { value: '紹介', label: '紹介' },
  { value: 'その他', label: 'その他' },
]

const employeeOptions = [
  { value: '', label: '選択してください' },
  { value: '1', label: '山田花子' },
  { value: '2', label: '鈴木一郎' },
  { value: '3', label: '佐藤美咲' },
]

export default function NewCandidatePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    name_kana: '',
    gender: '',
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    desired_occupation: '',
    desired_location: '',
    desired_salary: '',
    available_date: '',
    status: '',
    source: '',
    employee_id: '',
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
    // 実際はここでSupabaseにデータを保存
    console.log('Form submitted:', formData)
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
              name="name_kana"
              value={formData.name_kana}
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
            <div className="md:col-span-2">
              <Input
                label="住所"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">希望条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="希望職種"
              name="desired_occupation"
              value={formData.desired_occupation}
              onChange={handleChange}
            />
            <Input
              label="希望勤務地"
              name="desired_location"
              value={formData.desired_location}
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
              label="応募状態"
              name="status"
              options={statusOptions}
              value={formData.status}
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
          <Button type="submit">登録する</Button>
        </div>
      </form>
    </div>
  )
}
