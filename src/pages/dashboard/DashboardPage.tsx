import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Phone,
  Briefcase,
  TrendingUp,
  Calendar,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { Card, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

interface DashboardStats {
  newApplications: number
  todayInterviews: number
  todayDispatchInterviews: number
  pendingReferrals: number
  monthlyRevenue: number
}

interface TodayInterview {
  id: string
  scheduled_at: string
  job_seeker_name: string
}

interface DigUpItem {
  id: string
  name: string
  phone: string
  days_since_contact: number
  last_contact_date: string
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    newApplications: 0,
    todayInterviews: 0,
    todayDispatchInterviews: 0,
    pendingReferrals: 0,
    monthlyRevenue: 0,
  })
  const [todayInterviews, setTodayInterviews] = useState<TodayInterview[]>([])
  const [digUpList, setDigUpList] = useState<DigUpItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    try {
      // Fetch stats in parallel
      const [
        applicationsResult,
        interviewsResult,
        referralsResult,
        revenueResult,
      ] = await Promise.all([
        // New applications this month
        supabase
          .from('applications')
          .select('id', { count: 'exact' })
          .eq('application_status', 'new')
          .gte('created_at', startOfMonth),

        // Today's interviews
        supabase
          .from('interviews')
          .select(`
            id,
            scheduled_at,
            application:applications (
              job_seeker:job_seekers (
                name
              )
            )
          `)
          .gte('scheduled_at', `${today}T00:00:00`)
          .lte('scheduled_at', `${today}T23:59:59`)
          .is('conducted_at', null)
          .order('scheduled_at'),

        // Pending referrals
        supabase
          .from('referrals')
          .select('id', { count: 'exact' })
          .in('referral_status', ['referred', 'dispatch_interview_scheduled']),

        // Monthly revenue
        supabase
          .from('sales')
          .select('amount')
          .in('status', ['confirmed', 'invoiced', 'paid'])
          .gte('created_at', startOfMonth),
      ])

      // Calculate stats
      setStats({
        newApplications: applicationsResult.count || 0,
        todayInterviews: interviewsResult.data?.length || 0,
        todayDispatchInterviews: 0, // Would need separate query
        pendingReferrals: referralsResult.count || 0,
        monthlyRevenue: revenueResult.data?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0,
      })

      // Set today's interviews
      if (interviewsResult.data) {
        setTodayInterviews(
          interviewsResult.data.map((i: any) => ({
            id: i.id,
            scheduled_at: i.scheduled_at,
            job_seeker_name: i.application?.job_seeker?.name || '不明',
          }))
        )
      }

      // Fetch dig-up list (contacts older than 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data: digUpData } = await supabase
        .from('applications')
        .select(`
          id,
          job_seekers (
            name,
            phone
          ),
          contact_logs (
            contacted_at
          )
        `)
        .in('application_status', ['valid', 'no_answer', 'connected'])
        .order('updated_at', { ascending: true })
        .limit(5)

      if (digUpData) {
        setDigUpList(
          digUpData.map((item: any) => {
            const lastContact = item.contact_logs?.[0]?.contacted_at
            const daysSince = lastContact
              ? Math.floor((Date.now() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
              : 999
            return {
              id: item.id,
              name: item.job_seekers?.name || '不明',
              phone: item.job_seekers?.phone || '',
              days_since_contact: daysSince,
              last_contact_date: lastContact || '',
            }
          })
        )
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }

    setLoading(false)
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
          {/* Today's Interviews */}
          <Card padding="none">
            <div className="p-3 lg:p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-slate-500" />
                <h3 className="text-sm lg:text-base font-semibold text-slate-800">本日の面談予定</h3>
              </div>
              <Link to="/interviews" className="text-xs lg:text-sm text-primary hover:underline flex items-center gap-1">
                すべて見る <ArrowRight className="w-3 h-3 lg:w-4 lg:h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">読み込み中...</div>
              ) : todayInterviews.length > 0 ? (
                todayInterviews.map((interview) => (
                  <div key={interview.id} className="p-3 lg:p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm lg:text-base font-medium text-slate-800 truncate">{interview.job_seeker_name}</p>
                        <p className="text-xs lg:text-sm text-slate-500">
                          {new Date(interview.scheduled_at).toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <Badge variant="info" className="flex-shrink-0">電話面談</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">
                  本日の面談予定はありません
                </div>
              )}
            </div>
          </Card>

          {/* Dig-up List */}
          <Card padding="none">
            <div className="p-3 lg:p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
                <h3 className="text-sm lg:text-base font-semibold text-slate-800">掘り起こしリスト</h3>
              </div>
              <Link to="/job-seekers?filter=digup" className="text-xs lg:text-sm text-primary hover:underline flex items-center gap-1">
                すべて見る <ArrowRight className="w-3 h-3 lg:w-4 lg:h-4" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">読み込み中...</div>
              ) : digUpList.length > 0 ? (
                digUpList.map((item) => (
                  <div key={item.id} className="p-3 lg:p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm lg:text-base font-medium text-slate-800 truncate">{item.name}</p>
                        <p className="text-xs lg:text-sm text-slate-500">{item.phone}</p>
                      </div>
                      <Badge variant={item.days_since_contact > 14 ? 'danger' : 'warning'} className="flex-shrink-0">
                        {item.days_since_contact}日前
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 lg:p-8 text-center text-slate-500 text-sm">
                  掘り起こし対象はありません
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
