import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Plus,
  ChevronRight,
  MessageSquare,
  Briefcase,
  ClipboardList,
  FileText,
} from 'lucide-react'
import { Card, Button, Badge, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { formatDate, formatDateTime, calculateAge } from '../../lib/utils'
import type {
  Application,
  JobSeeker,
  ContactLog,
  Referral,
  Interview,
  ApplicationStatus,
  ProgressStatus,
} from '../../types/database'
import {
  APPLICATION_STATUS_LABELS,
  PROGRESS_STATUS_LABELS,
  CONTACT_RESULT_LABELS,
  INTERVIEW_RESULT_LABELS,
  type ContactResult,
  type InterviewResult,
} from '../../types/database'

type TabType = 'info' | 'contacts' | 'interviews' | 'referrals'

interface ApplicationDetail extends Omit<Application, 'source' | 'coordinator'> {
  job_seeker: JobSeeker
  contact_logs: ContactLog[]
  interviews: Interview[]
  referrals: (Referral & {
    job: {
      id: string
      title: string
      company: {
        name: string
      }
    }
  })[]
  coordinator: {
    id: string
    name: string
  } | null
  source: {
    id: string
    name: string
  } | null
}

// 同じ電話番号の全応募履歴用
interface ApplicationHistory {
  id: string
  applied_at: string
  application_status: ApplicationStatus
  job_type: string | null
  source: { name: string } | null
  coordinator: { name: string } | null
}

export function JobSeekerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [showContactModal, setShowContactModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)
  const [showContactDetailModal, setShowContactDetailModal] = useState(false)
  const [selectedContactLog, setSelectedContactLog] = useState<ContactLog | null>(null)
  const [coordinators, setCoordinators] = useState<{ value: string; label: string }[]>([])
  const [allApplications, setAllApplications] = useState<ApplicationHistory[]>([])

  useEffect(() => {
    if (id) {
      fetchApplication()
      fetchCoordinators()
    }
  }, [id])

  // application取得後に同じ電話番号の全応募を取得
  useEffect(() => {
    if (application?.job_seeker?.phone) {
      fetchAllApplications(application.job_seeker.phone)
    }
  }, [application?.job_seeker?.phone])

  async function fetchApplication() {
    setLoading(true)

    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        job_seeker:job_seekers (*),
        contact_logs (*),
        interviews (*),
        referrals (
          *,
          job:jobs (
            id,
            title,
            company:companies (
              name
            )
          )
        ),
        coordinator:users!applications_coordinator_id_fkey (
          id,
          name
        ),
        source:sources (
          id,
          name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching application:', error)
      navigate('/job-seekers')
      return
    }

    setApplication(data as unknown as ApplicationDetail)
    setLoading(false)
  }

  async function fetchCoordinators() {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .order('name')

    if (data) {
      setCoordinators(data.map((u) => ({ value: u.id, label: u.name })))
    }
  }

  // 同じ電話番号の求職者の全応募を取得
  async function fetchAllApplications(phone: string) {
    // 同じ電話番号の求職者IDを全て取得
    const { data: jobSeekers } = await supabase
      .from('job_seekers')
      .select('id')
      .eq('phone', phone)

    if (!jobSeekers || jobSeekers.length === 0) return

    const jobSeekerIds = jobSeekers.map((js) => js.id)

    // 全応募を取得
    const { data: applications } = await supabase
      .from('applications')
      .select(`
        id,
        applied_at,
        application_status,
        job_type,
        source:sources (name),
        coordinator:users!applications_coordinator_id_fkey (name)
      `)
      .in('job_seeker_id', jobSeekerIds)
      .order('applied_at', { ascending: false })

    if (applications) {
      setAllApplications(applications as unknown as ApplicationHistory[])
    }
  }

  async function updateApplicationStatus(status: ApplicationStatus) {
    if (!application) return

    const { error } = await supabase
      .from('applications')
      .update({ application_status: status })
      .eq('id', application.id)

    if (!error) {
      setApplication({ ...application, application_status: status })
    }
    setShowStatusModal(false)
  }

  async function updateProgressStatus(status: ProgressStatus | null) {
    if (!application) return

    const { error } = await supabase
      .from('applications')
      .update({ progress_status: status })
      .eq('id', application.id)

    if (!error) {
      setApplication({ ...application, progress_status: status })
    }
  }

  async function updateCoordinator(coordinatorId: string) {
    if (!application) return

    const { error } = await supabase
      .from('applications')
      .update({ coordinator_id: coordinatorId || null })
      .eq('id', application.id)

    if (!error) {
      const coordinator = coordinators.find((c) => c.value === coordinatorId)
      setApplication({
        ...application,
        coordinator_id: coordinatorId || null,
        coordinator: coordinator ? { id: coordinatorId, name: coordinator.label } : null,
      })
    }
  }

  async function updateInterviewer(interviewerId: string) {
    if (!application) return

    // 最新の面談レコードを取得
    const latestInterview = application.interviews
      ?.slice()
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0]

    if (!latestInterview) return

    const { error } = await supabase
      .from('interviews')
      .update({ interviewer_id: interviewerId || null })
      .eq('id', latestInterview.id)

    if (!error) {
      const updatedInterviews = application.interviews.map((iv) =>
        iv.id === latestInterview.id
          ? { ...iv, interviewer_id: interviewerId || null }
          : iv
      )
      setApplication({ ...application, interviews: updatedInterviews })
    }
  }

  // 最新面談の担当者IDを取得
  function getLatestInterviewerId(): string {
    if (!application?.interviews?.length) return ''
    const sorted = [...application.interviews].sort(
      (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
    )
    return sorted[0]?.interviewer_id || ''
  }

  function getStatusBadgeVariant(status: ApplicationStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'new': return 'info'
      case 'valid': return 'success'
      case 'invalid': return 'danger'
      case 'no_answer': return 'warning'
      case 'connected': return 'purple'
      case 'working': return 'success'
      case 'completed': return 'default'
      default: return 'default'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!application) {
    return null
  }

  const { job_seeker } = application

  // 「直電」の場合はname_kanaを表示名として使用
  const displayName = job_seeker.name === '直電' && job_seeker.name_kana ? job_seeker.name_kana : job_seeker.name

  const tabs = [
    { id: 'info' as const, label: '基本情報', icon: User },
    { id: 'contacts' as const, label: '対応履歴', icon: MessageSquare },
    { id: 'interviews' as const, label: '面談記録', icon: ClipboardList },
    { id: 'referrals' as const, label: '紹介履歴', icon: Briefcase },
  ]

  return (
    <div>
      <Header
        title={displayName}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowContactModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              対応記録
            </Button>
            <Button onClick={() => navigate(`/job-seekers/${id}/edit`)}>
              <Edit2 className="w-4 h-4 mr-2" />
              編集
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status and Info Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Card */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">応募ステータス</span>
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="flex items-center gap-1 hover:opacity-80"
                >
                  <Badge variant={getStatusBadgeVariant(application.application_status)}>
                    {APPLICATION_STATUS_LABELS[application.application_status]}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">進捗ステータス</span>
                <Select
                  options={Object.entries(PROGRESS_STATUS_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  placeholder="未設定"
                  value={application.progress_status || ''}
                  onChange={(e) => updateProgressStatus(e.target.value as ProgressStatus || null)}
                  className="w-40 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">応募担当者</span>
                <Select
                  options={coordinators}
                  placeholder="未設定"
                  value={application.coordinator?.id || ''}
                  onChange={(e) => updateCoordinator(e.target.value)}
                  className="w-40 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">面談担当者</span>
                {application.interviews?.length > 0 ? (
                  <Select
                    options={coordinators}
                    placeholder="未設定"
                    value={getLatestInterviewerId()}
                    onChange={(e) => updateInterviewer(e.target.value)}
                    className="w-40 text-sm"
                  />
                ) : (
                  <span className="text-sm text-slate-400">-</span>
                )}
              </div>
            </div>
          </Card>

          {/* Contact Info Card */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4" />
                <a href={`tel:${job_seeker.phone}`} className="hover:text-primary">
                  {job_seeker.phone}
                </a>
              </div>
              {job_seeker.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${job_seeker.email}`} className="hover:text-primary">
                    {job_seeker.email}
                  </a>
                </div>
              )}
              {job_seeker.prefecture && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{job_seeker.prefecture}{job_seeker.city}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Application Info Card */}
          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">応募日</span>
                <span className="text-slate-700">{formatDate(application.applied_at)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">流入元</span>
                <span className="text-slate-700">{application.source?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">対応回数</span>
                <span className="text-slate-700">{application.contact_logs?.length || 0}回</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">個人情報</h3>
              <div className="space-y-3">
                <InfoRow label="氏名" value={displayName} />
                <InfoRow label="氏名（カナ）" value={job_seeker.name_kana} />
                {job_seeker.name === '直電' && (
                  <InfoRow label="元データ名" value="直電" />
                )}
                <InfoRow label="生年月日" value={job_seeker.birth_date ? `${formatDate(job_seeker.birth_date)}（${calculateAge(job_seeker.birth_date)}歳）` : null} />
                <InfoRow label="性別" value={
                  job_seeker.gender === 'male' ? '男性' :
                  job_seeker.gender === 'female' ? '女性' :
                  job_seeker.gender === 'other' ? 'その他' : null
                } />
                <InfoRow label="LINE ID" value={job_seeker.line_id} />
              </div>
            </Card>

            {/* Address */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">住所</h3>
              <div className="space-y-3">
                <InfoRow label="郵便番号" value={job_seeker.postal_code} />
                <InfoRow label="都道府県" value={job_seeker.prefecture} />
                <InfoRow label="市区町村" value={job_seeker.city} />
                <InfoRow label="番地・建物名" value={job_seeker.address} />
              </div>
            </Card>

            {/* Physical Info */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">身体情報</h3>
              <div className="space-y-3">
                <InfoRow label="身長" value={job_seeker.height ? `${job_seeker.height}cm` : null} />
                <InfoRow label="体重" value={job_seeker.weight ? `${job_seeker.weight}kg` : null} />
                <InfoRow label="タトゥー" value={job_seeker.has_tattoo ? 'あり' : 'なし'} />
                <InfoRow label="持病" value={job_seeker.has_medical_condition ? 'あり' : 'なし'} />
                {job_seeker.has_medical_condition && job_seeker.medical_condition_detail && (
                  <InfoRow label="持病の詳細" value={job_seeker.medical_condition_detail} />
                )}
              </div>
            </Card>

            {/* Employment Status */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">就業状況</h3>
              <div className="space-y-3">
                <InfoRow label="配偶者" value={job_seeker.has_spouse ? 'あり' : 'なし'} />
                <InfoRow label="子供" value={job_seeker.has_children ? 'あり' : 'なし'} />
                <InfoRow label="現在の就業状況" value={
                  job_seeker.employment_status === 'unemployed' ? '無職' :
                  job_seeker.employment_status === 'employed' ? '就業中' : null
                } />
                <InfoRow label="希望開始日" value={job_seeker.desired_start_date ? formatDate(job_seeker.desired_start_date) : null} />
                <InfoRow label="希望期間" value={job_seeker.desired_period} />
              </div>
            </Card>

            {/* Notes */}
            {job_seeker.notes && (
              <Card className="lg:col-span-2">
                <h3 className="font-semibold text-slate-800 mb-4">備考</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{job_seeker.notes}</p>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-6">
            {/* 応募履歴セクション */}
            {allApplications.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">応募履歴（{allApplications.length}回）</h3>
                </div>
                <div className="space-y-2">
                  {allApplications.map((app, index) => (
                    <div
                      key={app.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        app.id === id
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-slate-50 hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        if (app.id !== id) {
                          window.location.href = `/job-seekers/${app.id}`
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500 w-8">
                          #{allApplications.length - index}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-700">
                              {formatDate(app.applied_at)}
                            </span>
                            {app.source?.name && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                {app.source.name}
                              </span>
                            )}
                            {app.job_type && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                {app.job_type}
                              </span>
                            )}
                            {app.id === id && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                現在表示中
                              </span>
                            )}
                          </div>
                          {app.coordinator?.name && (
                            <p className="text-xs text-slate-500 mt-0.5">担当: {app.coordinator.name}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(app.application_status)}>
                        {APPLICATION_STATUS_LABELS[app.application_status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 対応履歴セクション */}
            <Card padding="none">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">対応履歴</h3>
                <Button size="sm" onClick={() => setShowContactModal(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  追加
                </Button>
              </div>
            {application.contact_logs && application.contact_logs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {application.contact_logs
                  .sort((a, b) => new Date(b.contacted_at).getTime() - new Date(a.contacted_at).getTime())
                  .map((log) => {
                    const linkedInterview = application.interviews?.find(
                      (i) => i.contact_log_id === log.id
                    )
                    return (
                      <div
                        key={log.id}
                        className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedContactLog(log)
                          setShowContactDetailModal(true)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={log.direction === 'outbound' ? 'info' : 'purple'}>
                                {log.direction === 'outbound' ? '発信' : '着信'}
                              </Badge>
                              <Badge variant="default">
                                {log.contact_type === 'phone' ? '電話' :
                                 log.contact_type === 'email' ? 'メール' :
                                 log.contact_type === 'line' ? 'LINE' : 'その他'}
                              </Badge>
                              {log.result && (
                                <Badge variant={log.result === 'connected' ? 'success' : 'warning'}>
                                  {CONTACT_RESULT_LABELS[log.result as ContactResult] || log.result}
                                </Badge>
                              )}
                              {linkedInterview && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  → 面談予定: {new Date(linkedInterview.scheduled_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                                  {' '}
                                  {new Date(linkedInterview.scheduled_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="mt-2 text-sm text-slate-600 line-clamp-1">{log.notes}</p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm text-slate-500">{formatDateTime(log.contacted_at)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                対応履歴はありません
              </div>
            )}
          </Card>
          </div>
        )}

        {activeTab === 'interviews' && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">面談記録</h3>
              {application.interviews && application.interviews.some((i) => !i.conducted_at) && (
                <Button size="sm" onClick={() => {
                  const pending = application.interviews?.find((i) => !i.conducted_at)
                  if (pending) {
                    setSelectedInterview(pending)
                    setShowInterviewModal(true)
                  }
                }}>
                  <Plus className="w-4 h-4 mr-1" />
                  面談記録を追加
                </Button>
              )}
            </div>
            {application.interviews && application.interviews.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {application.interviews
                  .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
                  .map((interview) => (
                    <div key={interview.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {interview.conducted_at ? (
                              <Badge variant="success">実施済み</Badge>
                            ) : (
                              <Badge variant="info">予定</Badge>
                            )}
                            {interview.result && (
                              <Badge variant={interview.result === 'connected' ? 'success' : interview.result === 'not_connected' ? 'danger' : 'warning'}>
                                {INTERVIEW_RESULT_LABELS[interview.result as InterviewResult] || interview.result}
                              </Badge>
                            )}
                            {interview.eval_hearing && interview.eval_proposal && interview.eval_closing && interview.eval_impression && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                評価: {(interview.eval_hearing || 0) + (interview.eval_proposal || 0) + (interview.eval_closing || 0) + (interview.eval_impression || 0)}/20点
                              </span>
                            )}
                          </div>
                          {interview.eval_comment && (
                            <p className="mt-1 text-sm text-slate-600">{interview.eval_comment}</p>
                          )}
                          {interview.transcript && (
                            <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500">
                              <span className="font-medium">文字起こし:</span>
                              <p className="mt-1 whitespace-pre-wrap line-clamp-3">{interview.transcript}</p>
                            </div>
                          )}
                          {(interview.eval_hearing || interview.eval_proposal || interview.eval_closing || interview.eval_impression) && (
                            <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
                              {interview.eval_hearing && <span>ヒアリング: {interview.eval_hearing}</span>}
                              {interview.eval_proposal && <span>提案: {interview.eval_proposal}</span>}
                              {interview.eval_closing && <span>クロージング: {interview.eval_closing}</span>}
                              {interview.eval_impression && <span>印象: {interview.eval_impression}</span>}
                            </div>
                          )}
                          {!interview.conducted_at && (
                            <button
                              className="mt-2 text-xs text-primary hover:underline"
                              onClick={() => {
                                setSelectedInterview(interview)
                                setShowInterviewModal(true)
                              }}
                            >
                              面談記録を入力する →
                            </button>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm text-slate-500">
                            {interview.conducted_at ? formatDateTime(interview.conducted_at) : formatDateTime(interview.scheduled_at)}
                          </p>
                          {!interview.conducted_at && (
                            <p className="text-xs text-blue-500">予定</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                面談予定はありません。<br />
                <span className="text-xs">対応記録で「繋がった」を選択すると面談予定を設定できます。</span>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'referrals' && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">紹介履歴</h3>
              <Button size="sm" onClick={() => navigate(`/referrals/new?application=${application.id}`)}>
                <Plus className="w-4 h-4 mr-1" />
                紹介を追加
              </Button>
            </div>
            {application.referrals && application.referrals.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {application.referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/referrals/${referral.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{referral.job?.title}</p>
                        <p className="text-sm text-slate-500">{referral.job?.company?.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge>{referral.referral_status}</Badge>
                        <p className="text-sm text-slate-500 mt-1">
                          {formatDate(referral.referred_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                紹介履歴はありません
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <Modal onClose={() => setShowStatusModal(false)} title="ステータス変更">
          <div className="space-y-2">
            {Object.entries(APPLICATION_STATUS_LABELS).map(([status, label]) => (
              <button
                key={status}
                onClick={() => updateApplicationStatus(status as ApplicationStatus)}
                className={`w-full px-4 py-3 text-left rounded-lg transition-colors ${
                  application.application_status === status
                    ? 'bg-primary text-white'
                    : 'hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Contact Log Modal */}
      {showContactModal && (
        <ContactLogModal
          applicationId={application.id}
          onClose={() => setShowContactModal(false)}
          onSave={() => {
            setShowContactModal(false)
            fetchApplication()
          }}
        />
      )}

      {/* Interview Record Modal */}
      {showInterviewModal && selectedInterview && (
        <InterviewRecordModal
          interview={selectedInterview}
          applicationId={application.id}
          onClose={() => {
            setShowInterviewModal(false)
            setSelectedInterview(null)
          }}
          onSave={() => {
            setShowInterviewModal(false)
            setSelectedInterview(null)
            fetchApplication()
          }}
        />
      )}

      {/* Contact Detail Modal */}
      {showContactDetailModal && selectedContactLog && (
        <ContactDetailModal
          contactLog={selectedContactLog}
          linkedInterview={application.interviews?.find(
            (i) => i.contact_log_id === selectedContactLog.id
          ) || null}
          onClose={() => {
            setShowContactDetailModal(false)
            setSelectedContactLog(null)
          }}
        />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{value || '-'}</span>
    </div>
  )
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function ContactLogModal({
  applicationId,
  onClose,
  onSave,
}: {
  applicationId: string
  onClose: () => void
  onSave: () => void
}) {
  const { user } = useAuthStore()
  const [contactType, setContactType] = useState('phone')
  const [direction, setDirection] = useState('outbound')
  const [result, setResult] = useState('')
  const [notes, setNotes] = useState('')
  const [interviewDate, setInterviewDate] = useState('')
  const [interviewTime, setInterviewTime] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return

    setSaving(true)

    // 対応記録を保存
    const { data: contactLog, error } = await supabase.from('contact_logs').insert({
      application_id: applicationId,
      contact_type: contactType,
      direction: direction,
      result: result || null,
      notes: notes || null,
      contacted_by: user.id,
      contacted_at: new Date().toISOString(),
    }).select().single()

    if (error) {
      console.error('Error creating contact log:', error)
      alert('保存に失敗しました')
      setSaving(false)
      return
    }

    // 繋がった + 面談予定日時があれば面談予定を作成
    if (result === 'connected' && interviewDate && interviewTime) {
      const scheduledAt = new Date(`${interviewDate}T${interviewTime}`).toISOString()

      const { error: interviewError } = await supabase.from('interviews').insert({
        application_id: applicationId,
        contact_log_id: contactLog.id,
        interview_type: 'phone',
        scheduled_at: scheduledAt,
        interviewer_id: user.id,
      })

      if (interviewError) {
        console.error('Error creating interview:', interviewError)
      }

      // 進捗ステータスを「電話面談予約済み」に更新
      await supabase
        .from('applications')
        .update({ progress_status: 'phone_interview_scheduled' })
        .eq('id', applicationId)
    }

    onSave()
    setSaving(false)
  }

  const RESULT_OPTIONS = [
    { value: '', label: '選択してください' },
    { value: 'connected', label: '繋がった' },
    { value: 'absent', label: '不在' },
    { value: 'callback', label: '折り返し依頼' },
    { value: 'voicemail', label: '留守電' },
    { value: 'other', label: 'その他' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">対応記録を追加</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="連絡方法"
              options={[
                { value: 'phone', label: '電話' },
                { value: 'line', label: 'LINE' },
                { value: 'email', label: 'メール' },
                { value: 'other', label: 'その他' },
              ]}
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
            />
            <Select
              label="方向"
              options={[
                { value: 'outbound', label: '発信（こちらから）' },
                { value: 'inbound', label: '着信（先方から）' },
              ]}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            />
          </div>

          <Select
            label="結果"
            options={RESULT_OPTIONS}
            value={result}
            onChange={(e) => setResult(e.target.value)}
          />

          {result === 'connected' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
              <p className="text-sm font-medium text-blue-800">面談予定を設定</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">日付</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">時間</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">対応内容メモ</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="対応内容を入力..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}

function InterviewRecordModal({
  interview,
  applicationId,
  onClose,
  onSave,
}: {
  interview: Interview
  applicationId: string
  onClose: () => void
  onSave: () => void
}) {
  const { user } = useAuthStore()
  const [transcript, setTranscript] = useState('')
  const [notes, setNotes] = useState(`生年月日：
住所：
健康面：
メアド：
現状：
応募経緯：
職歴1：
職歴2：
職歴3：
学歴：
経験：
目標：
趣味：
条件：
【進捗状況】：
【最終連絡日】：
【派遣先履歴】：`)
  const [evalHearing, setEvalHearing] = useState<number | null>(null)
  const [evalProposal, setEvalProposal] = useState<number | null>(null)
  const [evalClosing, setEvalClosing] = useState<number | null>(null)
  const [evalImpression, setEvalImpression] = useState<number | null>(null)
  const [evalComment, setEvalComment] = useState('')
  const [interviewResult, setInterviewResult] = useState('')
  const [saving, setSaving] = useState(false)

  const totalScore = (evalHearing || 0) + (evalProposal || 0) + (evalClosing || 0) + (evalImpression || 0)

  async function handleSave() {
    if (!user) return

    setSaving(true)

    const { error } = await supabase
      .from('interviews')
      .update({
        conducted_at: new Date().toISOString(),
        transcript: transcript || null,
        notes: notes || null,
        eval_hearing: evalHearing,
        eval_proposal: evalProposal,
        eval_closing: evalClosing,
        eval_impression: evalImpression,
        eval_comment: evalComment || null,
        result: interviewResult || null,
      })
      .eq('id', interview.id)

    if (error) {
      console.error('Error updating interview:', error)
      alert('保存に失敗しました')
      setSaving(false)
      return
    }

    // 面談結果に応じて進捗ステータスを更新
    if (interviewResult) {
      let progressStatus: string | null = null
      switch (interviewResult) {
        case 'connected':
          progressStatus = 'referred'
          break
        case 'not_connected':
          progressStatus = 'phone_interview_done'
          break
        case 'considering':
          progressStatus = 'phone_interview_done'
          break
        case 'waiting_referral':
          progressStatus = 'phone_interview_done'
          break
      }
      if (progressStatus) {
        await supabase
          .from('applications')
          .update({ progress_status: progressStatus })
          .eq('id', applicationId)
      }
    }

    onSave()
    setSaving(false)
  }

  const SCORE_OPTIONS = [
    { value: '', label: '-' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">面談記録を入力</h3>
          <p className="text-sm text-slate-500 mt-1">
            面談予定: {formatDateTime(interview.scheduled_at)}
          </p>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">文字起こし</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              placeholder="録音の文字起こしを貼り付け..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              placeholder="面談内容を入力..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* 面談評価 */}
          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <p className="text-sm font-medium text-slate-700">面談評価（5段階）</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ヒアリング</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={evalHearing || ''}
                  onChange={(e) => setEvalHearing(e.target.value ? parseInt(e.target.value) : null)}
                >
                  {SCORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">提案</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={evalProposal || ''}
                  onChange={(e) => setEvalProposal(e.target.value ? parseInt(e.target.value) : null)}
                >
                  {SCORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">クロージング</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={evalClosing || ''}
                  onChange={(e) => setEvalClosing(e.target.value ? parseInt(e.target.value) : null)}
                >
                  {SCORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">印象</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  value={evalImpression || ''}
                  onChange={(e) => setEvalImpression(e.target.value ? parseInt(e.target.value) : null)}
                >
                  {SCORE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(evalHearing || evalProposal || evalClosing || evalImpression) && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-600">合計点:</span>
                <span className="font-bold text-lg text-primary">{totalScore}</span>
                <span className="text-slate-400">/ 20点</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">振り返りコメント</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                placeholder="一言メモ..."
                value={evalComment}
                onChange={(e) => setEvalComment(e.target.value)}
              />
            </div>
          </div>

          {/* 面談結果 */}
          <Select
            label="面談結果"
            options={[
              { value: '', label: '選択してください' },
              { value: 'connected', label: 'つなぎ' },
              { value: 'not_connected', label: 'つなげず' },
              { value: 'considering', label: '検討中' },
              { value: 'waiting_referral', label: '紹介先連絡待ち' },
            ]}
            value={interviewResult}
            onChange={(e) => setInterviewResult(e.target.value)}
          />
          {interviewResult && (
            <p className="text-xs text-slate-500">
              ※ 保存すると進捗ステータスが自動更新されます
              {interviewResult === 'connected' && '（→ 派遣会社紹介済み）'}
              {interviewResult !== 'connected' && '（→ 電話面談済み）'}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}

function ContactDetailModal({
  contactLog,
  linkedInterview,
  onClose,
}: {
  contactLog: ContactLog
  linkedInterview: Interview | null
  onClose: () => void
}) {
  const contactTypeLabel =
    contactLog.contact_type === 'phone' ? '電話' :
    contactLog.contact_type === 'email' ? 'メール' :
    contactLog.contact_type === 'line' ? 'LINE' : 'その他'

  const directionLabel = contactLog.direction === 'outbound' ? '発信' : '着信'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">対応記録 詳細</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">日時</span>
            <span className="text-slate-700">{formatDateTime(contactLog.contacted_at)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">種別</span>
            <span className="text-slate-700">{directionLabel} / {contactTypeLabel}</span>
          </div>
          {contactLog.result && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">結果</span>
              <Badge variant={contactLog.result === 'connected' ? 'success' : 'warning'}>
                {CONTACT_RESULT_LABELS[contactLog.result as ContactResult] || contactLog.result}
              </Badge>
            </div>
          )}
          {contactLog.notes && (
            <div className="text-sm">
              <span className="text-slate-500 block mb-1">メモ</span>
              <p className="text-slate-700 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{contactLog.notes}</p>
            </div>
          )}

          {linkedInterview && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-1">面談予定</p>
              <p className="text-sm text-blue-700">
                {formatDateTime(linkedInterview.scheduled_at)}
              </p>
              {linkedInterview.conducted_at && (
                <p className="text-xs text-green-600 mt-1">実施済み</p>
              )}
              {linkedInterview.result && (
                <p className="text-xs text-slate-600 mt-1">
                  結果: {INTERVIEW_RESULT_LABELS[linkedInterview.result as InterviewResult] || linkedInterview.result}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  )
}
