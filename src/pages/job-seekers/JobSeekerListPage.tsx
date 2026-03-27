import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { Card, Button, Select, Badge, CSVImportModal, type DuplicateAction, type ImportFormat } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { ApplicationStatus, ProgressStatus } from '../../types/database'
import { APPLICATION_STATUS_LABELS, PROGRESS_STATUS_LABELS } from '../../types/database'
import { formatDate, calculateAge } from '../../lib/utils'

interface SourceCount {
  name: string
  count: number
}

interface JobSeekerSummary {
  id: string
  name: string
  name_kana: string | null
  display_name: string // 「直電」の場合はname_kanaを使用
  phone: string
  email: string | null
  birth_date: string | null
  prefecture: string | null
  application_count: number // 応募回数（その人が応募した回数）
  contact_count: number // 対応回数（電話/LINE/メール等の対応記録）
  interview_count: number // 面談回数（面談予定・実施）
  source_counts: SourceCount[] // 媒体ごとの応募回数
  latest_application_id: string
  latest_application_status: ApplicationStatus
  latest_progress_status: ProgressStatus | null
  latest_coordinator_id: string | null
  latest_coordinator_name: string | null
  all_coordinator_ids: string[] // 全応募の担当者ID（フィルター用）
  latest_interviewer_id: string | null
  latest_interviewer_name: string | null
  all_interviewer_ids: string[] // 全面談の担当者ID（フィルター用）
  latest_job_type: string | null // 最新応募の職種
  latest_applied_at: string
}

interface FilterState {
  search: string
  status: string
  progressStatus: string
  coordinator: string
  interviewer: string
  source: string
}

const PAGE_SIZE = 20

const JOB_SEEKER_CSV_COLUMNS = [
  { key: 'name', label: '氏名', required: true },
  { key: 'phone', label: '電話番号', required: true },
  { key: 'name_kana', label: 'フリガナ' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'line_id', label: 'LINE ID' },
  { key: 'birth_date', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村' },
  { key: 'address', label: '番地・建物名' },
  { key: 'height', label: '身長' },
  { key: 'weight', label: '体重' },
  { key: 'has_tattoo', label: 'タトゥー' },
  { key: 'has_medical_condition', label: '持病' },
  { key: 'medical_condition_detail', label: '持病の詳細' },
  { key: 'has_spouse', label: '配偶者' },
  { key: 'has_children', label: '子供' },
  { key: 'employment_status', label: '就業状況' },
  { key: 'desired_start_date', label: '希望開始日' },
  { key: 'desired_period', label: '希望期間' },
  { key: 'education_level', label: '最終学歴' },
  { key: 'education_school', label: '学校名' },
  { key: 'education_faculty', label: '学部・学科' },
  { key: 'graduation_year', label: '卒業年' },
  { key: 'work_history', label: '職務経歴' },
  { key: 'current_job_type', label: '現職の職種' },
  { key: 'reason_for_change', label: '転職理由' },
  { key: 'current_annual_income', label: '現在の年収' },
  { key: 'desired_annual_income', label: '希望年収' },
  { key: 'desired_job_type', label: '希望職種' },
  { key: 'desired_employment_type', label: '希望雇用形態' },
  { key: 'desired_work_location', label: '希望勤務地' },
  { key: 'remote_work_preference', label: 'リモートワーク希望' },
  { key: 'pc_skill_level', label: 'PCスキル' },
  { key: 'qualifications', label: '保有資格' },
  { key: 'language_skill', label: '語学力' },
  { key: 'toeic_score', label: 'TOEICスコア' },
  { key: 'has_car_license', label: '普通自動車免許' },
  { key: 'has_forklift', label: 'フォークリフト免許' },
  { key: 'commute_method', label: '通勤手段' },
  { key: 'commute_time', label: '通勤時間' },
  { key: 'other_job_hunting', label: '他社選考状況' },
  { key: 'source_name', label: '流入元' },
  { key: 'notes', label: '備考' },
  // 応募・面談・紹介・稼働・売上
  { key: 'coordinator_name', label: '応募担当者' },
  { key: 'applied_at', label: '応募日' },
  { key: 'interview_date', label: '面談日' },
  { key: 'interviewer_name', label: '面談担当者' },
  { key: 'interview_result', label: '面談結果' },
  { key: 'dispatch_company_name', label: '派遣会社名' },
  { key: 'client_company_name', label: '派遣先企業名' },
  { key: 'referred_at', label: '紹介日' },
  { key: 'dispatch_interview_at', label: '派遣会社面接日' },
  { key: 'hired_at', label: '採用日' },
  { key: 'assignment_date', label: '赴任日' },
  { key: 'start_work_date', label: '稼働開始日' },
  { key: 'referral_status', label: '稼働状況' },
  { key: 'sale_amount', label: '売上金額' },
  { key: 'payment_month', label: '入金月' },
  { key: 'payment_amount', label: '入金額' },
]

function csvParseBoolean(value: string): boolean {
  return ['あり', 'true', '1', 'yes'].includes(value.toLowerCase().trim())
}

function csvParseNumber(value: string): number | null {
  if (!value || value.trim() === '') return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

function csvParseGender(value: string): 'male' | 'female' | null {
  if (value === '男性') return 'male'
  if (value === '女性') return 'female'
  return null
}

function csvParseEmploymentStatus(value: string): 'employed' | 'unemployed' | null {
  if (value === '就業中') return 'employed'
  if (value === '離職中' || value === '無職') return 'unemployed'
  return null
}

function csvParseInterviewResult(value: string): string | null {
  if (value === '派遣面接組み') return 'referred'
  if (value === '検討中') return 'considering'
  if (value === '繋げず') return 'not_connected'
  return value || null
}

function csvParseReferralStatus(value: string): string {
  if (value === '赴任前') return 'pre_assignment'
  if (value === '稼働前') return 'assigned'
  if (value === '稼働済み') return 'working'
  return value || 'referred'
}

function buildJobSeekerFields(row: Record<string, string>) {
  return {
    name: row.name,
    phone: row.phone,
    name_kana: row.name_kana || null,
    email: row.email || null,
    line_id: row.line_id || null,
    birth_date: row.birth_date || null,
    gender: csvParseGender(row.gender || ''),
    postal_code: row.postal_code || null,
    prefecture: row.prefecture || null,
    city: row.city || null,
    address: row.address || null,
    height: csvParseNumber(row.height || ''),
    weight: csvParseNumber(row.weight || ''),
    has_tattoo: csvParseBoolean(row.has_tattoo || ''),
    has_medical_condition: csvParseBoolean(row.has_medical_condition || ''),
    medical_condition_detail: row.medical_condition_detail || null,
    has_spouse: csvParseBoolean(row.has_spouse || ''),
    has_children: csvParseBoolean(row.has_children || ''),
    employment_status: csvParseEmploymentStatus(row.employment_status || ''),
    desired_start_date: row.desired_start_date || null,
    desired_period: row.desired_period || null,
    education_level: row.education_level || null,
    education_school: row.education_school || null,
    education_faculty: row.education_faculty || null,
    graduation_year: csvParseNumber(row.graduation_year || ''),
    work_history: row.work_history || null,
    current_job_type: row.current_job_type || null,
    reason_for_change: row.reason_for_change || null,
    current_annual_income: csvParseNumber(row.current_annual_income || ''),
    desired_annual_income: csvParseNumber(row.desired_annual_income || ''),
    desired_job_type: row.desired_job_type || null,
    desired_employment_type: row.desired_employment_type || null,
    desired_work_location: row.desired_work_location || null,
    remote_work_preference: row.remote_work_preference || null,
    pc_skill_level: row.pc_skill_level || null,
    qualifications: row.qualifications || null,
    language_skill: row.language_skill || null,
    toeic_score: csvParseNumber(row.toeic_score || ''),
    has_car_license: csvParseBoolean(row.has_car_license || ''),
    has_forklift: csvParseBoolean(row.has_forklift || ''),
    commute_method: row.commute_method || null,
    commute_time: csvParseNumber(row.commute_time || ''),
    other_job_hunting: row.other_job_hunting || null,
    notes: row.notes || null,
  }
}

const APPLICATION_SHEET_COLUMNS = [
  // 求職者情報
  { key: 'name', label: '氏名', required: true },
  { key: 'name_kana', label: 'ふりがな' },
  { key: 'phone', label: '電話番号', required: true },
  { key: 'birth_date', label: '生年月日' },
  { key: 'gender', label: '性別' },
  { key: 'postal_code', label: '郵便番号' },
  { key: 'prefecture', label: '都道府県' },
  { key: 'city', label: '市区町村群' },
  { key: 'height', label: '身長' },
  { key: 'weight', label: '体重' },
  { key: 'has_tattoo', label: 'タトゥー' },
  { key: 'has_medical_condition', label: '持病' },
  { key: 'has_spouse', label: '配偶者' },
  { key: 'has_children', label: '子供' },
  { key: 'source_name', label: '媒体' },
  { key: 'notes', label: '備考' },
  { key: 'desired_start_date', label: '就業時期' },
  { key: 'desired_job_type', label: '職種' },
  { key: 'desired_work_location', label: '勤務地' },
  // 応募情報
  { key: 'applied_at', label: '日付' },
  { key: 'coordinator_name', label: '応募対応' },
  // 面談情報
  { key: 'interview_date', label: '面談日程' },
  { key: 'interviewer_name', label: '担当CD' },
  { key: 'interview_result', label: '繋ぎ' },
  // 紹介・稼働
  { key: 'dispatch_interview_at', label: '面接日' },
  { key: 'dispatch_company_name', label: '紹介先' },
  { key: 'client_company_name', label: '案件' },
  { key: 'assignment_date', label: '赴任予定日' },
  { key: 'start_work_date_planned', label: '稼働予定日' },
  { key: 'start_work_date_actual', label: '稼働日' },
  { key: 'progress', label: '進捗' },
  // 売上・入金
  { key: 'sale_amount', label: '確定売上' },
  { key: 'payment_amount', label: '入金金額' },
  { key: 'year', label: '年' },
  { key: 'payment_m1', label: '入金1月' },
  { key: 'payment_m2', label: '入金2月' },
  { key: 'payment_m3', label: '入金3月' },
  { key: 'payment_m4', label: '入金4月' },
  { key: 'payment_m5', label: '入金5月' },
  { key: 'payment_m6', label: '入金6月' },
  { key: 'payment_m7', label: '入金7月' },
  { key: 'payment_m8', label: '入金8月' },
  { key: 'payment_m9', label: '入金9月' },
  { key: 'payment_m10', label: '入金10月' },
  { key: 'payment_m11', label: '入金11月' },
  { key: 'payment_m12', label: '入金12月' },
]

const CSV_IMPORT_FORMATS: ImportFormat[] = [
  { id: 'lion', label: 'LIONテンプレート形式', columns: JOB_SEEKER_CSV_COLUMNS },
  { id: 'application_sheet', label: '応募シート形式', columns: APPLICATION_SHEET_COLUMNS },
]

function preprocessApplicationSheetRow(row: Record<string, string>): Record<string, string> {
  const processed = { ...row }

  // 配偶者: 既婚→あり (true), 未婚/other→ empty (false)
  if (processed.has_spouse === '既婚') processed.has_spouse = 'あり'
  else if (processed.has_spouse !== 'あり') processed.has_spouse = ''

  // 子供: number > 0 → あり
  const childrenCount = parseInt(processed.has_children || '0')
  processed.has_children = (!isNaN(childrenCount) && childrenCount > 0) ? 'あり' : ''

  // 繋ぎ→interview_result: 済み→派遣面接組み (so csvParseInterviewResult returns 'referred')
  if (processed.interview_result === '済み') processed.interview_result = '派遣面接組み'

  // start_work_date: actual takes priority over planned
  if (processed.start_work_date_actual) {
    processed.start_work_date = processed.start_work_date_actual
  } else if (processed.start_work_date_planned) {
    processed.start_work_date = processed.start_work_date_planned
  }

  // referred_at: use dispatch_interview_at
  if (!processed.referred_at && processed.dispatch_interview_at) {
    processed.referred_at = processed.dispatch_interview_at
  }

  // referral_status: determine from multiple fields
  if (processed.dispatch_company_name) {
    if (processed.start_work_date_actual) {
      processed.referral_status = 'working'
    } else if (processed.start_work_date_planned) {
      processed.referral_status = 'assigned'
    } else if (processed.assignment_date) {
      processed.referral_status = 'pre_assignment'
    } else if (processed.progress === '辞退') {
      processed.referral_status = 'declined'
    } else if (processed.progress === '済み' && !processed.assignment_date) {
      processed.referral_status = 'interview_done'
    } else {
      processed.referral_status = 'interview_scheduled'
    }
  }

  return processed
}

export function JobSeekerListPage() {
  const navigate = useNavigate()
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
    interviewer: searchParams.get('interviewer') || '',
    source: searchParams.get('source') || '',
  })
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
  const [editingCoordinatorId, setEditingCoordinatorId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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
    const offset = (currentPage - 1) * PAGE_SIZE

    // サーバーサイドで適用可能なフィルター条件
    const serverCoordinator = filters.coordinator && filters.coordinator !== 'unset' ? filters.coordinator : ''
    const serverInterviewer = filters.interviewer && filters.interviewer !== 'unset' ? filters.interviewer : ''
    const hasServerAppFilter = !!(filters.status || filters.progressStatus || serverCoordinator || filters.source)
    const hasServerInterviewFilter = !!serverInterviewer

    // Step 1: 軽量クエリでIDと総件数を取得（サーバーサイドフィルタ付き）
    let idSelect: string
    if (hasServerInterviewFilter) {
      idSelect = 'id, applications!inner(id, interviews!inner(id))'
    } else if (hasServerAppFilter) {
      idSelect = 'id, applications!inner(id)'
    } else {
      idSelect = 'id'
    }

    let idQuery = supabase
      .from('job_seekers')
      .select(idSelect, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (filters.search) {
      idQuery = idQuery.or(`name.ilike.%${filters.search}%,name_kana.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`)
    }
    if (filters.status) idQuery = idQuery.eq('applications.application_status', filters.status)
    if (filters.progressStatus) idQuery = idQuery.eq('applications.progress_status', filters.progressStatus)
    if (serverCoordinator) idQuery = idQuery.eq('applications.coordinator_id', serverCoordinator)
    if (filters.source) idQuery = idQuery.eq('applications.source_id', filters.source)
    if (serverInterviewer) idQuery = idQuery.eq('applications.interviews.interviewer_id', serverInterviewer)

    const { data: idRows, count: serverCount, error: idError } = await idQuery

    if (idError) {
      console.error('Error fetching job seekers:', idError)
      setLoading(false)
      return
    }

    if (!idRows || idRows.length === 0) {
      setJobSeekers([])
      setTotalCount(serverCount ?? 0)
      setLoading(false)
      return
    }

    // Step 2: このページのjob_seekerの全データを取得
    const ids = idRows.map((r: any) => r.id)

    const { data, error: detailError } = await supabase
      .from('job_seekers')
      .select(`
        id, name, name_kana, phone, email, birth_date, prefecture,
        applications (
          id, application_status, progress_status, job_type, applied_at,
          coordinator_id, source_id,
          coordinator:users!applications_coordinator_id_fkey (name),
          sources (name),
          contact_logs (id),
          interviews (
            id, scheduled_at, interviewer_id,
            interviewer:users!interviews_interviewer_id_fkey (name)
          )
        )
      `)
      .in('id', ids)
      .order('created_at', { ascending: false })

    if (detailError) {
      console.error('Error fetching job seeker details:', detailError)
      setLoading(false)
      return
    }

    // 電話番号で重複除去しながら求職者データを集計
    // 同じ電話番号の求職者は1つにまとめ、全応募・対応・面談を合算
    const phoneToJobSeekerMap = new Map<string, {
      id: string
      name: string
      name_kana: string | null
      phone: string
      email: string | null
      birth_date: string | null
      prefecture: string | null
      applications: any[]
      total_contact_count: number
      total_interview_count: number
    }>()

    for (const js of (data || [])) {
      const phone = js.phone?.trim() || ''
      if (!phone) continue

      // この求職者の対応回数・面談回数を計算
      const apps = js.applications || []
      const contactCount = apps.reduce((sum: number, app: any) => sum + (app.contact_logs?.length || 0), 0)
      const interviewCount = apps.reduce((sum: number, app: any) => sum + (app.interviews?.length || 0), 0)

      const existing = phoneToJobSeekerMap.get(phone)
      if (existing) {
        // 同じ電話番号の求職者が既に存在する場合、応募・対応・面談を合算
        existing.applications = [...existing.applications, ...apps]
        existing.total_contact_count += contactCount
        existing.total_interview_count += interviewCount
        // より新しい情報で更新（name, email等）
        if (js.name && js.name !== '直電' && existing.name === '直電') {
          existing.name = js.name
        }
        if (js.name_kana && !existing.name_kana) {
          existing.name_kana = js.name_kana
        }
        if (js.email && !existing.email) {
          existing.email = js.email
        }
        if (js.prefecture && !existing.prefecture) {
          existing.prefecture = js.prefecture
        }
        if (js.birth_date && !existing.birth_date) {
          existing.birth_date = js.birth_date
        }
      } else {
        phoneToJobSeekerMap.set(phone, {
          id: js.id as string,
          name: js.name as string,
          name_kana: js.name_kana as string | null,
          phone: js.phone as string,
          email: js.email as string | null,
          birth_date: js.birth_date as string | null,
          prefecture: js.prefecture as string | null,
          applications: apps,
          total_contact_count: contactCount,
          total_interview_count: interviewCount,
        })
      }
    }

    // 集計された求職者データをJobSeekerSummaryに変換
    let results: JobSeekerSummary[] = Array.from(phoneToJobSeekerMap.values())
      .map((js) => {
        const applications = js.applications || []

        // 最新の応募を取得（応募日の新しい順）
        const sortedApps = [...applications].sort(
          (a: any, b: any) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
        )
        const latestApp = sortedApps[0]

        if (!latestApp) return null

        // 「直電」の場合はname_kanaを表示名として使用
        const displayName = js.name === '直電' && js.name_kana ? js.name_kana : js.name

        // 媒体ごとの応募回数を集計
        const sourceCountMap = new Map<string, number>()
        for (const app of sortedApps) {
          const sourceName = app.sources?.name
          if (sourceName) {
            sourceCountMap.set(sourceName, (sourceCountMap.get(sourceName) || 0) + 1)
          }
        }
        // 回数の多い順にソート
        const sourceCounts: SourceCount[] = Array.from(sourceCountMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)

        // 全応募の担当者IDを収集（フィルター用）
        const allCoordinatorIds = [...new Set(
          applications
            .map((app: any) => app.coordinator_id)
            .filter(Boolean) as string[]
        )]

        // 全応募の面談から最新の面談担当者を取得
        const allInterviews = applications.flatMap((app: any) =>
          (app.interviews || []).map((iv: any) => ({ ...iv, _app: app }))
        )
        const sortedInterviews = allInterviews
          .filter((iv: any) => iv.interviewer?.name)
          .sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
        const latestInterviewerId = sortedInterviews.length > 0
          ? sortedInterviews[0].interviewer_id
          : null
        const latestInterviewerName = sortedInterviews.length > 0
          ? sortedInterviews[0].interviewer.name
          : null

        // 全面談の担当者IDを収集（フィルター用）
        const allInterviewerIds = [...new Set(
          allInterviews
            .map((iv: any) => iv.interviewer_id)
            .filter(Boolean) as string[]
        )]

        return {
          id: js.id,
          name: js.name,
          name_kana: js.name_kana,
          display_name: displayName,
          phone: js.phone,
          email: js.email,
          birth_date: js.birth_date,
          prefecture: js.prefecture,
          application_count: applications.length,
          contact_count: js.total_contact_count,
          interview_count: js.total_interview_count,
          source_counts: sourceCounts,
          latest_application_id: latestApp.id,
          latest_application_status: latestApp.application_status,
          latest_progress_status: latestApp.progress_status,
          latest_coordinator_id: latestApp.coordinator_id || null,
          latest_coordinator_name: latestApp.coordinator?.name || null,
          all_coordinator_ids: allCoordinatorIds,
          latest_interviewer_id: latestInterviewerId,
          latest_interviewer_name: latestInterviewerName,
          all_interviewer_ids: allInterviewerIds,
          latest_job_type: latestApp.job_type || null,
          latest_applied_at: latestApp.applied_at,
        }
      })
      .filter((js): js is JobSeekerSummary => js !== null)

    // クライアントサイド「未設定」フィルター（サーバーサイドでは否定条件が困難なため）
    if (filters.coordinator === 'unset') {
      results = results.filter((js) => js.all_coordinator_ids.length === 0)
    }
    if (filters.interviewer === 'unset') {
      results = results.filter((js) => js.all_interviewer_ids.length === 0)
    }

    // 最新応募日でソート
    results.sort((a, b) => new Date(b.latest_applied_at).getTime() - new Date(a.latest_applied_at).getTime())

    setJobSeekers(results)
    setTotalCount(serverCount ?? 0)
    setLoading(false)
  }

  async function handleInlineStatusChange(applicationId: string, newStatus: string) {
    const { error } = await supabase
      .from('applications')
      .update({ application_status: newStatus })
      .eq('id', applicationId)

    if (!error) {
      setJobSeekers((prev) =>
        prev.map((js) =>
          js.latest_application_id === applicationId
            ? { ...js, latest_application_status: newStatus as ApplicationStatus }
            : js
        )
      )
    }
    setEditingStatusId(null)
  }

  async function handleInlineCoordinatorChange(applicationId: string, newCoordinatorId: string) {
    const coordinatorId = newCoordinatorId || null
    const { error } = await supabase
      .from('applications')
      .update({ coordinator_id: coordinatorId })
      .eq('id', applicationId)

    if (!error) {
      const coordinatorName = coordinatorId
        ? coordinators.find((c) => c.value === coordinatorId)?.label.replace('（退職）', '') || null
        : null
      setJobSeekers((prev) =>
        prev.map((js) =>
          js.latest_application_id === applicationId
            ? { ...js, latest_coordinator_id: coordinatorId, latest_coordinator_name: coordinatorName }
            : js
        )
      )
    }
    setEditingCoordinatorId(null)
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
    setSearchInput('')
    const emptyFilters: FilterState = {
      search: '',
      status: '',
      progressStatus: '',
      coordinator: '',
      interviewer: '',
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

  async function handleCSVImport(data: Record<string, string>[], duplicateAction: DuplicateAction, formatId?: string): Promise<{ success: number; skipped: number; updated: number; errors: string[] }> {
    const errors: string[] = []
    let success = 0
    let skipped = 0
    let updated = 0
    const isAppSheet = formatId === 'application_sheet'

    // Preprocess application sheet rows
    if (isAppSheet) {
      data = data.map(preprocessApplicationSheetRow)
    }

    // Pre-fetch lookup tables
    const { data: sourcesData } = await supabase.from('sources').select('id, name')
    const sourceMap = new Map(sourcesData?.map((s) => [s.name, s.id]) || [])

    const { data: usersData } = await supabase.from('users').select('id, name')
    const userMap = new Map(usersData?.map((u) => [u.name, u.id]) || [])

    const { data: companiesData } = await supabase.from('companies').select('id, name, company_type_v2')
    const companyMap = new Map(companiesData?.map((c) => [c.name, c]) || [])

    const phones = data.map((row) => row.phone).filter(Boolean)
    const { data: existingJobSeekers } = await supabase
      .from('job_seekers')
      .select('id, phone')
      .in('phone', phones)

    const existingPhoneMap = new Map(existingJobSeekers?.map((js) => [js.phone, js.id]) || [])

    // Helper: find or create company
    async function findOrCreateCompany(name: string, companyType: string): Promise<string | null> {
      const existing = companyMap.get(name)
      if (existing) return existing.id

      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert({ name, company_type: companyType, company_type_v2: companyType })
        .select('id')
        .single()

      if (error || !newCompany) return null
      companyMap.set(name, { id: newCompany.id, name, company_type_v2: companyType })
      return newCompany.id
    }

    // Helper: find or create job
    async function findOrCreateJob(companyId: string, clientCompanyId: string | null, title: string): Promise<string | null> {
      let query = supabase
        .from('jobs')
        .select('id')
        .eq('company_id', companyId)

      if (clientCompanyId) {
        query = query.eq('client_company_id', clientCompanyId)
      } else {
        query = query.is('client_company_id', null)
      }

      const { data: existingJobs } = await query.limit(1)
      if (existingJobs && existingJobs.length > 0) return existingJobs[0].id

      const { data: newJob, error } = await supabase
        .from('jobs')
        .insert({
          company_id: companyId,
          client_company_id: clientCompanyId,
          title,
          status: 'open',
        })
        .select('id')
        .single()

      if (error || !newJob) return null
      return newJob.id
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNum = i + 2

      if (!row.name || !row.phone) {
        errors.push(`行${rowNum}: 氏名と電話番号は必須です`)
        continue
      }

      // === Step 1: Job Seeker ===
      let jobSeekerId: string
      const existingId = existingPhoneMap.get(row.phone)

      if (existingId) {
        if (duplicateAction === 'skip') {
          skipped++
          continue
        } else if (duplicateAction === 'update') {
          const { error: updateError } = await supabase
            .from('job_seekers')
            .update(buildJobSeekerFields(row))
            .eq('id', existingId)

          if (updateError) {
            errors.push(`行${rowNum}: 更新エラー - ${updateError.message}`)
            continue
          }
          jobSeekerId = existingId
          updated++
        } else {
          // duplicateAction === 'create'
          const { data: newJs, error: jsErr } = await supabase
            .from('job_seekers')
            .insert(buildJobSeekerFields(row))
            .select('id')
            .single()

          if (jsErr || !newJs) {
            errors.push(`行${rowNum}: ${jsErr?.message || '作成失敗'}`)
            continue
          }
          jobSeekerId = newJs.id
          success++
        }
      } else {
        const { data: newJs, error: jsErr } = await supabase
          .from('job_seekers')
          .insert(buildJobSeekerFields(row))
          .select('id')
          .single()

        if (jsErr || !newJs) {
          errors.push(`行${rowNum}: ${jsErr?.message || '作成失敗'}`)
          continue
        }
        jobSeekerId = newJs.id
        success++
      }

      // === Step 2: Application ===
      const sourceId = row.source_name ? sourceMap.get(row.source_name) || null : null
      const coordinatorId = row.coordinator_name ? userMap.get(row.coordinator_name) || null : null
      const appliedAt = row.applied_at || new Date().toISOString()

      // Check existing application for this job_seeker
      const { data: existingApps } = await supabase
        .from('applications')
        .select('id')
        .eq('job_seeker_id', jobSeekerId)
        .limit(1)

      let applicationId: string
      if (existingApps && existingApps.length > 0 && existingId && duplicateAction !== 'create') {
        applicationId = existingApps[0].id
        // Update coordinator if provided
        if (coordinatorId) {
          await supabase.from('applications').update({ coordinator_id: coordinatorId }).eq('id', applicationId)
        }
      } else {
        const { data: newApp, error: appErr } = await supabase
          .from('applications')
          .insert({
            job_seeker_id: jobSeekerId,
            source_id: sourceId,
            coordinator_id: coordinatorId,
            application_status: 'new',
            applied_at: appliedAt,
          })
          .select('id')
          .single()

        if (appErr || !newApp) {
          errors.push(`行${rowNum}: 応募作成エラー - ${appErr?.message || '作成失敗'}`)
          continue
        }
        applicationId = newApp.id
      }

      // === Step 3: Interview (if interview_date exists) ===
      if (row.interview_date) {
        const interviewerId = row.interviewer_name ? userMap.get(row.interviewer_name) || null : null
        const result = csvParseInterviewResult(row.interview_result || '')

        const { error: intErr } = await supabase.from('interviews').insert({
          application_id: applicationId,
          scheduled_at: row.interview_date,
          conducted_at: row.interview_date,
          interviewer_id: interviewerId,
          result,
        })

        if (intErr) {
          errors.push(`行${rowNum}: 面談作成エラー - ${intErr.message}`)
        }
      }

      // === Step 4: Companies + Jobs + Referrals (if dispatch_company_name exists) ===
      if (row.dispatch_company_name) {
        const dispatchCompanyId = await findOrCreateCompany(row.dispatch_company_name, 'dispatch')
        if (!dispatchCompanyId) {
          errors.push(`行${rowNum}: 派遣会社作成エラー`)
          continue
        }

        let clientCompanyId: string | null = null
        if (row.client_company_name) {
          clientCompanyId = await findOrCreateCompany(row.client_company_name, 'client')
          if (!clientCompanyId) {
            errors.push(`行${rowNum}: 派遣先企業作成エラー`)
            continue
          }
        }

        const jobTitle = clientCompanyId
          ? `${row.dispatch_company_name} → ${row.client_company_name}`
          : row.dispatch_company_name

        const jobId = await findOrCreateJob(dispatchCompanyId, clientCompanyId, jobTitle)
        if (!jobId) {
          errors.push(`行${rowNum}: 求人作成エラー`)
          continue
        }

        // Check existing referral
        const { data: existingRefs } = await supabase
          .from('referrals')
          .select('id')
          .eq('application_id', applicationId)
          .eq('job_id', jobId)
          .limit(1)

        let referralId: string
        if (existingRefs && existingRefs.length > 0) {
          referralId = existingRefs[0].id
        } else {
          const referralStatus = csvParseReferralStatus(row.referral_status || '')
          const { data: newRef, error: refErr } = await supabase
            .from('referrals')
            .insert({
              application_id: applicationId,
              job_id: jobId,
              referral_status: referralStatus,
              referred_at: row.referred_at || new Date().toISOString(),
              dispatch_interview_at: row.dispatch_interview_at || null,
              hired_at: row.hired_at || null,
              assignment_date: row.assignment_date || null,
              start_work_date: row.start_work_date || null,
            })
            .select('id')
            .single()

          if (refErr || !newRef) {
            errors.push(`行${rowNum}: 紹介作成エラー - ${refErr?.message || '作成失敗'}`)
            continue
          }
          referralId = newRef.id
        }

        // === Step 5: Sale (if sale_amount exists) ===
        if (row.sale_amount) {
          const saleAmount = parseInt(row.sale_amount)
          if (!isNaN(saleAmount)) {
            const { data: newSale, error: saleErr } = await supabase
              .from('sales')
              .insert({
                referral_id: referralId,
                amount: saleAmount,
                status: 'expected',
              })
              .select('id')
              .single()

            if (saleErr) {
              errors.push(`行${rowNum}: 売上作成エラー - ${saleErr.message}`)
            } else if (newSale) {
              // === Step 6: Payments ===
              if (isAppSheet) {
                // Application sheet: monthly payment columns (入金1月〜12月)
                const payYear = row.year || new Date().getFullYear().toString()
                let hasMonthlyPayments = false
                for (let m = 1; m <= 12; m++) {
                  const mAmount = parseInt(row[`payment_m${m}`] || '')
                  if (!isNaN(mAmount) && mAmount !== 0) {
                    hasMonthlyPayments = true
                    const payMonth = `${payYear}-${String(m).padStart(2, '0')}`
                    const { error: payErr } = await supabase.from('payments').insert({
                      sale_id: newSale.id,
                      amount: mAmount,
                      paid_at: `${payMonth}-01`,
                      payment_month: payMonth,
                    })
                    if (payErr) {
                      errors.push(`行${rowNum}: 入金${m}月作成エラー - ${payErr.message}`)
                    }
                  }
                }
                // Fallback: if no monthly data, use payment_amount
                if (!hasMonthlyPayments && row.payment_amount) {
                  const paymentAmount = parseInt(row.payment_amount)
                  if (!isNaN(paymentAmount)) {
                    const { error: payErr } = await supabase.from('payments').insert({
                      sale_id: newSale.id,
                      amount: paymentAmount,
                      paid_at: new Date().toISOString(),
                    })
                    if (payErr) {
                      errors.push(`行${rowNum}: 入金作成エラー - ${payErr.message}`)
                    }
                  }
                }
              } else if (row.payment_amount) {
                // LION format: single payment
                const paymentAmount = parseInt(row.payment_amount)
                if (!isNaN(paymentAmount)) {
                  const payMonth = row.payment_month || null
                  const { error: payErr } = await supabase.from('payments').insert({
                    sale_id: newSale.id,
                    amount: paymentAmount,
                    paid_at: payMonth ? `${payMonth}-01` : new Date().toISOString(),
                    payment_month: payMonth,
                  })
                  if (payErr) {
                    errors.push(`行${rowNum}: 入金作成エラー - ${payErr.message}`)
                  }
                }
              }
            }
          }
        }
      }
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
                value={searchInput}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchInput(value)
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
                  searchTimerRef.current = setTimeout(() => {
                    handleFilterChange('search', value)
                  }, 400)
                }}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  label="応募担当者"
                  options={coordinators}
                  placeholder="すべて"
                  value={filters.coordinator}
                  onChange={(e) => handleFilterChange('coordinator', e.target.value)}
                />
                <Select
                  label="面談担当者"
                  options={coordinators}
                  placeholder="すべて"
                  value={filters.interviewer}
                  onChange={(e) => handleFilterChange('interviewer', e.target.value)}
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
                    onClick={() => navigate(`/job-seekers/${js.latest_application_id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{js.display_name}</p>
                          {js.birth_date && (
                            <span className="text-xs text-slate-500 flex-shrink-0">{calculateAge(js.birth_date)}歳</span>
                          )}
                          <span className="flex items-center gap-0.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            <span className="text-blue-600">{js.application_count}</span>
                            <span>/</span>
                            <span className="text-green-600">{js.contact_count}</span>
                            <span>/</span>
                            <span className="text-purple-600">{js.interview_count}</span>
                          </span>
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
                      {js.source_counts.length > 0 && (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {js.source_counts.map((sc) =>
                            sc.count > 1 ? `${sc.name}(${sc.count})` : sc.name
                          ).join(', ')}
                        </span>
                      )}
                      {js.latest_job_type && (
                        <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                          {js.latest_job_type}
                        </span>
                      )}
                      {js.latest_progress_status && (
                        <Badge variant="default" className="text-xs">
                          {PROGRESS_STATUS_LABELS[js.latest_progress_status]}
                        </Badge>
                      )}
                      {js.latest_coordinator_name && <span>応募: {js.latest_coordinator_name}</span>}
                      {js.latest_interviewer_name && <span>面談: {js.latest_interviewer_name}</span>}
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
                        応募/対応/面談
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        応募媒体
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        職種
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        最新ステータス
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        応募担当者
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        面談担当者
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
                        onClick={() => navigate(`/job-seekers/${js.latest_application_id}`)}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900">{js.display_name}</p>
                              {js.birth_date && (
                                <span className="text-xs text-slate-500">{calculateAge(js.birth_date)}歳</span>
                              )}
                            </div>
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
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-medium text-blue-600">{js.application_count}</span>
                            <span className="text-slate-400">/</span>
                            <span className="font-medium text-green-600">{js.contact_count}</span>
                            <span className="text-slate-400">/</span>
                            <span className="font-medium text-purple-600">{js.interview_count}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-slate-600">
                            {js.source_counts.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {js.source_counts.map((sc, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-xs"
                                  >
                                    {sc.name}
                                    {sc.count > 1 && (
                                      <span className="ml-0.5 bg-blue-200 text-blue-800 px-1 rounded-full text-[10px]">
                                        {sc.count}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              '-'
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {js.latest_job_type ? (
                            <span className="inline-flex items-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-sm">
                              {js.latest_job_type}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          {editingStatusId === js.latest_application_id ? (
                            <select
                              autoFocus
                              className="text-sm border border-primary rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                              value={js.latest_application_status}
                              onChange={(e) => handleInlineStatusChange(js.latest_application_id, e.target.value)}
                              onBlur={() => setEditingStatusId(null)}
                            >
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <div
                              className="flex flex-col gap-1 cursor-pointer"
                              onClick={() => setEditingStatusId(js.latest_application_id)}
                            >
                              <Badge variant={getStatusBadgeVariant(js.latest_application_status)}>
                                {APPLICATION_STATUS_LABELS[js.latest_application_status]}
                              </Badge>
                              {js.latest_progress_status && (
                                <Badge variant="default">
                                  {PROGRESS_STATUS_LABELS[js.latest_progress_status]}
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          {editingCoordinatorId === js.latest_application_id ? (
                            <select
                              autoFocus
                              className="text-sm border border-primary rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                              value={js.latest_coordinator_id || ''}
                              onChange={(e) => handleInlineCoordinatorChange(js.latest_application_id, e.target.value)}
                              onBlur={() => setEditingCoordinatorId(null)}
                            >
                              <option value="">未設定</option>
                              {coordinators.filter((c) => c.value !== 'unset').map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className="text-sm text-slate-600 cursor-pointer hover:text-primary"
                              onClick={() => setEditingCoordinatorId(js.latest_application_id)}
                            >
                              {js.latest_coordinator_name || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {js.latest_interviewer_name || '-'}
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
        formats={CSV_IMPORT_FORMATS}
      />
    </div>
  )
}
