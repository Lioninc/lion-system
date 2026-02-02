import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  User,
  Phone,
  MapPin,
  Building2,
  Briefcase,
  Calendar,
  DollarSign,
  ChevronRight,
  Home,
} from 'lucide-react'
import { Card, Button, Badge, Input } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { ReferralStatus, SaleStatus } from '../../types/database'
import { REFERRAL_STATUS_LABELS, SALE_STATUS_LABELS } from '../../types/database'

interface ReferralDetail {
  id: string
  referral_status: ReferralStatus
  referred_at: string
  dispatch_interview_at: string | null
  hired_at: string | null
  assignment_date: string | null
  start_work_date: string | null
  notes: string | null
  application: {
    id: string
    job_seeker: {
      id: string
      name: string
      name_kana: string | null
      phone: string
      email: string | null
      prefecture: string | null
      city: string | null
    }
    coordinator: {
      id: string
      name: string
    } | null
  }
  job: {
    id: string
    title: string
    job_type: string | null
    prefecture: string | null
    city: string | null
    salary_min: number | null
    salary_max: number | null
    has_dormitory: boolean
    fee_type: string | null
    fee_amount: number | null
    fee_percentage: number | null
    company: {
      id: string
      name: string
      phone: string | null
      contact_person: string | null
    }
  }
  sales?: {
    id: string
    amount: number
    status: SaleStatus
    expected_date: string | null
    paid_date: string | null
  }[]
}

const REFERRAL_STATUS_OPTIONS = Object.entries(REFERRAL_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function ReferralDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [referral, setReferral] = useState<ReferralDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)

  useEffect(() => {
    if (id) {
      fetchReferral()
    }
  }, [id])

  async function fetchReferral() {
    setLoading(true)

    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        application:applications (
          id,
          job_seeker:job_seekers (
            id,
            name,
            name_kana,
            phone,
            email,
            prefecture,
            city
          ),
          coordinator:users!applications_coordinator_id_fkey (
            id,
            name
          )
        ),
        job:jobs (
          id,
          title,
          job_type,
          prefecture,
          city,
          salary_min,
          salary_max,
          has_dormitory,
          fee_type,
          fee_amount,
          fee_percentage,
          company:companies (
            id,
            name,
            phone,
            contact_person
          )
        ),
        sales (
          id,
          amount,
          status,
          expected_date,
          paid_date
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching referral:', error)
      navigate('/referrals')
      return
    }

    setReferral(data as unknown as ReferralDetail)
    setLoading(false)
  }

  async function updateStatus(newStatus: ReferralStatus) {
    if (!referral) return

    const updates: Record<string, string | null> = {
      referral_status: newStatus,
    }

    // Auto-fill dates based on status
    const now = new Date().toISOString()
    if (newStatus === 'hired' && !referral.hired_at) {
      updates.hired_at = now
    }
    if (newStatus === 'assigned' && !referral.assignment_date) {
      updates.assignment_date = now
    }
    if (newStatus === 'working' && !referral.start_work_date) {
      updates.start_work_date = now
    }

    const { error } = await supabase
      .from('referrals')
      .update(updates)
      .eq('id', referral.id)

    if (error) {
      console.error('Error updating status:', error)
      alert('ステータスの更新に失敗しました')
      return
    }

    // Update application progress status
    let progressStatus = null
    switch (newStatus) {
      case 'interview_scheduled':
        progressStatus = 'dispatch_interview_scheduled'
        break
      case 'interview_done':
        progressStatus = 'dispatch_interview_done'
        break
      case 'hired':
        progressStatus = 'hired'
        break
      case 'pre_assignment':
        progressStatus = 'pre_assignment'
        break
      case 'assigned':
        progressStatus = 'assigned'
        break
      case 'working':
        progressStatus = 'working'
        break
    }

    if (progressStatus) {
      await supabase
        .from('applications')
        .update({ progress_status: progressStatus })
        .eq('id', referral.application.id)
    }

    setReferral({ ...referral, referral_status: newStatus, ...updates })
    setShowStatusModal(false)

    // If hired, create sale record if not exists
    if (newStatus === 'hired' && referral.job.fee_amount && (!referral.sales || referral.sales.length === 0)) {
      const { error: saleError } = await supabase
        .from('sales')
        .insert({
          referral_id: referral.id,
          amount: referral.job.fee_amount,
          status: 'expected',
          expected_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days later
        })

      if (!saleError) {
        fetchReferral() // Refresh to show new sale
      }
    }
  }

  async function updateDate(field: string, value: string) {
    if (!referral) return

    const { error } = await supabase
      .from('referrals')
      .update({ [field]: value || null })
      .eq('id', referral.id)

    if (!error) {
      setReferral({ ...referral, [field]: value || null })
    }
  }

  function getStatusBadgeVariant(status: ReferralStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'referred': return 'info'
      case 'interview_scheduled': return 'purple'
      case 'interview_done': return 'purple'
      case 'hired': return 'success'
      case 'pre_assignment': return 'warning'
      case 'assigned': return 'success'
      case 'working': return 'success'
      case 'cancelled': return 'default'
      case 'declined': return 'danger'
      default: return 'default'
    }
  }

  function getSaleStatusBadgeVariant(status: SaleStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'expected': return 'info'
      case 'confirmed': return 'warning'
      case 'invoiced': return 'purple'
      case 'paid': return 'success'
      default: return 'default'
    }
  }

  if (loading || !referral) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const { application, job } = referral

  return (
    <div>
      <Header
        title="紹介詳細"
        action={
          <Button onClick={() => setShowStatusModal(true)}>
            ステータス変更
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={getStatusBadgeVariant(referral.referral_status)} className="text-base px-4 py-2">
                {REFERRAL_STATUS_LABELS[referral.referral_status] || referral.referral_status}
              </Badge>
              <div className="text-slate-500">
                <span className="text-slate-800 font-medium">{application.job_seeker?.name}</span>
                <ChevronRight className="w-4 h-4 inline mx-2" />
                <span className="text-slate-800 font-medium">{job.title}</span>
              </div>
            </div>
            {job.fee_amount && (
              <div className="text-right">
                <p className="text-sm text-slate-500">成功報酬</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(job.fee_amount)}
                </p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Seeker Info */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">求職者情報</h3>
              <Link to={`/job-seekers/${application.id}`}>
                <Button variant="outline" size="sm">
                  詳細を見る
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{application.job_seeker?.name}</p>
                  {application.job_seeker?.name_kana && (
                    <p className="text-sm text-slate-500">{application.job_seeker.name_kana}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4" />
                <a href={`tel:${application.job_seeker?.phone}`} className="hover:text-primary">
                  {application.job_seeker?.phone}
                </a>
              </div>
              {application.job_seeker?.prefecture && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{application.job_seeker.prefecture}{application.job_seeker.city}</span>
                </div>
              )}
              {application.coordinator && (
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4" />
                  <span>担当: {application.coordinator.name}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Job Info */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">求人情報</h3>
              <Link to={`/jobs/${job.id}`}>
                <Button variant="outline" size="sm">
                  詳細を見る
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{job.title}</p>
                  {job.has_dormitory && (
                    <Badge variant="purple" className="mt-1">
                      <Home className="w-3 h-3 mr-1" />
                      寮あり
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Building2 className="w-4 h-4" />
                <span>{job.company?.name}</span>
              </div>
              {job.prefecture && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{job.prefecture}{job.city}</span>
                </div>
              )}
              {job.salary_min && (
                <div className="flex items-center gap-2 text-slate-600">
                  <DollarSign className="w-4 h-4" />
                  <span>{formatCurrency(job.salary_min)}〜{job.salary_max && formatCurrency(job.salary_max)}</span>
                </div>
              )}
              {job.company?.contact_person && (
                <div className="text-sm text-slate-500 mt-2">
                  担当者: {job.company.contact_person}
                  {job.company.phone && ` / ${job.company.phone}`}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Timeline / Dates */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-4">進捗タイムライン</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">紹介日</label>
              <div className="flex items-center gap-2 text-slate-800">
                <Calendar className="w-4 h-4 text-slate-400" />
                {formatDate(referral.referred_at)}
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">面接日</label>
              <Input
                type="date"
                value={referral.dispatch_interview_at?.split('T')[0] || ''}
                onChange={(e) => updateDate('dispatch_interview_at', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">採用日</label>
              <Input
                type="date"
                value={referral.hired_at?.split('T')[0] || ''}
                onChange={(e) => updateDate('hired_at', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">赴任日</label>
              <Input
                type="date"
                value={referral.assignment_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('assignment_date', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">稼働開始日</label>
              <Input
                type="date"
                value={referral.start_work_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('start_work_date', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Sales */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">売上情報</h3>
            {(!referral.sales || referral.sales.length === 0) && (
              <Button size="sm" onClick={() => setShowSaleModal(true)}>
                売上を登録
              </Button>
            )}
          </div>
          {referral.sales && referral.sales.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {referral.sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/sales/${sale.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-slate-800">
                          {formatCurrency(sale.amount)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {sale.expected_date && `入金予定: ${formatDate(sale.expected_date)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSaleStatusBadgeVariant(sale.status)}>
                        {SALE_STATUS_LABELS[sale.status]}
                      </Badge>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              売上情報はありません
            </div>
          )}
        </Card>

        {/* Notes */}
        {referral.notes && (
          <Card>
            <h3 className="font-semibold text-slate-800 mb-2">メモ</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{referral.notes}</p>
          </Card>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatusModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">ステータス変更</h3>
            <div className="space-y-2">
              {REFERRAL_STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateStatus(value as ReferralStatus)}
                  className={`w-full px-4 py-3 text-left rounded-lg transition-colors ${
                    referral.referral_status === value
                      ? 'bg-primary text-white'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <SaleModal
          referralId={referral.id}
          defaultAmount={job.fee_amount || 0}
          onClose={() => setShowSaleModal(false)}
          onSave={() => {
            setShowSaleModal(false)
            fetchReferral()
          }}
        />
      )}
    </div>
  )
}

function SaleModal({
  referralId,
  defaultAmount,
  onClose,
  onSave,
}: {
  referralId: string
  defaultAmount: number
  onClose: () => void
  onSave: () => void
}) {
  const [amount, setAmount] = useState(defaultAmount.toString())
  const [expectedDate, setExpectedDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!amount) return

    setSaving(true)

    const { error } = await supabase.from('sales').insert({
      referral_id: referralId,
      amount: parseInt(amount),
      status: 'expected',
      expected_date: expectedDate || null,
    })

    if (error) {
      console.error('Error creating sale:', error)
      alert('売上の登録に失敗しました')
    } else {
      onSave()
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">売上を登録</h3>
        <div className="space-y-4">
          <Input
            label="金額"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額を入力"
          />
          <Input
            label="入金予定日"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            登録
          </Button>
        </div>
      </div>
    </div>
  )
}
