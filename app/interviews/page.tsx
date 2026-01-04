'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Interview {
  id: string
  interview_date: string
  interview_time: string | null
  interview_type: string | null
  result: string | null
  notes: string | null
  candidate_id: string
  candidate_name: string
  employee_id: string | null
  employee_name: string | null
  company_id: string | null
  company_name: string | null
}

interface Candidate {
  id: string
  name: string
}

interface Employee {
  id: string
  name: string
}

interface Company {
  id: string
  name: string
}

const interviewTypeOptions = [
  { value: '', label: '選択してください' },
  { value: '対面', label: '対面' },
  { value: '電話', label: '電話' },
  { value: 'Web', label: 'Web' },
]

const resultOptions = [
  { value: '', label: '選択してください' },
  { value: '未実施', label: '未実施' },
  { value: '繋ぎ', label: '繋ぎ' },
  { value: '繋げず', label: '繋げず' },
]

function getResultBadge(result: string | null) {
  switch (result) {
    case '繋ぎ':
      return <Badge variant="success">{result}</Badge>
    case '繋げず':
      return <Badge variant="danger">{result}</Badge>
    case '未実施':
      return <Badge variant="default">{result}</Badge>
    default:
      return <Badge variant="default">未実施</Badge>
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    candidate_id: '',
    interview_date: '',
    interview_time: '',
    interview_type: '',
    employee_id: '',
    result: '',
    company_id: '',
    notes: '',
  })

  useEffect(() => {
    fetchInterviews()
    fetchCandidates()
    fetchEmployees()
    fetchCompanies()
  }, [])

  async function fetchInterviews() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        id,
        interview_date,
        interview_time,
        interview_type,
        result,
        notes,
        candidate_id,
        employee_id,
        company_id,
        candidates:candidate_id (
          name
        ),
        employees:employee_id (
          name
        ),
        companies:company_id (
          name
        )
      `)
      .order('interview_date', { ascending: false })

    if (error) {
      console.error('Error fetching interviews:', error)
      setLoading(false)
      return
    }

    const formattedData: Interview[] = (data || []).map((i: any) => ({
      id: i.id,
      interview_date: i.interview_date,
      interview_time: i.interview_time,
      interview_type: i.interview_type,
      result: i.result,
      notes: i.notes,
      candidate_id: i.candidate_id,
      candidate_name: i.candidates?.name || '',
      employee_id: i.employee_id,
      employee_name: i.employees?.name || null,
      company_id: i.company_id,
      company_name: i.companies?.name || null,
    }))

    setInterviews(formattedData)
    setLoading(false)
  }

  async function fetchCandidates() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching candidates:', error)
      return
    }

    setCandidates(data || [])
  }

  async function fetchEmployees() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    setEmployees(data || [])
  }

  async function fetchCompanies() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching companies:', error)
      return
    }

    setCompanies(data || [])
  }

  function handleOpenModal() {
    setFormData({
      candidate_id: '',
      interview_date: '',
      interview_time: '',
      interview_type: '',
      employee_id: '',
      result: '',
      company_id: '',
      notes: '',
    })
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const payload = {
      candidate_id: formData.candidate_id,
      interview_date: formData.interview_date,
      interview_time: formData.interview_time || null,
      interview_type: formData.interview_type || null,
      employee_id: formData.employee_id || null,
      result: formData.result || null,
      company_id: formData.company_id || null,
      notes: formData.notes || null,
    }

    const { error } = await (supabase
      .from('interviews') as any)
      .insert(payload)

    if (error) {
      console.error('Error creating interview:', error)
      alert('登録に失敗しました')
      return
    }

    handleCloseModal()
    fetchInterviews()
  }

  const filteredInterviews = interviews.filter((interview) =>
    interview.candidate_name.includes(searchQuery) ||
    (interview.employee_name && interview.employee_name.includes(searchQuery))
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">面談一覧</h1>
        <Button onClick={handleOpenModal}>新規面談</Button>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="求職者名・担当者で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </Card>

      {/* テーブル */}
      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>求職者名</TableHead>
                <TableHead>種類</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>紹介先</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInterviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>{formatDate(interview.interview_date)}</TableCell>
                  <TableCell>{interview.interview_time || '-'}</TableCell>
                  <TableCell>
                    <Link
                      href={`/candidates/${interview.candidate_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {interview.candidate_name}
                    </Link>
                  </TableCell>
                  <TableCell>{interview.interview_type || '-'}</TableCell>
                  <TableCell>{interview.employee_name || '-'}</TableCell>
                  <TableCell>{getResultBadge(interview.result)}</TableCell>
                  <TableCell>
                    {interview.company_name || (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && filteredInterviews.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する面談が見つかりません
          </div>
        )}
      </Card>

      {/* 新規面談モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">新規面談登録</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="求職者"
                options={[
                  { value: '', label: '選択してください' },
                  ...candidates.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={formData.candidate_id}
                onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="面談日"
                  type="date"
                  value={formData.interview_date}
                  onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                  required
                />
                <Input
                  label="面談時間"
                  type="time"
                  value={formData.interview_time}
                  onChange={(e) => setFormData({ ...formData, interview_time: e.target.value })}
                />
              </div>
              <Select
                label="面談種類"
                options={interviewTypeOptions}
                value={formData.interview_type}
                onChange={(e) => setFormData({ ...formData, interview_type: e.target.value })}
              />
              <Select
                label="面談担当者"
                options={[
                  { value: '', label: '選択してください' },
                  ...employees.map((e) => ({ value: e.id, label: e.name })),
                ]}
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              />
              <Select
                label="結果"
                options={resultOptions}
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
              />
              <Select
                label="紹介先企業（任意）"
                options={[
                  { value: '', label: '選択してください' },
                  ...companies.map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  キャンセル
                </Button>
                <Button type="submit">登録</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
