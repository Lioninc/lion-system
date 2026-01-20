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
} from 'lucide-react'
import { Card, Button, Badge, Select, Input } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { formatDate, formatDateTime } from '../../lib/utils'
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
} from '../../types/database'

type TabType = 'info' | 'contacts' | 'referrals'

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

export function JobSeekerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [showContactModal, setShowContactModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [coordinators, setCoordinators] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    if (id) {
      fetchApplication()
      fetchCoordinators()
    }
  }, [id])

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
      .select('id, name, department')
      .neq('department', '管理部')
      .order('name')

    if (data) {
      setCoordinators(data.map((u) => ({ value: u.id, label: u.name })))
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

  const tabs = [
    { id: 'info' as const, label: '基本情報', icon: User },
    { id: 'contacts' as const, label: '対応履歴', icon: MessageSquare },
    { id: 'referrals' as const, label: '紹介履歴', icon: Briefcase },
  ]

  return (
    <div>
      <Header
        title={job_seeker.name}
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
                <span className="text-sm text-slate-500">担当者</span>
                <Select
                  options={coordinators}
                  placeholder="未設定"
                  value={application.coordinator?.id || ''}
                  onChange={(e) => updateCoordinator(e.target.value)}
                  className="w-40 text-sm"
                />
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
                <InfoRow label="氏名" value={job_seeker.name} />
                <InfoRow label="氏名（カナ）" value={job_seeker.name_kana} />
                <InfoRow label="生年月日" value={job_seeker.birth_date ? formatDate(job_seeker.birth_date) : null} />
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
                  .map((log) => (
                    <div key={log.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant={log.direction === 'outbound' ? 'info' : 'purple'}>
                              {log.direction === 'outbound' ? '発信' : '着信'}
                            </Badge>
                            <Badge variant="default">
                              {log.contact_type === 'phone' ? '電話' :
                               log.contact_type === 'email' ? 'メール' :
                               log.contact_type === 'line' ? 'LINE' : 'その他'}
                            </Badge>
                            {log.result && (
                              <span className="text-sm text-slate-600">{log.result}</span>
                            )}
                          </div>
                          {log.notes && (
                            <p className="mt-2 text-sm text-slate-600">{log.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">{formatDateTime(log.contacted_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                対応履歴はありません
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
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return

    setSaving(true)

    const { error } = await supabase.from('contact_logs').insert({
      application_id: applicationId,
      contact_type: contactType,
      direction: direction,
      result: result || null,
      notes: notes || null,
      contacted_by: user.id,
      contacted_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Error creating contact log:', error)
      alert('保存に失敗しました')
    } else {
      onSave()
    }

    setSaving(false)
  }

  return (
    <Modal onClose={onClose} title="対応記録を追加">
      <div className="space-y-4">
        <Select
          label="連絡方法"
          options={[
            { value: 'phone', label: '電話' },
            { value: 'email', label: 'メール' },
            { value: 'line', label: 'LINE' },
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
        <Input
          label="結果"
          placeholder="例: 繋がった、不在、折り返し依頼"
          value={result}
          onChange={(e) => setResult(e.target.value)}
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="対応内容のメモ..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            保存
          </Button>
        </div>
      </div>
    </Modal>
  )
}
