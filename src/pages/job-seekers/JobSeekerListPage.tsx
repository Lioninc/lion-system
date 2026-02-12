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
  FileText,
} from 'lucide-react'
import { Card, Button, Select, Badge, CSVImportModal, type DuplicateAction } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { ApplicationStatus, ProgressStatus } from '../../types/database'
import { APPLICATION_STATUS_LABELS, PROGRESS_STATUS_LABELS } from '../../types/database'
import { formatDate } from '../../lib/utils'

interface JobSeekerSummary {
  id: string
  name: string
  name_kana: string | null
  display_name: string // 「直電」の場合はname_kanaを使用
  phone: string
  email: string | null
  prefecture: string | null
  application_count: number
  latest_application_id: string
  latest_application_status: ApplicationStatus
  latest_progress_status: ProgressStatus | null
  latest_coordinator_name: string | null
  latest_source_name: string | null
  latest_applied_at: string
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
  const [jobSeekers, setJobSeekers] = useState<JobSeekerSummary[]>([])
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
    // Fetch coordinators (users excluding 管理部)
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, department, employment_status')
      .or('department.is.null,department.neq.管理部')
      .order('name')

    if (usersData) {
      const coordinatorOptions = [
        { value: 'unset', label: '未設定' },
        ...usersData.map((u) => ({
          value: u.id,
          label: u.employment_status === 'retired' ? `${u.name}（退職）` : u.name,
        })),
      ]
      setCoordinators(coordinatorOptions)
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

    // 求職者ベースでデータを取得
    let query = supabase
      .from('job_seekers')
      .select(`
        id,
        name,
        name_kana,
        phone,
        email,
        prefecture,
        applications (
          id,
          application_status,
          progress_status,
          applied_at,
          coordinator_id,
          source_id,
          coordinator:users!applications_coordinator_id_fkey (
            name
          ),
          sources (
            name
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // 検索フィルター（name, name_kana, phoneで検索）
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,name_kana.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching job seekers:', error)
      setLoading(false)
      return
    }

    // 求職者ごとにデータを集計し、フィルターを適用
    let results: JobSeekerSummary[] = (data || [])
      .map((js: any) => {
        const applications = js.applications || []

        // 最新の応募を取得
        const sortedApps = [...applications].sort(
          (a: any, b: any) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
        )
        const latestApp = sortedApps[0]

        if (!latestApp) return null

        // 「直電」の場合はname_kanaを表示名として使用
        const displayName = js.name === '直電' && js.name_kana ? js.name_kana : js.name

        return {
          id: js.id,
          name: js.name,
          name_kana: js.name_kana,
          display_name: displayName,
          phone: js.phone,
          email: js.email,
          prefecture: js.prefecture,
          application_count: applications.length,
          latest_application_id: latestApp.id,
          latest_application_status: latestApp.application_status,
          latest_progress_status: latestApp.progress_status,
          latest_coordinator_name: latestApp.coordinator?.name || null,
          latest_source_name: latestApp.sources?.name || null,
          latest_applied_at: latestApp.applied_at,
        }
      })
      .filter((js: any): js is JobSeekerSummary => js !== null)

    // ステータスフィルター
    if (filters.status) {
      results = results.filter((js) => js.latest_application_status === filters.status)
    }

    if (filters.progressStatus) {
      results = results.filter((js) => js.latest_progress_status === filters.progressStatus)
    }

    // 担当者フィルター
    if (filters.coordinator) {
      if (filters.coordinator === 'unset') {
        results = results.filter((js) => !js.latest_coordinator_name)
      } else {
        const selectedCoordinator = coordinators.find((c) => c.value === filters.coordinator)
        if (selectedCoordinator) {
          const coordinatorName = selectedCoordinator.label.replace('（退職）', '')
          results = results.filter((js) => js.latest_coordinator_name === coordinatorName)
        }
      }
    }

    // 流入元フィルター
    if (filters.source) {
      const selectedSource = sources.find((s) => s.value === filters.source)
      if (selectedSource) {
        results = results.filter((js) => js.latest_source_name === selectedSource.label)
      }
    }

    // 最新応募日でソート
    results.sort((a, b) => new Date(b.latest_applied_at).getTime() - new Date(a.latest_applied_at).getTime())

    // ページネーション
    const startIndex = (currentPage - 1) * PAGE_SIZE
    const paginatedResults = results.slice(startIndex, startIndex + PAGE_SIZE)

    setJobSeekers(paginatedResults)
    setTotalCount(results.length)
    setLoading(false)
  }

  function handleFilterChange(key: keyof FilterState, value: string) {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    setCurrentPage(1)

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

    const { data: sourcesData } = await supabase.from('sources').select('id, name')
    const sourceMap = new Map(sourcesData?.map((s) => [s.name, s.id]) || [])

    const phones = data.map((row) => row.phone).filter(Boolean)
    const { data: existingJobSeekers } = await supabase
      .from('job_seekers')
      .select('id, phone')
      .in('phone', phones)

    const existingPhoneMap = new Map(existingJobSeekers?.map((js) => [js.phone, js.id]) || [])

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      if (!row.name || !row.phone) {
        errors.push(`行${rowNum}: 氏名と電話番号は必須です`)
        continue
      }

      const existingId = existingPhoneMap.get(row.phone)

      if (existingId) {
        if (duplicateAction === 'skip') {
          skipped++
          continue
        } else if (duplicateAction === 'update') {
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

          const sourceId = row.source_name ? sourceMap.get(row.source_name) : null
          const { error: appError } = await supabase.from('applications').insert({
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
      }

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

      const sourceId = row.source_name ? sourceMap.get(row.source_name) : null
      const { error: appError } = await supabase.from('applications').insert({
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

    if (success > 0 || updated > 0) {
      fetchJobSeekers()
    }

    return { success, skipped, updated, errors }
  }

  function getStatusBadgeVariant(status: ApplicationStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'new': return 'info'
      case 'valid': return 'success'
      case 'invalid': return 'danger'
      case 'no_answer': return 'warning'
      case 'connected': return 'purple'
      case 'working': return 'success'
      case 'completed': return 'default'
      default: return 'default'
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

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select
                  label="最新応募ステータス"
                  options={statusOptions}
                  placeholder="すべて"
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                />
                <Select
                  label="最新進捗ステータス"
                  options={progressStatusOptions}
                  placeholder="すべて"
                  value={filters.progressStatus}
                  onChange={(e) => handleFilterChange('progressStatus', e.target.value)}
                />
                <Select
                  label="最新担当者"
                  options={coordinators}
                  placeholder="すべて"
                  value={filters.coordinator}
                  onChange={(e) => handleFilterChange('coordinator', e.target.value)}
                />
                <Select
                  label="最新流入元"
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

        <div className="text-sm text-slate-500">
          {totalCount}人中 {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalCount)}-
          {Math.min(currentPage * PAGE_SIZE, totalCount)}人を表示
        </div>

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
                    key={js.id}
                    className="p-4 hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/job-seekers/${js.latest_application_id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{js.display_name}</p>
                          {js.application_count > 1 && (
                            <span className="flex items-center gap-0.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              <FileText className="w-3 h-3" />
                              {js.application_count}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-slate-600 mt-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{js.phone}</span>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(js.latest_application_status)} className="flex-shrink-0">
                        {APPLICATION_STATUS_LABELS[js.latest_application_status]}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {js.latest_progress_status && (
                        <Badge variant="default" className="text-xs">
                          {PROGRESS_STATUS_LABELS[js.latest_progress_status]}
                        </Badge>
                      )}
                      {js.latest_coordinator_name && <span>担当: {js.latest_coordinator_name}</span>}
                      <span>{formatDate(js.latest_applied_at)}</span>
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
                        応募回数
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        最新ステータス
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        最新進捗
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        最新担当者
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        最新応募日
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {jobSeekers.map((js) => (
                      <tr
                        key={js.id}
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => window.location.href = `/job-seekers/${js.latest_application_id}`}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{js.display_name}</p>
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
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-slate-700">{js.application_count}回</span>
                            {js.application_count > 1 && (
                              <span className="text-xs text-slate-400">(再応募あり)</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getStatusBadgeVariant(js.latest_application_status)}>
                            {APPLICATION_STATUS_LABELS[js.latest_application_status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          {js.latest_progress_status ? (
                            <Badge variant="default">
                              {PROGRESS_STATUS_LABELS[js.latest_progress_status]}
                            </Badge>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {js.latest_coordinator_name || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {formatDate(js.latest_applied_at)}
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
