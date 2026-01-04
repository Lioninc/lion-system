'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoCompany = {
  id: '1',
  name: '株式会社ABC',
  industry: '製造業',
  address: '東京都千代田区丸の内1-1-1',
  phone: '03-1234-5678',
  email: 'info@abc-corp.co.jp',
  contact_person: '佐々木健一',
  employee_name: '山田花子',
  status: '取引中',
  notes: '優良顧客。製造業案件を多く依頼いただいている。',
}

const demoJobs = [
  { id: '1', title: '製造スタッフ', location: '東京都大田区', hourly_rate: 1200, status: '募集中' },
  { id: '2', title: '検品スタッフ', location: '東京都品川区', hourly_rate: 1100, status: '募集中' },
  { id: '3', title: '倉庫作業員', location: '神奈川県川崎市', hourly_rate: 1150, status: '募集停止' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '取引中':
      return <Badge variant="success">{status}</Badge>
    case '取引停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getJobStatusBadge(status: string) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function CompanyDetailPage() {
  const params = useParams()

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/companies"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{demoCompany.name}</h1>
          {getStatusBadge(demoCompany.status)}
        </div>
        <Link href={`/companies/${params.id}/edit`}>
          <Button>編集</Button>
        </Link>
      </div>

      {/* 企業情報 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">企業名</dt>
              <dd className="text-sm text-slate-800">{demoCompany.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">業界</dt>
              <dd className="text-sm text-slate-800">{demoCompany.industry}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">住所</dt>
              <dd className="text-sm text-slate-800">{demoCompany.address}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">電話番号</dt>
              <dd className="text-sm text-slate-800">{demoCompany.phone}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">メール</dt>
              <dd className="text-sm text-slate-800">{demoCompany.email}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">担当者情報</h2>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">先方担当者</dt>
              <dd className="text-sm text-slate-800">{demoCompany.contact_person}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">弊社担当</dt>
              <dd className="text-sm text-slate-800">{demoCompany.employee_name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">ステータス</dt>
              <dd className="text-sm text-slate-800">{getStatusBadge(demoCompany.status)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <p className="text-sm text-slate-700">{demoCompany.notes}</p>
        </Card>
      </div>

      {/* 案件一覧 */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">案件一覧</h2>
          <Link href="/jobs/new">
            <Button size="sm">新規案件</Button>
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件名</TableHead>
              <TableHead>勤務地</TableHead>
              <TableHead>時給</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {demoJobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {job.title}
                  </Link>
                </TableCell>
                <TableCell>{job.location}</TableCell>
                <TableCell>¥{job.hourly_rate.toLocaleString()}</TableCell>
                <TableCell>{getJobStatusBadge(job.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
