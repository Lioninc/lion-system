import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Phone,
  Briefcase,
  TrendingUp,
  Clock,
  Building2,
  UserCheck,
  ChevronDown,
} from 'lucide-react'
import { Card, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { WORK_START_CONTACT_TYPE_LABELS, type WorkStartContactType } from '../../types/database'

interface DashboardStats {
  newApplications: number
  todayInterviews: number
  pendingReferrals: number
  monthlyRevenue: number
}

interface DispatchInterviewItem {
  id: string
  jobSeekerName: string
  companyName: string
  dispatchInterviewAt: string
  applicationId: string
}

interface FollowUpItem {
  referralId: string
  jobSeekerName: string
  companyName: string
  startWorkDate: string
  applicationId: string
  contacts: Record<WorkStartContactType, 'pending' | 'contacted'>
}

interface ConsideringItem {
  id: string
  applicationId: string
  jobSeekerName: string
  interviewDate: string
  daysSince: number
}

const CONTACT_TYPES: WorkStartContactType[] = ['week_before', 'three_days_before', 'on_day', 'week_after']

export function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    newApplications: 0,
    todayInterviews: 0,
    pendingReferrals: 0,
    monthlyRevenue: 0,
  })
  const [dispatchInterviews, setDispatchInterviews] = useState<DispatchInterviewItem[]>([])
  const [followUpList, setFollowUpList] = useState<FollowUpItem[]>([])
  const [consideringList, setConsideringList] = useState<ConsideringItem[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'
  const isCoordinator = user?.role === 'coordinator'
  const hasAccess = isAdmin || isCoordinator

  useEffect(() => {
    if (hasAccess) {
      fetchDashboardData()
    } else {
      setLoading(false)
    }
  }, [user?.id])

  async function fetchDashboardData() {
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]

    try {
      // Build queries with coordinator filter
      let applicationsQuery = supabase
        .from('applications')
        .select('id', { count: 'exact' })
        .gte('applied_at', startOfMonth)
        .lte('applied_at', endOfMonth)

      let interviewsQuery = supabase
        .from('interviews')
        .select('id', { count: 'exact' })
        .gte('scheduled_at', `${today}T00:00:00`)
        .lte('scheduled_at', `${today}T23:59:59`)
        .is('conducted_at', null)

      let referralsQuery = supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .in('referral_status', [
          'referred',
          'interview_scheduled',
          'interview_done',
        ])

      let revenueQuery = supabase
        .from('sales')
        .select('amount')
        .in('status', ['confirmed', 'invoiced', 'paid'])
        .gte('sales_date', startOfMonth)
        .lte('sales_date', endOfMonth)

      // Coordinator filters
      if (isCoordinator && user?.id) {
        applicationsQuery = applicationsQuery.eq('coordinator_id', user.id)
        interviewsQuery = interviewsQuery.eq('interviewer_id', user.id)
      }

      const [
        applicationsResult,
        interviewsResult,
        referralsResult,
        revenueResult,
      ] = await Promise.all([
        applicationsQuery,
        interviewsQuery,
        referralsResult ? referralsQuery : referralsQuery,
        revenueQuery,
      ])

      setStats({
        newApplications: applicationsResult.count || 0,
        todayInterviews: interviewsResult.count || 0,
        pendingReferrals: referralsResult.count || 0,
        monthlyRevenue: revenueResult.data?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0,
      })

      // Fetch dispatch interviews (referral_status = 'interview_scheduled')
      let dispatchQuery = supabase
        .from('referrals')
        .select(`
          id,
          dispatch_interview_at,
          application:applications (
            id,
            coordinator_id,
            job_seeker:job_seekers (
              name
            )
          ),
          job:jobs (
            title,
            company:companies (
              name
            )
          )
        `)
        .eq('referral_status', 'interview_scheduled')
        .order('dispatch_interview_at', { ascending: true })

      if (isCoordinator && user?.id) {
        dispatchQuery = dispatchQuery.eq('application.coordinator_id', user.id)
      }

      const { data: dispatchData } = await dispatchQuery

      if (dispatchData) {
        setDispatchInterviews(
          (dispatchData as any[])
            .filter((r) => {
              if (isCoordinator && user?.id) {
                return r.application?.coordinator_id === user.id
              }
              return true
            })
            .map((r) => ({
              id: r.id,
              jobSeekerName: r.application?.job_seeker?.name || '不明',
              companyName: r.job?.company?.name || '不明',
              dispatchInterviewAt: r.dispatch_interview_at || '',
              applicationId: r.application?.id || '',
            }))
        )
      }

      // Fetch follow-up list (assigned or working referrals with start_work_date)
      let followUpQuery = supabase
        .from('referrals')
        .select(`
          id,
          start_work_date,
          application:applications (
            id,
            coordinator_id,
            job_seeker:job_seekers (
              name
            )
          ),
          job:jobs (
            title,
            company:companies (
              name
            )
          ),
          work_start_contacts (
            contact_type,
            status
          )
        `)
        .in('referral_status', ['hired', 'pre_assignment', 'assigned', 'working'])
        .not('start_work_date', 'is', null)
        .order('start_work_date', { ascending: true })

      const { data: followUpData } = await followUpQuery

      if (followUpData) {
        const now = new Date()
        const filtered = (followUpData as any[])
          .filter((r) => {
            if (isCoordinator && user?.id) {
              return r.application?.coordinator_id === user.id
            }
            return true
          })
          .filter((r) => {
            // Show items where start_work_date is within relevant range
            // (1 week before to 1 week after)
            const startDate = new Date(r.start_work_date)
            const weekBefore = new Date(startDate)
            weekBefore.setDate(weekBefore.getDate() - 8)
            const weekAfter = new Date(startDate)
            weekAfter.setDate(weekAfter.getDate() + 8)
            return now >= weekBefore && now <= weekAfter
          })
          .map((r) => {
            const contacts: Record<WorkStartContactType, 'pending' | 'contacted'> = {
              week_before: 'pending',
              three_days_before: 'pending',
              on_day: 'pending',
              week_after: 'pending',
            }
            if (r.work_start_contacts) {
              for (const c of r.work_start_contacts) {
                if (c.contact_type in contacts) {
                  contacts[c.contact_type as WorkStartContactType] = c.status
                }
              }
            }
            return {
              referralId: r.id,
              jobSeekerName: r.application?.job_seeker?.name || '不明',
              companyName: r.job?.company?.name || '不明',
              startWorkDate: r.start_work_date,
              applicationId: r.application?.id || '',
              contacts,
            }
          })

        setFollowUpList(filtered)
      }

      // Fetch considering interviews
      let consideringQuery = supabase
        .from('interviews')
        .select(`
          id,
          scheduled_at,
          conducted_at,
          application:applications (
            id,
            job_seeker:job_seekers (
              name
            )
          )
        `)
        .eq('result', 'considering')

      if (isCoordinator && user?.id) {
        consideringQuery = consideringQuery.eq('interviewer_id', user.id)
      }

      const { data: consideringData } = await consideringQuery

      if (consideringData) {
        const now = Date.now()
        setConsideringList(
          (consideringData as any[]).map((iv) => {
            const dateStr = iv.conducted_at || iv.scheduled_at
            const daysSince = Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
            return {
              id: iv.id,
              applicationId: iv.application?.id || '',
              jobSeekerName: iv.application?.job_seeker?.name || '不明',
              interviewDate: dateStr,
              daysSince,
            }
          }).sort((a, b) => b.daysSince - a.daysSince)
        )
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }

    setLoading(false)
  }

  async function handleContactStatusChange(referralId: string, contactType: WorkStartContactType, newStatus: 'pending' | 'contacted') {
    const tenantId = user?.tenant_id
    if (!tenantId) return

    const { error } = await supabase
      .from('work_start_contacts')
      .upsert({
        tenant_id: tenantId,
        referral_id: referralId,
        contact_type: contactType,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'referral_id,contact_type',
      })

    if (error) {
      console.error('Error updating contact status:', error)
      return
    }

    // Update local state
    setFollowUpList((prev) =>
      prev.map((item) =>
        item.referralId === referralId
          ? { ...item, contacts: { ...item.contacts, [contactType]: newStatus } }
          : item
      )
    )
  }

  const statCards = [
    {
      label: '新規応募（今月）',
      value: stats.newApplications,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: '本日の面談',
      value: stats.todayInterviews,
      icon: Phone,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      label: '紹介進行中',
      value: stats.pendingReferrals,
      icon: Briefcase,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      label: '今月売上',
      value: formatCurrency(stats.monthlyRevenue),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      isText: true,
    },
  ]

  return (
    <div>
      <Header title="ダッシュボード" />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-primary to-primary-600 rounded-xl p-4 lg:p-6 text-white">
          <h2 className="text-xl lg:text-2xl font-bold">おはようございます、{user?.name}さん</h2>
          <p className="mt-1 text-primary-100 text-sm lg:text-base">
            {new Date().toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {/* clerk/viewer: no content */}
        {!hasAccess && !loading && (
          <Card className="p-8 text-center">
            <p className="text-slate-500">現在表示できるコンテンツはありません</p>
          </Card>
        )}

        {hasAccess && (
          <>
            {/* Considering List */}
            {!loading && consideringList.length > 0 && (
              <Card padding="none" className="border-amber-200 bg-amber-50">
                <div className="p-3 lg:p-4 border-b border-amber-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600" />
                  <h3 className="text-sm lg:text-base font-semibold text-amber-800">検討中の求職者（{consideringList.length}件）</h3>
                </div>
                <div className="divide-y divide-amber-100">
                  {consideringList.map((item) => (
                    <Link
                      key={item.id}
                      to={`/job-seekers/${item.applicationId}`}
                      className="block p-3 lg:p-4 hover:bg-amber-100/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm lg:text-base font-medium text-slate-800 truncate">{item.jobSeekerName}</p>
                          <p className="text-xs lg:text-sm text-slate-500">
                            面談日: {new Date(item.interviewDate).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <span className={`text-sm font-bold px-2 py-1 rounded flex-shrink-0 ${
                          item.daysSince >= 5
                            ? 'bg-red-100 text-red-600'
                            : item.daysSince >= 3
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.daysSince}日経過
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {statCards.map((card) => {
                const Icon = card.icon
                return (
                  <Card key={card.label} className="p-3 lg:p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                      <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg ${card.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 lg:w-6 lg:h-6 ${card.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs lg:text-sm text-slate-500 truncate">{card.label}</p>
                        <p className={`text-lg lg:text-2xl font-bold ${card.color} truncate`}>
                          {card.isText ? card.value : card.value}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Dispatch Interviews */}
              <Card padding="none">
                <div className="p-3 lg:p-4 border-b border-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 lg:w-5 lg:h-5 text-blue-500" />
                  <h3 className="text-sm lg:text-base font-semibold text-slate-800">派遣会社面接予定</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">読み込み中...</div>
                  ) : dispatchInterviews.length > 0 ? (
                    dispatchInterviews.map((item) => (
                      <Link
                        key={item.id}
                        to={`/job-seekers/${item.applicationId}`}
                        className="block p-3 lg:p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm lg:text-base font-medium text-slate-800 truncate">{item.jobSeekerName}</p>
                            <p className="text-xs lg:text-sm text-slate-500 truncate">{item.companyName}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {item.dispatchInterviewAt ? (
                              <>
                                <p className="text-xs lg:text-sm font-medium text-slate-700">
                                  {new Date(item.dispatchInterviewAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(item.dispatchInterviewAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </>
                            ) : (
                              <Badge variant="warning" className="text-xs">日程未定</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">
                      派遣会社面接の予定はありません
                    </div>
                  )}
                </div>
              </Card>

              {/* Work Start Follow-up */}
              <Card padding="none">
                <div className="p-3 lg:p-4 border-b border-slate-200 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-500" />
                  <h3 className="text-sm lg:text-base font-semibold text-slate-800">稼働フォローアップ</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {loading ? (
                    <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">読み込み中...</div>
                  ) : followUpList.length > 0 ? (
                    followUpList.map((item) => (
                      <div key={item.referralId} className="p-3 lg:p-4">
                        <Link
                          to={`/job-seekers/${item.applicationId}`}
                          className="hover:underline"
                        >
                          <p className="text-sm lg:text-base font-medium text-slate-800 truncate">{item.jobSeekerName}</p>
                        </Link>
                        <p className="text-xs lg:text-sm text-slate-500 truncate mb-2">
                          {item.companyName} / 稼働開始: {new Date(item.startWorkDate).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {CONTACT_TYPES.map((ct) => (
                            <ContactStatusButton
                              key={ct}
                              label={WORK_START_CONTACT_TYPE_LABELS[ct]}
                              status={item.contacts[ct]}
                              onChange={(newStatus) => handleContactStatusChange(item.referralId, ct, newStatus)}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">
                      フォローアップ対象はありません
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ContactStatusButton({
  label,
  status,
  onChange,
}: {
  label: string
  status: 'pending' | 'contacted'
  onChange: (status: 'pending' | 'contacted') => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
          status === 'contacted'
            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
            : 'bg-slate-100 text-slate-600 border-slate-200'
        }`}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[120px]">
            <button
              onClick={() => { onChange('pending'); setOpen(false) }}
              className={`block w-full text-left text-xs px-3 py-2 hover:bg-slate-50 ${status === 'pending' ? 'font-bold text-slate-800' : 'text-slate-600'}`}
            >
              未連絡
            </button>
            <button
              onClick={() => { onChange('contacted'); setOpen(false) }}
              className={`block w-full text-left text-xs px-3 py-2 hover:bg-slate-50 ${status === 'contacted' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}
            >
              連絡済み
            </button>
          </div>
        </>
      )}
    </div>
  )
}
