'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Input, Select, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Candidate {
  id: string
  name: string
  phone: string | null
  stage: string
  staff_id: string | null
  staff_name: string | null
  notes: string | null
  created_at: string
  application_date: string | null
  source_name: string | null
  last_contact: string | null
  last_contact_result: string | null
  contact_count: number
  available_date: string | null
}

interface Employee {
  id: string
  name: string
}


// ステージ別のバッジ表示
function getStageBadge(stage: string) {
  switch (stage) {
    case '新規':
      return <Badge variant="info">{stage}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{stage}</Badge>
    case '連絡済み':
      return <Badge variant="success">{stage}</Badge>
    case '面談予定':
      return <Badge variant="purple">{stage}</Badge>
    case '保留':
      return <Badge variant="default">{stage}</Badge>
    case '就業時期が先':
      return <Badge variant="default">{stage}</Badge>
    default:
      return <Badge>{stage}</Badge>
  }
}

// 連絡結果のバッジ
function getContactResultBadge(result: string | null) {
  if (!result) return null
  switch (result) {
    case '繋がった':
      return <Badge variant="success">{result}</Badge>
    case '繋がらず':
      return <Badge variant="danger">{result}</Badge>
    case '留守電':
      return <Badge variant="warning">{result}</Badge>
    case '就業時期が先':
      return <Badge variant="default">{result}</Badge>
    default:
      return <Badge>{result}</Badge>
  }
}

export default function AttackListPage() {
  const router = useRouter()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // フィルター
  const [stageFilter, setStageFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 連絡モーダル
  const [showContactModal, setShowContactModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [contactResult, setContactResult] = useState('')
  const [contactNotes, setContactNotes] = useState('')
  const [availableDate, setAvailableDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()

    // 従業員を取得
    const { data: employeesData } = await supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    setEmployees(employeesData || [])

    // 対象ステージの求職者を取得
    const targetStages = ['新規', '電話出ず', '連絡済み', '面談予定', '保留', '就業時期が先']

    const { data: candidatesData, error } = await supabase
      .from('candidates')
      .select(`
        id,
        name,
        phone,
        stage,
        staff_id,
        notes,
        created_at,
        contact_count,
        available_date,
        employees:staff_id (
          name
        )
      `)
      .in('stage', targetStages)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching candidates:', error)
      setLoading(false)
      return
    }

    // 各求職者の最新連絡履歴と応募媒体を取得
    const candidateIds = (candidatesData || []).map((c: any) => c.id)

    if (candidateIds.length === 0) {
      setCandidates([])
      setLoading(false)
      return
    }

    // 応募情報を取得（応募日と媒体）
    const { data: applicationsData } = await supabase
      .from('applications')
      .select('candidate_id, source, application_date')
      .in('candidate_id', candidateIds)
      .order('application_date', { ascending: true })

    // 連絡履歴を取得（最新のもの）
    const { data: contactHistoryData } = await supabase
      .from('contact_history')
      .select('candidate_id, contacted_at, result')
      .in('candidate_id', candidateIds)
      .order('contacted_at', { ascending: false })

    // 求職者ごとの最新連絡履歴をマップ
    const latestContactMap = new Map<string, { contacted_at: string; result: string }>()
    ;(contactHistoryData || []).forEach((ch: any) => {
      if (!latestContactMap.has(ch.candidate_id)) {
        latestContactMap.set(ch.candidate_id, {
          contacted_at: ch.contacted_at,
          result: ch.result,
        })
      }
    })

    // 求職者ごとの応募媒体と応募日をマップ
    const applicationMap = new Map<string, { source: string; application_date: string | null }>()
    ;(applicationsData || []).forEach((app: any) => {
      if (!applicationMap.has(app.candidate_id)) {
        applicationMap.set(app.candidate_id, {
          source: app.source,
          application_date: app.application_date,
        })
      }
    })

    const formattedData: Candidate[] = (candidatesData || []).map((c: any) => {
      const latestContact = latestContactMap.get(c.id)
      const application = applicationMap.get(c.id)
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        stage: c.stage,
        staff_id: c.staff_id,
        staff_name: c.employees?.name || null,
        notes: c.notes,
        created_at: c.created_at,
        application_date: application?.application_date || null,
        source_name: application?.source || null,
        last_contact: latestContact?.contacted_at || null,
        last_contact_result: latestContact?.result || null,
        contact_count: c.contact_count || 0,
        available_date: c.available_date,
      }
    })

    setCandidates(formattedData)
    setLoading(false)
  }

  // 表示対象かどうかを判定
  function shouldDisplay(candidate: Candidate): boolean {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    // 14日前の日付
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0]

    // 就業時期が先の場合
    if (candidate.stage === '就業時期が先') {
      // available_dateがあり、今日以前なら表示（希望日になった人）
      if (candidate.available_date && candidate.available_date <= todayStr) {
        return true
      }
      // available_dateがNULLまたは今日より後なら非表示
      return false
    }

    // 新規・電話出ず・連絡済みの場合
    if (['新規', '電話出ず', '連絡済み'].includes(candidate.stage)) {
      // contact_count >= 3 なら除外
      if (candidate.contact_count >= 3) {
        return false
      }

      // 応募から2週間以上経過なら除外
      const applicationDateStr = candidate.application_date || candidate.created_at
      if (applicationDateStr) {
        const applicationDate = applicationDateStr.split('T')[0]
        if (applicationDate < twoWeeksAgoStr) {
          return false
        }
      }

      return true
    }

    // 面談予定・保留は表示
    return true
  }

  // フィルタリング
  const filteredCandidates = candidates.filter((candidate) => {
    // 検索クエリ
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !candidate.name.toLowerCase().includes(query) &&
        !(candidate.phone || '').includes(query)
      ) {
        return false
      }
    }

    // ステージフィルター
    if (stageFilter && candidate.stage !== stageFilter) {
      return false
    }

    // 担当者フィルター
    if (employeeFilter && candidate.staff_id !== employeeFilter) {
      return false
    }

    // 応募日フィルター（application_date優先、なければcreated_at）
    const applicationDateStr = candidate.application_date || candidate.created_at
    if (dateFrom) {
      const candidateDate = new Date(applicationDateStr).toISOString().split('T')[0]
      if (candidateDate < dateFrom) {
        return false
      }
    }
    if (dateTo) {
      const candidateDate = new Date(applicationDateStr).toISOString().split('T')[0]
      if (candidateDate > dateTo) {
        return false
      }
    }

    return true
  })

  // 当日連絡リスト（表示条件を適用）
  const todayList = filteredCandidates.filter((c) => {
    // 新規・電話出ず・連絡済み または 就業時期が先（希望日到来）の人
    if (['新規', '電話出ず', '連絡済み', '就業時期が先'].includes(c.stage)) {
      return shouldDisplay(c)
    }
    return false
  })

  // ステージ別カウント（表示条件を適用）
  const displayableCandidates = filteredCandidates.filter(shouldDisplay)
  const stageCounts = {
    '新規': displayableCandidates.filter((c) => c.stage === '新規').length,
    '電話出ず': displayableCandidates.filter((c) => c.stage === '電話出ず').length,
    '連絡済み': displayableCandidates.filter((c) => c.stage === '連絡済み').length,
    '面談予定': filteredCandidates.filter((c) => c.stage === '面談予定').length,
    '保留': filteredCandidates.filter((c) => c.stage === '保留').length,
    '就業時期が先': displayableCandidates.filter((c) => c.stage === '就業時期が先').length,
  }

  function handleOpenContactModal(candidate: Candidate) {
    setSelectedCandidate(candidate)
    setContactResult('')
    setContactNotes('')
    setAvailableDate('')
    setShowContactModal(true)
  }

  function handleCloseContactModal() {
    setShowContactModal(false)
    setSelectedCandidate(null)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCandidate || !contactResult) return

    // 就業時期が先を選択した場合は日付必須
    if (contactResult === '就業時期が先' && !availableDate) {
      alert('希望就業日を入力してください')
      return
    }

    setSubmitting(true)
    const supabase = createClient()

    // 連絡履歴を保存
    const { error } = await (supabase.from('contact_history') as any).insert({
      candidate_id: selectedCandidate.id,
      contacted_at: new Date().toISOString(),
      result: contactResult,
      notes: contactNotes || null,
      staff_id: null, // TODO: ログインユーザーのIDを設定
    })

    if (error) {
      console.error('Error saving contact history:', error)
      alert('連絡履歴の保存に失敗しました')
      setSubmitting(false)
      return
    }

    // ステージとcontact_countを更新
    let newStage = selectedCandidate.stage
    let newContactCount = selectedCandidate.contact_count
    const updateData: any = {}

    if (contactResult === '繋がった') {
      newStage = '連絡済み'
      updateData.stage = newStage

      // ステージ更新後、面談登録画面へ遷移
      await (supabase
        .from('candidates') as any)
        .update(updateData)
        .eq('id', selectedCandidate.id)

      setSubmitting(false)
      handleCloseContactModal()
      router.push(`/interviews/new?candidate_id=${selectedCandidate.id}`)
      return
    } else if (contactResult === '繋がらず' || contactResult === '留守電') {
      newStage = '電話出ず'
      newContactCount = (selectedCandidate.contact_count || 0) + 1
      updateData.stage = newStage
      updateData.contact_count = newContactCount
    } else if (contactResult === '就業時期が先') {
      newStage = '就業時期が先'
      updateData.stage = newStage
      updateData.available_date = availableDate
    }

    if (Object.keys(updateData).length > 0) {
      await (supabase
        .from('candidates') as any)
        .update(updateData)
        .eq('id', selectedCandidate.id)
    }

    setSubmitting(false)
    handleCloseContactModal()
    fetchData() // データを再取得
  }

  function formatDateTime(dateStr: string | null) {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  }

  const stageOptions = [
    { value: '', label: 'すべて' },
    { value: '新規', label: '新規' },
    { value: '電話出ず', label: '電話出ず' },
    { value: '連絡済み', label: '連絡済み' },
    { value: '面談予定', label: '面談予定' },
    { value: '保留', label: '保留' },
    { value: '就業時期が先', label: '就業時期が先' },
  ]

  const contactResultOptions = [
    { value: '', label: '選択してください' },
    { value: '繋がった', label: '繋がった' },
    { value: '繋がらず', label: '繋がらず' },
    { value: '留守電', label: '留守電' },
    { value: '就業時期が先', label: '就業時期が先' },
  ]

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">アタックリスト</h1>
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  // 表示用リスト（フィルター適用時はフィルター結果、それ以外はtodayList）
  const displayList = stageFilter
    ? filteredCandidates.filter(shouldDisplay)
    : todayList

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">アタックリスト</h1>

      {/* ステージ別サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('新規')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">新規</p>
            <p className="text-2xl font-bold text-blue-600">{stageCounts['新規']}</p>
          </div>
        </Card>
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('電話出ず')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">電話出ず</p>
            <p className="text-2xl font-bold text-orange-600">{stageCounts['電話出ず']}</p>
          </div>
        </Card>
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('連絡済み')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">連絡済み</p>
            <p className="text-2xl font-bold text-green-600">{stageCounts['連絡済み']}</p>
          </div>
        </Card>
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('面談予定')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">面談予定</p>
            <p className="text-2xl font-bold text-purple-600">{stageCounts['面談予定']}</p>
          </div>
        </Card>
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('保留')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">保留</p>
            <p className="text-2xl font-bold text-slate-600">{stageCounts['保留']}</p>
          </div>
        </Card>
        <Card className="cursor-pointer hover:bg-slate-50" onClick={() => setStageFilter('就業時期が先')}>
          <div className="text-center">
            <p className="text-sm text-slate-500">就業時期が先</p>
            <p className="text-2xl font-bold text-slate-600">{stageCounts['就業時期が先']}</p>
          </div>
        </Card>
      </div>

      {/* フィルター */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            placeholder="名前・電話番号で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            label=""
            options={stageOptions}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          />
          <Select
            label=""
            options={[
              { value: '', label: '担当者：すべて' },
              ...employees.map((e) => ({ value: e.id, label: e.name })),
            ]}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          />
          <Input
            type="date"
            placeholder="応募日（から）"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            placeholder="応募日（まで）"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {(stageFilter || employeeFilter || dateFrom || dateTo) && (
          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStageFilter('')
                setEmployeeFilter('')
                setDateFrom('')
                setDateTo('')
              }}
            >
              フィルターをクリア
            </Button>
          </div>
        )}
      </Card>

      {/* 当日連絡リストヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          {stageFilter ? `${stageFilter}の求職者` : '当日連絡リスト'}
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({displayList.length}件)
          </span>
        </h2>
      </div>

      {/* テーブル */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>ステージ</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>応募媒体</TableHead>
              <TableHead>応募日</TableHead>
              <TableHead>最終連絡</TableHead>
              <TableHead>備考</TableHead>
              <TableHead>アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayList.map((candidate) => (
              <TableRow key={candidate.id}>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {candidate.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {candidate.phone ? (
                    <a
                      href={`tel:${candidate.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {candidate.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>{getStageBadge(candidate.stage)}</TableCell>
                <TableCell>{candidate.staff_name || <span className="text-slate-400">-</span>}</TableCell>
                <TableCell>{candidate.source_name || <span className="text-slate-400">-</span>}</TableCell>
                <TableCell>{formatDate(candidate.application_date || candidate.created_at)}</TableCell>
                <TableCell>
                  {candidate.last_contact ? (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">
                        {formatDateTime(candidate.last_contact)}
                      </div>
                      {getContactResultBadge(candidate.last_contact_result)}
                    </div>
                  ) : (
                    <span className="text-slate-400">未連絡</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="max-w-32 truncate text-sm text-slate-600" title={candidate.notes || ''}>
                    {candidate.notes || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleOpenContactModal(candidate)}
                  >
                    連絡
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {displayList.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する求職者がいません
          </div>
        )}
      </Card>

      {/* 連絡モーダル */}
      {showContactModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">連絡記録</h2>
            <div className="mb-4 p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                <span className="font-medium">{selectedCandidate.name}</span>
                {selectedCandidate.phone && (
                  <span className="ml-2 text-slate-500">{selectedCandidate.phone}</span>
                )}
              </p>
            </div>
            <form onSubmit={handleSaveContact} className="space-y-4">
              <Select
                label="連絡結果"
                options={contactResultOptions}
                value={contactResult}
                onChange={(e) => setContactResult(e.target.value)}
                required
              />
              {contactResult === '就業時期が先' && (
                <Input
                  label="希望就業日"
                  type="date"
                  value={availableDate}
                  onChange={(e) => setAvailableDate(e.target.value)}
                  required
                />
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={contactNotes}
                  onChange={(e) => setContactNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="メモを入力（任意）"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="secondary" onClick={handleCloseContactModal}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={!contactResult || submitting}>
                  {submitting ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
