'use client'

import { useState, useEffect, useRef } from 'react'
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

    if (status === '入金済' || status === '入金済み') {
      paidAmount += amount
    } else if (status === '請求中' || status === '入金途中') {
      waitingAmount += amount
    } else {
      pendingAmount += amount
    }
  })

  return { pendingAmount, waitingAmount, paidAmount }
}

// ステータスドロップダウンコンポーネント
function StatusDropdown({
  item,
  onStatusChange,
}: {
  item: PaymentItem
  onStatusChange: (introductionId: string, newStatus: string, referralFee: number | null, paymentId: string | null) => Promise<void>
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSelect(newStatus: string) {
    if (newStatus === item.payment_status) {
      setIsOpen(false)
      return
    }

    setIsUpdating(true)
    try {
      await onStatusChange(item.introduction_id, newStatus, item.referral_fee, item.payment_id)
    } finally {
      setIsUpdating(false)
      setIsOpen(false)
    }
  }

  const currentStatus = getStatusLabel(item.payment_status)
  const variant = getStatusBadgeVariant(item.payment_status)

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        disabled={isUpdating}
        className="cursor-pointer disabled:cursor-wait"
      >
        {isUpdating ? (
          <Badge variant={variant}>
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              保存中
            </span>
          </Badge>
        ) : (
          <Badge variant={variant}>{currentStatus}</Badge>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg ${
                option.value === currentStatus ? 'bg-slate-100 font-medium' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
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
    paymentId: string | null
  ) {
    const supabase = createClient()

    if (paymentId) {
      // 既存のpaymentをUPDATE
      const { error } = await (supabase.from('payments') as any)
        .update({ status: newStatus })
        .eq('id', paymentId)

      if (error) {
        console.error('Error updating payment:', error)
        alert('ステータスの更新に失敗しました')
        return
      }
    } else {
      // 新規INSERT
      const payload = {
        introduction_id: introductionId,
        total_amount: referralFee || 0,
        status: newStatus,
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
          ? { ...item, payment_status: newStatus, payment_id: paymentId }
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
                        <span className="font-medium">
                          ¥{formatNumber(item.referral_fee)}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusDropdown
                        item={item}
                        onStatusChange={handleStatusChange}
                      />
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
    </div>
  )
}
