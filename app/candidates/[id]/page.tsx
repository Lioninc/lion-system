'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
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
  status: string
  current_stage: string | null
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

const tabs = [
  { id: 'summary', label: '詳細' },
  { id: 'basic', label: '基本情報' },
  { id: 'applications', label: '応募履歴' },
  { id: 'interviews', label: '面談履歴' },
  { id: 'introductions', label: '企業紹介' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '有効応募':
      return <Badge variant="success">{status}</Badge>
    case '無効応募':
      return <Badge variant="danger">{status}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{status}</Badge>
    case '就業時期が先':
      return <Badge variant="purple">{status}</Badge>
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

export default function CandidateDetailPage() {
  const params = useParams()
  const candidateId = params.id as string

  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [introductions, setIntroductions] = useState<Introduction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary')

  useEffect(() => {
    if (candidateId) {
      fetchCandidateData()
    }
  }, [candidateId])

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
      status: data.status,
      current_stage: data.current_stage,
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
        employees:employee_id (
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
          {getStatusBadge(candidate.status)}
        </div>
        <Button>編集</Button>
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
              <dt className="text-xs text-slate-500">ステータス</dt>
              <dd className="text-sm text-slate-800 mt-1">{getStatusBadge(candidate.status)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">現在のステージ</dt>
              <dd className="text-sm text-slate-800 mt-1">{candidate.current_stage || '-'}</dd>
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
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
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
            <Button size="sm">新規面談</Button>
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
    </div>
  )
}
