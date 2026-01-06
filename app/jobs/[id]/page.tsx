'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  title: string
  company_id: string | null
  company_name: string | null
  description: string | null
  location: string | null
  site_name: string | null
  nearest_station: string | null
  transportation: string | null
  monthly_salary: number | null
  salary_min: number | null
  salary_max: number | null
  salary_breakdown: string | null
  employment_type: string | null
  working_hours: string | null
  holidays: string | null
  requirements: string | null
  qualifications: string | null
  benefits: string | null
  job_type: string | null
  job_details: string | null
  company_pr: string | null
  gender_requirement: string | null
  age_min: number | null
  age_max: number | null
  height_min: number | null
  height_max: number | null
  waist_max: number | null
  bmi_requirement: string | null
  dormitory_available: boolean | null
  dormitory_cost: number | null
  family_dormitory: boolean | null
  couple_dormitory: boolean | null
  car_commute_ok: boolean | null
  transportation_paid: boolean | null
  shuttle_bus: boolean | null
  foreigner_ok: boolean | null
  smoking_policy: string | null
  remaining_slots: number | null
  referral_fee: number | null
  start_date: string | null
  probation_period: string | null
  probation_salary: number | null
  status: string | null
}

const tabs = [
  { id: 'basic', label: '基本情報' },
  { id: 'description', label: '求人内容' },
  { id: 'conditions', label: '勤務条件' },
  { id: 'benefits', label: '待遇・福利厚生' },
  { id: 'requirements', label: '採用要件' },
]

function getStatusBadge(status: string | null) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

function formatBoolean(value: boolean | null): string {
  if (value === true) return 'あり'
  if (value === false) return 'なし'
  return '-'
}

export default function JobDetailPage() {
  const params = useParams()
  const jobId = params.id as string
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('basic')

  useEffect(() => {
    if (jobId) {
      fetchJob()
    }
  }, [jobId])

  async function fetchJob() {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        companies:company_id (
          name
        )
      `)
      .eq('id', jobId)
      .single()

    if (error || !data) {
      console.error('Error fetching job:', error)
      setLoading(false)
      return
    }

    // Supabaseの結果を適切に型変換
    const jobData = data as Record<string, any>
    setJob({
      id: jobData.id,
      title: jobData.title,
      company_id: jobData.company_id,
      company_name: jobData.companies?.name || null,
      description: jobData.description,
      location: jobData.location,
      site_name: jobData.site_name,
      nearest_station: jobData.nearest_station,
      transportation: jobData.transportation,
      monthly_salary: jobData.monthly_salary,
      salary_min: jobData.salary_min,
      salary_max: jobData.salary_max,
      salary_breakdown: jobData.salary_breakdown,
      employment_type: jobData.employment_type,
      working_hours: jobData.working_hours,
      holidays: jobData.holidays,
      requirements: jobData.requirements,
      qualifications: jobData.qualifications,
      benefits: jobData.benefits,
      job_type: jobData.job_type,
      job_details: jobData.job_details,
      company_pr: jobData.company_pr,
      gender_requirement: jobData.gender_requirement,
      age_min: jobData.age_min,
      age_max: jobData.age_max,
      height_min: jobData.height_min,
      height_max: jobData.height_max,
      waist_max: jobData.waist_max,
      bmi_requirement: jobData.bmi_requirement,
      dormitory_available: jobData.dormitory_available,
      dormitory_cost: jobData.dormitory_cost,
      family_dormitory: jobData.family_dormitory,
      couple_dormitory: jobData.couple_dormitory,
      car_commute_ok: jobData.car_commute_ok,
      transportation_paid: jobData.transportation_paid,
      shuttle_bus: jobData.shuttle_bus,
      foreigner_ok: jobData.foreigner_ok,
      smoking_policy: jobData.smoking_policy,
      remaining_slots: jobData.remaining_slots,
      referral_fee: jobData.referral_fee,
      start_date: jobData.start_date,
      probation_period: jobData.probation_period,
      probation_salary: jobData.probation_salary,
      status: jobData.status,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">案件が見つかりません</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/jobs"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
          {getStatusBadge(job.status)}
        </div>
        <Link href={`/jobs/${jobId}/edit`}>
          <Button>編集</Button>
        </Link>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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

      {/* 基本情報 */}
      {activeTab === 'basic' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">案件名</dt>
              <dd className="text-sm text-slate-800 mt-1">{job.title}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">企業名</dt>
              <dd className="text-sm text-slate-800 mt-1">
                {job.company_id ? (
                  <Link href={`/companies/${job.company_id}`} className="text-blue-600 hover:underline">
                    {job.company_name || '-'}
                  </Link>
                ) : (
                  '-'
                )}
              </dd>
            </div>
            {job.site_name && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">現場名</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.site_name}</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">勤務地</dt>
              <dd className="text-sm text-slate-800 mt-1">{job.location || '-'}</dd>
            </div>
            {job.nearest_station && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">最寄り駅</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.nearest_station}</dd>
              </div>
            )}
            {job.transportation && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">交通手段</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.transportation}</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">給与</dt>
              <dd className="text-sm text-slate-800 mt-1">
                {job.monthly_salary ? (
                  `月収 ¥${job.monthly_salary.toLocaleString()}`
                ) : job.salary_min || job.salary_max ? (
                  job.salary_min && job.salary_max ? (
                    `¥${job.salary_min.toLocaleString()}〜¥${job.salary_max.toLocaleString()}`
                  ) : job.salary_min ? (
                    `¥${job.salary_min.toLocaleString()}〜`
                  ) : (
                    `〜¥${job.salary_max!.toLocaleString()}`
                  )
                ) : '-'}
              </dd>
            </div>
            {job.salary_breakdown && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">給与内訳</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.salary_breakdown}</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">雇用形態</dt>
              <dd className="text-sm text-slate-800 mt-1">{job.employment_type || '-'}</dd>
            </div>
            {job.job_type && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">職種</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.job_type}</dd>
              </div>
            )}
            {job.referral_fee && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">紹介料</dt>
                <dd className="text-sm text-slate-800 mt-1">¥{job.referral_fee.toLocaleString()}</dd>
              </div>
            )}
            {job.remaining_slots !== null && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">残り枠</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.remaining_slots}名</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* 求人内容 */}
      {activeTab === 'description' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">求人内容</h2>
          <div className="space-y-4">
            {job.description && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500 mb-1">仕事内容</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.description}</dd>
              </div>
            )}
            {job.job_details && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500 mb-1">仕事内容詳細</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.job_details}</dd>
              </div>
            )}
            {job.company_pr && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500 mb-1">アピールポイント</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.company_pr}</dd>
              </div>
            )}
            {!job.description && !job.job_details && !job.company_pr && (
              <p className="text-sm text-slate-500">求人内容の詳細は登録されていません</p>
            )}
          </div>
        </Card>
      )}

      {/* 勤務条件 */}
      {activeTab === 'conditions' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">勤務条件</h2>
          <dl className="space-y-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">勤務時間</dt>
              <dd className="text-sm text-slate-800 mt-1">{job.working_hours || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">休日</dt>
              <dd className="text-sm text-slate-800 mt-1">{job.holidays || '-'}</dd>
            </div>
            {job.start_date && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">赴任日</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.start_date}</dd>
              </div>
            )}
            {job.probation_period && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">見習い期間</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.probation_period}</dd>
              </div>
            )}
            {job.probation_salary !== null && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">見習い給与</dt>
                <dd className="text-sm text-slate-800 mt-1">¥{job.probation_salary.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* 待遇・福利厚生 */}
      {activeTab === 'benefits' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">待遇・福利厚生</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.benefits && (
              <div className="p-3 bg-slate-50 rounded md:col-span-2">
                <dt className="text-xs text-slate-500 mb-1">福利厚生</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.benefits}</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">寮</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.dormitory_available)}</dd>
            </div>
            {job.dormitory_cost !== null && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">寮費</dt>
                <dd className="text-sm text-slate-800 mt-1">¥{job.dormitory_cost.toLocaleString()}/月</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">家族寮</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.family_dormitory)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">カップル寮</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.couple_dormitory)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">車通勤</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.car_commute_ok)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">交通費支給</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.transportation_paid)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">送迎バス</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.shuttle_bus)}</dd>
            </div>
            {job.smoking_policy && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">喫煙</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.smoking_policy}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* 採用要件 */}
      {activeTab === 'requirements' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">採用要件</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {job.requirements && (
              <div className="p-3 bg-slate-50 rounded md:col-span-2">
                <dt className="text-xs text-slate-500 mb-1">必須条件</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.requirements}</dd>
              </div>
            )}
            {job.qualifications && (
              <div className="p-3 bg-slate-50 rounded md:col-span-2">
                <dt className="text-xs text-slate-500 mb-1">応募資格</dt>
                <dd className="text-sm text-slate-700 whitespace-pre-line">{job.qualifications}</dd>
              </div>
            )}
            {job.gender_requirement && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">性別</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.gender_requirement}</dd>
              </div>
            )}
            {(job.age_min !== null || job.age_max !== null) && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">年齢</dt>
                <dd className="text-sm text-slate-800 mt-1">
                  {job.age_min && job.age_max ? (
                    `${job.age_min}歳〜${job.age_max}歳`
                  ) : job.age_min ? (
                    `${job.age_min}歳以上`
                  ) : (
                    `${job.age_max}歳以下`
                  )}
                </dd>
              </div>
            )}
            {(job.height_min !== null || job.height_max !== null) && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">身長</dt>
                <dd className="text-sm text-slate-800 mt-1">
                  {job.height_min && job.height_max ? (
                    `${job.height_min}cm〜${job.height_max}cm`
                  ) : job.height_min ? (
                    `${job.height_min}cm以上`
                  ) : (
                    `${job.height_max}cm以下`
                  )}
                </dd>
              </div>
            )}
            {job.waist_max !== null && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">ウエスト</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.waist_max}cm以下</dd>
              </div>
            )}
            {job.bmi_requirement && (
              <div className="p-3 bg-slate-50 rounded">
                <dt className="text-xs text-slate-500">BMI</dt>
                <dd className="text-sm text-slate-800 mt-1">{job.bmi_requirement}</dd>
              </div>
            )}
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">外国籍</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatBoolean(job.foreigner_ok)}</dd>
            </div>
          </dl>
        </Card>
      )}
    </div>
  )
}
