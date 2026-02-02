import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Card, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

interface MonthlyStats {
  month: string
  applications: number
  validApplications: number
  referrals: number
  hires: number
  sales: number
}

interface SourceStats {
  id: string
  name: string
  applications: number
  validApplications: number
  conversionRate: number
  costPerApplication: number | null
  totalCost: number
}

interface CoordinatorStats {
  id: string
  name: string
  applications: number
  validApplications: number
  referrals: number
  hires: number
  sales: number
}

export function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([])
  const [coordinatorStats, setCoordinatorStats] = useState<CoordinatorStats[]>([])
  const [period, setPeriod] = useState('6months')

  useEffect(() => {
    fetchReportData()
  }, [period])

  async function fetchReportData() {
    setLoading(true)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    if (period === '3months') {
      startDate.setMonth(startDate.getMonth() - 3)
    } else if (period === '6months') {
      startDate.setMonth(startDate.getMonth() - 6)
    } else if (period === '12months') {
      startDate.setMonth(startDate.getMonth() - 12)
    }

    // Fetch applications with related data
    const { data: applications } = await supabase
      .from('applications')
      .select(`
        id,
        application_status,
        applied_at,
        coordinator_id,
        source_id,
        source:sources (id, name, cost_per_application),
        coordinator:users!applications_coordinator_id_fkey (id, name),
        referrals (
          id,
          referral_status,
          sales (amount, status)
        )
      `)
      .gte('applied_at', startDate.toISOString())
      .lte('applied_at', endDate.toISOString())

    if (!applications) {
      setLoading(false)
      return
    }

    // Calculate monthly stats
    const monthlyMap = new Map<string, MonthlyStats>()
    applications.forEach((app) => {
      const month = app.applied_at.substring(0, 7) // YYYY-MM
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          month,
          applications: 0,
          validApplications: 0,
          referrals: 0,
          hires: 0,
          sales: 0,
        })
      }
      const stats = monthlyMap.get(month)!
      stats.applications++
      if (app.application_status === 'valid' || app.application_status === 'connected' || app.application_status === 'working' || app.application_status === 'completed') {
        stats.validApplications++
      }
      if (app.referrals) {
        app.referrals.forEach((ref: { referral_status: string; sales?: { amount: number; status: string }[] }) => {
          stats.referrals++
          if (ref.referral_status === 'hired' || ref.referral_status === 'assigned' || ref.referral_status === 'working') {
            stats.hires++
          }
          if (ref.sales) {
            ref.sales.forEach((sale: { amount: number; status: string }) => {
              if (sale.status === 'paid') {
                stats.sales += sale.amount
              }
            })
          }
        })
      }
    })
    const sortedMonthly = Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
    setMonthlyStats(sortedMonthly)

    // Calculate source stats
    const sourceMap = new Map<string, SourceStats>()
    applications.forEach((app) => {
      const source = app.source as unknown as { id: string; name: string; cost_per_application: number | null } | null
      if (!source) return
      if (!sourceMap.has(source.id)) {
        sourceMap.set(source.id, {
          id: source.id,
          name: source.name,
          applications: 0,
          validApplications: 0,
          conversionRate: 0,
          costPerApplication: source.cost_per_application,
          totalCost: 0,
        })
      }
      const stats = sourceMap.get(source.id)!
      stats.applications++
      if (source.cost_per_application) {
        stats.totalCost += source.cost_per_application
      }
      if (app.application_status === 'valid' || app.application_status === 'connected' || app.application_status === 'working' || app.application_status === 'completed') {
        stats.validApplications++
      }
    })
    sourceMap.forEach((stats) => {
      stats.conversionRate = stats.applications > 0 ? (stats.validApplications / stats.applications) * 100 : 0
    })
    const sortedSources = Array.from(sourceMap.values()).sort((a, b) => b.applications - a.applications)
    setSourceStats(sortedSources)

    // Calculate coordinator stats
    const coordinatorMap = new Map<string, CoordinatorStats>()
    applications.forEach((app) => {
      const coordinator = app.coordinator as unknown as { id: string; name: string } | null
      if (!coordinator) return
      if (!coordinatorMap.has(coordinator.id)) {
        coordinatorMap.set(coordinator.id, {
          id: coordinator.id,
          name: coordinator.name,
          applications: 0,
          validApplications: 0,
          referrals: 0,
          hires: 0,
          sales: 0,
        })
      }
      const stats = coordinatorMap.get(coordinator.id)!
      stats.applications++
      if (app.application_status === 'valid' || app.application_status === 'connected' || app.application_status === 'working' || app.application_status === 'completed') {
        stats.validApplications++
      }
      if (app.referrals) {
        app.referrals.forEach((ref: { referral_status: string; sales?: { amount: number; status: string }[] }) => {
          stats.referrals++
          if (ref.referral_status === 'hired' || ref.referral_status === 'assigned' || ref.referral_status === 'working') {
            stats.hires++
          }
          if (ref.sales) {
            ref.sales.forEach((sale: { amount: number; status: string }) => {
              if (sale.status === 'paid') {
                stats.sales += sale.amount
              }
            })
          }
        })
      }
    })
    const sortedCoordinators = Array.from(coordinatorMap.values()).sort((a, b) => b.sales - a.sales)
    setCoordinatorStats(sortedCoordinators)

    setLoading(false)
  }

  // Calculate totals
  const totals = monthlyStats.reduce(
    (acc, m) => ({
      applications: acc.applications + m.applications,
      validApplications: acc.validApplications + m.validApplications,
      referrals: acc.referrals + m.referrals,
      hires: acc.hires + m.hires,
      sales: acc.sales + m.sales,
    }),
    { applications: 0, validApplications: 0, referrals: 0, hires: 0, sales: 0 }
  )

  // Calculate previous period for comparison (simplified)
  const currentMonth = monthlyStats[monthlyStats.length - 1]
  const previousMonth = monthlyStats[monthlyStats.length - 2]
  const appChange = currentMonth && previousMonth
    ? ((currentMonth.applications - previousMonth.applications) / (previousMonth.applications || 1)) * 100
    : 0

  return (
    <div>
      <Header
        title="レポート"
        action={
          <Select
            options={[
              { value: '3months', label: '過去3ヶ月' },
              { value: '6months', label: '過去6ヶ月' },
              { value: '12months', label: '過去12ヶ月' },
            ]}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-36"
          />
        }
      />

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">総応募数</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-slate-800">{totals.applications}</p>
                      {appChange !== 0 && (
                        <span className={`flex items-center text-xs ${appChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {appChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {Math.abs(appChange).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">有効応募</p>
                    <p className="text-2xl font-bold text-emerald-600">{totals.validApplications}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">紹介数</p>
                    <p className="text-2xl font-bold text-purple-600">{totals.referrals}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">採用数</p>
                    <p className="text-2xl font-bold text-amber-600">{totals.hires}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">売上</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.sales)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Monthly Trend */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  月別推移
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">月</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">応募数</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効応募</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効率</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">紹介数</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">採用数</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">売上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStats.map((stats) => (
                      <tr key={stats.month} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{stats.month}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600">{stats.applications}</td>
                        <td className="px-4 py-3 text-sm text-right text-emerald-600">{stats.validApplications}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-600">
                          {stats.applications > 0 ? ((stats.validApplications / stats.applications) * 100).toFixed(1) : 0}%
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600">{stats.referrals}</td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">{stats.hires}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                          {formatCurrency(stats.sales)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-4 py-3 text-sm text-slate-800">合計</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-800">{totals.applications}</td>
                      <td className="px-4 py-3 text-sm text-right text-emerald-600">{totals.validApplications}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-600">
                        {totals.applications > 0 ? ((totals.validApplications / totals.applications) * 100).toFixed(1) : 0}%
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-purple-600">{totals.referrals}</td>
                      <td className="px-4 py-3 text-sm text-right text-amber-600">{totals.hires}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                        {formatCurrency(totals.sales)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Source Performance */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  媒体別効果
                </h3>
              </div>
              {sourceStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">媒体名</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">応募数</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効応募</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効率</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">単価</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">総コスト</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceStats.map((stats) => (
                        <tr key={stats.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{stats.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">{stats.applications}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-600">{stats.validApplications}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">
                            {stats.conversionRate.toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">
                            {stats.costPerApplication ? formatCurrency(stats.costPerApplication) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">
                            {stats.totalCost > 0 ? formatCurrency(stats.totalCost) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                            {stats.validApplications > 0 && stats.totalCost > 0
                              ? formatCurrency(Math.round(stats.totalCost / stats.validApplications))
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">データがありません</p>
              )}
            </Card>

            {/* Coordinator Performance */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  担当者別実績
                </h3>
              </div>
              {coordinatorStats.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">担当者</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">担当応募</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効応募</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">有効率</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">紹介数</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">採用数</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">売上</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coordinatorStats.map((stats) => (
                        <tr key={stats.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{stats.name}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">{stats.applications}</td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-600">{stats.validApplications}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-600">
                            {stats.applications > 0 ? ((stats.validApplications / stats.applications) * 100).toFixed(1) : 0}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-purple-600">{stats.referrals}</td>
                          <td className="px-4 py-3 text-sm text-right text-amber-600">{stats.hires}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600">
                            {formatCurrency(stats.sales)}
                          </td>
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
