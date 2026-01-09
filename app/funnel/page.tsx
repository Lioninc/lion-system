'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
  division_name: string | null
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

interface MonthlyData {
  month: number
  interviews: number        // 面接数
  connections: number       // 繋ぎ数（紹介数）
  connectionRate: number    // 繋ぎ率
  activeWorkers: number     // 稼働数（入社した人数）
  activeRate: number        // 稼働率
  expectedRevenue: number   // 売上見込み
  actualRevenue: number     // 売上実績
  paymentRate: number       // 入金率
}

interface EmployeeData {
  employee: Employee
  monthlyData: MonthlyData[]
  totals: MonthlyData
}

const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function getYearOptions() {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push({ value: y.toString(), label: `${y}年度` })
  }
  return years
}

export default function FunnelPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [introductions, setIntroductions] = useState<Introduction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const year = parseInt(selectedYear)
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    // 担当者一覧（管理部を除外）
    const { data: employeesData, error: employeesError } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        divisions (
          name
        )
      `)
      .order('name')

    if (employeesError) {
      console.error('Error fetching employees:', employeesError)
    }

    // 管理部の担当者を除外
    const filteredEmployees: Employee[] = (employeesData || [])
      .map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        division_name: emp.divisions?.name || null,
      }))
      .filter((emp: Employee) => emp.division_name !== '管理部')

    // 面談データ
    const { data: interviewsData } = await supabase
      .from('interviews')
      .select('id, interview_date, employee_id, candidate_id')
      .gte('interview_date', startDate)
      .lte('interview_date', endDate)

    // 紹介データ
    const { data: introductionsData } = await supabase
      .from('introductions')
      .select('id, introduction_date, staff_id, candidate_id, status, start_work_date, job_id')
      .gte('introduction_date', startDate)
      .lte('introduction_date', endDate)

    // 入金データ（紹介に紐づく）
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, introduction_id, total_amount, status, paid_date')

    // 案件データ（紹介料取得用）
    const { data: jobsData } = await supabase
      .from('jobs')
      .select('id, referral_fee')

    setEmployees(filteredEmployees)
    setInterviews(interviewsData || [])
    setIntroductions(introductionsData || [])
    setPayments(paymentsData || [])
    setJobs(jobsData || [])
    setLoading(false)
  }

  const jobsMap = useMemo(() => {
    const map = new Map<string, Job>()
    jobs.forEach(j => map.set(j.id, j))
    return map
  }, [jobs])

  const paymentsMap = useMemo(() => {
    const map = new Map<string, Payment[]>()
    payments.forEach(p => {
      const arr = map.get(p.introduction_id) || []
      arr.push(p)
      map.set(p.introduction_id, arr)
    })
    return map
  }, [payments])

  // 全体データ（全担当者選択時に使用）
  const companyWideData = useMemo(() => {
    const monthlyData: MonthlyData[] = months.map(month => {
      // 該当月の面談数（全担当者）
      const monthInterviews = interviews.filter(i => {
        const date = new Date(i.interview_date)
        return date.getMonth() + 1 === month
      })

      // 該当月の紹介数（全担当者）
      const monthIntroductions = introductions.filter(i => {
        if (!i.introduction_date) return false
        const date = new Date(i.introduction_date)
        return date.getMonth() + 1 === month
      })

      // 稼働数（入社した人数）
      const activeWorkers = monthIntroductions.filter(i => i.start_work_date).length

      // 売上見込み（紹介料の合計）
      let expectedRevenue = 0
      monthIntroductions.forEach(intro => {
        if (intro.job_id) {
          const job = jobsMap.get(intro.job_id)
          if (job?.referral_fee) {
            expectedRevenue += job.referral_fee
          }
        }
      })

      // 売上実績（入金済みの金額）
      let actualRevenue = 0
      monthIntroductions.forEach(intro => {
        const introPayments = paymentsMap.get(intro.id) || []
        introPayments.forEach(p => {
          if (p.status === '入金済み' || p.status === '入金済') {
            actualRevenue += p.total_amount
          }
        })
      })

      // 繋ぎ率 = 紹介数 / 面接数
      const connectionRate = monthInterviews.length > 0
        ? Math.round((monthIntroductions.length / monthInterviews.length) * 100)
        : 0

      // 稼働率 = 稼働数 / 紹介数
      const activeRate = monthIntroductions.length > 0
        ? Math.round((activeWorkers / monthIntroductions.length) * 100)
        : 0

      // 入金率 = 売上実績 / 売上見込み
      const paymentRate = expectedRevenue > 0
        ? Math.round((actualRevenue / expectedRevenue) * 100)
        : 0

      return {
        month,
        interviews: monthInterviews.length,
        connections: monthIntroductions.length,
        connectionRate,
        activeWorkers,
        activeRate,
        expectedRevenue,
        actualRevenue,
        paymentRate,
      }
    })

    // 年間合計
    const totals: MonthlyData = {
      month: 0,
      interviews: monthlyData.reduce((sum, d) => sum + d.interviews, 0),
      connections: monthlyData.reduce((sum, d) => sum + d.connections, 0),
      connectionRate: 0,
      activeWorkers: monthlyData.reduce((sum, d) => sum + d.activeWorkers, 0),
      activeRate: 0,
      expectedRevenue: monthlyData.reduce((sum, d) => sum + d.expectedRevenue, 0),
      actualRevenue: monthlyData.reduce((sum, d) => sum + d.actualRevenue, 0),
      paymentRate: 0,
    }
    totals.connectionRate = totals.interviews > 0
      ? Math.round((totals.connections / totals.interviews) * 100)
      : 0
    totals.activeRate = totals.connections > 0
      ? Math.round((totals.activeWorkers / totals.connections) * 100)
      : 0
    totals.paymentRate = totals.expectedRevenue > 0
      ? Math.round((totals.actualRevenue / totals.expectedRevenue) * 100)
      : 0

    return { monthlyData, totals }
  }, [interviews, introductions, jobsMap, paymentsMap])

  // 個別担当者データ（個別選択時に使用）
  const selectedEmployeeData = useMemo((): EmployeeData | null => {
    if (selectedEmployee === 'all') return null

    const employee = employees.find(e => e.id === selectedEmployee)
    if (!employee) return null

    const monthlyData: MonthlyData[] = months.map(month => {
      // 該当月の面談数（該当担当者のみ）
      const monthInterviews = interviews.filter(i => {
        if (i.employee_id !== employee.id) return false
        const date = new Date(i.interview_date)
        return date.getMonth() + 1 === month
      })

      // 該当月の紹介数（該当担当者のみ）
      const monthIntroductions = introductions.filter(i => {
        if (i.staff_id !== employee.id) return false
        if (!i.introduction_date) return false
        const date = new Date(i.introduction_date)
        return date.getMonth() + 1 === month
      })

      // 稼働数（入社した人数）
      const activeWorkers = monthIntroductions.filter(i => i.start_work_date).length

      // 売上見込み（紹介料の合計）
      let expectedRevenue = 0
      monthIntroductions.forEach(intro => {
        if (intro.job_id) {
          const job = jobsMap.get(intro.job_id)
          if (job?.referral_fee) {
            expectedRevenue += job.referral_fee
          }
        }
      })

      // 売上実績（入金済みの金額）
      let actualRevenue = 0
      monthIntroductions.forEach(intro => {
        const introPayments = paymentsMap.get(intro.id) || []
        introPayments.forEach(p => {
          if (p.status === '入金済み' || p.status === '入金済') {
            actualRevenue += p.total_amount
          }
        })
      })

      // 繋ぎ率 = 紹介数 / 面接数
      const connectionRate = monthInterviews.length > 0
        ? Math.round((monthIntroductions.length / monthInterviews.length) * 100)
        : 0

      // 稼働率 = 稼働数 / 紹介数
      const activeRate = monthIntroductions.length > 0
        ? Math.round((activeWorkers / monthIntroductions.length) * 100)
        : 0

      // 入金率 = 売上実績 / 売上見込み
      const paymentRate = expectedRevenue > 0
        ? Math.round((actualRevenue / expectedRevenue) * 100)
        : 0

      return {
        month,
        interviews: monthInterviews.length,
        connections: monthIntroductions.length,
        connectionRate,
        activeWorkers,
        activeRate,
        expectedRevenue,
        actualRevenue,
        paymentRate,
      }
    })

    // 年間合計
    const totals: MonthlyData = {
      month: 0,
      interviews: monthlyData.reduce((sum, d) => sum + d.interviews, 0),
      connections: monthlyData.reduce((sum, d) => sum + d.connections, 0),
      connectionRate: 0,
      activeWorkers: monthlyData.reduce((sum, d) => sum + d.activeWorkers, 0),
      activeRate: 0,
      expectedRevenue: monthlyData.reduce((sum, d) => sum + d.expectedRevenue, 0),
      actualRevenue: monthlyData.reduce((sum, d) => sum + d.actualRevenue, 0),
      paymentRate: 0,
    }
    totals.connectionRate = totals.interviews > 0
      ? Math.round((totals.connections / totals.interviews) * 100)
      : 0
    totals.activeRate = totals.connections > 0
      ? Math.round((totals.activeWorkers / totals.connections) * 100)
      : 0
    totals.paymentRate = totals.expectedRevenue > 0
      ? Math.round((totals.actualRevenue / totals.expectedRevenue) * 100)
      : 0

    return { employee, monthlyData, totals }
  }, [employees, interviews, introductions, jobsMap, paymentsMap, selectedEmployee])

  // サマリーカード用の合計（全担当者選択時は全体、個別選択時はその担当者）
  const grandTotals = useMemo((): MonthlyData => {
    if (selectedEmployee === 'all') {
      return companyWideData.totals
    }
    return selectedEmployeeData?.totals || {
      month: 0,
      interviews: 0,
      connections: 0,
      connectionRate: 0,
      activeWorkers: 0,
      activeRate: 0,
      expectedRevenue: 0,
      actualRevenue: 0,
      paymentRate: 0,
    }
  }, [selectedEmployee, companyWideData, selectedEmployeeData])

  const employeeOptions = [
    { value: 'all', label: '全担当者' },
    ...employees.map(e => ({ value: e.id, label: e.name }))
  ]

  function formatCurrency(value: number): string {
    if (value === 0) return '-'
    return `¥${value.toLocaleString()}`
  }

  function getRateColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-600'
    if (rate >= 50) return 'text-amber-600'
    if (rate > 0) return 'text-red-600'
    return 'text-slate-400'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">歩留確認</h1>
        <div className="flex gap-4">
          <div className="w-40">
            <Select
              options={getYearOptions()}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={employeeOptions}
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">読み込み中...</div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">面接数</h3>
              <p className="text-xl font-bold text-slate-800">{grandTotals.interviews}</p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">繋ぎ数</h3>
              <p className="text-xl font-bold text-slate-800">{grandTotals.connections}</p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">繋ぎ率</h3>
              <p className={`text-xl font-bold ${getRateColor(grandTotals.connectionRate)}`}>
                {grandTotals.connectionRate}%
              </p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">稼働数</h3>
              <p className="text-xl font-bold text-slate-800">{grandTotals.activeWorkers}</p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">稼働率</h3>
              <p className={`text-xl font-bold ${getRateColor(grandTotals.activeRate)}`}>
                {grandTotals.activeRate}%
              </p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">売上見込み</h3>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(grandTotals.expectedRevenue)}</p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">売上実績</h3>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(grandTotals.actualRevenue)}</p>
            </Card>
            <Card>
              <h3 className="text-xs text-slate-500 mb-1">入金率</h3>
              <p className={`text-xl font-bold ${getRateColor(grandTotals.paymentRate)}`}>
                {grandTotals.paymentRate}%
              </p>
            </Card>
          </div>

          {/* データテーブル */}
          {selectedEmployee === 'all' ? (
            // 全担当者選択時: 会社全体の合計テーブル
            <Card padding="none">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-800">全体</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2 text-left font-medium text-slate-600 border-b">月度</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">面接数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">繋ぎ数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">稼働数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">売上見込み</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">売上実績</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyWideData.monthlyData.map((data: MonthlyData) => (
                      <tr key={data.month} className="hover:bg-slate-50">
                        <td className="px-3 py-2 border-b text-slate-800">{data.month}月</td>
                        <td className="px-3 py-2 border-b text-right">{data.interviews || '-'}</td>
                        <td className="px-3 py-2 border-b text-right">{data.connections || '-'}</td>
                        <td className="px-3 py-2 border-b text-right">{data.activeWorkers || '-'}</td>
                        <td className="px-3 py-2 border-b text-right text-blue-600">
                          {formatCurrency(data.expectedRevenue)}
                        </td>
                        <td className="px-3 py-2 border-b text-right text-emerald-600">
                          {formatCurrency(data.actualRevenue)}
                        </td>
                      </tr>
                    ))}
                    {/* 年間合計行 */}
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-3 py-2 text-slate-800">合計</td>
                      <td className="px-3 py-2 text-right">{companyWideData.totals.interviews}</td>
                      <td className="px-3 py-2 text-right">{companyWideData.totals.connections}</td>
                      <td className="px-3 py-2 text-right">{companyWideData.totals.activeWorkers}</td>
                      <td className="px-3 py-2 text-right text-blue-600">
                        {formatCurrency(companyWideData.totals.expectedRevenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {formatCurrency(companyWideData.totals.actualRevenue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : selectedEmployeeData ? (
            // 個別担当者選択時: その担当者のテーブル
            <Card padding="none">
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-semibold text-slate-800">
                  {selectedEmployeeData.employee.name}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="px-3 py-2 text-left font-medium text-slate-600 border-b">月度</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">面接数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">繋ぎ数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">稼働数</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">売上見込み</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600 border-b">売上実績</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployeeData.monthlyData.map((data: MonthlyData) => (
                      <tr key={data.month} className="hover:bg-slate-50">
                        <td className="px-3 py-2 border-b text-slate-800">{data.month}月</td>
                        <td className="px-3 py-2 border-b text-right">{data.interviews || '-'}</td>
                        <td className="px-3 py-2 border-b text-right">{data.connections || '-'}</td>
                        <td className="px-3 py-2 border-b text-right">{data.activeWorkers || '-'}</td>
                        <td className="px-3 py-2 border-b text-right text-blue-600">
                          {formatCurrency(data.expectedRevenue)}
                        </td>
                        <td className="px-3 py-2 border-b text-right text-emerald-600">
                          {formatCurrency(data.actualRevenue)}
                        </td>
                      </tr>
                    ))}
                    {/* 年間合計行 */}
                    <tr className="bg-slate-100 font-semibold">
                      <td className="px-3 py-2 text-slate-800">合計</td>
                      <td className="px-3 py-2 text-right">{selectedEmployeeData.totals.interviews}</td>
                      <td className="px-3 py-2 text-right">{selectedEmployeeData.totals.connections}</td>
                      <td className="px-3 py-2 text-right">{selectedEmployeeData.totals.activeWorkers}</td>
                      <td className="px-3 py-2 text-right text-blue-600">
                        {formatCurrency(selectedEmployeeData.totals.expectedRevenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {formatCurrency(selectedEmployeeData.totals.actualRevenue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-8 text-slate-500">
                該当するデータがありません
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
