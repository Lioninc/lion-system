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
import { calculateAge } from '../../lib/utils'

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
  education?: string
  work_history_1?: string
  work_history_2?: string
  work_history_3?: string
  qualifications?: string
  hobbies?: string
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
  language_skill?: string
  toeic_score?: number
  has_car_license: boolean
  has_forklift: boolean
  commute_method?: string
  commute_time?: number
  other_job_hunting?: string
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
  education: z.string().optional(),
  work_history_1: z.string().optional(),
  work_history_2: z.string().optional(),
  work_history_3: z.string().optional(),
  qualifications: z.string().optional(),
  hobbies: z.string().optional(),
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
  language_skill: z.string().optional(),
  toeic_score: z.number().optional(),
  has_car_license: z.boolean(),
  has_forklift: z.boolean(),
  commute_method: z.string().optional(),
  commute_time: z.number().optional(),
  other_job_hunting: z.string().optional(),
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
      has_car_license: false,
      has_forklift: false,
    },
  })

  const hasMedicalCondition = watch('has_medical_condition')
  const birthDate = watch('birth_date')
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
      education: js.education || '',
      work_history_1: js.work_history_1 || '',
      work_history_2: js.work_history_2 || '',
      work_history_3: js.work_history_3 || '',
      qualifications: js.qualifications || '',
      hobbies: js.hobbies || '',
      education_level: js.education_level || undefined,
      education_school: js.education_school || '',
      education_faculty: js.education_faculty || '',
      graduation_year: js.graduation_year || undefined,
      work_history: js.work_history || '',
      current_job_type: js.current_job_type || '',
      reason_for_change: js.reason_for_change || '',
      current_annual_income: js.current_annual_income || undefined,
      desired_annual_income: js.desired_annual_income || undefined,
      desired_job_type: js.desired_job_type || '',
      desired_employment_type: js.desired_employment_type || undefined,
      desired_work_location: js.desired_work_location || '',
      remote_work_preference: js.remote_work_preference || undefined,
      pc_skill_level: js.pc_skill_level || undefined,
      language_skill: js.language_skill || undefined,
      toeic_score: js.toeic_score || undefined,
      has_car_license: js.has_car_license || false,
      has_forklift: js.has_forklift || false,
      commute_method: js.commute_method || undefined,
      commute_time: js.commute_time || undefined,
      other_job_hunting: js.other_job_hunting || '',
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
        education: data.education || null,
        work_history_1: data.work_history_1 || null,
        work_history_2: data.work_history_2 || null,
        work_history_3: data.work_history_3 || null,
        qualifications: data.qualifications || null,
        hobbies: data.hobbies || null,
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
        language_skill: data.language_skill || null,
        toeic_score: data.toeic_score || null,
        has_car_license: data.has_car_license,
        has_forklift: data.has_forklift,
        commute_method: data.commute_method || null,
        commute_time: data.commute_time || null,
        other_job_hunting: data.other_job_hunting || null,
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
