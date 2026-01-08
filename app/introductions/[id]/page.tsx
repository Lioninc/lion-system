'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Input, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Introduction {
  id: string
  introduction_date: string | null
  candidate_id: string
  candidate_name: string | null
  company_id: string
  company_name: string | null
  job_id: string | null
  job_title: string | null
  status: string
  interview_date: string | null
  hire_date: string | null
  salary_offered: number | null
  staff_id: string | null
  staff_name: string | null
  notes: string | null
}

interface Payment {
  id: string
  total_amount: number
  status: string
  invoice_date: string | null
  due_date: string | null
  paid_date: string | null
}

const statusOptions = [
  { value: '紹介済み', label: '紹介済み' },
  { value: '面接予定', label: '面接予定' },
  { value: '面接済み', label: '面接済み' },
  { value: '採用決定', label: '採用決定' },
  { value: '不採用', label: '不採用' },
  { value: '辞退', label: '辞退' },
]

const paymentStatusOptions = [
  { value: '未請求', label: '未請求' },
  { value: '請求中', label: '請求中' },
  { value: '入金済み', label: '入金済み' },
]

function getStatusBadge(status: string | null) {
  switch (status) {
    case '採用':
    case '採用決定':
      return <Badge variant="success">{status}</Badge>
    case '面接予定':
      return <Badge variant="info">{status}</Badge>
    case '面接済み':
      return <Badge variant="purple">{status}</Badge>
    case '不採用':
    case '辞退':
      return <Badge variant="danger">{status}</Badge>
    case '紹介済み':
      return <Badge variant="warning">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return dateStr
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

export default function IntroductionDetailPage() {
  const params = useParams()
  const introductionId = params.id as string

  const [introduction, setIntroduction] = useState<Introduction | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    status: '',
    interview_date: '',
    hire_date: '',
    salary_offered: '',
    notes: '',
  })
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentFormData, setPaymentFormData] = useState({
    total_amount: '',
    status: '未請求',
    invoice_date: '',
    due_date: '',
    paid_date: '',
    notes: '',
  })

  useEffect(() => {
    if (introductionId) {
      fetchIntroductionData()
    }
  }, [introductionId])

  async function fetchIntroductionData() {
    setLoading(true)
    const supabase = createClient()

    // 紹介情報を取得
    const { data: introData, error: introError } = await supabase
      .from('introductions')
      .select(`
        id,
        introduction_date,
        candidate_id,
        company_id,
        job_id,
        status,
        interview_date,
        hire_date,
        salary_offered,
        staff_id,
        notes,
        candidates:candidate_id (
          name
        ),
        companies:company_id (
          name
        ),
        jobs:job_id (
          title
        ),
        employees:staff_id (
          name
        )
      `)
      .eq('id', introductionId)
      .single()

    if (introError || !introData) {
      console.error('Error fetching introduction:', introError)
      setLoading(false)
      return
    }

    const data = introData as any
    const intro: Introduction = {
      id: data.id,
      introduction_date: data.introduction_date,
      candidate_id: data.candidate_id,
      candidate_name: data.candidates?.name || null,
      company_id: data.company_id,
      company_name: data.companies?.name || null,
      job_id: data.job_id,
      job_title: data.jobs?.title || null,
      status: data.status,
      interview_date: data.interview_date,
      hire_date: data.hire_date,
      salary_offered: data.salary_offered,
      staff_id: data.staff_id,
      staff_name: data.employees?.name || null,
      notes: data.notes,
    }
    setIntroduction(intro)
    setEditFormData({
      status: intro.status || '',
      interview_date: intro.interview_date || '',
      hire_date: intro.hire_date || '',
      salary_offered: intro.salary_offered?.toString() || '',
      notes: intro.notes || '',
    })

    // 入金情報を取得
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('introduction_id', introductionId)
      .order('created_at', { ascending: false })

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
    } else {
      setPayments(paymentsData || [])
    }

    setLoading(false)
  }

  async function handleSaveEdit() {
    const supabase = createClient()

    const updateData = {
      status: editFormData.status,
      interview_date: editFormData.interview_date || null,
      hire_date: editFormData.hire_date || null,
      salary_offered: editFormData.salary_offered ? parseInt(editFormData.salary_offered, 10) : null,
      notes: editFormData.notes || null,
    }

    const { error } = await (supabase
      .from('introductions') as any)
      .update(updateData)
      .eq('id', introductionId)

    if (error) {
      console.error('Error updating introduction:', error)
      alert('更新に失敗しました')
      return
    }

    setIsEditing(false)
    fetchIntroductionData()
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const payload = {
      introduction_id: introductionId,
      total_amount: parseInt(paymentFormData.total_amount, 10),
      status: paymentFormData.status,
      invoice_date: paymentFormData.invoice_date || null,
      due_date: paymentFormData.due_date || null,
      paid_date: paymentFormData.paid_date || null,
      notes: paymentFormData.notes || null,
    }

    const { error } = await (supabase.from('payments') as any).insert(payload)

    if (error) {
      console.error('Error creating payment:', error)
      alert('入金登録に失敗しました')
      return
    }

    setShowPaymentModal(false)
    setPaymentFormData({
      total_amount: '',
      status: '未請求',
      invoice_date: '',
      due_date: '',
      paid_date: '',
      notes: '',
    })
    fetchIntroductionData()
  }

  function getPaymentStatusBadge(status: string | null) {
    switch (status) {
      case '入金済み':
      case '入金済':
        return <Badge variant="success">{status}</Badge>
      case '請求中':
        return <Badge variant="warning">{status}</Badge>
      case '未請求':
        return <Badge variant="info">{status}</Badge>
      default:
        return <Badge>{status || '-'}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  if (!introduction) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">紹介が見つかりません</p>
          <Link href="/introductions">
            <Button variant="secondary">一覧に戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  const isHired = introduction.status === '採用' || introduction.status === '採用決定'

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/introductions"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">紹介詳細</h1>
          {getStatusBadge(introduction.status)}
        </div>
        <div className="flex gap-2">
          {isHired && (
            <Button onClick={() => setShowPaymentModal(true)}>
              入金登録
            </Button>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>編集</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setIsEditing(false)}>
                キャンセル
              </Button>
              <Button onClick={handleSaveEdit}>保存</Button>
            </>
          )}
        </div>
      </div>

      {/* 紹介情報 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">紹介情報</h2>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">紹介日</dt>
              <dd className="text-sm text-slate-800">{formatDate(introduction.introduction_date)}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">求職者</dt>
              <dd className="text-sm">
                <Link href={`/candidates/${introduction.candidate_id}`} className="text-blue-600 hover:underline">
                  {introduction.candidate_name || '-'}
                </Link>
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">企業</dt>
              <dd className="text-sm">
                <Link href={`/companies/${introduction.company_id}`} className="text-blue-600 hover:underline">
                  {introduction.company_name || '-'}
                </Link>
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">案件</dt>
              <dd className="text-sm">
                {introduction.job_id ? (
                  <Link href={`/jobs/${introduction.job_id}`} className="text-blue-600 hover:underline">
                    {introduction.job_title || '-'}
                  </Link>
                ) : (
                  '-'
                )}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">担当</dt>
              <dd className="text-sm text-slate-800">{introduction.staff_name || '-'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">進捗情報</h2>
          {isEditing ? (
            <div className="space-y-4">
              <Select
                label="ステータス"
                options={statusOptions}
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              />
              <Input
                label="面接日"
                type="date"
                value={editFormData.interview_date}
                onChange={(e) => setEditFormData({ ...editFormData, interview_date: e.target.value })}
              />
              <Input
                label="採用日"
                type="date"
                value={editFormData.hire_date}
                onChange={(e) => setEditFormData({ ...editFormData, hire_date: e.target.value })}
              />
              <Input
                label="提示給与"
                type="number"
                value={editFormData.salary_offered}
                onChange={(e) => setEditFormData({ ...editFormData, salary_offered: e.target.value })}
                placeholder="例: 300000"
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          ) : (
            <dl className="space-y-3">
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">ステータス</dt>
                <dd className="text-sm">{getStatusBadge(introduction.status)}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">面接日</dt>
                <dd className="text-sm text-slate-800">{formatDate(introduction.interview_date)}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">採用日</dt>
                <dd className="text-sm text-slate-800">{formatDate(introduction.hire_date)}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">提示給与</dt>
                <dd className="text-sm text-slate-800">
                  {introduction.salary_offered ? `¥${formatNumber(introduction.salary_offered)}` : '-'}
                </dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">備考</dt>
                <dd className="text-sm text-slate-800">{introduction.notes || '-'}</dd>
              </div>
            </dl>
          )}
        </Card>
      </div>

      {/* 入金情報 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">入金情報</h2>
          {isHired && payments.length === 0 && (
            <Button size="sm" onClick={() => setShowPaymentModal(true)}>
              入金登録
            </Button>
          )}
        </div>
        {payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-emerald-600">
                    ¥{formatNumber(payment.total_amount)}
                  </span>
                  {getPaymentStatusBadge(payment.status)}
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">請求日: </span>
                    <span className="text-slate-800">{formatDate(payment.invoice_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">入金予定日: </span>
                    <span className="text-slate-800">{formatDate(payment.due_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">入金日: </span>
                    <span className="text-slate-800">{formatDate(payment.paid_date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            入金情報がありません
          </div>
        )}
      </Card>

      {/* 入金登録モーダル */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-4">入金登録</h2>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="p-3 bg-slate-100 rounded">
                <div className="text-sm text-slate-500">紹介情報</div>
                <div className="text-sm font-medium text-slate-800">
                  {introduction.candidate_name} → {introduction.company_name}
                </div>
              </div>
              <Input
                label="金額"
                type="number"
                value={paymentFormData.total_amount}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, total_amount: e.target.value })}
                placeholder="例: 300000"
                required
              />
              <Select
                label="ステータス"
                options={paymentStatusOptions}
                value={paymentFormData.status}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value })}
              />
              <Input
                label="請求日"
                type="date"
                value={paymentFormData.invoice_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, invoice_date: e.target.value })}
              />
              <Input
                label="入金予定日"
                type="date"
                value={paymentFormData.due_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, due_date: e.target.value })}
              />
              <Input
                label="入金日"
                type="date"
                value={paymentFormData.paid_date}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, paid_date: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">備考</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="備考があれば入力"
                />
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>
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
