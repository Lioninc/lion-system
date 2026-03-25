import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, User, Phone, AlertCircle, Check } from 'lucide-react'
import { Card, Button, Input, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { usePostalCodeLookup } from '../../hooks/usePostalCodeLookup'
import { calculateAge } from '../../lib/utils'

// Form data type
interface JobSeekerFormData {
  phone: string
  name: string
  name_kana?: string
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
  source_id?: string
  education_level?: string
  education_school?: string
  education_faculty?: string
  graduation_year?: number
  work_history?: string
  current_job_type?: string
  reason_for_change?: string
  current_annual_income?: number
  desired_annual_income?: number
  desired_job_type?: string
  desired_employment_type?: string
  desired_work_location?: string
  remote_work_preference?: string
  pc_skill_level?: string
  qualifications?: string
  language_skill?: string
  toeic_score?: number
  has_car_license: boolean
  has_forklift: boolean
  commute_method?: string
  commute_time?: number
  other_job_hunting?: string
}

// Form validation schema
const jobSeekerSchema = z.object({
  phone: z.string().min(10, '電話番号は10桁以上で入力してください').max(15),
  name: z.string().min(1, '氏名は必須です'),
  name_kana: z.string().optional(),
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
  source_id: z.string().optional(),
  education_level: z.string().optional(),
  education_school: z.string().optional(),
  education_faculty: z.string().optional(),
  graduation_year: z.number().optional(),
  work_history: z.string().optional(),
  current_job_type: z.string().optional(),
  reason_for_change: z.string().optional(),
  current_annual_income: z.number().optional(),
  desired_annual_income: z.number().optional(),
  desired_job_type: z.string().optional(),
  desired_employment_type: z.string().optional(),
  desired_work_location: z.string().optional(),
  remote_work_preference: z.string().optional(),
  pc_skill_level: z.string().optional(),
  qualifications: z.string().optional(),
  language_skill: z.string().optional(),
  toeic_score: z.number().optional(),
  has_car_license: z.boolean(),
  has_forklift: z.boolean(),
  commute_method: z.string().optional(),
  commute_time: z.number().optional(),
  other_job_hunting: z.string().optional(),
})

interface ExistingJobSeeker {
  id: string
  name: string
  phone: string
  applications: {
    id: string
    application_status: string
    applied_at: string
  }[]
}

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

export function JobSeekerNewPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState<'phone_check' | 'form'>('phone_check')
  const [phoneInput, setPhoneInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [existingJobSeeker, setExistingJobSeeker] = useState<ExistingJobSeeker | null>(null)
  const [sources, setSources] = useState<{ value: string; label: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<JobSeekerFormData>({
    resolver: zodResolver(jobSeekerSchema),
    defaultValues: {
      has_tattoo: false,
      has_medical_condition: false,
      has_spouse: false,
      has_children: false,
      has_car_license: false,
      has_forklift: false,
    },
  })

  const hasMedicalCondition = watch('has_medical_condition')
  const birthDate = watch('birth_date')
  const { handlePostalCodeChange, searching: postalSearching } = usePostalCodeLookup(setValue)

  // Search for existing job seeker by phone
  async function handlePhoneSearch() {
    if (!phoneInput || phoneInput.length < 10) {
      return
    }

    setSearching(true)
    setExistingJobSeeker(null)

    const { data, error } = await supabase
      .from('job_seekers')
      .select(`
        id,
        name,
        phone,
        applications (
          id,
          application_status,
          applied_at
        )
      `)
      .eq('phone', phoneInput)
      .single()

    if (data && !error) {
      setExistingJobSeeker(data as ExistingJobSeeker)
    } else {
      // No existing job seeker, proceed to form
      setValue('phone', phoneInput)
      await loadSources()
      setStep('form')
    }

    setSearching(false)
  }

  async function loadSources() {
    const { data } = await supabase
      .from('sources')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setSources(data.map((s) => ({ value: s.id, label: s.name })))
    }
  }

  // Create new application for existing job seeker
  async function handleCreateNewApplication() {
    if (!existingJobSeeker || !user) return

    setSubmitting(true)

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_seeker_id: existingJobSeeker.id,
        application_status: 'new',
        coordinator_id: user.id,
        applied_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating application:', error)
      alert('応募の作成に失敗しました')
      setSubmitting(false)
      return
    }

    navigate(`/job-seekers/${data.id}`)
  }

  // Submit new job seeker and application
  async function onSubmit(data: JobSeekerFormData) {
    if (!user) return

    setSubmitting(true)

    try {
      // Create job seeker
      const { data: jobSeeker, error: jsError } = await supabase
        .from('job_seekers')
        .insert({
          phone: data.phone,
          name: data.name,
          name_kana: data.name_kana || null,
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
          education_level: data.education_level || null,
          education_school: data.education_school || null,
          education_faculty: data.education_faculty || null,
          graduation_year: data.graduation_year || null,
          work_history: data.work_history || null,
          current_job_type: data.current_job_type || null,
          reason_for_change: data.reason_for_change || null,
          current_annual_income: data.current_annual_income || null,
          desired_annual_income: data.desired_annual_income || null,
          desired_job_type: data.desired_job_type || null,
          desired_employment_type: data.desired_employment_type || null,
          desired_work_location: data.desired_work_location || null,
          remote_work_preference: data.remote_work_preference || null,
          pc_skill_level: data.pc_skill_level || null,
          qualifications: data.qualifications || null,
          language_skill: data.language_skill || null,
          toeic_score: data.toeic_score || null,
          has_car_license: data.has_car_license,
          has_forklift: data.has_forklift,
          commute_method: data.commute_method || null,
          commute_time: data.commute_time || null,
          other_job_hunting: data.other_job_hunting || null,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (jsError) {
        throw jsError
      }

      // Create application
      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
          job_seeker_id: jobSeeker.id,
          source_id: data.source_id || null,
          coordinator_id: user.id,
          application_status: 'new',
          applied_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (appError) {
        throw appError
      }

      navigate(`/job-seekers/${application.id}`)
    } catch (error) {
      console.error('Error creating job seeker:', error)
      alert('登録に失敗しました')
    }

    setSubmitting(false)
  }

  // Phone check step
  if (step === 'phone_check') {
    return (
      <div>
        <Header title="求職者登録" />

        <div className="p-6 max-w-xl mx-auto">
          <Card>
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">電話番号を入力</h2>
                <p className="text-sm text-slate-500 mt-2">
                  まず電話番号を入力して、既存の求職者かどうか確認します
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="090XXXXXXXX"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1"
                />
                <Button onClick={handlePhoneSearch} isLoading={searching}>
                  <Search className="w-4 h-4 mr-2" />
                  検索
                </Button>
              </div>

              {/* Existing job seeker found */}
              {existingJobSeeker && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium text-amber-800">既存の求職者が見つかりました</h3>
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-amber-700">
                          <span className="font-medium">{existingJobSeeker.name}</span> ({existingJobSeeker.phone})
                        </p>
                        {existingJobSeeker.applications.length > 0 && (
                          <p className="text-xs text-amber-600">
                            過去の応募: {existingJobSeeker.applications.length}件
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleCreateNewApplication}
                          isLoading={submitting}
                        >
                          新規応募として登録
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (existingJobSeeker.applications.length > 0) {
                              navigate(`/job-seekers/${existingJobSeeker.applications[0].id}`)
                            }
                          }}
                        >
                          既存の応募を開く
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // Registration form
  return (
    <div>
      <Header title="求職者登録" />

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Basic Info */}
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
              disabled
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
            <div>
              <Input
                label="生年月日"
                type="date"
                {...register('birth_date')}
              />
              {birthDate && (
                <p className="text-sm text-slate-600 mt-1">{calculateAge(birthDate)}歳</p>
              )}
            </div>
            <Select
              label="性別"
              options={[
                { value: 'male', label: '男性' },
                { value: 'female', label: '女性' },
                { value: 'other', label: 'その他' },
              ]}
              placeholder="選択してください"
              {...register('gender', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Select
              label="流入元"
              options={sources}
              placeholder="選択してください"
              {...register('source_id', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
          </div>
        </Card>

        {/* Address */}
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

        {/* Physical Info */}
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

        {/* Personal Status */}
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
              {...register('employment_status', { setValueAs: (v: string) => v === '' ? undefined : v })}
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

        {/* Education */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">学歴</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="最終学歴"
              options={[
                { value: '中学卒', label: '中学卒' },
                { value: '高校卒', label: '高校卒' },
                { value: '専門学校卒', label: '専門学校卒' },
                { value: '短大卒', label: '短大卒' },
                { value: '大学卒', label: '大学卒' },
                { value: '大学院卒', label: '大学院卒' },
              ]}
              placeholder="選択してください"
              {...register('education_level', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Input
              label="卒業年"
              type="number"
              placeholder="例: 2020"
              {...register('graduation_year', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
            <Input
              label="学校名"
              placeholder="例: ○○大学"
              {...register('education_school')}
            />
            <Input
              label="学部・学科"
              placeholder="例: 経済学部"
              {...register('education_faculty')}
            />
          </div>
        </Card>

        {/* Work History & Skills */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">職歴・スキル</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="現職の職種"
              placeholder="例: 営業, 製造, 事務"
              {...register('current_job_type')}
            />
            <Input
              label="現在の年収（万円）"
              type="number"
              placeholder="例: 350"
              {...register('current_annual_income', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
            <Select
              label="PCスキル"
              options={[
                { value: 'none', label: 'なし' },
                { value: 'basic', label: '基本操作' },
                { value: 'intermediate', label: 'Excel/Word活用' },
                { value: 'advanced', label: '上級（マクロ/VBA等）' },
              ]}
              placeholder="選択してください"
              {...register('pc_skill_level', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Select
              label="語学力"
              options={[
                { value: 'none', label: 'なし' },
                { value: 'daily', label: '日常会話' },
                { value: 'business', label: 'ビジネスレベル' },
                { value: 'native', label: 'ネイティブ' },
              ]}
              placeholder="選択してください"
              {...register('language_skill', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Input
              label="TOEICスコア"
              type="number"
              placeholder="例: 650"
              {...register('toeic_score', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
            <Input
              label="他社選考状況"
              placeholder="例: 2社選考中"
              {...register('other_job_hunting')}
            />
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">保有資格</label>
              <textarea
                {...register('qualifications')}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="例: 普通自動車免許, 簿記2級, フォークリフト"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">職務経歴</label>
              <textarea
                {...register('work_history')}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="これまでの職務経歴を入力..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">転職理由</label>
              <textarea
                {...register('reason_for_change')}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="転職を希望する理由..."
              />
            </div>
          </div>
        </Card>

        {/* Desired Conditions */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">希望条件</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="希望職種"
              placeholder="例: 製造, 事務, 営業"
              {...register('desired_job_type')}
            />
            <Select
              label="希望雇用形態"
              options={[
                { value: '正社員', label: '正社員' },
                { value: '契約社員', label: '契約社員' },
                { value: '派遣社員', label: '派遣社員' },
                { value: 'パート・アルバイト', label: 'パート・アルバイト' },
                { value: '業務委託', label: '業務委託' },
              ]}
              placeholder="選択してください"
              {...register('desired_employment_type', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Input
              label="希望年収（万円）"
              type="number"
              placeholder="例: 400"
              {...register('desired_annual_income', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
            <Input
              label="希望勤務地"
              placeholder="例: 東京都, 神奈川県"
              {...register('desired_work_location')}
            />
            <Select
              label="リモートワーク希望"
              options={[
                { value: 'office', label: '出社のみ' },
                { value: 'hybrid', label: 'ハイブリッド' },
                { value: 'full_remote', label: 'フルリモート' },
                { value: 'any', label: 'こだわりなし' },
              ]}
              placeholder="選択してください"
              {...register('remote_work_preference', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
          </div>
        </Card>

        {/* License & Commute */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">免許・通勤</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_car_license')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">普通自動車免許</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                {...register('has_forklift')}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-700">フォークリフト免許</span>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Select
              label="通勤手段"
              options={[
                { value: '電車', label: '電車' },
                { value: 'バス', label: 'バス' },
                { value: '自動車', label: '自動車' },
                { value: 'バイク', label: 'バイク' },
                { value: '自転車', label: '自転車' },
                { value: '徒歩', label: '徒歩' },
              ]}
              placeholder="選択してください"
              {...register('commute_method', { setValueAs: (v: string) => v === '' ? undefined : v })}
            />
            <Input
              label="通勤時間（分）"
              type="number"
              placeholder="例: 30"
              {...register('commute_time', { setValueAs: (v: string) => v === '' ? undefined : Number(v) })}
            />
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="その他の情報を入力..."
          />
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/job-seekers')}
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
