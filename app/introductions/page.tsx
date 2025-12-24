'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoIntroductions = [
  {
    id: '1',
    date: '2024/12/23',
    candidate_name: '田中太郎',
    candidate_id: '1',
    company_name: '株式会社ABC',
    job_title: '製造スタッフ',
    status: '面接予定',
    employee_name: '山田花子',
    fee_amount: 300000,
  },
  {
    id: '2',
    date: '2024/12/20',
    candidate_name: '高橋三郎',
    candidate_id: '3',
    company_name: '株式会社XYZ',
    job_title: '倉庫作業員',
    status: '採用',
    employee_name: '山田花子',
    fee_amount: 350000,
  },
  {
    id: '3',
    date: '2024/12/18',
    candidate_name: '渡辺五郎',
    candidate_id: '5',
    company_name: '株式会社GHI',
    job_title: '事務スタッフ',
    status: '面接済',
    employee_name: '鈴木一郎',
    fee_amount: 280000,
  },
  {
    id: '4',
    date: '2024/12/15',
    candidate_name: '佐藤次郎',
    candidate_id: '2',
    company_name: '株式会社DEF',
    job_title: '検品スタッフ',
    status: '不採用',
    employee_name: '佐藤美咲',
    fee_amount: 0,
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '採用':
      return <Badge variant="success">{status}</Badge>
    case '面接予定':
      return <Badge variant="info">{status}</Badge>
    case '面接済':
      return <Badge variant="purple">{status}</Badge>
    case '不採用':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function IntroductionsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIntroductions = demoIntroductions.filter((intro) =>
    intro.candidate_name.includes(searchQuery) ||
    intro.company_name.includes(searchQuery) ||
    intro.job_title.includes(searchQuery)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">紹介一覧</h1>
        <Button>新規紹介</Button>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="求職者名・企業名・案件名で検索"
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
              <TableHead>日付</TableHead>
              <TableHead>求職者</TableHead>
              <TableHead>企業</TableHead>
              <TableHead>案件</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>担当</TableHead>
              <TableHead>売上</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIntroductions.map((intro) => (
              <TableRow key={intro.id}>
                <TableCell>{intro.date}</TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${intro.candidate_id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {intro.candidate_name}
                  </Link>
                </TableCell>
                <TableCell>{intro.company_name}</TableCell>
                <TableCell>{intro.job_title}</TableCell>
                <TableCell>{getStatusBadge(intro.status)}</TableCell>
                <TableCell>{intro.employee_name}</TableCell>
                <TableCell>
                  {intro.fee_amount > 0 ? (
                    <span className="font-medium text-emerald-600">
                      ¥{intro.fee_amount.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredIntroductions.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する紹介が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
