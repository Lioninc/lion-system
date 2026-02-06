import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  Send,
  Building2,
  User,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { Card, Badge, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import type { ReferralStatus } from '../../types/database'
import { REFERRAL_STATUS_LABELS } from '../../types/database'

interface ReferralWithDetails {
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
      phone: string
    }
    coordinator: {
      id: string
      name: string
    } | null
  }
  job: {
    id: string
    title: string
    company: {
      id: string
      name: string
    }
    }
}

const REFERRAL_STATUS_OPTIONS = [
  { value: '', label: 'すべてのステータス' },
  ...Object.entries(REFERRAL_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export function ReferralListPage() {
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState<ReferralWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [companyFilter, setCompanyFilter] = useState('')

  useEffect(() => {
    fetchReferrals()
    fetchCompanies()
  }, [])

  async function fetchReferrals() {
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
            phone
          ),
          coordinator:users!applications_coordinator_id_fkey (
            id,
            name
          )
        ),
        job:jobs (
          id,
          title,
          company:companies (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(0, 9999)

    if (error) {
      console.error('Error fetching referrals:', error)
      setLoading(false)
      return
    }

    setReferrals(data as unknown as ReferralWithDetails[])
    setLoading(false)
  }

  async function fetchCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setCompanies([
        { value: '', label: 'すべての会社' },
        ...data.map((c) => ({ value: c.id, label: c.name })),
      ])
    }
  }

  const filteredReferrals = referrals.filter((referral) => {
    const matchesSearch =
      referral.application?.job_seeker?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.job?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.job?.company?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || referral.referral_status === statusFilter
    const matchesCompany = !companyFilter || referral.job?.company?.id === companyFilter

    return matchesSearch && matchesStatus && matchesCompany
  })

  // Count by status
  const statusCounts = referrals.reduce((acc, r) => {
    acc[r.referral_status] = (acc[r.referral_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

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

  return (
    <div>
      <Header title="紹介管理" />

      <div className="p-6 space-y-6">
        {/* Search & Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="求職者名、求人名、会社名で検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select
                options={REFERRAL_STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40"
              />
              <Select
                options={companies}
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-sm text-slate-500">全紹介</p>
              <p className="text-2xl font-bold text-slate-800">{referrals.length}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-slate-500">紹介済み</p>
              <p className="text-2xl font-bold text-blue-600">
                {(statusCounts['referred'] || 0) + (statusCounts['interview_scheduled'] || 0) + (statusCounts['interview_done'] || 0)}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-slate-500">採用</p>
              <p className="text-2xl font-bold text-emerald-600">{statusCounts['hired'] || 0}</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-slate-500">稼働中</p>
              <p className="text-2xl font-bold text-emerald-600">
                {(statusCounts['assigned'] || 0) + (statusCounts['working'] || 0)}
              </p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-sm text-slate-500">不採用/キャンセル</p>
              <p className="text-2xl font-bold text-slate-600">
                {(statusCounts['declined'] || 0) + (statusCounts['cancelled'] || 0)}
              </p>
            </div>
          </Card>
        </div>

        {/* Referral List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">紹介一覧</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredReferrals.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当する紹介が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredReferrals.map((referral) => (
                <div
                  key={referral.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/referrals/${referral.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Send className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">
                            {referral.application?.job_seeker?.name}
                          </p>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                          <p className="text-slate-600">{referral.job?.title}</p>
                          <Badge variant={getStatusBadgeVariant(referral.referral_status)}>
                            {REFERRAL_STATUS_LABELS[referral.referral_status] || referral.referral_status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {referral.job?.company?.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {referral.application?.coordinator?.name || '担当未定'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            紹介日: {formatDate(referral.referred_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
