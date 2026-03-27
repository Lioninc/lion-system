import { useEffect, useState, useCallback } from 'react'
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Phone,
  Send,
  Filter,
  DollarSign,
  Percent,
  Play,
  Briefcase,
  Wallet,
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

interface MonthlyRow {
  month: string
  interviews: number
  referrals: number
  referralRate: number
  prospects: number
  prospectRate: number
  working: number
  workingRate: number
  prospectSales: number
  workingSales: number
  unitPrice: number
}

interface SalesMonthRow {
  month: string
  prospects: number
  working: number
  prospectSales: number
  workingSales: number
  unitPrice: number
}

interface StockRow {
  month: string
  stockCount: number
  stockSales: number
  currentCount: number
  currentSales: number
}

interface CoordinatorRow {
  name: string
  interviews: number
  referrals: number
  referralRate: number
  prospects: number
  prospectRate: number
  working: number
  workingRate: number
  workingSales: number
  paidAmount: number
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
// Helpers
// ============================================================

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0
}

function fmtPct(value: number): string {
  return value > 0 ? value.toFixed(1) + '%' : '-'
}

function fmtNum(value: number): string {
  return value > 0 ? value.toLocaleString() : '-'
}

function fmtCurrency(value: number): string {
  return formatCurrency(value)
}

function fmtUnitPrice(sales: number, count: number): string {
  if (count === 0 || sales === 0) return '-'
  return formatCurrency(Math.round(sales / count))
}

/** Rate color: green when high, red when low */
function rateColor(value: number): string {
  if (value === 0) return 'text-slate-400'
  if (value >= 50) return 'text-emerald-600'
  if (value >= 30) return 'text-green-600'
  if (value >= 15) return 'text-amber-600'
  return 'text-red-500'
}

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

  // KPIs
  const [totalInterviews, setTotalInterviews] = useState(0)
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [totalProspects, setTotalProspects] = useState(0)
  const [totalWorking, setTotalWorking] = useState(0)

  // Tables
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([])
  const [salesMonthData, setSalesMonthData] = useState<SalesMonthRow[]>([])
  const [stockData, setStockData] = useState<StockRow[]>([])
  const [coordinatorData, setCoordinatorData] = useState<CoordinatorRow[]>([])

  // Load filter options
  useEffect(() => {
    async function loadFilters() {
      const [coordRes, sourceRes, jobTypeRes] = await Promise.all([
        supabase.from('users').select('id, name').order('name'),
        supabase.from('sources').select('id, name').eq('is_active', true).order('name'),
        supabase.from('applications').select('job_type').not('job_type', 'is', null),
      ])
      const jobTypes = [...new Set((jobTypeRes.data || []).map((r: { job_type: string }) => r.job_type).filter(Boolean))].sort()
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

  // Trigger fetch when filters or options change
  useEffect(() => {
    if (filterOptions.coordinators.length === 0) return
    fetchReport()
  }, [period, coordinatorFilter, sourceFilter, jobTypeFilter, filterOptions])

  // Paginated fetch helper
  async function fetchAllRows<T>(
    table: string,
    select: string,
    filters?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
  ): Promise<T[]> {
    const rows: T[] = []
    let offset = 0
    const pageSize = 1000
    while (true) {
      let q: any = supabase.from(table).select(select)
      if (filters) q = filters(q)
      const { data } = await q.range(offset, offset + pageSize - 1)
      if (!data || data.length === 0) break
      rows.push(...(data as T[]))
      offset += data.length
      if (data.length < pageSize) break
    }
    return rows
  }

  async function fetchReport() {
    setLoading(true)
    const { start, end } = getDateRange()

    try {
      // 1. Applications (filtered)
      const allApps = await fetchAllRows<{
        id: string
        applied_at: string
        coordinator_id: string | null
        source_id: string | null
        job_type: string | null
      }>('applications', 'id, applied_at, coordinator_id, source_id, job_type', (q: any) => {
        q = q.gte('applied_at', start).lte('applied_at', end)
        if (coordinatorFilter) q = q.eq('coordinator_id', coordinatorFilter)
        if (sourceFilter) q = q.eq('source_id', sourceFilter)
        if (jobTypeFilter) q = q.eq('job_type', jobTypeFilter)
        return q
      })
      const appIdSet = new Set(allApps.map((a) => a.id))

      // 2. Interviews
      const rawInterviews = await fetchAllRows<{
        id: string
        application_id: string
        scheduled_at: string
        conducted_at: string | null
        interviewer_id: string | null
      }>('interviews', 'id, application_id, scheduled_at, conducted_at, interviewer_id')
      const allInterviews = rawInterviews.filter((iv) => appIdSet.has(iv.application_id))

      // 3. Referrals
      const rawReferrals = await fetchAllRows<{
        id: string
        application_id: string
        referred_at: string
        referral_status: string
        start_work_date: string | null
      }>('referrals', 'id, application_id, referred_at, referral_status, start_work_date')
      const allReferrals = rawReferrals.filter((r) => appIdSet.has(r.application_id))
      const refIdSet = new Set(allReferrals.map((r) => r.id))

      // 4. Sales
      const rawSales = await fetchAllRows<{
        id: string
        referral_id: string
        amount: number
        status: string
        expected_date: string | null
        confirmed_date: string | null
        paid_date: string | null
        created_at: string
      }>('sales', 'id, referral_id, amount, status, expected_date, confirmed_date, paid_date, created_at')
      const allSales = rawSales.filter((s) => refIdSet.has(s.referral_id))

      // 5. Payments
      const saleIdSet = new Set(allSales.map((s) => s.id))
      const rawPayments = await fetchAllRows<{
        id: string
        sale_id: string
        amount: number
      }>('payments', 'id, sale_id, amount')
      const allPayments = rawPayments.filter((p) => saleIdSet.has(p.sale_id))

      // Lookup maps
      const appCoordMap = new Map<string, string | null>()
      for (const app of allApps) appCoordMap.set(app.id, app.coordinator_id)

      const coordNameMap = new Map<string, string>()
      filterOptions.coordinators.forEach((c) => coordNameMap.set(c.id, c.name))

      // interview → application lookup
      const interviewAppMap = new Map<string, string>()
      for (const iv of allInterviews) interviewAppMap.set(iv.id, iv.application_id)

      // referral → application lookup
      const referralAppMap = new Map<string, string>()
      for (const ref of allReferrals) referralAppMap.set(ref.id, ref.application_id)

      // application → interviewer_id lookup (from the earliest conducted interview)
      const appInterviewerMap = new Map<string, string | null>()
      for (const iv of allInterviews) {
        if (iv.conducted_at && !appInterviewerMap.has(iv.application_id)) {
          appInterviewerMap.set(iv.application_id, iv.interviewer_id)
        }
      }

      // referral → interview month: find earliest interview for this application
      const appInterviewMonth = new Map<string, string>()
      for (const iv of allInterviews) {
        if (!iv.conducted_at) continue
        const month = iv.scheduled_at.substring(0, 7)
        const existing = appInterviewMonth.get(iv.application_id)
        if (!existing || month < existing) appInterviewMonth.set(iv.application_id, month)
      }

      // salesByRef
      const salesByRef = new Map<string, typeof allSales>()
      for (const sale of allSales) {
        const arr = salesByRef.get(sale.referral_id) || []
        arr.push(sale)
        salesByRef.set(sale.referral_id, arr)
      }

      // ============================================================
      // 月別推移（面接月ベース）
      // ============================================================
      const monthMap = new Map<string, {
        interviews: number
        referrals: number
        prospects: number
        working: number
        prospectSales: number
        workingSales: number
      }>()

      const ensureMonth = (month: string) => {
        if (!monthMap.has(month)) {
          monthMap.set(month, { interviews: 0, referrals: 0, prospects: 0, working: 0, prospectSales: 0, workingSales: 0 })
        }
        return monthMap.get(month)!
      }

      // 面接数: conducted_at が NOT NULL のinterviewをscheduled_at月で集計
      for (const iv of allInterviews) {
        if (iv.conducted_at) {
          const month = iv.scheduled_at.substring(0, 7)
          ensureMonth(month).interviews += 1
        }
      }

      // 繋ぎ・見込み・稼働: referral → そのapplicationの面接月で集計
      for (const ref of allReferrals) {
        const ivMonth = appInterviewMonth.get(ref.application_id)
        if (!ivMonth) continue

        const m = ensureMonth(ivMonth)
        m.referrals += 1

        const sales = salesByRef.get(ref.id) || []
        if (sales.length > 0) {
          m.prospects += 1
          const totalSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0)
          m.prospectSales += totalSalesAmount
        }

        if (ref.referral_status === 'working') {
          m.working += 1
          const totalSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0)
          m.workingSales += totalSalesAmount
        }
      }

      const sortedMonths = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]): MonthlyRow => ({
          month,
          interviews: d.interviews,
          referrals: d.referrals,
          referralRate: pct(d.referrals, d.interviews),
          prospects: d.prospects,
          prospectRate: pct(d.prospects, d.referrals),
          working: d.working,
          workingRate: pct(d.working, d.prospects),
          prospectSales: d.prospectSales,
          workingSales: d.workingSales,
          unitPrice: d.working > 0 ? Math.round(d.workingSales / d.working) : 0,
        }))

      setMonthlyData(sortedMonths)

      // Totals for KPI
      const totInterviews = sortedMonths.reduce((s, r) => s + r.interviews, 0)
      const totReferrals = sortedMonths.reduce((s, r) => s + r.referrals, 0)
      const totProspects = sortedMonths.reduce((s, r) => s + r.prospects, 0)
      const totWorking = sortedMonths.reduce((s, r) => s + r.working, 0)
      setTotalInterviews(totInterviews)
      setTotalReferrals(totReferrals)
      setTotalProspects(totProspects)
      setTotalWorking(totWorking)

      // ============================================================
      // 月別推移（売上月ベース） — sales.created_at月で集計
      // ============================================================
      const salesMonthMap = new Map<string, {
        prospects: number
        working: number
        prospectSales: number
        workingSales: number
      }>()

      const ensureSalesMonth = (month: string) => {
        if (!salesMonthMap.has(month)) {
          salesMonthMap.set(month, { prospects: 0, working: 0, prospectSales: 0, workingSales: 0 })
        }
        return salesMonthMap.get(month)!
      }

      // Group sales by referral_id + month to count unique referrals per month
      const refMonthProspect = new Set<string>()
      const refMonthWorking = new Set<string>()

      for (const sale of allSales) {
        const saleMonth = sale.created_at.substring(0, 7)
        const sm = ensureSalesMonth(saleMonth)

        const refKey = `${sale.referral_id}_${saleMonth}`
        if (!refMonthProspect.has(refKey)) {
          refMonthProspect.add(refKey)
          sm.prospects += 1
        }
        sm.prospectSales += sale.amount

        // Check if this referral is working
        const ref = allReferrals.find((r) => r.id === sale.referral_id)
        if (ref && ref.referral_status === 'working') {
          if (!refMonthWorking.has(refKey)) {
            refMonthWorking.add(refKey)
            sm.working += 1
          }
          sm.workingSales += sale.amount
        }
      }

      const sortedSalesMonths = Array.from(salesMonthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]): SalesMonthRow => ({
          month,
          prospects: d.prospects,
          working: d.working,
          prospectSales: d.prospectSales,
          workingSales: d.workingSales,
          unitPrice: d.working > 0 ? Math.round(d.workingSales / d.working) : 0,
        }))
      setSalesMonthData(sortedSalesMonths)

      // ============================================================
      // ストック・当月テーブル（面接月ベース）
      // ============================================================
      // 面接月 = interviews.scheduled_at の年月
      // 稼働月 = referrals.start_work_date の年月
      // ストック: 面接月 ≠ 稼働月 → 面接月に計上
      // 当月: 面接月 = 稼働月 → 面接月に計上
      const stockMap = new Map<string, {
        stockCount: number
        stockSales: number
        currentCount: number
        currentSales: number
      }>()

      const ensureStockMonth = (month: string) => {
        if (!stockMap.has(month)) {
          stockMap.set(month, { stockCount: 0, stockSales: 0, currentCount: 0, currentSales: 0 })
        }
        return stockMap.get(month)!
      }

      // sale_id → referral_id lookup
      const saleRefMap = new Map<string, string>()
      for (const sale of allSales) saleRefMap.set(sale.id, sale.referral_id)

      // referral_id → referral lookup
      const refById = new Map<string, typeof allReferrals[number]>()
      for (const ref of allReferrals) refById.set(ref.id, ref)

      for (const ref of allReferrals) {
        if (!ref.start_work_date) continue
        const workMonth = ref.start_work_date.substring(0, 7)
        const ivMonth = appInterviewMonth.get(ref.application_id)
        if (!ivMonth) continue

        const sm = ensureStockMonth(ivMonth)
        const sales = salesByRef.get(ref.id) || []
        const refSalesAmount = sales.reduce((sum, s) => sum + s.amount, 0)

        if (ivMonth !== workMonth) {
          sm.stockCount += 1
          sm.stockSales += refSalesAmount
        } else {
          sm.currentCount += 1
          sm.currentSales += refSalesAmount
        }
      }

      const sortedStock = Array.from(stockMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]): StockRow => ({
          month,
          stockCount: d.stockCount,
          stockSales: d.stockSales,
          currentCount: d.currentCount,
          currentSales: d.currentSales,
        }))
      setStockData(sortedStock)

      // ============================================================
      // 担当者別実績
      // ============================================================
      const crdMap = new Map<string, {
        name: string
        interviews: number
        referrals: number
        prospects: number
        working: number
        workingSales: number
        paidAmount: number
      }>()

      for (const iv of allInterviews) {
        if (iv.conducted_at) {
          // 面接数はinterviewer_id（面談担当者）で集計
          const interviewerKey = iv.interviewer_id || '_none'
          if (!crdMap.has(interviewerKey)) {
            const name = iv.interviewer_id ? (coordNameMap.get(iv.interviewer_id) || '不明') : '未設定'
            crdMap.set(interviewerKey, { name, interviews: 0, referrals: 0, prospects: 0, working: 0, workingSales: 0, paidAmount: 0 })
          }
          crdMap.get(interviewerKey)!.interviews += 1
        }
      }

      for (const ref of allReferrals) {
        // 繋ぎ数はinterviewer_id（面談担当者）で集計、interview_doneのみ
        const interviewerId = appInterviewerMap.get(ref.application_id)
        const iKey = interviewerId || '_none'
        if (!crdMap.has(iKey)) {
          const name = interviewerId ? (coordNameMap.get(interviewerId) || '不明') : '未設定'
          crdMap.set(iKey, { name, interviews: 0, referrals: 0, prospects: 0, working: 0, workingSales: 0, paidAmount: 0 })
        }
        const crd = crdMap.get(iKey)!

        crd.referrals += 1

        const sales = salesByRef.get(ref.id) || []
        if (sales.length > 0) crd.prospects += 1

        if (ref.referral_status === 'working') {
          crd.working += 1
          crd.workingSales += sales.reduce((sum, s) => sum + s.amount, 0)
        }
      }

      // 入金: payments → sale → referral → interviewer_id で集計
      for (const payment of allPayments) {
        const referralId = saleRefMap.get(payment.sale_id)
        if (!referralId) continue
        const ref = refById.get(referralId)
        if (!ref) continue
        const interviewerId = appInterviewerMap.get(ref.application_id)
        const iKey = interviewerId || '_none'
        if (crdMap.has(iKey)) {
          crdMap.get(iKey)!.paidAmount += payment.amount
        }
      }

      const sortedCoord = Array.from(crdMap.values())
        .sort((a, b) => b.workingSales - a.workingSales)
        .map((d): CoordinatorRow => ({
          name: d.name,
          interviews: d.interviews,
          referrals: d.referrals,
          referralRate: pct(d.referrals, d.interviews),
          prospects: d.prospects,
          prospectRate: pct(d.prospects, d.referrals),
          working: d.working,
          workingRate: pct(d.working, d.prospects),
          workingSales: d.workingSales,
          paidAmount: d.paidAmount,
        }))
      setCoordinatorData(sortedCoord)

    } catch (err) {
      console.error('Report fetch error:', err)
    }

    setLoading(false)
  }

  // KPI derived values
  const referralRate = pct(totalReferrals, totalInterviews)
  const prospectRate = pct(totalProspects, totalReferrals)
  const workingRate = pct(totalWorking, totalProspects)

  return (
    <div>
      <Header title="月次レポート" />

      <div className="p-6 space-y-6">
        {/* ============================================================ */}
        {/* 1. Filters */}
        {/* ============================================================ */}
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
            {/* ============================================================ */}
            {/* 2. KPI Cards (7 cards) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {/* 面接数 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                    <Phone className="w-4 h-4 text-sky-600" />
                  </div>
                  <p className="text-xs text-slate-500">面接数</p>
                </div>
                <p className="text-2xl font-bold text-sky-600">{totalInterviews.toLocaleString()}</p>
              </Card>

              {/* 繋ぎ数 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Send className="w-4 h-4 text-purple-600" />
                  </div>
                  <p className="text-xs text-slate-500">繋ぎ数</p>
                </div>
                <p className="text-2xl font-bold text-purple-600">{totalReferrals.toLocaleString()}</p>
              </Card>

              {/* 繋ぎ率 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Percent className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xs text-slate-500">繋ぎ率</p>
                </div>
                <p className={`text-2xl font-bold ${rateColor(referralRate)}`}>{fmtPct(referralRate)}</p>
              </Card>

              {/* 見込み数 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs text-slate-500">見込み数</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{totalProspects.toLocaleString()}</p>
              </Card>

              {/* 見込み率 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xs text-slate-500">見込み率</p>
                </div>
                <p className={`text-2xl font-bold ${rateColor(prospectRate)}`}>{fmtPct(prospectRate)}</p>
              </Card>

              {/* 稼働数 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                    <Play className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-xs text-slate-500">稼働数</p>
                </div>
                <p className="text-2xl font-bold text-rose-600">{totalWorking.toLocaleString()}</p>
              </Card>

              {/* 稼働率 */}
              <Card>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xs text-slate-500">稼働率</p>
                </div>
                <p className={`text-2xl font-bold ${rateColor(workingRate)}`}>{fmtPct(workingRate)}</p>
              </Card>
            </div>

            {/* ============================================================ */}
            {/* 3. Monthly Trend (Interview Month) */}
            {/* ============================================================ */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                月別推移（面接月ベース）
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">月</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-sky-600">面接数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-purple-600">繋ぎ数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-green-600">繋ぎ率</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-blue-600">見込み数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-green-600">見込み率</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-rose-600">稼働数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-green-600">稼働率</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">見込み売上</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">稼働売上</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-600">単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.month}</td>
                        <td className="px-3 py-3 text-sm text-right text-sky-600">{fmtNum(row.interviews)}</td>
                        <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(row.referrals)}</td>
                        <td className={`px-3 py-3 text-sm text-right ${rateColor(row.referralRate)}`}>{fmtPct(row.referralRate)}</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(row.prospects)}</td>
                        <td className={`px-3 py-3 text-sm text-right ${rateColor(row.prospectRate)}`}>{fmtPct(row.prospectRate)}</td>
                        <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(row.working)}</td>
                        <td className={`px-3 py-3 text-sm text-right ${rateColor(row.workingRate)}`}>{fmtPct(row.workingRate)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.prospectSales)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.workingSales)}</td>
                        <td className="px-3 py-3 text-sm text-right text-slate-700">{fmtUnitPrice(row.workingSales, row.working)}</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    {monthlyData.length > 0 && (() => {
                      const totI = monthlyData.reduce((s, r) => s + r.interviews, 0)
                      const totR = monthlyData.reduce((s, r) => s + r.referrals, 0)
                      const totP = monthlyData.reduce((s, r) => s + r.prospects, 0)
                      const totW = monthlyData.reduce((s, r) => s + r.working, 0)
                      const totPS = monthlyData.reduce((s, r) => s + r.prospectSales, 0)
                      const totWS = monthlyData.reduce((s, r) => s + r.workingSales, 0)
                      return (
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                          <td className="px-3 py-3 text-sm text-right text-sky-600">{fmtNum(totI)}</td>
                          <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(totR)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totR, totI))}`}>{fmtPct(pct(totR, totI))}</td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(totP)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totP, totR))}`}>{fmtPct(pct(totP, totR))}</td>
                          <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(totW)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totW, totP))}`}>{fmtPct(pct(totW, totP))}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totPS)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totWS)}</td>
                          <td className="px-3 py-3 text-sm text-right text-slate-700">{fmtUnitPrice(totWS, totW)}</td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ============================================================ */}
            {/* 4. Monthly Trend (Sales Month) */}
            {/* ============================================================ */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                月別推移（売上月ベース）
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">月</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-blue-600">見込み数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-rose-600">稼働数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">見込み売上</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">稼働売上</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-600">単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesMonthData.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.month}</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(row.prospects)}</td>
                        <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(row.working)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.prospectSales)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.workingSales)}</td>
                        <td className="px-3 py-3 text-sm text-right text-slate-700">{fmtUnitPrice(row.workingSales, row.working)}</td>
                      </tr>
                    ))}
                    {salesMonthData.length > 0 && (() => {
                      const totP = salesMonthData.reduce((s, r) => s + r.prospects, 0)
                      const totW = salesMonthData.reduce((s, r) => s + r.working, 0)
                      const totPS = salesMonthData.reduce((s, r) => s + r.prospectSales, 0)
                      const totWS = salesMonthData.reduce((s, r) => s + r.workingSales, 0)
                      return (
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(totP)}</td>
                          <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(totW)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totPS)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totWS)}</td>
                          <td className="px-3 py-3 text-sm text-right text-slate-700">{fmtUnitPrice(totWS, totW)}</td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ============================================================ */}
            {/* 5. Stock & Current Month */}
            {/* ============================================================ */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                ストック・当月
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">月</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-blue-600">ストック件数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">ストック売上</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-purple-600">当月件数</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">当月売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.month}</td>
                        <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(row.stockCount)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.stockSales)}</td>
                        <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(row.currentCount)}</td>
                        <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(row.currentSales)}</td>
                      </tr>
                    ))}
                    {stockData.length > 0 && (() => {
                      const totSC = stockData.reduce((s, r) => s + r.stockCount, 0)
                      const totSS = stockData.reduce((s, r) => s + r.stockSales, 0)
                      const totCC = stockData.reduce((s, r) => s + r.currentCount, 0)
                      const totCS = stockData.reduce((s, r) => s + r.currentSales, 0)
                      return (
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(totSC)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totSS)}</td>
                          <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(totCC)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totCS)}</td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ============================================================ */}
            {/* 6. Coordinator Performance */}
            {/* ============================================================ */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                担当者別実績
              </h3>
              {coordinatorData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-500">担当者</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-sky-600">面接数</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-purple-600">繋ぎ数</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-green-600">繋ぎ率</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-blue-600">見込み数</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-green-600">見込み率</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-rose-600">稼働数</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-green-600">稼働率</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-orange-600">稼働売上</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-emerald-600">入金</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coordinatorData.map((c) => (
                        <tr key={c.name} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 text-sm font-medium text-slate-800">{c.name}</td>
                          <td className="px-3 py-3 text-sm text-right text-sky-600">{fmtNum(c.interviews)}</td>
                          <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(c.referrals)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(c.referralRate)}`}>{fmtPct(c.referralRate)}</td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(c.prospects)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(c.prospectRate)}`}>{fmtPct(c.prospectRate)}</td>
                          <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(c.working)}</td>
                          <td className={`px-3 py-3 text-sm text-right ${rateColor(c.workingRate)}`}>{fmtPct(c.workingRate)}</td>
                          <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(c.workingSales)}</td>
                          <td className="px-3 py-3 text-sm text-right text-emerald-600">{fmtCurrency(c.paidAmount)}</td>
                        </tr>
                      ))}
                      {(() => {
                        const totI = coordinatorData.reduce((s, r) => s + r.interviews, 0)
                        const totR = coordinatorData.reduce((s, r) => s + r.referrals, 0)
                        const totP = coordinatorData.reduce((s, r) => s + r.prospects, 0)
                        const totW = coordinatorData.reduce((s, r) => s + r.working, 0)
                        const totWS = coordinatorData.reduce((s, r) => s + r.workingSales, 0)
                        const totPaid = coordinatorData.reduce((s, r) => s + r.paidAmount, 0)
                        return (
                          <tr className="bg-slate-50 font-semibold">
                            <td className="px-3 py-3 text-sm text-slate-800">合計</td>
                            <td className="px-3 py-3 text-sm text-right text-sky-600">{fmtNum(totI)}</td>
                            <td className="px-3 py-3 text-sm text-right text-purple-600">{fmtNum(totR)}</td>
                            <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totR, totI))}`}>{fmtPct(pct(totR, totI))}</td>
                            <td className="px-3 py-3 text-sm text-right text-blue-600">{fmtNum(totP)}</td>
                            <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totP, totR))}`}>{fmtPct(pct(totP, totR))}</td>
                            <td className="px-3 py-3 text-sm text-right text-rose-600">{fmtNum(totW)}</td>
                            <td className={`px-3 py-3 text-sm text-right ${rateColor(pct(totW, totP))}`}>{fmtPct(pct(totW, totP))}</td>
                            <td className="px-3 py-3 text-sm text-right text-orange-600">{fmtCurrency(totWS)}</td>
                            <td className="px-3 py-3 text-sm text-right text-emerald-600">{fmtCurrency(totPaid)}</td>
                          </tr>
                        )
                      })()}
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
