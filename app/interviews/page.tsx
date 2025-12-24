'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoInterviews = [
  {
    id: '1',
    date: '2024/12/23',
    time: '10:00',
    candidate_name: '田中太郎',
    candidate_id: '1',
    employee_name: '山田花子',
    result: '繋ぎ',
    introduction_company: '株式会社ABC',
  },
  {
    id: '2',
    date: '2024/12/23',
    time: '14:00',
    candidate_name: '佐藤次郎',
    candidate_id: '2',
    employee_name: '鈴木一郎',
    result: '繋げず',
    introduction_company: null,
  },
  {
    id: '3',
    date: '2024/12/22',
    time: '11:00',
    candidate_name: '高橋三郎',
    candidate_id: '3',
    employee_name: '山田花子',
    result: '繋ぎ',
    introduction_company: '株式会社XYZ',
  },
  {
    id: '4',
    date: '2024/12/22',
    time: '15:00',
    candidate_name: '伊藤四郎',
    candidate_id: '4',
    employee_name: '佐藤美咲',
    result: null,
    introduction_company: null,
  },
  {
    id: '5',
    date: '2024/12/21',
    time: '10:00',
    candidate_name: '渡辺五郎',
    candidate_id: '5',
    employee_name: '鈴木一郎',
    result: '繋ぎ',
    introduction_company: '株式会社GHI',
  },
]

function getResultBadge(result: string | null) {
  switch (result) {
    case '繋ぎ':
      return <Badge variant="success">{result}</Badge>
    case '繋げず':
      return <Badge variant="danger">{result}</Badge>
    default:
      return <Badge variant="default">未実施</Badge>
  }
}

export default function InterviewsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredInterviews = demoInterviews.filter((interview) =>
    interview.candidate_name.includes(searchQuery) ||
    interview.employee_name.includes(searchQuery)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">面談一覧</h1>
        <Button>新規面談</Button>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="求職者名・担当者で検索"
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
              <TableHead>時間</TableHead>
              <TableHead>求職者名</TableHead>
              <TableHead>担当</TableHead>
              <TableHead>結果</TableHead>
              <TableHead>紹介先</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInterviews.map((interview) => (
              <TableRow key={interview.id}>
                <TableCell>{interview.date}</TableCell>
                <TableCell>{interview.time}</TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${interview.candidate_id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {interview.candidate_name}
                  </Link>
                </TableCell>
                <TableCell>{interview.employee_name}</TableCell>
                <TableCell>{getResultBadge(interview.result)}</TableCell>
                <TableCell>
                  {interview.introduction_company || (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredInterviews.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する面談が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
