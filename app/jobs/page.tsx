'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoJobs = [
  {
    id: '1',
    title: '製造スタッフ',
    company: '株式会社ABC',
    location: '東京都大田区',
    hourly_rate: 1200,
    applicant_count: 5,
    status: '募集中',
  },
  {
    id: '2',
    title: '検品スタッフ',
    company: '株式会社ABC',
    location: '東京都品川区',
    hourly_rate: 1100,
    applicant_count: 3,
    status: '募集中',
  },
  {
    id: '3',
    title: '倉庫作業員',
    company: '株式会社XYZ',
    location: '神奈川県川崎市',
    hourly_rate: 1150,
    applicant_count: 8,
    status: '募集中',
  },
  {
    id: '4',
    title: 'ピッキングスタッフ',
    company: '株式会社XYZ',
    location: '東京都江東区',
    hourly_rate: 1050,
    applicant_count: 2,
    status: '募集停止',
  },
  {
    id: '5',
    title: '事務スタッフ',
    company: '株式会社GHI',
    location: '東京都渋谷区',
    hourly_rate: 1300,
    applicant_count: 12,
    status: '募集中',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function JobsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = demoJobs.filter((job) =>
    job.title.includes(searchQuery) ||
    job.company.includes(searchQuery) ||
    job.location.includes(searchQuery)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">案件管理</h1>
        <div className="flex gap-2">
          <Link href="/jobs/import">
            <Button variant="secondary">CSVインポート</Button>
          </Link>
          <Link href="/jobs/new">
            <Button>新規登録</Button>
          </Link>
        </div>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="案件名・企業名・勤務地で検索"
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
              <TableHead>案件名</TableHead>
              <TableHead>企業</TableHead>
              <TableHead>勤務地</TableHead>
              <TableHead>時給</TableHead>
              <TableHead>応募者数</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.map((job) => (
              <TableRow key={job.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {job.title}
                  </Link>
                </TableCell>
                <TableCell>{job.company}</TableCell>
                <TableCell>{job.location}</TableCell>
                <TableCell>¥{job.hourly_rate.toLocaleString()}</TableCell>
                <TableCell>
                  <span className={job.applicant_count > 0 ? 'text-blue-600 font-medium' : 'text-slate-400'}>
                    {job.applicant_count}名
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(job.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredJobs.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する案件が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
