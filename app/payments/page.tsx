'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const stats = [
  { label: '今月売上', value: '¥3,600,000', color: 'text-blue-600' },
  { label: '入金済', value: '¥2,800,000', color: 'text-emerald-600' },
  { label: '請求中', value: '¥800,000', color: 'text-amber-600' },
]

const demoPayments = [
  {
    id: '1',
    hire_date: '2024/12/20',
    candidate_name: '高橋三郎',
    candidate_id: '3',
    company_name: '株式会社XYZ',
    total_amount: 350000,
    status: '入金済',
    paid_date: '2024/12/22',
    due_date: '2024/12/31',
  },
  {
    id: '2',
    hire_date: '2024/12/18',
    candidate_name: '渡辺五郎',
    candidate_id: '5',
    company_name: '株式会社GHI',
    total_amount: 280000,
    status: '請求中',
    paid_date: null,
    due_date: '2024/12/28',
  },
  {
    id: '3',
    hire_date: '2024/12/10',
    candidate_name: '山本六郎',
    candidate_id: '6',
    company_name: '株式会社ABC',
    total_amount: 320000,
    status: '入金済',
    paid_date: '2024/12/15',
    due_date: '2024/12/20',
  },
  {
    id: '4',
    hire_date: '2024/12/05',
    candidate_name: '中村七郎',
    candidate_id: '7',
    company_name: '株式会社DEF',
    total_amount: 300000,
    status: '入金済',
    paid_date: '2024/12/10',
    due_date: '2024/12/15',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '入金済':
      return <Badge variant="success">{status}</Badge>
    case '請求中':
      return <Badge variant="warning">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPayments = demoPayments.filter((payment) =>
    payment.candidate_name.includes(searchQuery) ||
    payment.company_name.includes(searchQuery)
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">入金一覧</h1>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
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
                <TableCell>{payment.hire_date}</TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${payment.candidate_id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {payment.candidate_name}
                  </Link>
                </TableCell>
                <TableCell>{payment.company_name}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    ¥{payment.total_amount.toLocaleString()}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(payment.status)}</TableCell>
                <TableCell>{payment.due_date}</TableCell>
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
            該当する入金が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
