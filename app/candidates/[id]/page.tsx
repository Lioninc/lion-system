'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Candidate {
  id: string
  name: string
  furigana: string | null
  gender: string | null
  birth_date: string | null
  age: number | null
  phone: string | null
  phone_2: string | null
  email: string | null
  line_id: string | null
  postal_code: string | null
  address: string | null
  nearest_station: string | null
  preferred_job: string | null
  preferred_location: string | null
  preferred_salary_min: number | null
  preferred_salary_max: number | null
  available_date: string | null
  height: number | null
  weight: number | null
  tattoo: string | null
  disability_certificate: string | null
  medical_condition: string | null
  has_spouse: boolean | null
  has_children: boolean | null
  stage: string
  stage_reason: string | null
  notes: string | null
  staff_id: string | null
  employee_name: string | null
}

interface Application {
  id: string
  application_date: string
  source: string
  status: string
  job_article: string | null
  notes: string | null
}

interface Interview {
  id: string
  interview_date: string
  interview_time: string | null
  interview_type: string | null
  result: string | null
  notes: string | null
  employee_name: string | null
}

interface Introduction {
  id: string
  introduced_date: string
  status: string
  interview_date: string | null
  hire_date: string | null
  fee_amount: number | null
  notes: string | null
  company_name: string | null
  job_title: string | null
}

interface Employee {
  id: string
  name: string
}

interface Company {
  id: string
  name: string
}

interface Source {
  id: string
  name: string
}

const interviewTypeOptions = [
  { value: '', label: '選択してください' },
  { value: '対面', label: '対面' },
  { value: '電話', label: '電話' },
  { value: 'Web', label: 'Web' },
]

const resultOptions = [
  { value: '', label: '選択してください' },
  { value: '未実施', label: '未実施' },
  { value: '繋ぎ', label: '繋ぎ' },
  { value: '繋げず', label: '繋げず' },
]

const applicationStatusOptions = [
  { value: '', label: '選択してください' },
  { value: '有効応募', label: '有効応募' },
  { value: '無効応募', label: '無効応募' },
]

const tabs = [
  { id: 'summary', label: '詳細' },
  { id: 'basic', label: '基本情報' },
  { id: 'applications', label: '応募履歴' },
  { id: 'interviews', label: '面談履歴' },
  { id: 'introductions', label: '企業紹介' },
]

function getStageBadge(stage: string) {
  switch (stage) {
    case '新規':
      return <Badge variant="info">{stage}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{stage}</Badge>
    case '連絡済み':
      return <Badge variant="info">{stage}</Badge>
    case '面談予定':
    case '面談済み':
      return <Badge variant="purple">{stage}</Badge>
    case '紹介済み':
    case '面接予定':
    case '面接済み':
      return <Badge variant="info">{stage}</Badge>
    case '採用決定':
    case '稼働中':
      return <Badge variant="success">{stage}</Badge>
    case '保留':
    case '就業時期が先':
      return <Badge variant="warning">{stage}</Badge>
    case '不採用':
    case '辞退':
    case '飛び':
    case 'NG':
      return <Badge variant="danger">{stage}</Badge>
    default:
      return <Badge>{stage}</Badge>
  }
}

function getApplicationStatusBadge(status: string) {
  switch (status) {
    case '有効応募':
      return <Badge variant="success">{status}</Badge>
    case '無効応募':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getResultBadge(result: string | null) {
  if (!result) return <Badge>-</Badge>
  switch (result) {
    case '繋ぎ':
      return <Badge variant="success">{result}</Badge>
    case '繋げず':
      return <Badge variant="danger">{result}</Badge>
    default:
      return <Badge>{result}</Badge>
  }
}

function getIntroductionStatusBadge(status: string) {
  switch (status) {
    case '採用':
      return <Badge variant="success">{status}</Badge>
    case '面接予定':
      return <Badge variant="info">{status}</Badge>
    case '面接済':
      return <Badge variant="purple">{status}</Badge>
    case '不採用':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function calculateBMI(height: number | null, weight: number | null): string {
  if (!height || !weight) return '-'
  const heightInMeters = height / 100
  const bmi = weight / (heightInMeters * heightInMeters)
  return bmi.toFixed(1)
}

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [introductions, setIntroductions] = useState<Introduction[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [interviewFormData, setInterviewFormData] = useState({
    interview_date: '',
    interview_time: '',
    interview_type: '',
    interviewer_id: '',
    result: '',
    referred_company_id: '',
    notes: '',
  })
  // 再応募モーダル
  const [showApplicationModal, setShowApplicationModal] = useState(false)
  const [applicationFormData, setApplicationFormData] = useState({
    application_date: new Date().toISOString().split('T')[0],
    source: '',
    job_article: '',
    status: '有効応募',
    notes: '',
  })

  useEffect(() => {
    if (candidateId) {
      fetchCandidateData()
      fetchEmployees()
      fetchCompanies()
      fetchSources()
    }
  }, [candidateId])

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

  async function fetchCompanies() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching companies:', error)
      return
    }

    setCompanies(data || [])
  }

  async function fetchSources() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sources')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching sources:', error)
      return
    }

    setSources(data || [])
  }

  async function fetchCandidateData() {
    const supabase = createClient()

    // 求職者情報を取得
    const { data: candidateData, error: candidateError } = await supabase
      .from('candidates')
      .select(`
        *,
        employees:staff_id (
          name
        )
      `)
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidateData) {
      console.error('Error fetching candidate:', candidateError)
      setLoading(false)
      return
    }

    const data = candidateData as any
    setCandidate({
      id: data.id,
      name: data.name,
      furigana: data.furigana,
      gender: data.gender,
      birth_date: data.birth_date,
      age: data.age,
      phone: data.phone,
      phone_2: data.phone_2,
      email: data.email,
      line_id: data.line_id,
      postal_code: data.postal_code,
      address: data.address,
      nearest_station: data.nearest_station,
      preferred_job: data.preferred_job,
      preferred_location: data.preferred_location,
      preferred_salary_min: data.preferred_salary_min,
      preferred_salary_max: data.preferred_salary_max,
      available_date: data.available_date,
      height: data.height,
      weight: data.weight,
      tattoo: data.tattoo,
      disability_certificate: data.disability_certificate,
      medical_condition: data.medical_condition,
      has_spouse: data.has_spouse,
      has_children: data.has_children,
      stage: data.stage,
      stage_reason: data.stage_reason,
      notes: data.notes,
      staff_id: data.staff_id,
      employee_name: data.employees?.name || null,
    })

    // 応募履歴を取得
    const { data: applicationsData } = await supabase
      .from('applications')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('application_date', { ascending: false })

    setApplications(applicationsData || [])

    // 面談履歴を取得
    const { data: interviewsData } = await supabase
      .from('interviews')
      .select(`
        *,
        employees:interviewer_id (
          name
        )
      `)
      .eq('candidate_id', candidateId)
      .order('interview_date', { ascending: false })

    setInterviews((interviewsData || []).map((i: any) => ({
      ...i,
      employee_name: i.employees?.name || null,
    })))

    // 企業紹介履歴を取得
    const { data: introductionsData } = await supabase
      .from('introductions')
      .select(`
        *,
        companies:company_id (
          name
        ),
        jobs:job_id (
          title
        )
      `)
      .eq('candidate_id', candidateId)
      .order('introduced_date', { ascending: false })

    setIntroductions((introductionsData || []).map((i: any) => ({
      ...i,
      company_name: i.companies?.name || null,
      job_title: i.jobs?.title || null,
    })))

    setLoading(false)
  }

  function handleOpenInterviewModal() {
    setInterviewFormData({
      interview_date: '',
      interview_time: '',
      interview_type: '',
      interviewer_id: '',
      result: '',
      referred_company_id: '',
      notes: '',
    })
    setShowInterviewModal(true)
  }

  function handleCloseInterviewModal() {
    setShowInterviewModal(false)
  }

  async function handleInterviewSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const payload = {
      candidate_id: candidateId,
      interview_date: interviewFormData.interview_date,
      interview_time: interviewFormData.interview_time || null,
      interview_type: interviewFormData.interview_type || null,
      interviewer_id: interviewFormData.interviewer_id || null,
      result: interviewFormData.result || null,
      referred_company_id: interviewFormData.referred_company_id || null,
      notes: interviewFormData.notes || null,
    }

    const { error } = await (supabase
      .from('interviews') as any)
      .insert(payload)

    if (error) {
      console.error('Error creating interview:', error)
      alert('登録に失敗しました')
      return
    }

    handleCloseInterviewModal()
    // 面談履歴を再取得
    const { data: interviewsData } = await supabase
      .from('interviews')
      .select(`
        *,
        employees:interviewer_id (
          name
        )
      `)
      .eq('candidate_id', candidateId)
      .order('interview_date', { ascending: false })

    setInterviews((interviewsData || []).map((i: any) => ({
      ...i,
      employee_name: i.employees?.name || null,
    })))
  }

  // 再応募モーダル
  function handleOpenApplicationModal() {
    setApplicationFormData({
      application_date: new Date().toISOString().split('T')[0],
      source: '',
      job_article: '',
      status: '有効応募',
      notes: '',
    })
    setShowApplicationModal(true)
  }

  function handleCloseApplicationModal() {
    setShowApplicationModal(false)
  }

  async function handleApplicationSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    // 既存の応募から最大のapplication_numberを取得
    const { data: existingApps } = await supabase
      .from('applications')
      .select('application_number')
      .eq('candidate_id', candidateId)
      .order('application_number', { ascending: false })
      .limit(1)

    const apps = existingApps as { application_number: number }[] | null
    const maxNumber = (apps && apps.length > 0 && apps[0].application_number)
      ? apps[0].application_number
      : 0
    const newNumber = maxNumber + 1

    // 新しい応募を登録
    const payload = {
      candidate_id: candidateId,
      application_number: newNumber,
      application_date: applicationFormData.application_date,
      source: applicationFormData.source,
      job_article: applicationFormData.job_article || null,
      status: applicationFormData.status || '有効応募',
      notes: applicationFormData.notes || null,
    }

    const { error } = await (supabase.from('applications') as any).insert(payload)

    if (error) {
      console.error('Error creating application:', error)
      alert('登録に失敗しました')
      return
    }

    // ステージを「新規」に更新（アタックリストに出るように）、応募日も更新、最終連絡日もリセット
    await (supabase.from('candidates') as any)
      .update({
        stage: '新規',
        contact_count: 0,
        application_date: applicationFormData.application_date,
        last_contact_date: null
      })
      .eq('id', candidateId)

    handleCloseApplicationModal()

    // 応募履歴を再取得
    const { data: applicationsData } = await supabase
      .from('applications')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('application_date', { ascending: false })

    setApplications(applicationsData || [])

    // 求職者情報も再取得（stageが変わっているため）
    fetchCandidateData()

    // 応募履歴タブに切り替え
    setActiveTab('applications')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  if (!candidate) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">求職者が見つかりません</div>
        <div className="text-center mt-4">
          <Link href="/candidates">
            <Button variant="secondary">一覧に戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/candidates"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{candidate.name}</h1>
          {getStageBadge(candidate.stage)}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleOpenApplicationModal}>再応募登録</Button>
          <Link href={`/candidates/${candidateId}/edit`}>
            <Button>編集</Button>
          </Link>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
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

      {/* 詳細（サマリー） */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">氏名</dt>
                <dd className="text-sm text-slate-800">{candidate.name}{candidate.furigana ? `（${candidate.furigana}）` : ''}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">性別・年齢</dt>
                <dd className="text-sm text-slate-800">{candidate.gender || '-'} / {candidate.age ? `${candidate.age}歳` : '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">電話番号</dt>
                <dd className="text-sm text-slate-800">{candidate.phone || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">担当者</dt>
                <dd className="text-sm text-slate-800">{candidate.employee_name || '-'}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">希望条件</h2>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望職種</dt>
                <dd className="text-sm text-slate-800">{candidate.preferred_job || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望勤務地</dt>
                <dd className="text-sm text-slate-800">{candidate.preferred_location || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望給与</dt>
                <dd className="text-sm text-slate-800">
                  {candidate.preferred_salary_min || candidate.preferred_salary_max
                    ? `¥${candidate.preferred_salary_min?.toLocaleString() || '?'} 〜 ¥${candidate.preferred_salary_max?.toLocaleString() || '?'}`
                    : '-'}
                </dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">就業可能日</dt>
                <dd className="text-sm text-slate-800">{candidate.available_date || '-'}</dd>
              </div>
            </dl>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
            <p className="text-sm text-slate-700">{candidate.notes || '備考はありません'}</p>
          </Card>
        </div>
      )}

      {/* 基本情報 */}
      {activeTab === 'basic' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">氏名</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.name}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">ふりがな</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.furigana || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">性別</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.gender || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">生年月日</dt>
              <dd className="text-sm text-slate-800 mt-1">{formatDate(candidate.birth_date)}{candidate.age ? `（${candidate.age}歳）` : ''}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">電話番号</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.phone || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">電話番号2</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.phone_2 || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">メールアドレス</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.email || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">LINE ID</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.line_id || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">郵便番号</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.postal_code || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">最寄り駅</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.nearest_station || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded md:col-span-2">
              <dt className="text-xs text-slate-500">住所</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.address || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">身長</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.height ? `${candidate.height}cm` : '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">体重</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.weight ? `${candidate.weight}kg` : '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">BMI</dt>
              <dd className="text-sm text-slate-800 mt-1">{calculateBMI(candidate.height, candidate.weight)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">タトゥー</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.tattoo || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">障害者手帳</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.disability_certificate || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">持病</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.medical_condition || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">配偶者</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.has_spouse === true ? 'あり' : candidate.has_spouse === false ? 'なし' : '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">子供</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.has_children === true ? 'あり' : candidate.has_children === false ? 'なし' : '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">ステージ</dt>
              <dd className="text-sm text-slate-800 mt-1">{getStageBadge(candidate.stage)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">ステージ理由</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.stage_reason || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">担当者</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.employee_name || '-'}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded md:col-span-2">
              <dt className="text-xs text-slate-500">備考</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.notes || '-'}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* 応募履歴 */}
      {activeTab === 'applications' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">応募履歴</h2>
          </div>
          {applications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>応募日</TableHead>
                  <TableHead>応募媒体</TableHead>
                  <TableHead>職種</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{formatDate(app.application_date)}</TableCell>
                    <TableCell>{app.source}</TableCell>
                    <TableCell>{app.job_article || '-'}</TableCell>
                    <TableCell>{getApplicationStatusBadge(app.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">{app.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500">応募履歴はありません</div>
          )}
        </Card>
      )}

      {/* 面談履歴 */}
      {activeTab === 'interviews' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">面談履歴</h2>
            <Button size="sm" onClick={handleOpenInterviewModal}>新規面談</Button>
          </div>
          {interviews.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>種類</TableHead>
                  <TableHead>担当</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviews.map((interview) => (
                  <TableRow key={interview.id}>
                    <TableCell>{formatDate(interview.interview_date)}</TableCell>
                    <TableCell>{interview.interview_time || '-'}</TableCell>
                    <TableCell>{interview.interview_type || '-'}</TableCell>
                    <TableCell>{interview.employee_name || '-'}</TableCell>
                    <TableCell>{getResultBadge(interview.result)}</TableCell>
                    <TableCell className="max-w-xs truncate">{interview.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500">面談履歴はありません</div>
          )}
        </Card>
      )}

      {/* 企業紹介 */}
      {activeTab === 'introductions' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">企業紹介</h2>
            <Button size="sm">新規紹介</Button>
          </div>
          {introductions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>紹介日</TableHead>
                  <TableHead>企業名</TableHead>
                  <TableHead>案件</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>面接日</TableHead>
                  <TableHead>採用日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {introductions.map((intro) => (
                  <TableRow key={intro.id}>
                    <TableCell>{formatDate(intro.introduced_date)}</TableCell>
                    <TableCell>{intro.company_name || '-'}</TableCell>
                    <TableCell>{intro.job_title || '-'}</TableCell>
                    <TableCell>{getIntroductionStatusBadge(intro.status)}</TableCell>
                    <TableCell>{formatDate(intro.interview_date)}</TableCell>
                    <TableCell>{formatDate(intro.hire_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-slate-500">企業紹介履歴はありません</div>
          )}
        </Card>
      )}

      {/* 新規面談モーダル */}
      {showInterviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">新規面談登録</h2>
            <form onSubmit={handleInterviewSubmit} className="space-y-4">
              <div className="p-3 bg-slate-100 rounded">
                <span className="text-sm text-slate-500">求職者：</span>
                <span className="text-sm font-medium text-slate-800 ml-2">{candidate.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="面談日"
                  type="date"
                  value={interviewFormData.interview_date}
                  onChange={(e) => setInterviewFormData({ ...interviewFormData, interview_date: e.target.value })}
                  required
                />
                <Input
                  label="面談時間"
                  type="time"
                  value={interviewFormData.interview_time}
                  onChange={(e) => setInterviewFormData({ ...interviewFormData, interview_time: e.target.value })}
                />
              </div>
              <Select
                label="面談種類"
                options={interviewTypeOptions}
                value={interviewFormData.interview_type}
                onChange={(e) => setInterviewFormData({ ...interviewFormData, interview_type: e.target.value })}
              />
              <Select
                label="面談担当者"
                options={[
                  { value: '', label: '選択してください' },
                  ...employees.map((emp) => ({ value: emp.id, label: emp.name })),
                ]}
                value={interviewFormData.interviewer_id}
                onChange={(e) => setInterviewFormData({ ...interviewFormData, interviewer_id: e.target.value })}
              />
              <Select
                label="結果"
                options={resultOptions}
                value={interviewFormData.result}
                onChange={(e) => setInterviewFormData({ ...interviewFormData, result: e.target.value })}
              />
              <Select
                label="紹介先企業（任意）"
                options={[
                  { value: '', label: '選択してください' },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={interviewFormData.referred_company_id}
                onChange={(e) => setInterviewFormData({ ...interviewFormData, referred_company_id: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={interviewFormData.notes}
                  onChange={(e) => setInterviewFormData({ ...interviewFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseInterviewModal}>
                  キャンセル
                </Button>
                <Button type="submit">登録</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 再応募登録モーダル */}
      {showApplicationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">再応募登録</h2>
            <form onSubmit={handleApplicationSubmit} className="space-y-4">
              <div className="p-3 bg-slate-100 rounded">
                <span className="text-sm text-slate-500">求職者：</span>
                <span className="text-sm font-medium text-slate-800 ml-2">{candidate.name}</span>
              </div>
              <Input
                label="応募日"
                type="date"
                value={applicationFormData.application_date}
                onChange={(e) => setApplicationFormData({ ...applicationFormData, application_date: e.target.value })}
                required
              />
              <Select
                label="応募媒体"
                options={[
                  { value: '', label: '選択してください' },
                  ...sources.map((s) => ({ value: s.name, label: s.name })),
                ]}
                value={applicationFormData.source}
                onChange={(e) => setApplicationFormData({ ...applicationFormData, source: e.target.value })}
                required
              />
              <Input
                label="職種"
                value={applicationFormData.job_article}
                onChange={(e) => setApplicationFormData({ ...applicationFormData, job_article: e.target.value })}
                placeholder="例: 製造スタッフ"
              />
              <Select
                label="ステータス"
                options={applicationStatusOptions}
                value={applicationFormData.status}
                onChange={(e) => setApplicationFormData({ ...applicationFormData, status: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={applicationFormData.notes}
                  onChange={(e) => setApplicationFormData({ ...applicationFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="備考があれば入力"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseApplicationModal}>
                  キャンセル
                </Button>
                <Button type="submit">登録</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
