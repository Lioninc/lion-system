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
  due_date: string | null
  paid_date: string | null
}

interface Stats {
  pendingAmount: number   // 入金予定（仮売上・入金予定）
  waitingAmount: number   // 入金待ち（請求中）
  paidAmount: number      // 入金済
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '入金済':
    case '入金済み':
      return <Badge variant="success">{status}</Badge>
    case '請求中':
      return <Badge variant="warning">{status}</Badge>
    case '仮売上':
    case '入金予定':
      return <Badge variant="info">{status}</Badge>
    default:
      return <Badge variant="info">入金予定</Badge>
  }
}

// 数値を安全にフォーマット
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
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
        due_date: payment?.due_date || null,
        paid_date: payment?.paid_date || null,
      }
    })

    // 統計を計算
    let pendingAmount = 0   // 入金予定（仮売上・入金予定・ステータスなし）
    let waitingAmount = 0   // 入金待ち（請求中）
    let paidAmount = 0      // 入金済

    formattedData.forEach((item) => {
      const amount = item.referral_fee || 0
      const status = item.payment_status

      if (status === '入金済' || status === '入金済み') {
        paidAmount += amount
      } else if (status === '請求中') {
        waitingAmount += amount
      } else {
        // 仮売上、入金予定、またはステータスなし
        pendingAmount += amount
      }
    })

    setStats({
      pendingAmount,
      waitingAmount,
      paidAmount,
    })

    setPaymentItems(formattedData)
    setLoading(false)
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
                  <TableHead>入金予定日</TableHead>
                  <TableHead>入金日</TableHead>
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
                    <TableCell>{getStatusBadge(item.payment_status)}</TableCell>
                    <TableCell>{item.due_date || '-'}</TableCell>
                    <TableCell>
                      {item.paid_date || (
                        <span className="text-slate-400">-</span>
                      )}
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
