import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  User,
  Building2,
  Calendar,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { Card, Button, Badge, Input } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { SaleStatus } from '../../types/database'
import { SALE_STATUS_LABELS } from '../../types/database'

interface SaleDetail {
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
    referral_status: string
    referred_at: string
    application: {
      id: string
      job_seeker: {
        id: string
        name: string
        phone: string
      }
      coordinator: {
        id: string
        name: string
      } | null
    }
    job: {
      id: string
      title: string
      fee_amount: number | null
      company: {
        id: string
        name: string
        phone: string | null
        contact_person: string | null
      }
    }
  }
  payments?: {
    id: string
    amount: number
    paid_at: string
    payment_method: string | null
    notes: string | null
  }[]
}

const SALE_STATUS_OPTIONS = Object.entries(SALE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    if (id) {
      fetchSale()
    }
  }, [id])

  async function fetchSale() {
    setLoading(true)

    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        referral:referrals (
          id,
          referral_status,
          referred_at,
          application:applications (
            id,
            job_seeker:job_seekers (
              id,
              name,
              phone
            ),
            coordinator:users!applications_coordinator_id_fkey (
              id,
              name
            )
          ),
          job:jobs (
            id,
            title,
            fee_amount,
            company:companies (
              id,
              name,
              phone,
              contact_person
            )
          )
        ),
        payments (
          id,
          amount,
          paid_at,
          payment_method,
          notes
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching sale:', error)
      navigate('/sales')
      return
    }

    setSale(data as unknown as SaleDetail)
    setLoading(false)
  }

  async function updateStatus(newStatus: SaleStatus) {
    if (!sale) return

    const updates: Record<string, string | null> = {
      status: newStatus,
    }

    // Auto-fill dates based on status
    const now = new Date().toISOString()
    if (newStatus === 'confirmed' && !sale.confirmed_date) {
      updates.confirmed_date = now
    }
    if (newStatus === 'invoiced' && !sale.invoiced_date) {
      updates.invoiced_date = now
    }
    if (newStatus === 'paid' && !sale.paid_date) {
      updates.paid_date = now
    }

    const { error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', sale.id)

    if (error) {
      console.error('Error updating status:', error)
      alert('ステータスの更新に失敗しました')
      return
    }

    // If marked as paid, update application progress status
    if (newStatus === 'paid') {
      await supabase
        .from('applications')
        .update({ progress_status: 'full_paid' })
        .eq('id', sale.referral.application.id)
    }

    setSale({ ...sale, status: newStatus, ...updates })
    setShowStatusModal(false)
  }

  async function updateDate(field: string, value: string) {
    if (!sale) return

    const { error } = await supabase
      .from('sales')
      .update({ [field]: value || null })
      .eq('id', sale.id)

    if (!error) {
      setSale({ ...sale, [field]: value || null })
    }
  }

  function getSaleStatusBadgeVariant(status: SaleStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' {
    switch (status) {
      case 'expected': return 'info'
      case 'confirmed': return 'warning'
      case 'invoiced': return 'purple'
      case 'paid': return 'success'
      default: return 'default'
    }
  }

  if (loading || !sale) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const { referral } = sale
  const totalPaid = sale.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
  const remaining = sale.amount - totalPaid

  return (
    <div>
      <Header
        title="売上詳細"
        action={
          <Button onClick={() => setShowStatusModal(true)}>
            ステータス変更
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Amount Header */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Badge variant={getSaleStatusBadgeVariant(sale.status)} className="text-base px-4 py-2">
                {SALE_STATUS_LABELS[sale.status]}
              </Badge>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {formatCurrency(sale.amount)}
              </p>
              {sale.payments && sale.payments.length > 0 && (
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-emerald-600">入金済: {formatCurrency(totalPaid)}</span>
                  {remaining > 0 && (
                    <span className="text-amber-600">残額: {formatCurrency(remaining)}</span>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">紹介元</p>
              <Link
                to={`/referrals/${referral.id}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                紹介詳細を見る
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Seeker Info */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4">求職者情報</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{referral.application?.job_seeker?.name}</p>
                  <p className="text-sm text-slate-500">{referral.application?.job_seeker?.phone}</p>
                </div>
              </div>
              {referral.application?.coordinator && (
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <User className="w-4 h-4" />
                  <span>担当: {referral.application.coordinator.name}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Company Info */}
          <Card>
            <h3 className="font-semibold text-slate-800 mb-4">請求先</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{referral.job?.company?.name}</p>
                  <p className="text-sm text-slate-500">{referral.job?.title}</p>
                </div>
              </div>
              {referral.job?.company?.contact_person && (
                <div className="text-sm text-slate-600">
                  担当者: {referral.job.company.contact_person}
                  {referral.job.company.phone && ` / ${referral.job.company.phone}`}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Dates */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-4">日程</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-500 mb-1">入金予定日</label>
              <Input
                type="date"
                value={sale.expected_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('expected_date', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">確定日</label>
              <Input
                type="date"
                value={sale.confirmed_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('confirmed_date', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">請求日</label>
              <Input
                type="date"
                value={sale.invoiced_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('invoiced_date', e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-500 mb-1">入金日</label>
              <Input
                type="date"
                value={sale.paid_date?.split('T')[0] || ''}
                onChange={(e) => updateDate('paid_date', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Payments */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">入金履歴</h3>
            <Button size="sm" onClick={() => setShowPaymentModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              入金を記録
            </Button>
          </div>
          {sale.payments && sale.payments.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {sale.payments
                .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
                .map((payment) => (
                  <div key={payment.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-800">
                          {formatCurrency(payment.amount)}
                        </p>
                        {payment.payment_method && (
                          <p className="text-sm text-slate-500">{payment.payment_method}</p>
                        )}
                        {payment.notes && (
                          <p className="text-sm text-slate-500 mt-1">{payment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        {formatDate(payment.paid_at)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              入金履歴はありません
            </div>
          )}
        </Card>

        {/* Notes */}
        {sale.notes && (
          <Card>
            <h3 className="font-semibold text-slate-800 mb-2">メモ</h3>
            <p className="text-slate-600 whitespace-pre-wrap">{sale.notes}</p>
          </Card>
        )}
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatusModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">ステータス変更</h3>
            <div className="space-y-2">
              {SALE_STATUS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateStatus(value as SaleStatus)}
                  className={`w-full px-4 py-3 text-left rounded-lg transition-colors ${
                    sale.status === value
                      ? 'bg-primary text-white'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          saleId={sale.id}
          defaultAmount={remaining}
          onClose={() => setShowPaymentModal(false)}
          onSave={() => {
            setShowPaymentModal(false)
            fetchSale()
          }}
        />
      )}
    </div>
  )
}

function PaymentModal({
  saleId,
  defaultAmount,
  onClose,
  onSave,
}: {
  saleId: string
  defaultAmount: number
  onClose: () => void
  onSave: () => void
}) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount.toString() : '')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!amount || !paidAt) return

    setSaving(true)

    const { error } = await supabase.from('payments').insert({
      sale_id: saleId,
      amount: parseInt(amount),
      paid_at: paidAt,
      payment_method: paymentMethod || null,
      notes: notes || null,
    })

    if (error) {
      console.error('Error creating payment:', error)
      alert('入金の記録に失敗しました')
    } else {
      onSave()
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">入金を記録</h3>
        <div className="space-y-4">
          <Input
            label="金額"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額を入力"
            required
          />
          <Input
            label="入金日"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            required
          />
          <Input
            label="入金方法"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="例: 銀行振込、現金"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">メモ</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="備考..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={!amount || !paidAt}>
            記録
          </Button>
        </div>
      </div>
    </div>
  )
}
