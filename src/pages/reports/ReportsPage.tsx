import { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  Calendar,
  Phone,
  Send,
  Filter,
  DollarSign,
  ChevronRight,
  UserCheck,
  MapPin,
  Play,
} from 'lucide-react'
import { Card, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

// ============================================================
// Types
// ============================================================

interface FilterOptions {
  coordinators: { id: string; name: string }[]
  sources: { id: string; name: string }[]
  jobTypes: string[]
}

interface FunnelMetrics {
  interviewsDone: number       // 1. 電話面談数
  referrals: number            // 2. 繋ぎ数
  dispatchInterviewScheduled: number // 3. 派遣面接予定
  dispatchInterviewDone: number // 4. 派遣面接数（実施済み）
  hired: number                // 5. 採用
  prospect: number             // 6. 見込み（BX列=見込み売上あり）
  working: number              // 7. 稼働（CG列=確定売上あり）
  salesExpectedAmount: number  // 8. 売上見込
  salesConfirmedAmount: number // 9. 売上確定
  salesPaidAmount: number      // 10. 入金済
}

interface MonthlyRow extends FunnelMetrics {
  month: string
}

interface WorkMonthRow {
  month: string
  prospectCount: number   // 見込み件数（BX金額あり）
  workingCount: number    // 実働件数（CG金額あり & CF稼働日あり）
  salesExpected: number   // 売上見込（BX合計）
  salesConfirmed: number  // 実働売上（CG合計）
}

// ============================================================
// Constants
// ============================================================

const PERIOD_OPTIONS = [
  { value: '1week', label: '過去1週間' },
  { value: '1month', label: '過去1ヶ月' },
  { value: '3months', label: '過去3ヶ月' },
  { value: '6months', label: '過去6ヶ月' },
  { value: '12months', label: '過去1年' },
  { value: '24months', label: '過去2年' },
  { value: 'all', label: '全期間' },
]

// ============================================================
// Component
// ============================================================

export function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [coordinatorFilter, setCoordinatorFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [jobTypeFilter, setJobTypeFilter] = useState('')

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    coordinators: [],
    sources: [],
    jobTypes: [],
  })

  const emptyMetrics = (): FunnelMetrics => ({
    interviewsDone: 0,
    referrals: 0,
    dispatchInterviewScheduled: 0,
    dispatchInterviewDone: 0,
    hired: 0,
    prospect: 0,
    working: 0,
    salesExpectedAmount: 0,
    salesConfirmedAmount: 0,
    salesPaidAmount: 0,
  })

  const [funnel, setFunnel] = useState<FunnelMetrics>(emptyMetrics())
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([])
  const [workMonthData, setWorkMonthData] = useState<WorkMonthRow[]>([])
  const [coordinatorStats, setCoordinatorStats] = useState<
    { name: string; interviewsDone: number; referrals: number; dispatchInterviewScheduled: number; dispatchInterviewDone: number; hired: number; salesPaidAmount: number }[]
  >([])

  // Fetch filter options on mount
  useEffect(() => {
    async function loadFilters() {
      const [coordRes, sourceRes, jobTypeRes] = await Promise.all([
        supabase.from('users').select('id, name').order('name'),
        supabase.from('sources').select('id, name').eq('is_active', true).order('name'),
        supabase.from('applications').select('job_type').not('job_type', 'is', null),
      ])

      const jobTypes = [...new Set((jobTypeRes.data || []).map((r: any) => r.job_type).filter(Boolean))]
        .sort()

      setFilterOptions({
        coordinators: coordRes.data || [],
        sources: sourceRes.data || [],
        jobTypes,
      })
    }
    loadFilters()
  }, [])

  const getDateRange = useCallback(() => {
    const end = new Date()
    const start = new Date()
    switch (period) {
      case '1week': start.setDate(start.getDate() - 7); break
      case '1month': start.setMonth(start.getMonth() - 1); break
      case '3months': start.setMonth(start.getMonth() - 3); break
      case '6months': start.setMonth(start.getMonth() - 6); break
      case '12months': start.setMonth(start.getMonth() - 12); break
      case '24months': start.setMonth(start.getMonth() - 24); break
      case 'all': start.setFullYear(2000); break
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [period])

  // Main data fetch (filterOptions.coordinatorsがロード済みの場合のみ実行)
  useEffect(() => {
    if (filterOptions.coordinators.length === 0) return
    fetchReport()
  }, [period, coordinatorFilter, sourceFilter, jobTypeFilter, filterOptions])

  // Helper: paginated fetch for any table
  async function fetchAllRows(
    table: string,
    select: string,
    filters?: (q: any) => any,
  ): Promise<any[]> {
    const rows: any[] = []
    let offset = 0
    const pageSize = 1000
    while (true) {
      let q = supabase.from(table).select(select)
      if (filters) q = filters(q)
      const { data } = await q.range(offset, offset + pageSize - 1)
      if (!data || data.length === 0) break
      rows.push(...data)
      offset += data.length
      if (data.length < pageSize) break
    }
    return rows
  }

  async function fetchReport() {
    setLoading(true)
    const { start, end } = getDateRange()

    try {
      // 1. Fetch applications (paginated, with filters)
      const allApps: {
        id: string
        applied_at: string
        coordinator_id: string | null
        source_id: string | null
        job_type: string | null
      }[] = await fetchAllRows('applications', 'id, applied_at, coordinator_id, source_id, job_type', (q) => {
        q = q.gte('applied_at', start).lte('applied_at', end)
        if (coordinatorFilter) q = q.eq('coordinator_id', coordinatorFilter)
        if (sourceFilter) q = q.eq('source_id', sourceFilter)
        if (jobTypeFilter) q = q.eq('job_type', jobTypeFilter)
        return q
      })

      const appIdSet = new Set(allApps.map((a) => a.id))

      // 2. Fetch ALL interviews (small table ~317 rows) then filter by appIdSet
      const rawInterviews: {
        application_id: string
        scheduled_at: string
        conducted_at: string | null
      }[] = await fetchAllRows('interviews', 'application_id, scheduled_at, conducted_at')
      const allInterviews = rawInterviews.filter((iv) => appIdSet.has(iv.application_id))

      // 3. Fetch ALL referrals (small table ~2500 rows) then filter by appIdSet
      const rawReferrals: {
        id: string
        application_id: string
        referred_at: string
        referral_status: string
        dispatch_interview_at: string | null
        hired_at: string | null
        assignment_date: string | null
        start_work_date: string | null
      }[] = await fetchAllRows('referrals', 'id, application_id, referred_at, referral_status, dispatch_interview_at, hired_at, assignment_date, start_work_date')
      const allReferrals = rawReferrals.filter((r) => appIdSet.has(r.application_id))

      const refIdSet = new Set(allReferrals.map((r) => r.id))

      // 4. Fetch ALL sales (small table ~794 rows) then filter by refIdSet
      const rawSales: {
        referral_id: string
        amount: number
        status: string
        expected_date: string | null
        confirmed_date: string | null
        paid_date: string | null
      }[] = await fetchAllRows('sales', 'referral_id, amount, status, expected_date, confirmed_date, paid_date')
      const allSales = rawSales.filter((s) => refIdSet.has(s.referral_id))

      // 5. Build lookup maps
      const interviewsByApp = new Map<string, typeof allInterviews>()
      for (const iv of allInterviews) {
        const arr = interviewsByApp.get(iv.application_id) || []
        arr.push(iv)
        interviewsByApp.set(iv.application_id, arr)
      }

      const referralsByApp = new Map<string, typeof allReferrals>()
      for (const ref of allReferrals) {
        const arr = referralsByApp.get(ref.application_id) || []
        arr.push(ref)
        referralsByApp.set(ref.application_id, arr)
      }

      const salesByRef = new Map<string, typeof allSales>()
      for (const sale of allSales) {
        const arr = salesByRef.get(sale.referral_id) || []
        arr.push(sale)
        salesByRef.set(sale.referral_id, arr)
      }

      // 6. Coordinator name lookup
      const coordNameMap = new Map<string, string>()
      filterOptions.coordinators.forEach((c) => coordNameMap.set(c.id, c.name))

      // 7. Aggregate (action-date-based: each metric uses its own action date for month assignment)
      const monthMap = new Map<string, MonthlyRow>()
      const crdMap = new Map<string, { name: string; interviewsDone: number; referrals: number; dispatchInterviewScheduled: number; dispatchInterviewDone: number; hired: number; salesPaidAmount: number }>()

      const ensureMonth = (month: string) => {
        if (!monthMap.has(month)) monthMap.set(month, { month, ...emptyMetrics() })
        return monthMap.get(month)!
      }

      // application_id → coordinator lookup
      const appCoordMap = new Map<string, string | null>()
      for (const app of allApps) {
        appCoordMap.set(app.id, app.coordinator_id)
      }

      const ensureCoord = (appId: string) => {
        const coordId = appCoordMap.get(appId)
        const crdKey = coordId || '_none'
        if (!crdMap.has(crdKey)) {
          const crdName = coordId ? (coordNameMap.get(coordId) || '不明') : '未設定'
          crdMap.set(crdKey, { name: crdName, interviewsDone: 0, referrals: 0, dispatchInterviewScheduled: 0, dispatchInterviewDone: 0, hired: 0, salesPaidAmount: 0 })
        }
        return crdMap.get(crdKey)!
      }

      // 1. 面談 → conducted_atで済み判定、月はscheduled_atベース（スプシAU+AV列と100%一致）
      for (const iv of allInterviews) {
        if (iv.conducted_at) {
          const month = iv.scheduled_at.substring(0, 7)
          ensureMonth(month).interviewsDone += 1
          ensureCoord(iv.application_id).interviewsDone += 1
        }
      }

      // 2-10. Referrals-based metrics (ALL referrals = BF=繋ぎ, month from referred_at = AU+AV)
      const DONE_STATUSES = ['interview_done', 'hired', 'pre_assignment', 'assigned', 'working', 'full_paid']

      for (const ref of allReferrals) {
        const crd = ensureCoord(ref.application_id)
        const refMonth = ref.referred_at?.substring(0, 7)
        if (!refMonth) continue

        // 繋ぎ
        ensureMonth(refMonth).referrals += 1
        crd.referrals += 1

        // 面接予定 → dispatch_interview_at NOT NULL (BJ列に値あり)
        if (ref.dispatch_interview_at) {
          ensureMonth(refMonth).dispatchInterviewScheduled += 1
          crd.dispatchInterviewScheduled += 1
        }

        // 面接済 → referral_status in done statuses (BM=済み以降)
        if (DONE_STATUSES.includes(ref.referral_status)) {
          ensureMonth(refMonth).dispatchInterviewDone += 1
          crd.dispatchInterviewDone += 1
        }

        // 採用 → hired_at NOT NULL (BN=採用)
        if (ref.hired_at) {
          ensureMonth(refMonth).hired += 1
          crd.hired += 1
        }

        // Sales-based metrics (month = referred_at = AU+AV)
        const sales = salesByRef.get(ref.id) || []
        if (sales.some((s) => s.status === 'expected')) ensureMonth(refMonth).prospect += 1
        if (sales.some((s) => s.status === 'confirmed')) ensureMonth(refMonth).working += 1

        for (const sale of sales) {
          if (sale.status === 'expected') {
            ensureMonth(refMonth).salesExpectedAmount += sale.amount
          }
          if (sale.status === 'confirmed') {
            ensureMonth(refMonth).salesConfirmedAmount += sale.amount
          }
          if (sale.status === 'paid') {
            ensureMonth(refMonth).salesPaidAmount += sale.amount
            crd.salesPaidAmount += sale.amount
          }
        }
      }

      // 稼働月ベース集計（sales日付フィールドに稼働月日付が格納済み）
      const refById = new Map<string, typeof allReferrals[0]>()
      allReferrals.forEach((r) => refById.set(r.id, r))

      const workMap = new Map<string, WorkMonthRow>()
      const ensureWork = (month: string) => {
        if (!workMap.has(month)) workMap.set(month, { month, prospectCount: 0, workingCount: 0, salesExpected: 0, salesConfirmed: 0 })
        return workMap.get(month)!
      }

      for (const sale of allSales) {
        const ref = refById.get(sale.referral_id)
        if (!ref) continue

        if (sale.status === 'expected' && sale.expected_date) {
          const m = sale.expected_date.substring(0, 7)
          ensureWork(m).prospectCount += 1
          ensureWork(m).salesExpected += sale.amount
        }
        if (sale.status === 'confirmed' && sale.confirmed_date && ref.start_work_date) {
          const m = sale.confirmed_date.substring(0, 7)
          ensureWork(m).workingCount += 1
          ensureWork(m).salesConfirmed += sale.amount
        }
      }

      setWorkMonthData(Array.from(workMap.values()).sort((a, b) => a.month.localeCompare(b.month)))

      // Build sorted results
      const sorted = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))
      setMonthlyData(sorted)

      // Total funnel
      const total = sorted.reduce(
        (acc, m) => {
          acc.interviewsDone += m.interviewsDone
          acc.referrals += m.referrals
          acc.dispatchInterviewScheduled += m.dispatchInterviewScheduled
          acc.dispatchInterviewDone += m.dispatchInterviewDone
          acc.hired += m.hired
          acc.prospect += m.prospect
          acc.working += m.working
          acc.salesExpectedAmount += m.salesExpectedAmount
          acc.salesConfirmedAmount += m.salesConfirmedAmount
          acc.salesPaidAmount += m.salesPaidAmount
          return acc
        },
        emptyMetrics(),
      )
      setFunnel(total)

      setCoordinatorStats(Array.from(crdMap.values()).sort((a, b) => b.salesPaidAmount - a.salesPaidAmount))
    } catch (err) {
      console.error('Report fetch error:', err)
    }

    setLoading(false)
  }

  // Conversion rates
  const convRate = (from: number, to: number) => from > 0 ? ((to / from) * 100).toFixed(1) + '%' : '-'

  return (
    <div>
      <Header title="月次レポート" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-700">絞り込み</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select
              label="期間"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
            <Select
              label="担当者"
              options={[
                { value: '', label: '全員' },
                ...filterOptions.coordinators.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={coordinatorFilter}
              onChange={(e) => setCoordinatorFilter(e.target.value)}
            />
            <Select
              label="媒体"
              options={[
                { value: '', label: 'すべて' },
                ...filterOptions.sources.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            />
            <Select
              label="職種"
              options={[
                { value: '', label: 'すべて' },
                ...filterOptions.jobTypes.map((t) => ({ value: t, label: t })),
              ]}
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value)}
            />
          </div>
        </Card>

        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : (
          <>
            {/* 10 Metric Cards - 5x2 Grid */}
            <div className="grid grid-cols-5 gap-4">
              {/* Row 1: 面談 → 繋ぎ → 派遣面接予定 → 派遣面接数 → 採用 */}
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-5 h-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">電話面談</p>
                    <p className="text-2xl font-bold text-sky-600">{funnel.interviewsDone.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Send className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">繋ぎ数</p>
                    <p className="text-2xl font-bold text-purple-600">{funnel.referrals.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">派遣面接予定</p>
                    <p className="text-2xl font-bold text-amber-600">{funnel.dispatchInterviewScheduled.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">派遣面接数</p>
                    <p className="text-2xl font-bold text-yellow-600">{funnel.dispatchInterviewDone.toLocaleString()}</p>
                  </div>
                </div>
              </Card>

              {/* Row 2: 採用 → 見込み → 稼働 → 売上見込 → 売上確定 */}
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">採用</p>
                    <p className="text-2xl font-bold text-emerald-600">{funnel.hired.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">見込み</p>
                    <p className="text-2xl font-bold text-blue-600">{funnel.prospect.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center">
                    <Play className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">稼働</p>
                    <p className="text-2xl font-bold text-rose-600">{funnel.working.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">売上見込</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(funnel.salesExpectedAmount)}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">売上確定</p>
                    <p className="text-xl font-bold text-cyan-600">{formatCurrency(funnel.salesConfirmedAmount)}</p>
                  </div>
                </div>
              </Card>
              {/* 入金済 - 単独行 */}
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">入金済</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(funnel.salesPaidAmount)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Funnel Flow */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                ファネル転換率
              </h3>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {[
                  { label: '面談', value: funnel.interviewsDone, color: 'bg-sky-500' },
                  { label: '繋ぎ', value: funnel.referrals, color: 'bg-purple-500' },
                  { label: '面接予定', value: funnel.dispatchInterviewScheduled, color: 'bg-amber-500' },
                  { label: '面接数', value: funnel.dispatchInterviewDone, color: 'bg-yellow-500' },
                  { label: '採用', value: funnel.hired, color: 'bg-emerald-500' },
                  { label: '見込み', value: funnel.prospect, color: 'bg-blue-500' },
                  { label: '稼働', value: funnel.working, color: 'bg-rose-500' },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-1">
                    <div className="text-center min-w-[72px]">
                      <div className={`${step.color} text-white text-sm font-bold rounded-lg px-3 py-2`}>
                        {step.value.toLocaleString()}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{step.label}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="flex flex-col items-center min-w-[36px]">
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                        <span className="text-xs text-slate-400">
                          {convRate(step.value, arr[i + 1].value)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Monthly Trend Table */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                月別推移
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">月</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面談</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">繋ぎ</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面接予定</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面接数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">採用</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">見込み</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">稼働</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">売上見込</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">売上確定</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">入金済</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.month}</td>
                        <td className="px-3 py-3 text-sm text-right text-sky-600">{row.interviewsDone}</td>
                        <td className="px-3 py-3 text-sm text-right text-purple-600">{row.referrals}</td>
                        <td className="px-3 py-3 text-sm text-right text-amber-600">{row.dispatchInterviewScheduled}</td>
                        <td className="px-3 py-3 text-sm text-right text-yellow-600">{row.dispatchInterviewDone}</td>
                        <td className="px-3 py-3 text-sm text-right text-emerald-600">{row.hired}</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">{row.prospect}</td>
                        <td className="px-3 py-3 text-sm text-right text-rose-600">{row.working}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{formatCurrency(row.salesExpectedAmount)}</td>
                        <td className="px-3 py-3 text-sm text-right text-cyan-600">{formatCurrency(row.salesConfirmedAmount)}</td>
                        <td className="px-3 py-3 text-sm text-right font-medium text-emerald-600">{formatCurrency(row.salesPaidAmount)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                      <td className="px-3 py-3 text-sm text-right text-sky-600">{funnel.interviewsDone}</td>
                      <td className="px-3 py-3 text-sm text-right text-purple-600">{funnel.referrals}</td>
                      <td className="px-3 py-3 text-sm text-right text-amber-600">{funnel.dispatchInterviewScheduled}</td>
                      <td className="px-3 py-3 text-sm text-right text-yellow-600">{funnel.dispatchInterviewDone}</td>
                      <td className="px-3 py-3 text-sm text-right text-emerald-600">{funnel.hired}</td>
                      <td className="px-3 py-3 text-sm text-right text-blue-600">{funnel.prospect}</td>
                      <td className="px-3 py-3 text-sm text-right text-rose-600">{funnel.working}</td>
                      <td className="px-3 py-3 text-sm text-right text-orange-600">{formatCurrency(funnel.salesExpectedAmount)}</td>
                      <td className="px-3 py-3 text-sm text-right text-cyan-600">{formatCurrency(funnel.salesConfirmedAmount)}</td>
                      <td className="px-3 py-3 text-sm text-right font-medium text-emerald-600">{formatCurrency(funnel.salesPaidAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 稼働月ベース Monthly Table */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" />
                稼働月ベース
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">稼働月</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">見込み件数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">実働件数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">売上見込</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">実働売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workMonthData.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.month}</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">{row.prospectCount}</td>
                        <td className="px-3 py-3 text-sm text-right text-rose-600">{row.workingCount}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{formatCurrency(row.salesExpected)}</td>
                        <td className="px-3 py-3 text-sm text-right text-cyan-600">{formatCurrency(row.salesConfirmed)}</td>
                      </tr>
                    ))}
                    {workMonthData.length > 0 && (
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">
                          {workMonthData.reduce((s, r) => s + r.prospectCount, 0)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-rose-600">
                          {workMonthData.reduce((s, r) => s + r.workingCount, 0)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">
                          {formatCurrency(workMonthData.reduce((s, r) => s + r.salesExpected, 0))}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-cyan-600">
                          {formatCurrency(workMonthData.reduce((s, r) => s + r.salesConfirmed, 0))}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Coordinator Performance */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                担当者別実績
              </h3>
              {coordinatorStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">担当者</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面談</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">繋ぎ</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面接予定</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">面接数</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">採用</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-500">入金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coordinatorStats.map((c) => (
                        <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 text-sm font-medium text-slate-800">{c.name}</td>
                          <td className="px-3 py-3 text-sm text-right text-sky-600">{c.interviewsDone}</td>
                          <td className="px-3 py-3 text-sm text-right text-purple-600">{c.referrals}</td>
                          <td className="px-3 py-3 text-sm text-right text-amber-600">{c.dispatchInterviewScheduled}</td>
                          <td className="px-3 py-3 text-sm text-right text-yellow-600">{c.dispatchInterviewDone}</td>
                          <td className="px-3 py-3 text-sm text-right text-emerald-600">{c.hired}</td>
                          <td className="px-3 py-3 text-sm text-right font-medium text-emerald-600">{formatCurrency(c.salesPaidAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">データがありません</p>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
