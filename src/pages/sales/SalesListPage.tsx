import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Filter,
  DollarSign,
  Calendar,
  User,
  Building2,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle,
  CreditCard,
} from 'lucide-react'
import { Card, Badge, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { SaleStatus } from '../../types/database'
import { SALE_STATUS_LABELS } from '../../types/database'

interface SaleWithDetails {
  id: string
  amount: number
  status: SaleStatus
  expected_date: string | null
  confirmed_date: string | null
  invoiced_date: string | null
  paid_date: string | null
  notes: string | null
  referral: {
    id: string
    application: {
      id: string
      job_seeker: {
        id: string
        name: string
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
}

const SALE_STATUS_OPTIONS = [
  { value: '', label: 'すべてのステータス' },
  ...Object.entries(SALE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export function SalesListPage() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<SaleWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companies, setCompanies] = useState<{ value: string; label: string }[]>([])
  const [companyFilter, setCompanyFilter] = useState('')
  const [dateRange, setDateRange] = useState<'all' | 'thisMonth' | 'lastMonth' | 'thisYear'>('all')

  useEffect(() => {
    fetchSales()
    fetchCompanies()
  }, [])

  async function fetchSales() {
    setLoading(true)

    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        referral:referrals (
          id,
          application:applications (
            id,
            job_seeker:job_seekers (
              id,
              name
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
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sales:', error)
      setLoading(false)
      return
    }

    setSales(data as unknown as SaleWithDetails[])
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

  const filteredSales = sales.filter((sale) => {
    const matchesSearch =
      sale.referral?.application?.job_seeker?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.referral?.job?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.referral?.job?.company?.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || sale.status === statusFilter
    const matchesCompany = !companyFilter || sale.referral?.job?.company?.id === companyFilter

    // Date filter
    let matchesDate = true
    if (dateRange !== 'all') {
      const now = new Date()
      const saleDate = sale.expected_date ? new Date(sale.expected_date) : new Date(sale.paid_date || '')

      if (dateRange === 'thisMonth') {
        matchesDate = saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear()
      } else if (dateRange === 'lastMonth') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        matchesDate = saleDate.getMonth() === lastMonth.getMonth() && saleDate.getFullYear() === lastMonth.getFullYear()
      } else if (dateRange === 'thisYear') {
        matchesDate = saleDate.getFullYear() === now.getFullYear()
      }
    }

    return matchesSearch && matchesStatus && matchesCompany && matchesDate
  })

  // Calculate totals
  const totals = filteredSales.reduce((acc, sale) => {
    acc.total += sale.amount
    if (sale.status === 'expected') acc.expected += sale.amount
    if (sale.status === 'confirmed') acc.confirmed += sale.amount
    if (sale.status === 'invoiced') acc.invoiced += sale.amount
    if (sale.status === 'paid') acc.paid += sale.amount
    return acc
  }, { total: 0, expected: 0, confirmed: 0, invoiced: 0, paid: 0 })

  function getSaleStatusBadgeVariant(status: SaleStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'expected': return 'info'
      case 'confirmed': return 'warning'
      case 'invoiced': return 'purple'
      case 'paid': return 'success'
      default: return 'default'
    }
  }

  return (
    <div>
      <Header title="売上・入金管理" />

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
                options={SALE_STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-36"
              />
              <Select
                options={companies}
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-44"
              />
              <Select
                options={[
                  { value: 'all', label: '全期間' },
                  { value: 'thisMonth', label: '今月' },
                  { value: 'lastMonth', label: '先月' },
                  { value: 'thisYear', label: '今年' },
                ]}
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="w-28"
              />
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">総売上</p>
                <p className="text-xl font-bold text-slate-800">{formatCurrency(totals.total)}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">売上見込</p>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.expected)}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">売上確定</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(totals.confirmed)}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">請求済み</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(totals.invoiced)}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">入金済み</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.paid)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sales List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">売上一覧</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredSales.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当する売上が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/sales/${sale.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">
                            {formatCurrency(sale.amount)}
                          </p>
                          <Badge variant={getSaleStatusBadgeVariant(sale.status)}>
                            {SALE_STATUS_LABELS[sale.status]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {sale.referral?.application?.job_seeker?.name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {sale.referral?.job?.company?.name}
                          </div>
                          {sale.referral?.application?.coordinator && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              担当: {sale.referral.application.coordinator.name}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        {sale.status === 'paid' ? (
                          <div className="flex items-center gap-1 text-sm text-emerald-600">
                            <Calendar className="w-3 h-3" />
                            入金日: {formatDate(sale.paid_date || '')}
                          </div>
                        ) : sale.expected_date ? (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Calendar className="w-3 h-3" />
                            予定日: {formatDate(sale.expected_date)}
                          </div>
                        ) : null}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
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
