'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Input, Select, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface CandidateWithApplication {
  id: string
  name: string
  age: number | null
  stage: string
  preferred_job: string | null
  phone: string | null
  staff_id: string | null
  application_date: string | null
  source: string | null
  employee_name: string | null
}


const stageOptions = [
  { value: '', label: 'すべて' },
  { value: '新規', label: '新規' },
  { value: '電話出ず', label: '電話出ず' },
  { value: '連絡済み', label: '連絡済み' },
  { value: '面談予定', label: '面談予定' },
  { value: '面談済み', label: '面談済み' },
  { value: '紹介済み', label: '紹介済み' },
  { value: '面接予定', label: '面接予定' },
  { value: '面接済み', label: '面接済み' },
  { value: '採用決定', label: '採用決定' },
  { value: '稼働中', label: '稼働中' },
  { value: '保留', label: '保留' },
  { value: '就業時期が先', label: '就業時期が先' },
  { value: '不採用', label: '不採用' },
  { value: '辞退', label: '辞退' },
  { value: '飛び', label: '飛び' },
  { value: 'NG', label: 'NG' },
]

const occupationOptions = [
  { value: '', label: 'すべて' },
  { value: '製造業', label: '製造業' },
  { value: '軽作業', label: '軽作業' },
  { value: '事務', label: '事務' },
  { value: '倉庫作業', label: '倉庫作業' },
]

function getStageBadge(stage: string) {
  switch (stage) {
    case '新規':
      return <Badge variant="info">{stage}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{stage}</Badge>
    case '連絡済み':
      return <Badge variant="info">{stage}</Badge>
    case '面談予定':
    case '面談済み':
      return <Badge variant="purple">{stage}</Badge>
    case '紹介済み':
    case '面接予定':
    case '面接済み':
      return <Badge variant="info">{stage}</Badge>
    case '採用決定':
    case '稼働中':
      return <Badge variant="success">{stage}</Badge>
    case '保留':
    case '就業時期が先':
      return <Badge variant="warning">{stage}</Badge>
    case '不採用':
    case '辞退':
    case '飛び':
    case 'NG':
      return <Badge variant="danger">{stage}</Badge>
    default:
      return <Badge>{stage}</Badge>
  }
}

const ITEMS_PER_PAGE = 50

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateWithApplication[]>([])
  const [employees, setEmployees] = useState<{ value: string; label: string }[]>([{ value: '', label: 'すべて' }])
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([{ value: '', label: 'すべて' }])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [occupationFilter, setOccupationFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchEmployees()
    fetchSources()
  }, [])

  // フィルター変更時にページを1に戻す
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sourceFilter, stageFilter, occupationFilter, employeeFilter])

  // ページ変更時またはフィルター変更時にデータを再取得
  useEffect(() => {
    fetchCandidates(currentPage, searchQuery, sourceFilter, stageFilter, occupationFilter, employeeFilter)
  }, [currentPage, searchQuery, sourceFilter, stageFilter, occupationFilter, employeeFilter])

  async function fetchCandidates(
    page: number,
    search: string,
    source: string,
    stage: string,
    occupation: string,
    employee: string
  ) {
    setLoading(true)
    const supabase = createClient()

    // ベースクエリを構築
    let countQuery = supabase
      .from('candidates')
      .select('id, name, phone, stage, preferred_job, employees:staff_id(name), applications(source)', { count: 'exact', head: true })

    let dataQuery = supabase
      .from('candidates')
      .select(`
        id,
        name,
        age,
        stage,
        preferred_job,
        phone,
        staff_id,
        applications (
          application_date,
          source
        ),
        employees:staff_id (
          name
        )
      `)

    // フィルター適用（検索はクライアントサイドで行うため、サーバーサイドではstage, source等のみ）
    if (stage) {
      countQuery = countQuery.eq('stage', stage)
      dataQuery = dataQuery.eq('stage', stage)
    }
    if (occupation) {
      countQuery = countQuery.eq('preferred_job', occupation)
      dataQuery = dataQuery.eq('preferred_job', occupation)
    }

    // 件数取得
    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error fetching count:', countError)
    }

    // ページネーション用のrange計算
    const from = (page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    // データ取得
    const { data, error } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching candidates:', error)
      setLoading(false)
      return
    }

    // データを整形
    let formattedData: CandidateWithApplication[] = (data || []).map((candidate: any) => {
      // 最新の応募情報を取得
      const latestApplication = candidate.applications?.[0] || {}

      return {
        id: candidate.id,
        name: candidate.name,
        age: candidate.age,
        stage: candidate.stage,
        preferred_job: candidate.preferred_job,
        phone: candidate.phone,
        staff_id: candidate.staff_id,
        application_date: latestApplication.application_date || null,
        source: latestApplication.source || null,
        employee_name: candidate.employees?.name || null,
      }
    })

    // クライアントサイドフィルター（検索、応募媒体、担当者）
    if (search) {
      formattedData = formattedData.filter(c =>
        c.name?.includes(search) ||
        c.id?.includes(search) ||
        c.phone?.includes(search)
      )
    }
    if (source) {
      formattedData = formattedData.filter(c => c.source === source)
    }
    if (employee) {
      formattedData = formattedData.filter(c => c.employee_name === employee)
    }

    setCandidates(formattedData)
    setTotalCount(count || 0)
    setLoading(false)
  }

  async function fetchEmployees() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    const options = [
      { value: '', label: 'すべて' },
      ...(data || []).map((emp: any) => ({ value: emp.name, label: emp.name }))
    ]
    setEmployees(options)
  }

  async function fetchSources() {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('sources')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching sources:', error)
      return
    }

    const options = [
      { value: '', label: 'すべて' },
      ...(data || []).map((s: any) => ({ value: s.name, label: s.name }))
    ]
    setSourceOptions(options)
  }

  // ページネーション計算（サーバーサイドの件数を使用）
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // ページ番号の配列を生成（現在ページの前後2ページを表示）
  function getPageNumbers(): (number | string)[] {
    const pages: (number | string)[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  // 日付フォーマット
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">求職者一覧</h1>
        <div className="flex gap-2">
          <Link
            href="/candidates/import"
            className="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500 px-4 py-2 text-sm"
          >
            CSVインポート
          </Link>
          <Link
            href="/candidates/new"
            className="inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 bg-[#3b82f6] text-white hover:bg-blue-600 focus:ring-blue-500 px-4 py-2 text-sm"
          >
            新規登録
          </Link>
        </div>
      </div>

      {/* 検索・フィルター */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            placeholder="名前・ID・電話番号で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            options={sourceOptions}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
          <Select
            options={stageOptions}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          />
          <Select
            options={occupationOptions}
            value={occupationFilter}
            onChange={(e) => setOccupationFilter(e.target.value)}
          />
          <Select
            options={employees}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* テーブル */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            読み込み中...
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>応募日</TableHead>
                  <TableHead>応募媒体</TableHead>
                  <TableHead>応募状態</TableHead>
                  <TableHead>希望職種</TableHead>
                  <TableHead>名前</TableHead>
                  <TableHead>年齢</TableHead>
                  <TableHead>担当者</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate) => (
                  <TableRow key={candidate.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {formatDate(candidate.application_date)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {candidate.source || '-'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {getStageBadge(candidate.stage)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {candidate.preferred_job || '-'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full font-medium text-blue-600 hover:underline"
                      >
                        {candidate.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {candidate.age ? `${candidate.age}歳` : '-'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="block w-full"
                      >
                        {candidate.employee_name || '-'}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {candidates.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                該当する求職者が見つかりません
              </div>
            )}

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  全{totalCount.toLocaleString()}件（{currentPage} / {totalPages}ページ）
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    前へ
                  </button>
                  {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 text-sm border rounded-md ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={index} className="px-2 text-slate-400">
                        {page}
                      </span>
                    )
                  ))}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
