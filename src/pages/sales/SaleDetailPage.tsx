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
import { formatCurrency } from '../../lib/utils'
import type { SaleStatus } from '../../types/database'
import { SALE_STATUS_LABELS } from '../../types/database'

interface PaymentRecord {
  id: string
  amount: number
  paid_at: string
  payment_month: string | null
  payment_method: string | null
  refund_reason: string | null
  notes: string | null
}

interface SaleRecord {
  id: string
  amount: number
  status: SaleStatus
  expected_date: string | null
  confirmed_date: string | null
  invoiced_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
}

interface ReferralDetail {
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

interface SaleDetail extends SaleRecord {
  referral: ReferralDetail
  payments?: PaymentRecord[]
}

const SALE_STATUS_OPTIONS = Object.entries(SALE_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<SaleDetail | null>(null)
  const [allSales, setAllSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAddSaleModal, setShowAddSaleModal] = useState(false)
  const [paymentMonth, setPaymentMonth] = useState('')

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
            company:companies!company_id (
              id,
              name,
              phone,
              contact_person
            ),
            client_company:companies!client_company_id (
              id,
              name
            )
          )
        ),
        payments (
          id,
          amount,
          paid_at,
          payment_month,
          payment_method,
          refund_reason,
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

    const saleData = data as unknown as SaleDetail
    setSale(saleData)

    // Fetch all sales for the same referral
    if (saleData.referral?.id) {
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('referral_id', saleData.referral.id)
        .order('created_at', { ascending: false })

      if (salesData) {
        setAllSales(salesData as SaleRecord[])
      }
    }

    setLoading(false)
  }

  async function updateStatus(newStatus: SaleStatus) {
    if (!sale) return

    const updates: Record<string, string | null> = {
      status: newStatus,
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

    if (newStatus === 'paid') {
      await supabase
        .from('applications')
        .update({ progress_status: 'full_paid' })
        .eq('id', sale.referral.application.id)
    }

    setSale({ ...sale, status: newStatus })
    setShowStatusModal(false)
  }

  async function updatePaymentMonth(value: string) {
    if (!sale) return

    setPaymentMonth(value)

    // Save to expected_date field as YYYY-MM-01
    const dateValue = value ? `${value}-01` : null
    const { error } = await supabase
      .from('sales')
      .update({ expected_date: dateValue })
      .eq('id', sale.id)

    if (!error) {
      setSale({ ...sale, expected_date: dateValue })
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

  // Aggregate all payments across all sales for this referral
  const allPayments = sale.payments || []
  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0)
  const totalSalesAmount = allSales.reduce((sum, s) => sum + s.amount, 0)
  const remaining = totalSalesAmount - totalPaid

  // Derive payment month from expected_date
  const currentPaymentMonth = sale.expected_date ? sale.expected_date.substring(0, 7) : ''

  return (
    <div>
      <Header
        title="売上詳細"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddSaleModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              売上追加
            </Button>
            <Button onClick={() => setShowStatusModal(true)}>
              ステータス変更
            </Button>
          </div>
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
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-emerald-600">入金済: {formatCurrency(totalPaid)}</span>
                {remaining > 0 && (
                  <span className="text-amber-600">残額: {formatCurrency(remaining)}</span>
                )}
                {remaining < 0 && (
                  <span className="text-red-600">超過: {formatCurrency(Math.abs(remaining))}</span>
                )}
              </div>
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

        {/* Payment Month */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-4">入金月</h3>
          <div className="max-w-xs">
            <Input
              type="month"
              value={paymentMonth || currentPaymentMonth}
              onChange={(e) => updatePaymentMonth(e.target.value)}
              className="text-sm"
            />
          </div>
        </Card>

        {/* All Sales for this Referral */}
        {allSales.length > 1 && (
          <Card padding="none">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">この紹介の売上一覧</h3>
              <p className="text-sm text-slate-500 mt-1">
                合計: {formatCurrency(totalSalesAmount)}（{allSales.length}件）
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {allSales.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 ${
                    s.id === sale.id ? 'bg-primary/5 border-l-4 border-primary' : ''
                  }`}
                  onClick={() => {
                    if (s.id !== sale.id) navigate(`/sales/${s.id}`)
                  }}
                >
                  <div>
                    <p className="font-medium text-slate-800">{formatCurrency(s.amount)}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(s.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <Badge variant={getSaleStatusBadgeVariant(s.status)}>
                    {SALE_STATUS_LABELS[s.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Payments */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">入金履歴</h3>
              <p className="text-sm text-slate-500 mt-1">
                売上 {formatCurrency(totalSalesAmount)} / 入金済 {formatCurrency(totalPaid)} / 残り {formatCurrency(Math.max(0, remaining))}
              </p>
            </div>
            <Button size="sm" onClick={() => setShowPaymentModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              入金を記録
            </Button>
          </div>
          {allPayments.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {allPayments
                .sort((a, b) => {
                  // Sort by payment_month desc, then paid_at desc
                  const monthA = a.payment_month || ''
                  const monthB = b.payment_month || ''
                  if (monthA !== monthB) return monthB.localeCompare(monthA)
                  return new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime()
                })
                .map((payment) => (
                  <div key={payment.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${payment.amount < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          {payment.amount < 0 ? (
                            <>返金 {formatCurrency(Math.abs(payment.amount))}</>
                          ) : (
                            formatCurrency(payment.amount)
                          )}
                        </p>
                        {payment.refund_reason && (
                          <p className="text-sm text-red-500 mt-1">理由: {payment.refund_reason}</p>
                        )}
                        {payment.notes && (
                          <p className="text-sm text-slate-500 mt-1">{payment.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="w-4 h-4" />
                        {payment.payment_month || new Date(payment.paid_at).toLocaleDateString('ja-JP')}
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
          defaultAmount={remaining > 0 ? remaining : 0}
          onClose={() => setShowPaymentModal(false)}
          onSave={() => {
            setShowPaymentModal(false)
            fetchSale()
          }}
        />
      )}

      {/* Add Sale Modal */}
      {showAddSaleModal && sale.referral && (
        <AddSaleModal
          referralId={sale.referral.id}
          onClose={() => setShowAddSaleModal(false)}
          onSave={() => {
            setShowAddSaleModal(false)
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
  const [paymentMonth, setPaymentMonth] = useState(
    new Date().toISOString().substring(0, 7)
  )
  const [refundReason, setRefundReason] = useState('')
  const [saving, setSaving] = useState(false)

  const numericAmount = parseInt(amount) || 0
  const isRefund = numericAmount < 0

  async function handleSave() {
    if (!amount || !paymentMonth) return

    setSaving(true)

    const { error } = await supabase.from('payments').insert({
      sale_id: saleId,
      amount: parseInt(amount),
      paid_at: `${paymentMonth}-01`,
      payment_month: paymentMonth,
      refund_reason: isRefund && refundReason ? refundReason : null,
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
            label="入金年月"
            type="month"
            value={paymentMonth}
            onChange={(e) => setPaymentMonth(e.target.value)}
            required
          />
          <div>
            <Input
              label="金額（マイナス=返金）"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 400000 または -100000"
              required
            />
            {isRefund && (
              <p className="text-sm text-red-500 mt-1">※ マイナスのため返金として記録されます</p>
            )}
          </div>
          {isRefund && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">返金理由</label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="返金理由を入力..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={!amount || !paymentMonth}>
            記録
          </Button>
        </div>
      </div>
    </div>
  )
}

function AddSaleModal({
  referralId,
  onClose,
  onSave,
}: {
  referralId: string
  onClose: () => void
  onSave: () => void
}) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!amount) return

    setSaving(true)

    const { error } = await supabase.from('sales').insert({
      referral_id: referralId,
      amount: parseInt(amount),
      status: 'expected',
    })

    if (error) {
      console.error('Error creating sale:', error)
      alert('売上の追加に失敗しました')
    } else {
      onSave()
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">売上を追加</h3>
        <p className="text-sm text-slate-500 mb-4">
          同じ紹介に新しい売上レコードを追加します。
        </p>
        <div className="space-y-4">
          <Input
            label="金額"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額を入力"
            required
          />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving} disabled={!amount}>
            追加
          </Button>
        </div>
      </div>
    </div>
  )
}
