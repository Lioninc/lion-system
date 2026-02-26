import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Check } from 'lucide-react'
import { Card, Button, Input, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { usePostalCodeLookup } from '../../hooks/usePostalCodeLookup'

interface JobSeekerFormData {
  name: string
  name_kana?: string
  phone: string
  email?: string
  line_id?: string
  birth_date?: string
  gender?: 'male' | 'female' | 'other'
  postal_code?: string
  prefecture?: string
  city?: string
  address?: string
  height?: number
  weight?: number
  has_tattoo: boolean
  has_medical_condition: boolean
  medical_condition_detail?: string
  has_spouse: boolean
  has_children: boolean
  employment_status?: 'unemployed' | 'employed'
  desired_start_date?: string
  desired_period?: string
  notes?: string
}

const jobSeekerSchema = z.object({
  name: z.string().min(1, '氏名は必須です'),
  name_kana: z.string().optional(),
  phone: z.string().min(10, '電話番号は10桁以上で入力してください').max(15),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  line_id: z.string().optional(),
  birth_date: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  postal_code: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  has_tattoo: z.boolean(),
  has_medical_condition: z.boolean(),
  medical_condition_detail: z.string().optional(),
  has_spouse: z.boolean(),
  has_children: z.boolean(),
  employment_status: z.enum(['unemployed', 'employed']).optional(),
  desired_start_date: z.string().optional(),
  desired_period: z.string().optional(),
  notes: z.string().optional(),
})

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

export function JobSeekerEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [jobSeekerId, setJobSeekerId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<JobSeekerFormData>({
    resolver: zodResolver(jobSeekerSchema),
    defaultValues: {
      has_tattoo: false,
      has_medical_condition: false,
      has_spouse: false,
      has_children: false,
    },
  })

  const hasMedicalCondition = watch('has_medical_condition')
  const { handlePostalCodeChange, searching: postalSearching } = usePostalCodeLookup(setValue)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)

    const { data, error } = await supabase
      .from('applications')
      .select('job_seeker:job_seekers(*)')
      .eq('id', id)
      .single()

    if (error || !data) {
      navigate('/job-seekers')
      return
    }

    const js = (data as any).job_seeker
    setJobSeekerId(js.id)

    reset({
      name: js.name || '',
      name_kana: js.name_kana || '',
      phone: js.phone || '',
      email: js.email || '',
      line_id: js.line_id || '',
      birth_date: js.birth_date || '',
      gender: js.gender || undefined,
      postal_code: js.postal_code || '',
      prefecture: js.prefecture || '',
      city: js.city || '',
      address: js.address || '',
      height: js.height || undefined,
      weight: js.weight || undefined,
      has_tattoo: js.has_tattoo || false,
      has_medical_condition: js.has_medical_condition || false,
      medical_condition_detail: js.medical_condition_detail || '',
      has_spouse: js.has_spouse || false,
      has_children: js.has_children || false,
      employment_status: js.employment_status || undefined,
      desired_start_date: js.desired_start_date || '',
      desired_period: js.desired_period || '',
      notes: js.notes || '',
    })

    setLoading(false)
  }

  async function onSubmit(data: JobSeekerFormData) {
    if (!jobSeekerId) return

    setSubmitting(true)

    const { error } = await supabase
      .from('job_seekers')
      .update({
        name: data.name,
        name_kana: data.name_kana || null,
        phone: data.phone,
        email: data.email || null,
        line_id: data.line_id || null,
        birth_date: data.birth_date || null,
        gender: data.gender || null,
        postal_code: data.postal_code || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        height: data.height || null,
        weight: data.weight || null,
        has_tattoo: data.has_tattoo,
        has_medical_condition: data.has_medical_condition,
        medical_condition_detail: data.medical_condition_detail || null,
        has_spouse: data.has_spouse,
        has_children: data.has_children,
        employment_status: data.employment_status || null,
        desired_start_date: data.desired_start_date || null,
        desired_period: data.desired_period || null,
        notes: data.notes || null,
      })
      .eq('id', jobSeekerId)

    if (error) {
      console.error('Error updating job seeker:', error)
      alert('更新に失敗しました')
      setSubmitting(false)
      return
    }

    navigate(`/job-seekers/${id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <Header title="求職者編集" />

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">基本情報</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="電話番号 *"
              {...register('phone')}
              error={errors.phone?.message}
            />
            <Input
              label="氏名 *"
              {...register('name')}
              error={errors.name?.message}
            />
            <Input
              label="氏名（カナ）"
              {...register('name_kana')}
            />
            <Input
              label="メールアドレス"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="LINE ID"
              {...register('line_id')}
            />
            <Input
              label="生年月日"
              type="date"
              {...register('birth_date')}
            />
            <Select
              label="性別"
              options={[
                { value: 'male', label: '男性' },
                { value: 'female', label: '女性' },
                { value: 'other', label: 'その他' },
              ]}
              placeholder="選択してください"
              {...register('gender')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">住所</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Input
                label="郵便番号"
                placeholder="1234567"
                {...register('postal_code', {
                  onChange: handlePostalCodeChange,
                })}
              />
              {postalSearching && (
                <p className="text-xs text-slate-500 mt-1">住所を検索中...</p>
              )}
            </div>
            <Select
              label="都道府県"
              options={PREFECTURES.map((p) => ({ value: p, label: p }))}
              placeholder="選択してください"
              {...register('prefecture')}
            />
            <Input
              label="市区町村"
              {...register('city')}
            />
            <Input
              label="番地・建物名"
              {...register('address')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">身体情報</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="身長 (cm)"
              type="number"
              {...register('height', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
            <Input
              label="体重 (kg)"
              type="number"
              {...register('weight', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_tattoo')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">タトゥーあり</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_medical_condition')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">持病あり</span>
            </label>
            {hasMedicalCondition && (
              <Input
                label="持病の詳細"
                {...register('medical_condition_detail')}
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">個人状況</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_spouse')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">配偶者あり</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_children')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">子供あり</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Select
              label="現在の就業状況"
              options={[
                { value: 'unemployed', label: '無職' },
                { value: 'employed', label: '就業中' },
              ]}
              placeholder="選択してください"
              {...register('employment_status')}
            />
            <Input
              label="希望開始日"
              type="date"
              {...register('desired_start_date')}
            />
            <Input
              label="希望期間"
              placeholder="例: 3ヶ月以上"
              {...register('desired_period')}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="その他の情報を入力..."
          />
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/job-seekers/${id}`)}
          >
            キャンセル
          </Button>
          <Button type="submit" isLoading={submitting}>
            <Check className="w-4 h-4 mr-2" />
            更新する
          </Button>
        </div>
      </form>
    </div>
  )
}
