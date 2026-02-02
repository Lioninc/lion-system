import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Upload,
} from 'lucide-react'
import { Card, Button, Select, Badge, CSVImportModal, type DuplicateAction } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { ApplicationStatus, ProgressStatus } from '../../types/database'
import { APPLICATION_STATUS_LABELS, PROGRESS_STATUS_LABELS } from '../../types/database'
import { formatDate } from '../../lib/utils'

interface JobSeekerWithApplication {
  id: string
  name: string
  phone: string
  email: string | null
  prefecture: string | null
  application_id: string
  application_status: ApplicationStatus
  progress_status: ProgressStatus | null
  coordinator_name: string | null
  source_name: string | null
  applied_at: string
}

interface FilterState {
  search: string
  status: string
  progressStatus: string
  coordinator: string
  source: string
}

const PAGE_SIZE = 20

const JOB_SEEKER_CSV_COLUMNS = [
  { key: 'name', label: '氏名', required: true },
  { key: 'phone', label: '電話番号', required: true },
  { key: 'email', label: 'メールアドレス' },
  { key: 'name_kana', label: 'フリガナ' },
  { key: 'birth_date', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村' },
  { key: 'address', label: '番地' },
  { key: 'source_name', label: '流入元' },
  { key: 'notes', label: '備考' },
]

export function JobSeekerListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobSeekers, setJobSeekers] = useState<JobSeekerWithApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [coordinators, setCoordinators] = useState<{ value: string; label: string }[]>([])
  const [sources, setSources] = useState<{ value: string; label: string }[]>([])

  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    progressStatus: searchParams.get('progressStatus') || '',
    coordinator: searchParams.get('coordinator') || '',
    source: searchParams.get('source') || '',
  })
  const [showCSVImport, setShowCSVImport] = useState(false)

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  useEffect(() => {
    fetchJobSeekers()
  }, [currentPage, filters])

  async function fetchFilterOptions() {
    // Fetch coordinators (users with coordinator role, excluding 管理部)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, department')
      .neq('department', '管理部')
      .order('name')

    if (usersData) {
      setCoordinators(usersData.map((u) => ({ value: u.id, label: u.name })))
    }

    // Fetch sources
    const { data: sourcesData } = await supabase
      .from('sources')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (sourcesData) {
      setSources(sourcesData.map((s) => ({ value: s.id, label: s.name })))
    }
  }

  async function fetchJobSeekers() {
    setLoading(true)

    let query = supabase
      .from('applications')
      .select(`
        id,
        application_status,
        progress_status,
        applied_at,
        job_seekers (
          id,
          name,
          phone,
          email,
          prefecture
        ),
        coordinator:users!applications_coordinator_id_fkey (
          name
        ),
        sources (
          name
        )
      `, { count: 'exact' })
      .order('applied_at', { ascending: false })
      .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1)

    // Apply filters
    if (filters.status) {
      query = query.eq('application_status', filters.status)
    }

    if (filters.progressStatus) {
      query = query.eq('progress_status', filters.progressStatus)
    }

    if (filters.coordinator) {
      query = query.eq('coordinator_id', filters.coordinator)
    }

    if (filters.source) {
      query = query.eq('source_id', filters.source)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching job seekers:', error)
      setLoading(false)
      return
    }

    // Filter by search term (name or phone)
    let results = (data || []).map((item: any) => ({
      id: item.job_seekers?.id || '',
      name: item.job_seekers?.name || '不明',
      phone: item.job_seekers?.phone || '',
      email: item.job_seekers?.email || null,
      prefecture: item.job_seekers?.prefecture || null,
      application_id: item.id,
      application_status: item.application_status,
      progress_status: item.progress_status,
      coordinator_name: item.coordinator?.name || null,
      source_name: item.sources?.name || null,
      applied_at: item.applied_at,
    }))

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      results = results.filter(
        (js) =>
          js.name.toLowerCase().includes(searchLower) ||
          js.phone.includes(filters.search)
      )
    }

    setJobSeekers(results)
    setTotalCount(count || 0)
    setLoading(false)
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    setCurrentPage(1)

    // Update URL params
    const params = new URLSearchParams()
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    setSearchParams(params)
  }

  function clearFilters() {
    const emptyFilters: FilterState = {
      search: '',
      status: '',
      progressStatus: '',
      coordinator: '',
      source: '',
    }
    setFilters(emptyFilters)
    setSearchParams({})
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const statusOptions = Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  const progressStatusOptions = Object.entries(PROGRESS_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  async function handleCSVImport(data: Record<string, string>[], duplicateAction: DuplicateAction): Promise<{ success: number; skipped: number; updated: number; errors: string[] }> {
    const errors: string[] = []
    let success = 0
    let skipped = 0
    let updated = 0

    // Get sources for mapping
    const { data: sourcesData } = await supabase
      .from('sources')
      .select('id, name')

    const sourceMap = new Map(sourcesData?.map((s) => [s.name, s.id]) || [])

    // Get existing job seekers by phone for duplicate check
    const phones = data.map((row) => row.phone).filter(Boolean)
    const { data: existingJobSeekers } = await supabase
      .from('job_seekers')
      .select('id, phone')
      .in('phone', phones)

    const existingPhoneMap = new Map(existingJobSeekers?.map((js) => [js.phone, js.id]) || [])

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2 // CSV row number (header is row 1)

      // Validate required fields
      if (!row.name || !row.phone) {
        errors.push(`行${rowNum}: 氏名と電話番号は必須です`)
        continue
      }

      // Check for duplicate
      const existingId = existingPhoneMap.get(row.phone)

      if (existingId) {
        // Handle duplicate based on selected action
        if (duplicateAction === 'skip') {
          skipped++
          continue
        } else if (duplicateAction === 'update') {
          // Update existing job seeker info
          const { error: updateError } = await supabase
            .from('job_seekers')
            .update({
              name: row.name,
              email: row.email || null,
              name_kana: row.name_kana || null,
              birth_date: row.birth_date || null,
              gender: row.gender === '男性' ? 'male' : row.gender === '女性' ? 'female' : null,
              postal_code: row.postal_code || null,
              prefecture: row.prefecture || null,
              city: row.city || null,
              address: row.address || null,
              notes: row.notes || null,
            })
            .eq('id', existingId)

          if (updateError) {
            errors.push(`行${rowNum}: 更新エラー - ${updateError.message}`)
            continue
          }

          // Also create new application record (re-application)
          const sourceId = row.source_name ? sourceMap.get(row.source_name) : null

          const { error: appError } = await supabase
            .from('applications')
            .insert({
              job_seeker_id: existingId,
              source_id: sourceId,
              application_status: 'new',
              applied_at: new Date().toISOString(),
            })

          if (appError) {
            errors.push(`行${rowNum}: 応募作成エラー - ${appError.message}`)
            continue
          }

          updated++
          continue
        }
        // If duplicateAction === 'create', continue to create new record
      }

      // Insert job seeker
      const { data: jobSeeker, error: jsError } = await supabase
        .from('job_seekers')
        .insert({
          name: row.name,
          phone: row.phone,
          email: row.email || null,
          name_kana: row.name_kana || null,
          birth_date: row.birth_date || null,
          gender: row.gender === '男性' ? 'male' : row.gender === '女性' ? 'female' : null,
          postal_code: row.postal_code || null,
          prefecture: row.prefecture || null,
          city: row.city || null,
          address: row.address || null,
          notes: row.notes || null,
        })
        .select('id')
        .single()

      if (jsError) {
        errors.push(`行${rowNum}: ${jsError.message}`)
        continue
      }

      // Create application
      const sourceId = row.source_name ? sourceMap.get(row.source_name) : null

      const { error: appError } = await supabase
        .from('applications')
        .insert({
          job_seeker_id: jobSeeker.id,
          source_id: sourceId,
          application_status: 'new',
          applied_at: new Date().toISOString(),
        })

      if (appError) {
        errors.push(`行${rowNum}: 応募作成エラー - ${appError.message}`)
        continue
      }

      success++
    }

    // Refresh list after import
    if (success > 0 || updated > 0) {
      fetchJobSeekers()
    }

    return { success, skipped, updated, errors }
  }

  function getStatusBadgeVariant(status: ApplicationStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'new':
        return 'info'
      case 'valid':
        return 'success'
      case 'invalid':
        return 'danger'
      case 'no_answer':
        return 'warning'
      case 'connected':
        return 'purple'
      case 'working':
        return 'success'
      case 'completed':
        return 'default'
      default:
        return 'default'
    }
  }

  return (
    <div>
      <Header
        title="求職者管理"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => setShowCSVImport(true)}>
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">CSV取り込み</span>
            </Button>
            <Link to="/job-seekers/new">
              <Button size="sm">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">新規登録</span>
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-4 lg:p-6 space-y-4">
        {/* Search and Filter Bar */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="名前または電話番号で検索..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              フィルタ
              {hasActiveFilters && (
                <span className="ml-2 w-5 h-5 bg-white text-primary text-xs rounded-full flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  label="応募ステータス"
                  options={statusOptions}
                  placeholder="すべて"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                />
                <Select
                  label="進捗ステータス"
                  options={progressStatusOptions}
                  placeholder="すべて"
                  value={filters.progressStatus}
                  onChange={(e) => handleFilterChange('progressStatus', e.target.value)}
                />
                <Select
                  label="担当者"
                  options={coordinators}
                  placeholder="すべて"
                  value={filters.coordinator}
                  onChange={(e) => handleFilterChange('coordinator', e.target.value)}
                />
                <Select
                  label="流入元"
                  options={sources}
                  placeholder="すべて"
                  value={filters.source}
                  onChange={(e) => handleFilterChange('source', e.target.value)}
                />
              </div>
              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    フィルタをクリア
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Results Count */}
        <div className="text-sm text-slate-500">
          {totalCount}件中 {(currentPage - 1) * PAGE_SIZE + 1}-
          {Math.min(currentPage * PAGE_SIZE, totalCount)}件を表示
        </div>

        {/* Job Seeker List */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">読み込み中...</div>
          ) : jobSeekers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              該当する求職者が見つかりません
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-slate-200">
                {jobSeekers.map((js) => (
                  <div
                    key={js.application_id}
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/job-seekers/${js.application_id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">{js.name}</p>
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{js.phone}</span>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(js.application_status)} className="flex-shrink-0">
                        {APPLICATION_STATUS_LABELS[js.application_status]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {js.progress_status && (
                        <Badge variant="default" className="text-xs">
                          {PROGRESS_STATUS_LABELS[js.progress_status]}
                        </Badge>
                      )}
                      {js.coordinator_name && <span>担当: {js.coordinator_name}</span>}
                      <span>{formatDate(js.applied_at)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        求職者
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        連絡先
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        ステータス
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        進捗
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        担当者
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        流入元
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        応募日
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {jobSeekers.map((js) => (
                      <tr
                        key={js.application_id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => window.location.href = `/job-seekers/${js.application_id}`}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{js.name}</p>
                            {js.prefecture && (
                              <p className="text-sm text-slate-500">{js.prefecture}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Phone className="w-3 h-3" />
                              {js.phone}
                            </div>
                            {js.email && (
                              <div className="flex items-center gap-1 text-sm text-slate-500">
                                <Mail className="w-3 h-3" />
                                {js.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getStatusBadgeVariant(js.application_status)}>
                            {APPLICATION_STATUS_LABELS[js.application_status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          {js.progress_status ? (
                            <Badge variant="default">
                              {PROGRESS_STATUS_LABELS[js.progress_status]}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {js.coordinator_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {js.source_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {formatDate(js.applied_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              前へ
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              次へ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        title="求職者CSV取り込み"
        templateColumns={JOB_SEEKER_CSV_COLUMNS}
        templateFileName="job_seekers_template.csv"
        onImport={handleCSVImport}
        duplicateCheckKey="phone"
        duplicateCheckLabel="電話番号"
      />
    </div>
  )
}
