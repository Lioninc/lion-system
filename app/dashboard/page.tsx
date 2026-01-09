'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface KPIData {
  newApplications: number
  interviewsDone: number
  introductions: number
  startedWorking: number
  expectedRevenue: number
  paidAmount: number
}

interface ActionData {
  uncontactedAttacks: number
  pendingPayments: {
    count: number
    amount: number
  }
}

interface RecentActivity {
  id: string
  type: 'application' | 'interview' | 'hired' | 'payment'
  date: string
  candidateName: string
  description: string
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

function getActivityIcon(type: string): string {
  switch (type) {
    case 'application':
      return '📝'
    case 'interview':
      return '💬'
    case 'hired':
      return '🎉'
    case 'payment':
      return '💰'
    default:
      return '📌'
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case 'application':
      return '新規応募'
    case 'interview':
      return '面談実施'
    case 'hired':
      return '採用決定'
    case 'payment':
      return '入金完了'
    default:
      return ''
  }
}

function getActivityColor(type: string): string {
  switch (type) {
    case 'application':
      return 'bg-blue-100 text-blue-700'
    case 'interview':
      return 'bg-purple-100 text-purple-700'
    case 'hired':
      return 'bg-emerald-100 text-emerald-700'
    case 'payment':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPIData>({
    newApplications: 0,
    interviewsDone: 0,
    introductions: 0,
    startedWorking: 0,
    expectedRevenue: 0,
    paidAmount: 0,
  })
  const [actions, setActions] = useState<ActionData>({
    uncontactedAttacks: 0,
    pendingPayments: { count: 0, amount: 0 },
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    const supabase = createClient()

    // 今月の期間を計算
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startDate = startOfMonth.toISOString().split('T')[0]
    const endDate = endOfMonth.toISOString().split('T')[0]

    // 並列でデータを取得
    const [
      applicationsResult,
      interviewsResult,
      introductionsResult,
      startWorkResult,
      paymentsResult,
      uncontactedResult,
      pendingPaymentsResult,
      recentApplicationsResult,
      recentInterviewsResult,
      recentHiredResult,
      recentPaymentsResult,
    ] = await Promise.all([
      // 1. 今月の新規応募数
      supabase
        .from('applications')
        .select('id', { count: 'exact' })
        .gte('application_date', startDate)
        .lte('application_date', endDate),

      // 2. 今月の面談実施数
      supabase
        .from('interviews')
        .select('id', { count: 'exact' })
        .gte('interview_date', startDate)
        .lte('interview_date', endDate),

      // 3. 今月の企業紹介数
      supabase
        .from('introductions')
        .select('id', { count: 'exact' })
        .gte('introduction_date', startDate)
        .lte('introduction_date', endDate),

      // 4. 今月の稼働決定数（start_work_dateが今月）
      supabase
        .from('introductions')
        .select('id, job_id', { count: 'exact' })
        .gte('start_work_date', startDate)
        .lte('start_work_date', endDate),

      // 5. 今月の入金済み金額
      supabase
        .from('payments')
        .select('total_amount')
        .gte('paid_date', startDate)
        .lte('paid_date', endDate)
        .in('status', ['入金済み', '入金済']),

      // 6. 未対応アタック（stage='新規'でlast_contact_dateがNULL）
      supabase
        .from('candidates')
        .select('id', { count: 'exact' })
        .eq('stage', '新規')
        .is('last_contact_date', null),

      // 7. 入金待ち（請求中 or 入金途中）
      supabase
        .from('payments')
        .select('total_amount, paid_amount, status')
        .in('status', ['請求中', '入金途中']),

      // 直近の動き: 新規応募（最新5件）
      supabase
        .from('applications')
        .select(`
          id,
          created_at,
          candidates:candidate_id (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5),

      // 直近の動き: 面談実施（最新5件）
      supabase
        .from('interviews')
        .select(`
          id,
          interview_date,
          candidates:candidate_id (
            name
          )
        `)
        .order('interview_date', { ascending: false })
        .limit(5),

      // 直近の動き: 採用決定（最新5件）
      supabase
        .from('introductions')
        .select(`
          id,
          updated_at,
          candidates:candidate_id (
            name
          ),
          companies:company_id (
            name
          )
        `)
        .eq('status', '採用決定')
        .order('updated_at', { ascending: false })
        .limit(5),

      // 直近の動き: 入金（最新5件）
      supabase
        .from('payments')
        .select(`
          id,
          paid_date,
          total_amount,
          introductions:introduction_id (
            candidates:candidate_id (
              name
            )
          )
        `)
        .in('status', ['入金済み', '入金済'])
        .not('paid_date', 'is', null)
        .order('paid_date', { ascending: false })
        .limit(5),
    ])

    // KPI計算
    const newApplications = applicationsResult.count || 0
    const interviewsDone = interviewsResult.count || 0
    const introductionsCount = introductionsResult.count || 0
    const startedWorking = startWorkResult.count || 0

    // 売上見込み計算（今月稼働のreferral_fee合計）
    let expectedRevenue = 0
    if (startWorkResult.data && startWorkResult.data.length > 0) {
      const jobIds = startWorkResult.data
        .map((i: any) => i.job_id)
        .filter((id: string | null) => id !== null)

      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, referral_fee')
          .in('id', jobIds)

        if (jobsData) {
          const jobFeeMap = new Map(jobsData.map((j: any) => [j.id, j.referral_fee || 0]))
          startWorkResult.data.forEach((intro: any) => {
            if (intro.job_id) {
              expectedRevenue += jobFeeMap.get(intro.job_id) || 0
            }
          })
        }
      }
    }

    // 入金済み金額計算
    const paidAmount = (paymentsResult.data || []).reduce(
      (sum: number, p: any) => sum + (p.total_amount || 0),
      0
    )

    setKpi({
      newApplications,
      interviewsDone,
      introductions: introductionsCount,
      startedWorking,
      expectedRevenue,
      paidAmount,
    })

    // アクション必要セクション
    const uncontactedAttacks = uncontactedResult.count || 0

    let pendingCount = 0
    let pendingAmount = 0
    if (pendingPaymentsResult.data) {
      pendingPaymentsResult.data.forEach((p: any) => {
        pendingCount++
        if (p.status === '入金途中') {
          // 入金途中の場合は残額
          pendingAmount += (p.total_amount || 0) - (p.paid_amount || 0)
        } else {
          // 請求中の場合は全額
          pendingAmount += p.total_amount || 0
        }
      })
    }

    setActions({
      uncontactedAttacks,
      pendingPayments: { count: pendingCount, amount: pendingAmount },
    })

    // 直近の動きを統合
    const activities: RecentActivity[] = []

    // 新規応募
    if (recentApplicationsResult.data) {
      recentApplicationsResult.data.forEach((app: any) => {
        activities.push({
          id: `app-${app.id}`,
          type: 'application',
          date: app.created_at,
          candidateName: app.candidates?.name || '不明',
          description: '新規応募がありました',
        })
      })
    }

    // 面談実施
    if (recentInterviewsResult.data) {
      recentInterviewsResult.data.forEach((interview: any) => {
        activities.push({
          id: `int-${interview.id}`,
          type: 'interview',
          date: interview.interview_date,
          candidateName: interview.candidates?.name || '不明',
          description: '面談を実施しました',
        })
      })
    }

    // 採用決定
    if (recentHiredResult.data) {
      recentHiredResult.data.forEach((intro: any) => {
        activities.push({
          id: `hired-${intro.id}`,
          type: 'hired',
          date: intro.updated_at,
          candidateName: intro.candidates?.name || '不明',
          description: `${intro.companies?.name || '企業'}に採用決定`,
        })
      })
    }

    // 入金
    if (recentPaymentsResult.data) {
      recentPaymentsResult.data.forEach((payment: any) => {
        const candidateName = payment.introductions?.candidates?.name || '不明'
        activities.push({
          id: `pay-${payment.id}`,
          type: 'payment',
          date: payment.paid_date,
          candidateName,
          description: `¥${formatNumber(payment.total_amount)} 入金完了`,
        })
      })
    }

    // 日時でソートして最新5件を取得
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setRecentActivities(activities.slice(0, 5))

    setLoading(false)
  }

  const kpiCards = [
    { label: '新規応募', value: kpi.newApplications, icon: '📝', color: 'text-blue-600', suffix: '件' },
    { label: '面談実施', value: kpi.interviewsDone, icon: '💬', color: 'text-purple-600', suffix: '件' },
    { label: '企業紹介', value: kpi.introductions, icon: '🏢', color: 'text-indigo-600', suffix: '件' },
    { label: '稼働決定', value: kpi.startedWorking, icon: '🎉', color: 'text-emerald-600', suffix: '件' },
    { label: '売上見込み', value: kpi.expectedRevenue, icon: '📊', color: 'text-amber-600', prefix: '¥', isCurrency: true },
    { label: '入金済み', value: kpi.paidAmount, icon: '💰', color: 'text-emerald-600', prefix: '¥', isCurrency: true },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>

      {loading ? (
        <div className="p-8 text-center text-slate-500">読み込み中...</div>
      ) : (
        <>
          {/* KPIカード */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">今月の実績</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {kpiCards.map((card) => (
                <Card key={card.label}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{card.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 truncate">{card.label}</p>
                      <p className={`text-xl font-bold ${card.color} truncate`}>
                        {card.prefix || ''}
                        {card.isCurrency ? formatNumber(card.value) : card.value}
                        {card.suffix || ''}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* アクション必要セクション */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">アクション必要</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 未対応アタック */}
              <Link href="/attack-list">
                <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-xl">📋</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">未対応アタック</p>
                        <p className="text-xs text-slate-500">連絡が必要な求職者</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">{actions.uncontactedAttacks}</p>
                      <p className="text-xs text-slate-500">件</p>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* 入金待ち */}
              <Link href="/payments">
                <Card className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-xl">💳</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">入金待ち</p>
                        <p className="text-xs text-slate-500">請求中・入金途中</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-600">{actions.pendingPayments.count}</p>
                      <p className="text-xs text-slate-500">件 / ¥{formatNumber(actions.pendingPayments.amount)}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          {/* 直近の動き */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">直近の動き</h2>
            <Card padding="none">
              {recentActivities.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50"
                    >
                      <div className="text-xl">{getActivityIcon(activity.type)}</div>
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${getActivityColor(activity.type)}`}
                      >
                        {getActivityLabel(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {activity.candidateName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {activity.description}
                        </p>
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDate(activity.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  直近のアクティビティはありません
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
