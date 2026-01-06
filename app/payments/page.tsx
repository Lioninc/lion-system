'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Payment {
  id: string
  introduction_id: string
  total_amount: number
  status: string
  invoice_date: string | null
  due_date: string | null
  paid_date: string | null
  // introduction経由で取得
  hire_date: string | null
  candidate_id: string | null
  candidate_name: string | null
  company_id: string | null
  company_name: string | null
}

interface Stats {
  thisMonthTotal: number
  paidAmount: number
  pendingAmount: number
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '入金済':
    case '入金済み':
      return <Badge variant="success">{status}</Badge>
    case '請求中':
      return <Badge variant="warning">{status}</Badge>
    case '未請求':
      return <Badge variant="info">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

// 数値を安全にフォーマット
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState<Stats>({
    thisMonthTotal: 0,
    paidAmount: 0,
    pendingAmount: 0,
  })

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    setLoading(true)
    const supabase = createClient()

    // paymentsテーブルをintroductions経由でcandidate, companyと結合
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        introduction_id,
        total_amount,
        status,
        invoice_date,
        due_date,
        paid_date,
        introductions:introduction_id (
          hire_date,
          candidate_id,
          company_id,
          candidates:candidate_id (
            name
          ),
          companies:company_id (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching payments:', error)
      setLoading(false)
      return
    }

    const formattedData: Payment[] = (data || []).map((d: any) => ({
      id: d.id,
      introduction_id: d.introduction_id,
      total_amount: d.total_amount,
      status: d.status,
      invoice_date: d.invoice_date,
      due_date: d.due_date,
      paid_date: d.paid_date,
      hire_date: d.introductions?.hire_date || null,
      candidate_id: d.introductions?.candidate_id || null,
      candidate_name: d.introductions?.candidates?.name || null,
      company_id: d.introductions?.company_id || null,
      company_name: d.introductions?.companies?.name || null,
    }))

    // 統計を計算
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    let thisMonthTotal = 0
    let paidAmount = 0
    let pendingAmount = 0

    formattedData.forEach((p) => {
      // 今月の売上（hire_dateまたはinvoice_dateが今月のもの）
      const hireMonth = p.hire_date ? p.hire_date.substring(0, 7) : null
      const invoiceMonth = p.invoice_date ? p.invoice_date.substring(0, 7) : null

      if (hireMonth === thisMonth || invoiceMonth === thisMonth) {
        thisMonthTotal += p.total_amount || 0
      }

      // 入金済・請求中の集計
      if (p.status === '入金済' || p.status === '入金済み') {
        paidAmount += p.total_amount || 0
      } else if (p.status === '請求中') {
        pendingAmount += p.total_amount || 0
      }
    })

    setStats({
      thisMonthTotal,
      paidAmount,
      pendingAmount,
    })

    setPayments(formattedData)
    setLoading(false)
  }

  const filteredPayments = payments.filter((payment) =>
    (payment.candidate_name || '').includes(searchQuery) ||
    (payment.company_name || '').includes(searchQuery)
  )

  const statsDisplay = [
    { label: '今月売上', value: `¥${formatNumber(stats.thisMonthTotal)}`, color: 'text-blue-600' },
    { label: '入金済', value: `¥${formatNumber(stats.paidAmount)}`, color: 'text-emerald-600' },
    { label: '請求中', value: `¥${formatNumber(stats.pendingAmount)}`, color: 'text-amber-600' },
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
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.hire_date || '-'}</TableCell>
                    <TableCell>
                      {payment.candidate_id ? (
                        <Link
                          href={`/candidates/${payment.candidate_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {payment.candidate_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.company_id ? (
                        <Link
                          href={`/companies/${payment.company_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {payment.company_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        ¥{formatNumber(payment.total_amount)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>{payment.due_date || '-'}</TableCell>
                    <TableCell>
                      {payment.paid_date || (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredPayments.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                {payments.length === 0 ? '入金データがありません' : '該当する入金が見つかりません'}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
