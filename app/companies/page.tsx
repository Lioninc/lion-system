'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoCompanies = [
  {
    id: '1',
    name: '株式会社ABC',
    industry: '製造業',
    contact_person: '佐々木健一',
    phone: '03-1234-5678',
    job_count: 3,
    status: '取引中',
  },
  {
    id: '2',
    name: '株式会社XYZ',
    industry: '物流',
    contact_person: '田村洋子',
    phone: '03-2345-6789',
    job_count: 2,
    status: '取引中',
  },
  {
    id: '3',
    name: '株式会社DEF',
    industry: '小売',
    contact_person: '中村太郎',
    phone: '03-3456-7890',
    job_count: 0,
    status: '取引停止',
  },
  {
    id: '4',
    name: '株式会社GHI',
    industry: '製造業',
    contact_person: '木村美咲',
    phone: '03-4567-8901',
    job_count: 5,
    status: '取引中',
  },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '取引中':
      return <Badge variant="success">{status}</Badge>
    case '取引停止':
      return <Badge variant="danger">{status}</Badge>
    case '新規':
      return <Badge variant="info">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCompanies = demoCompanies.filter((company) =>
    company.name.includes(searchQuery) ||
    company.industry.includes(searchQuery) ||
    company.contact_person.includes(searchQuery)
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">企業管理</h1>
        <Link href="/companies/new">
          <Button>新規登録</Button>
        </Link>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="企業名・業界・担当者で検索"
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
              <TableHead>企業名</TableHead>
              <TableHead>業界</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>募集中案件数</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.map((company) => (
              <TableRow key={company.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/companies/${company.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {company.name}
                  </Link>
                </TableCell>
                <TableCell>{company.industry}</TableCell>
                <TableCell>{company.contact_person}</TableCell>
                <TableCell>{company.phone}</TableCell>
                <TableCell>
                  <span className={company.job_count > 0 ? 'text-blue-600 font-medium' : 'text-slate-400'}>
                    {company.job_count}件
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(company.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredCompanies.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する企業が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
