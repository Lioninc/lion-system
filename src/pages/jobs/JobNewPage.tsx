import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Briefcase, Check, Building2, MapPin, DollarSign, Home } from 'lucide-react'
import { Card, Button, Input, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { Company } from '../../types/database'

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

const JOB_TYPES = [
  '製造・組立',
  '検品・検査',
  '倉庫・物流',
  '食品加工',
  '機械オペレーター',
  '溶接・塗装',
  'フォークリフト',
  '軽作業',
  '建設・土木',
  '介護・福祉',
  '清掃',
  'その他',
]

const FEE_TYPES = [
  { value: 'fixed', label: '固定報酬' },
  { value: 'percentage', label: '年収の％' },
]

const jobSchema = z.object({
  company_id: z.string().min(1, '派遣会社は必須です'),
  title: z.string().min(1, '求人タイトルは必須です'),
  job_type: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  postal_code: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  salary_min: z.coerce.number().optional(),
  salary_max: z.coerce.number().optional(),
  working_hours: z.string().optional(),
  holidays: z.string().optional(),
  benefits: z.string().optional(),
  has_dormitory: z.boolean(),
  dormitory_details: z.string().optional(),
  fee_type: z.string().optional(),
  fee_amount: z.coerce.number().optional(),
  fee_percentage: z.coerce.number().optional(),
  notes: z.string().optional(),
})


export function JobNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedCompanyId = searchParams.get('company')
  const [submitting, setSubmitting] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      company_id: preselectedCompanyId || '',
      has_dormitory: false,
      fee_type: 'fixed',
      title: '',
    },
  })

  const hasDormitory = watch('has_dormitory')
  const feeType = watch('fee_type')

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setCompanies(data)
    }
  }

  async function onSubmit(data: z.infer<typeof jobSchema>) {
    setSubmitting(true)

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        company_id: data.company_id,
        title: data.title,
        job_type: data.job_type || null,
        description: data.description || null,
        requirements: data.requirements || null,
        postal_code: data.postal_code || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        salary_min: data.salary_min || null,
        salary_max: data.salary_max || null,
        working_hours: data.working_hours || null,
        holidays: data.holidays || null,
        benefits: data.benefits || null,
        has_dormitory: data.has_dormitory,
        dormitory_details: data.dormitory_details || null,
        fee_type: data.fee_type || null,
        fee_amount: data.fee_amount || null,
        fee_percentage: data.fee_percentage || null,
        notes: data.notes || null,
        status: 'open',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating job:', error)
      alert('登録に失敗しました')
      setSubmitting(false)
      return
    }

    navigate(`/jobs/${job.id}`)
  }

  return (
    <div>
      <Header title="求人登録" />

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Basic Info */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">基本情報</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="派遣会社 *"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="選択してください"
              {...register('company_id')}
              error={errors.company_id?.message}
            />
            <Select
              label="職種"
              options={JOB_TYPES.map((t) => ({ value: t, label: t }))}
              placeholder="選択してください"
              {...register('job_type')}
            />
            <div className="md:col-span-2">
              <Input
                label="求人タイトル *"
                {...register('title')}
                error={errors.title?.message}
                placeholder="例: 自動車部品の組立作業"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                仕事内容
              </label>
              <textarea
                {...register('description')}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="具体的な仕事内容を記載..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                応募要件
              </label>
              <textarea
                {...register('requirements')}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="必須スキル、資格、経験など..."
              />
            </div>
          </div>
        </Card>

        {/* Location */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">勤務地</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="郵便番号"
              placeholder="1234567"
              {...register('postal_code')}
            />
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

        {/* Salary & Working Conditions */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">給与・労働条件</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="給与（最低）"
              type="number"
              placeholder="200000"
              {...register('salary_min')}
            />
            <Input
              label="給与（最高）"
              type="number"
              placeholder="300000"
              {...register('salary_max')}
            />
            <Input
              label="勤務時間"
              placeholder="例: 8:00〜17:00"
              {...register('working_hours')}
            />
            <Input
              label="休日"
              placeholder="例: 土日祝"
              {...register('holidays')}
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                福利厚生
              </label>
              <textarea
                {...register('benefits')}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="社会保険完備、交通費支給など..."
              />
            </div>
          </div>
        </Card>

        {/* Dormitory */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Home className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">寮情報</h2>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('has_dormitory')}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <span className="text-slate-700">寮あり</span>
            </label>

            {hasDormitory && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  寮の詳細
                </label>
                <textarea
                  {...register('dormitory_details')}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="寮費、設備、入居条件など..."
                />
              </div>
            )}
          </div>
        </Card>

        {/* Fee Settings */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">成功報酬設定</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="報酬タイプ"
              options={FEE_TYPES}
              {...register('fee_type')}
            />
            {feeType === 'fixed' ? (
              <Input
                label="報酬金額（円）"
                type="number"
                placeholder="50000"
                {...register('fee_amount')}
              />
            ) : (
              <Input
                label="報酬率（%）"
                type="number"
                placeholder="30"
                {...register('fee_percentage')}
              />
            )}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            ※ 紹介成立時に派遣会社から受け取る成功報酬を設定します
          </p>
        </Card>

        {/* Notes */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="その他特記事項..."
          />
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/jobs')}
          >
            キャンセル
          </Button>
          <Button type="submit" isLoading={submitting}>
            <Check className="w-4 h-4 mr-2" />
            登録する
          </Button>
        </div>
      </form>
    </div>
  )
}
