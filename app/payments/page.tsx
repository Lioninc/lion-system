'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface PaymentItem {
  id: string
  introduction_id: string
  start_work_date: string
  candidate_id: string
  candidate_name: string | null
  company_id: string
  company_name: string | null
  referral_fee: number | null
  // paymentsテーブルから
  payment_id: string | null
  payment_status: string | null
  paid_amount: number | null  // 入金済み金額（入金途中の場合に使用）
}

interface Stats {
  pendingAmount: number   // 入金予定（入金予定・仮売上）
  waitingAmount: number   // 入金待ち（請求中・入金途中）
  paidAmount: number      // 入金済
}

const statusOptions = [
  { value: '入金予定', label: '入金予定' },
  { value: '請求中', label: '請求中' },
  { value: '入金途中', label: '入金途中' },
  { value: '入金済み', label: '入金済み' },
]

function getStatusBadgeVariant(status: string | null): 'success' | 'purple' | 'warning' | 'info' | 'default' {
  switch (status) {
    case '入金済':
    case '入金済み':
      return 'success'
    case '入金途中':
      return 'purple'
    case '請求中':
      return 'warning'
    case '仮売上':
    case '入金予定':
      return 'info'
    default:
      return 'info'
  }
}

function getStatusLabel(status: string | null): string {
  if (!status) return '入金予定'
  return status
}

// 数値を安全にフォーマット
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

// 統計を計算する関数
function calculateStats(items: PaymentItem[]): Stats {
  let pendingAmount = 0
  let waitingAmount = 0
  let paidAmount = 0

  items.forEach((item) => {
    const amount = item.referral_fee || 0
    const status = item.payment_status
    const paidAmt = item.paid_amount || 0

    if (status === '入金済' || status === '入金済み') {
      // 入金済み: 全額を入金済みに
      paidAmount += amount
    } else if (status === '入金途中') {
      // 入金途中: paid_amountを入金済みに、残りを入金待ちに
      paidAmount += paidAmt
      waitingAmount += (amount - paidAmt)
    } else if (status === '請求中') {
      // 請求中: 全額を入金待ちに
      waitingAmount += amount
    } else {
      // 入金予定・仮売上など: 入金予定売上に
      pendingAmount += amount
    }
  })

  return { pendingAmount, waitingAmount, paidAmount }
}

// ステータス変更モーダルコンポーネント
function StatusModal({
  item,
  isOpen,
  onClose,
  onStatusChange,
}: {
  item: PaymentItem | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: (introductionId: string, newStatus: string, referralFee: number | null, paymentId: string | null, paidAmount: number | null) => Promise<void>
}) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [paidAmountInput, setPaidAmountInput] = useState('')

  // モーダルが開いたときに初期化
  useEffect(() => {
    if (isOpen && item) {
      setSelectedStatus(null)
      setPaidAmountInput(item.paid_amount ? String(item.paid_amount) : '')
    }
  }, [isOpen, item])

  if (!isOpen || !item) return null

  async function handleStatusClick(newStatus: string) {
    if (newStatus === '入金途中') {
      // 入金途中を選択した場合は入力フォームを表示
      setSelectedStatus('入金途中')
    } else {
      // その他のステータスは直接保存
      await handleSave(newStatus, null)
    }
  }

  async function handleSave(status: string, paidAmount: number | null) {
    if (!item) return

    if (status === item.payment_status && paidAmount === item.paid_amount) {
      onClose()
      return
    }

    setIsUpdating(true)
    try {
      await onStatusChange(item.introduction_id, status, item.referral_fee, item.payment_id, paidAmount)
      onClose()
    } finally {
      setIsUpdating(false)
    }
  }

  async function handlePartialPaymentSubmit() {
    const paidAmount = parseInt(paidAmountInput, 10) || 0
    await handleSave('入金途中', paidAmount)
  }

  const currentStatus = getStatusLabel(item.payment_status)

  // ステータスごとの色設定
  const statusColors: Record<string, { bg: string; border: string; text: string; hover: string }> = {
    '入金予定': { bg: 'bg-blue-50', border: 'border-blue-500', text: 'text-blue-700', hover: 'hover:bg-blue-100' },
    '請求中': { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-700', hover: 'hover:bg-amber-100' },
    '入金途中': { bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-700', hover: 'hover:bg-purple-100' },
    '入金済み': { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-700', hover: 'hover:bg-emerald-100' },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isUpdating && onClose()}
      />

      {/* モーダル本体 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">ステータス変更</h2>

        {/* 対象情報 */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6">
          <div className="space-y-2 text-sm">
            <div className="flex">
              <span className="w-20 text-slate-500">求職者</span>
              <span className="font-medium text-slate-800">{item.candidate_name || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 text-slate-500">企業</span>
              <span className="font-medium text-slate-800">{item.company_name || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-20 text-slate-500">金額</span>
              <span className="font-bold text-emerald-600">
                {item.referral_fee ? `¥${formatNumber(item.referral_fee)}` : '-'}
              </span>
            </div>
            {item.payment_status === '入金途中' && item.paid_amount && (
              <div className="flex">
                <span className="w-20 text-slate-500">入金済</span>
                <span className="font-medium text-purple-600">¥{formatNumber(item.paid_amount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 入金途中選択時の入力フォーム */}
        {selectedStatus === '入金途中' ? (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-purple-50 border-2 border-purple-500 rounded-lg">
              <label className="block text-sm font-medium text-purple-700 mb-2">
                入金済み金額を入力
              </label>
              <div className="flex items-center gap-2">
                <span className="text-purple-700">¥</span>
                <input
                  type="number"
                  value={paidAmountInput}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  placeholder="0"
                  className="flex-1 px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              <p className="text-xs text-purple-600 mt-2">
                総額: ¥{formatNumber(item.referral_fee)} / 残り: ¥{formatNumber((item.referral_fee || 0) - (parseInt(paidAmountInput, 10) || 0))}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedStatus(null)}
                disabled={isUpdating}
                className="flex-1 h-[44px] rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                戻る
              </button>
              <button
                onClick={handlePartialPaymentSubmit}
                disabled={isUpdating || !paidAmountInput}
                className="flex-1 h-[44px] rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isUpdating ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ステータスボタン */}
            <div className="space-y-3 mb-6">
              {statusOptions.map((option) => {
                const colors = statusColors[option.value]
                const isSelected = option.value === currentStatus

                return (
                  <button
                    key={option.value}
                    onClick={() => handleStatusClick(option.value)}
                    disabled={isUpdating}
                    className={`
                      w-full h-[50px] rounded-lg font-medium text-base transition-all
                      border-2 disabled:opacity-50 disabled:cursor-not-allowed
                      ${isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text} ring-2 ring-offset-2 ring-${option.value === '入金予定' ? 'blue' : option.value === '請求中' ? 'amber' : option.value === '入金途中' ? 'purple' : 'emerald'}-300`
                        : `bg-white border-slate-200 text-slate-700 ${colors.hover}`
                      }
                    `}
                  >
                    {isUpdating ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        保存中...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {isSelected && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {option.label}
                        {isSelected && <span className="text-xs">（現在）</span>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* キャンセルボタン */}
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="w-full h-[44px] rounded-lg border border-slate-300 text-slate-600 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PaymentsPage() {
  const [paymentItems, setPaymentItems] = useState<PaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<Stats>({
    pendingAmount: 0,
    waitingAmount: 0,
    paidAmount: 0,
  })
  // モーダル用state
  const [modalItem, setModalItem] = useState<PaymentItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchPaymentData()
  }, [])

  async function fetchPaymentData() {
    setLoading(true)
    const supabase = createClient()

    // introductionsテーブルから入社日が入力されているデータを取得
    const { data: introductions, error: introError } = await supabase
      .from('introductions')
      .select(`
        id,
        start_work_date,
        candidate_id,
        company_id,
        job_id,
        candidates:candidate_id (
          name
        ),
        companies:company_id (
          name
        ),
        jobs:job_id (
          referral_fee
        )
      `)
      .not('start_work_date', 'is', null)
      .order('start_work_date', { ascending: false })

    if (introError) {
      console.error('Error fetching introductions:', introError)
      setLoading(false)
      return
    }

    // 紹介IDリストを取得してpaymentsを取得
    const introIds = (introductions || []).map((i: any) => i.id)

    let paymentsMap: Record<string, any> = {}
    if (introIds.length > 0) {
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('*')
        .in('introduction_id', introIds)

      if (payError) {
        console.error('Error fetching payments:', payError)
      } else {
        // introduction_idをキーにしたマップを作成
        (payments || []).forEach((p: any) => {
          paymentsMap[p.introduction_id] = p
        })
      }
    }

    // データを整形
    const formattedData: PaymentItem[] = (introductions || []).map((intro: any) => {
      const payment = paymentsMap[intro.id]
      return {
        id: intro.id,
        introduction_id: intro.id,
        start_work_date: intro.start_work_date,
        candidate_id: intro.candidate_id,
        candidate_name: intro.candidates?.name || null,
        company_id: intro.company_id,
        company_name: intro.companies?.name || null,
        referral_fee: intro.jobs?.referral_fee || null,
        payment_id: payment?.id || null,
        payment_status: payment?.status || null,
        paid_amount: payment?.paid_amount || null,
      }
    })

    // 統計を計算
    setStats(calculateStats(formattedData))
    setPaymentItems(formattedData)
    setLoading(false)
  }

  async function handleStatusChange(
    introductionId: string,
    newStatus: string,
    referralFee: number | null,
    paymentId: string | null,
    paidAmount: number | null
  ) {
    const supabase = createClient()

    if (paymentId) {
      // 既存のpaymentをUPDATE
      const updateData: Record<string, any> = { status: newStatus }
      if (newStatus === '入金途中') {
        updateData.paid_amount = paidAmount || 0
      } else {
        updateData.paid_amount = null
      }

      const { error } = await (supabase.from('payments') as any)
        .update(updateData)
        .eq('id', paymentId)

      if (error) {
        console.error('Error updating payment:', error)
        alert('ステータスの更新に失敗しました')
        return
      }
    } else {
      // 新規INSERT
      const payload: Record<string, any> = {
        introduction_id: introductionId,
        amount: referralFee || 0,
        total_amount: referralFee || 0,
        status: newStatus,
      }
      if (newStatus === '入金途中') {
        payload.paid_amount = paidAmount || 0
      }

      const { data, error } = await (supabase.from('payments') as any)
        .insert(payload)
        .select()
        .single()

      if (error) {
        console.error('Error creating payment:', error)
        alert('ステータスの更新に失敗しました')
        return
      }

      // 新しいpayment_idをセット
      paymentId = data.id
    }

    // ローカルステートを更新
    setPaymentItems((prev) => {
      const updated = prev.map((item) =>
        item.introduction_id === introductionId
          ? {
              ...item,
              payment_status: newStatus,
              payment_id: paymentId,
              paid_amount: newStatus === '入金途中' ? paidAmount : null
            }
          : item
      )
      // 統計を再計算
      setStats(calculateStats(updated))
      return updated
    })
  }

  const filteredItems = paymentItems.filter((item) =>
    (item.candidate_name || '').includes(searchQuery) ||
    (item.company_name || '').includes(searchQuery)
  )

  const statsDisplay = [
    { label: '入金予定売上', value: `¥${formatNumber(stats.pendingAmount)}`, color: 'text-blue-600' },
    { label: '入金待ち', value: `¥${formatNumber(stats.waitingAmount)}`, color: 'text-amber-600' },
    { label: '入金済', value: `¥${formatNumber(stats.paidAmount)}`, color: 'text-emerald-600' },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">入金一覧</h1>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statsDisplay.map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="求職者名・企業名で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
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
                  <TableHead>成約日</TableHead>
                  <TableHead>求職者</TableHead>
                  <TableHead>企業</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>ステータス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.start_work_date || '-'}</TableCell>
                    <TableCell>
                      {item.candidate_id ? (
                        <Link
                          href={`/candidates/${item.candidate_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {item.candidate_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {item.company_id ? (
                        <Link
                          href={`/companies/${item.company_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {item.company_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {item.referral_fee ? (
                        <div>
                          <span className="font-medium">
                            ¥{formatNumber(item.referral_fee)}
                          </span>
                          {item.payment_status === '入金途中' && item.paid_amount !== null && (
                            <span className="text-xs text-purple-600 ml-1">
                              (入金済: ¥{formatNumber(item.paid_amount)})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => {
                          setModalItem(item)
                          setIsModalOpen(true)
                        }}
                        className="cursor-pointer"
                      >
                        <Badge variant={getStatusBadgeVariant(item.payment_status)}>
                          {getStatusLabel(item.payment_status)}
                        </Badge>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredItems.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {paymentItems.length === 0 ? '入金データがありません' : '該当する入金が見つかりません'}
              </div>
            )}
          </>
        )}
      </Card>

      {/* ステータス変更モーダル */}
      <StatusModal
        item={modalItem}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setModalItem(null)
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
