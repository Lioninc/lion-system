'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type PeriodType = 'month' | 'quarter' | 'year'

interface Employee {
  id: string
  name: string
  division_name: string | null
}

interface Application {
  id: string
  application_date: string
  candidate_id: string
}

interface Interview {
  id: string
  interview_date: string
  employee_id: string | null
  candidate_id: string
}

interface Introduction {
  id: string
  introduction_date: string | null
  staff_id: string | null
  candidate_id: string
  status: string
  start_work_date: string | null
  job_id: string | null
}

interface Payment {
  id: string
  introduction_id: string
  total_amount: number
  status: string
  paid_date: string | null
}

interface Job {
  id: string
  referral_fee: number | null
}

interface MonthlyStats {
  month: string
  label: string
  applications: number
  interviews: number
  introductions: number
  startedWorking: number
  expectedRevenue: number
  paidAmount: number
  pendingAmount: number
}

interface EmployeeStats {
  employee: Employee
  applications: number
  interviews: number
  introductions: number
  startedWorking: number
  totalRevenue: number
}

function formatCurrency(value: number): string {
  if (value === 0) return '-'
  return `¥${value.toLocaleString()}`
}

export default function ManagerPage() {
  const router = useRouter()
  const [period, setPeriod] = useState<PeriodType>('month')
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  // Raw data
  const [employees, setEmployees] = useState<Employee[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [introductions, setIntroductions] = useState<Introduction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [jobs, setJobs] = useState<Job[]>([])

  // Check access and load data on mount
  useEffect(() => {
    checkAccessAndLoadData()
  }, [])

  async function checkAccessAndLoadData() {
    const supabase = createClient()

    // Check user role
    const savedUserId = localStorage.getItem('currentUserId')
    if (savedUserId) {
      const { data: userData } = await supabase
        .from('employees')
        .select('id, role')
        .eq('id', savedUserId)
        .single()

      const user = userData as { id: string; role: string } | null
      if (user && (user.role === 'admin' || user.role === 'manager')) {
        setHasAccess(true)
      } else {
        router.push('/dashboard')
        return
      }
    } else {
      // No user selected, try to find admin/manager
      const { data: adminUser } = await supabase
        .from('employees')
        .select('id, role')
        .in('role', ['admin', 'manager'])
        .limit(1)
        .single()

      const admin = adminUser as { id: string; role: string } | null
      if (admin) {
        localStorage.setItem('currentUserId', admin.id)
        setHasAccess(true)
      } else {
        router.push('/dashboard')
        return
      }
    }

    await fetchData()
  }

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()

    // Calculate date range based on period (get 12 months of data for flexibility)
    const now = new Date()
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const [
      employeesResult,
      applicationsResult,
      interviewsResult,
      introductionsResult,
      paymentsResult,
      jobsResult,
    ] = await Promise.all([
      // Employees (excluding admin department)
      supabase
        .from('employees')
        .select(`id, name, divisions (name)`)
        .order('name'),

      // Applications
      supabase
        .from('applications')
        .select('id, application_date, candidate_id')
        .gte('application_date', startDateStr)
        .lte('application_date', endDateStr),

      // Interviews
      supabase
        .from('interviews')
        .select('id, interview_date, employee_id, candidate_id')
        .gte('interview_date', startDateStr)
        .lte('interview_date', endDateStr),

      // Introductions
      supabase
        .from('introductions')
        .select('id, introduction_date, staff_id, candidate_id, status, start_work_date, job_id')
        .gte('introduction_date', startDateStr)
        .lte('introduction_date', endDateStr),

      // Payments
      supabase.from('payments').select('id, introduction_id, total_amount, status, paid_date'),

      // Jobs
      supabase.from('jobs').select('id, referral_fee'),
    ])

    // Filter out admin department employees
    const filteredEmployees: Employee[] = (employeesResult.data || [])
      .map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        division_name: emp.divisions?.name || null,
      }))
      .filter((emp: Employee) => emp.division_name !== '管理部')

    setEmployees(filteredEmployees)
    setApplications(applicationsResult.data || [])
    setInterviews(interviewsResult.data || [])
    setIntroductions(introductionsResult.data || [])
    setPayments(paymentsResult.data || [])
    setJobs(jobsResult.data || [])
    setLoading(false)
  }

  // Maps for quick lookups
  const jobsMap = useMemo(() => {
    const map = new Map<string, Job>()
    jobs.forEach((j) => map.set(j.id, j))
    return map
  }, [jobs])

  const paymentsMap = useMemo(() => {
    const map = new Map<string, Payment[]>()
    payments.forEach((p) => {
      const arr = map.get(p.introduction_id) || []
      arr.push(p)
      map.set(p.introduction_id, arr)
    })
    return map
  }, [payments])

  // Get date range based on period
  const dateRange = useMemo(() => {
    const now = new Date()

    if (period === 'month') {
      // Current month
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      return { start, end, months: [monthKey] }
    } else if (period === 'quarter') {
      // Last 3 months
      const months: string[] = []
      for (let i = 2; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start, end, months }
    } else {
      // Full year (12 months)
      const months: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start, end, months }
    }
  }, [period])

  // Monthly statistics
  const monthlyStats = useMemo((): MonthlyStats[] => {
    return dateRange.months.map((monthKey) => {
      const [year, month] = monthKey.split('-').map(Number)

      // Filter data for this month
      const monthApplications = applications.filter((a) => {
        const d = new Date(a.application_date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })

      const monthInterviews = interviews.filter((i) => {
        const d = new Date(i.interview_date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })

      const monthIntroductions = introductions.filter((i) => {
        if (!i.introduction_date) return false
        const d = new Date(i.introduction_date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })

      const monthStartedWorking = introductions.filter((i) => {
        if (!i.start_work_date) return false
        const d = new Date(i.start_work_date)
        return d.getFullYear() === year && d.getMonth() + 1 === month
      })

      // Calculate revenue
      let expectedRevenue = 0
      let paidAmount = 0
      let pendingAmount = 0

      monthStartedWorking.forEach((intro) => {
        if (intro.job_id) {
          const job = jobsMap.get(intro.job_id)
          if (job?.referral_fee) {
            expectedRevenue += job.referral_fee
          }
        }

        const introPayments = paymentsMap.get(intro.id) || []
        introPayments.forEach((p) => {
          if (p.status === '入金済み' || p.status === '入金済') {
            paidAmount += p.total_amount
          } else if (p.status === '請求中' || p.status === '入金途中' || p.status === '入金予定') {
            pendingAmount += p.total_amount
          }
        })
      })

      return {
        month: monthKey,
        label: `${month}月`,
        applications: monthApplications.length,
        interviews: monthInterviews.length,
        introductions: monthIntroductions.length,
        startedWorking: monthStartedWorking.length,
        expectedRevenue,
        paidAmount,
        pendingAmount,
      }
    })
  }, [applications, interviews, introductions, dateRange, jobsMap, paymentsMap])

  // Summary totals
  const summaryTotals = useMemo(() => {
    return monthlyStats.reduce(
      (acc, stats) => ({
        expectedRevenue: acc.expectedRevenue + stats.expectedRevenue,
        paidAmount: acc.paidAmount + stats.paidAmount,
        pendingAmount: acc.pendingAmount + stats.pendingAmount,
        applications: acc.applications + stats.applications,
        interviews: acc.interviews + stats.interviews,
        introductions: acc.introductions + stats.introductions,
        startedWorking: acc.startedWorking + stats.startedWorking,
      }),
      {
        expectedRevenue: 0,
        paidAmount: 0,
        pendingAmount: 0,
        applications: 0,
        interviews: 0,
        introductions: 0,
        startedWorking: 0,
      }
    )
  }, [monthlyStats])

  // Employee statistics
  const employeeStats = useMemo((): EmployeeStats[] => {
    return employees.map((employee) => {
      // Count applications (need to join through candidates - simplified: count interviews by employee)
      const empInterviews = interviews.filter(
        (i) =>
          i.employee_id === employee.id &&
          new Date(i.interview_date) >= dateRange.start &&
          new Date(i.interview_date) <= dateRange.end
      )

      const empIntroductions = introductions.filter(
        (i) =>
          i.staff_id === employee.id &&
          i.introduction_date &&
          new Date(i.introduction_date) >= dateRange.start &&
          new Date(i.introduction_date) <= dateRange.end
      )

      const empStartedWorking = introductions.filter(
        (i) =>
          i.staff_id === employee.id &&
          i.start_work_date &&
          new Date(i.start_work_date) >= dateRange.start &&
          new Date(i.start_work_date) <= dateRange.end
      )

      // Calculate revenue
      let totalRevenue = 0
      empStartedWorking.forEach((intro) => {
        if (intro.job_id) {
          const job = jobsMap.get(intro.job_id)
          if (job?.referral_fee) {
            totalRevenue += job.referral_fee
          }
        }
      })

      // Count applications by counting interviews (approximation)
      const empApplications = empInterviews.length

      return {
        employee,
        applications: empApplications,
        interviews: empInterviews.length,
        introductions: empIntroductions.length,
        startedWorking: empStartedWorking.length,
        totalRevenue,
      }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [employees, interviews, introductions, dateRange, jobsMap])

  // KPI Funnel data
  const funnelData = useMemo(() => {
    const total = summaryTotals
    return [
      {
        stage: '応募',
        count: total.applications,
        rate: 100,
      },
      {
        stage: '面談',
        count: total.interviews,
        rate: total.applications > 0 ? Math.round((total.interviews / total.applications) * 100) : 0,
      },
      {
        stage: '紹介',
        count: total.introductions,
        rate: total.interviews > 0 ? Math.round((total.introductions / total.interviews) * 100) : 0,
      },
      {
        stage: '稼働',
        count: total.startedWorking,
        rate:
          total.introductions > 0
            ? Math.round((total.startedWorking / total.introductions) * 100)
            : 0,
      },
    ]
  }, [summaryTotals])

  // Chart data for revenue trend
  const revenueChartData = useMemo(() => {
    return {
      labels: monthlyStats.map((s) => s.label),
      datasets: [
        {
          label: '売上見込み',
          data: monthlyStats.map((s) => s.expectedRevenue),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: '入金済み',
          data: monthlyStats.map((s) => s.paidAmount),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.3,
        },
      ],
    }
  }, [monthlyStats])

  // Chart data for applications/working trend
  const trendChartData = useMemo(() => {
    return {
      labels: monthlyStats.map((s) => s.label),
      datasets: [
        {
          label: '応募数',
          data: monthlyStats.map((s) => s.applications),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
        },
        {
          label: '稼働数',
          data: monthlyStats.map((s) => s.startedWorking),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
        },
      ],
    }
  }, [monthlyStats])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="text-center py-8 text-slate-500">アクセス権限を確認中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">経営ダッシュボード</h1>

        {/* Period selector */}
        <div className="flex gap-2">
          {[
            { value: 'month', label: '今月' },
            { value: 'quarter', label: '3ヶ月' },
            { value: 'year', label: '年間' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value as PeriodType)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                period === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">読み込み中...</div>
      ) : (
        <>
          {/* 1. Revenue Summary Cards */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">売上・入金サマリー</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">売上見込み合計</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(summaryTotals.expectedRevenue)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <span className="text-2xl">��</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">入金済み合計</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(summaryTotals.paidAmount)}
                    </p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">入金待ち合計</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(summaryTotals.pendingAmount)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Revenue Trend Chart */}
          <Card>
            <h3 className="text-sm font-medium text-slate-700 mb-4">月別推移（売上・入金）</h3>
            <div className="h-64">
              <Line data={revenueChartData} options={chartOptions} />
            </div>
          </Card>

          {/* 2. Employee Performance Table */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">担当者別実績比較</h2>
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-4 py-3 text-left font-medium text-slate-600 border-b">
                        担当者名
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 border-b">
                        応募数
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 border-b">
                        面談数
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 border-b">
                        紹介数
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 border-b">
                        稼働数
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600 border-b">
                        売上合計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map((stat) => (
                      <tr key={stat.employee.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 border-b font-medium text-slate-800">
                          {stat.employee.name}
                        </td>
                        <td className="px-4 py-3 border-b text-right">{stat.applications || '-'}</td>
                        <td className="px-4 py-3 border-b text-right">{stat.interviews || '-'}</td>
                        <td className="px-4 py-3 border-b text-right">
                          {stat.introductions || '-'}
                        </td>
                        <td className="px-4 py-3 border-b text-right">
                          {stat.startedWorking || '-'}
                        </td>
                        <td className="px-4 py-3 border-b text-right text-blue-600 font-medium">
                          {formatCurrency(stat.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                    {employeeStats.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          データがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* 3. KPI Funnel */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">月別KPIファネル</h2>
            <div className="grid grid-cols-4 gap-4">
              {funnelData.map((stage, index) => (
                <Card key={stage.stage}>
                  <div className="text-center">
                    <p className="text-xs text-slate-500 mb-1">{stage.stage}</p>
                    <p className="text-3xl font-bold text-slate-800">{stage.count}</p>
                    {index > 0 && (
                      <p className="text-sm text-slate-500 mt-2">
                        転換率:{' '}
                        <span
                          className={`font-medium ${
                            stage.rate >= 50
                              ? 'text-emerald-600'
                              : stage.rate >= 30
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {stage.rate}%
                        </span>
                      </p>
                    )}
                  </div>
                  {index < funnelData.length - 1 && (
                    <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 text-slate-300 text-2xl">
                      →
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* 4. Overall Trend Chart */}
          <div>
            <h2 className="text-sm font-medium text-slate-500 mb-3">全体トレンド</h2>
            <Card>
              <h3 className="text-sm font-medium text-slate-700 mb-4">
                月別の応募数・稼働数の推移
              </h3>
              <div className="h-64">
                <Bar data={trendChartData} options={barChartOptions} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
