'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Select, Card } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Candidate {
  id: string
  name: string
  phone: string | null
}

interface Employee {
  id: string
  name: string
  division_name: string | null
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

function NewInterviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const candidateIdParam = searchParams.get('candidate_id')

  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    candidate_id: candidateIdParam || '',
    interview_date: '',
    interview_time: '',
    interview_type: '',
    interviewer_id: '',
    result: '',
    referred_company_id: '',
    notes: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // 候補者IDパラメータがある場合、候補者を自動選択
    if (candidateIdParam && candidates.length > 0) {
      const candidate = candidates.find(c => c.id === candidateIdParam)
      if (candidate) {
        setSelectedCandidate(candidate)
        setFormData(prev => ({ ...prev, candidate_id: candidateIdParam }))
      }
    }
  }, [candidateIdParam, candidates])

  async function fetchData() {
    const supabase = createClient()

    const [candidatesResult, employeesResult, companiesResult] = await Promise.all([
      supabase.from('candidates').select('id, name, phone').order('name'),
      supabase.from('employees').select(`
        id,
        name,
        divisions (
          name
        )
      `).eq('is_active', true).order('name'),
      supabase.from('companies').select('id, name').order('name'),
    ])

    if (candidatesResult.error) {
      console.error('Error fetching candidates:', candidatesResult.error)
    } else {
      const candidatesData = (candidatesResult.data || []) as Candidate[]
      setCandidates(candidatesData)
      // パラメータがあれば候補者を自動選択
      if (candidateIdParam) {
        const candidate = candidatesData.find(c => c.id === candidateIdParam)
        if (candidate) {
          setSelectedCandidate(candidate)
        }
      }
    }

    if (employeesResult.error) {
      console.error('Error fetching employees:', employeesResult.error)
    } else {
      // 管理部の担当者を除外
      const filteredEmployees: Employee[] = (employeesResult.data || [])
        .map((emp: any) => ({
          id: emp.id,
          name: emp.name,
          division_name: emp.divisions?.name || null,
        }))
        .filter((emp: Employee) => emp.division_name !== '管理部')
      setEmployees(filteredEmployees)
    }

    if (companiesResult.error) {
      console.error('Error fetching companies:', companiesResult.error)
    } else {
      setCompanies(companiesResult.data || [])
    }

    setLoading(false)
  }

  function handleCandidateChange(candidateId: string) {
    const candidate = candidates.find(c => c.id === candidateId)
    setSelectedCandidate(candidate || null)
    setFormData(prev => ({ ...prev, candidate_id: candidateId }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    const supabase = createClient()

    const payload = {
      candidate_id: formData.candidate_id,
      interview_date: formData.interview_date,
      interview_time: formData.interview_time || null,
      interview_type: formData.interview_type || null,
      interviewer_id: formData.interviewer_id || null,
      result: formData.result || null,
      referred_company_id: formData.referred_company_id || null,
      notes: formData.notes || null,
    }

    const { error } = await (supabase.from('interviews') as any).insert(payload)

    if (error) {
      console.error('Error creating interview:', error)
      alert('登録に失敗しました')
      setSubmitting(false)
      return
    }

    // 候補者のステージを「面談予定」に更新
    await (supabase.from('candidates') as any)
      .update({ stage: '面談予定' })
      .eq('id', formData.candidate_id)

    router.push('/interviews')
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/interviews"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>一覧に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">面談 新規登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">求職者情報</h2>

          {selectedCandidate ? (
            <div className="p-4 bg-blue-50 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{selectedCandidate.name}</p>
                  {selectedCandidate.phone && (
                    <p className="text-sm text-slate-600">{selectedCandidate.phone}</p>
                  )}
                </div>
                {!candidateIdParam && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedCandidate(null)
                      setFormData(prev => ({ ...prev, candidate_id: '' }))
                    }}
                  >
                    変更
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Select
              label="求職者"
              options={[
                { value: '', label: '選択してください' },
                ...candidates.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={formData.candidate_id}
              onChange={(e) => handleCandidateChange(e.target.value)}
              required
            />
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">面談情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              value={formData.interviewer_id}
              onChange={(e) => setFormData({ ...formData, interviewer_id: e.target.value })}
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
              value={formData.referred_company_id}
              onChange={(e) => setFormData({ ...formData, referred_company_id: e.target.value })}
            />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="備考があれば入力してください"
          />
        </Card>

        <div className="flex gap-4 justify-end">
          <Link href="/interviews">
            <Button type="button" variant="secondary">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={!formData.candidate_id || !formData.interview_date || submitting}>
            {submitting ? '登録中...' : '登録する'}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewInterviewPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">読み込み中...</div>}>
      <NewInterviewContent />
    </Suspense>
  )
}
