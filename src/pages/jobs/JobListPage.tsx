import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  MapPin,
  Building2,
  Briefcase,
  DollarSign,
  ChevronRight,
  Filter,
  Upload,
} from 'lucide-react'
import { Card, Button, Badge, Select, CSVImportModal, type DuplicateAction } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import type { Job, Company } from '../../types/database'

interface JobWithCompany extends Job {
  company: Company
}

const JOB_STATUSES = [
  { value: '', label: 'すべてのステータス' },
  { value: 'open', label: '公開中' },
  { value: 'paused', label: '一時停止' },
  { value: 'closed', label: '終了' },
]

const JOB_CSV_COLUMNS = [
  { key: 'company_name', label: '派遣会社名', required: true },
  { key: 'title', label: '求人タイトル', required: true },
  { key: 'job_type', label: '職種' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村' },
  { key: 'address', label: '番地' },
  { key: 'salary_min', label: '給与（最低）' },
  { key: 'salary_max', label: '給与（最高）' },
  { key: 'working_hours', label: '勤務時間' },
  { key: 'holidays', label: '休日' },
  { key: 'has_dormitory', label: '寮あり' },
  { key: 'fee_amount', label: '成功報酬（円）' },
  { key: 'description', label: '仕事内容' },
  { key: 'notes', label: '備考' },
]

export function JobListPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<JobWithCompany[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [showCSVImport, setShowCSVImport] = useState(false)

  useEffect(() => {
    fetchJobs()
    fetchCompanies()
  }, [])

  async function fetchJobs() {
    setLoading(true)

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        company:companies (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      setLoading(false)
      return
    }

    setJobs(data as JobWithCompany[])
    setLoading(false)
  }

  async function fetchCompanies() {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setCompanies(data)
    }
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.prefecture?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || job.status === statusFilter
    const matchesCompany = !companyFilter || job.company_id === companyFilter

    return matchesSearch && matchesStatus && matchesCompany
  })

  const openJobs = filteredJobs.filter((j) => j.status === 'open')
  const pausedJobs = filteredJobs.filter((j) => j.status === 'paused')
  const closedJobs = filteredJobs.filter((j) => j.status === 'closed')

  async function handleCSVImport(data: Record<string, string>[], _duplicateAction: DuplicateAction): Promise<{ success: number; skipped: number; updated: number; errors: string[] }> {
    const errors: string[] = []
    let success = 0
    const skipped = 0
    const updated = 0

    // Get companies for mapping
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name')

    const companyMap = new Map(companiesData?.map((c) => [c.name, c.id]) || [])

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // CSV row number (header is row 1)

      // Validate required fields
      if (!row.company_name || !row.title) {
        errors.push(`行${rowNum}: 派遣会社名と求人タイトルは必須です`)
        continue
      }

      // Find company
      const companyId = companyMap.get(row.company_name)
      if (!companyId) {
        errors.push(`行${rowNum}: 派遣会社「${row.company_name}」が見つかりません`)
        continue
      }

      // Insert job
      const { error: jobError } = await supabase
        .from('jobs')
        .insert({
          company_id: companyId,
          title: row.title,
          job_type: row.job_type || null,
          prefecture: row.prefecture || null,
          city: row.city || null,
          address: row.address || null,
          salary_min: row.salary_min ? parseInt(row.salary_min) : null,
          salary_max: row.salary_max ? parseInt(row.salary_max) : null,
          working_hours: row.working_hours || null,
          holidays: row.holidays || null,
          has_dormitory: row.has_dormitory === 'あり' || row.has_dormitory === 'true' || row.has_dormitory === '1',
          fee_type: row.fee_amount ? 'fixed' : null,
          fee_amount: row.fee_amount ? parseInt(row.fee_amount) : null,
          description: row.description || null,
          notes: row.notes || null,
          status: 'open',
        })

      if (jobError) {
        errors.push(`行${rowNum}: ${jobError.message}`)
        continue
      }

      success++
    }

    // Refresh list after import
    if (success > 0) {
      fetchJobs()
    }

    return { success, skipped, updated, errors }
  }

  return (
    <div>
      <Header
        title="求人管理"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCSVImport(true)}>
              <Upload className="w-4 h-4 mr-2" />
              CSV取り込み
            </Button>
            <Link to="/jobs/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新規登録
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Search & Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="求人名、会社名、エリアで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select
                options={JOB_STATUSES}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40"
              />
              <Select
                options={[
                  { value: '', label: 'すべての会社' },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">全求人</p>
                <p className="text-2xl font-bold text-slate-800">{filteredJobs.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">公開中</p>
                <p className="text-2xl font-bold text-emerald-600">{openJobs.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">一時停止</p>
                <p className="text-2xl font-bold text-amber-600">{pausedJobs.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">終了</p>
                <p className="text-2xl font-bold text-slate-600">{closedJobs.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Job List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">求人一覧</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当する求人が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{job.title}</p>
                        <Badge
                          variant={
                            job.status === 'open' ? 'success' :
                            job.status === 'paused' ? 'warning' : 'default'
                          }
                        >
                          {job.status === 'open' ? '公開中' :
                           job.status === 'paused' ? '一時停止' : '終了'}
                        </Badge>
                        {job.has_dormitory && (
                          <Badge variant="purple">寮あり</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Building2 className="w-3 h-3" />
                          {job.company?.name}
                        </div>
                        {job.prefecture && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {job.prefecture}{job.city}
                          </div>
                        )}
                        {job.salary_min && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(job.salary_min)}〜
                            {job.salary_max && formatCurrency(job.salary_max)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {job.fee_amount && (
                      <div className="text-right">
                        <p className="text-sm text-slate-500">成功報酬</p>
                        <p className="text-lg font-semibold text-emerald-600">
                          {formatCurrency(job.fee_amount)}
                        </p>
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        title="求人CSV取り込み"
        templateColumns={JOB_CSV_COLUMNS}
        templateFileName="jobs_template.csv"
        onImport={handleCSVImport}
      />
    </div>
  )
}
