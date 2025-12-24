'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Select, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoCandidates = [
  {
    id: '1',
    applied_date: '2024/12/20',
    source: 'Indeed',
    status: '有効応募',
    desired_occupation: '製造業',
    name: '田中太郎',
    age: 28,
    employee_name: '山田花子',
  },
  {
    id: '2',
    applied_date: '2024/12/19',
    source: 'タウンワーク',
    status: '電話出ず',
    desired_occupation: '軽作業',
    name: '佐藤次郎',
    age: 35,
    employee_name: '鈴木一郎',
  },
  {
    id: '3',
    applied_date: '2024/12/18',
    source: 'リクナビ',
    status: '無効応募',
    desired_occupation: '事務',
    name: '高橋三郎',
    age: 42,
    employee_name: '山田花子',
  },
  {
    id: '4',
    applied_date: '2024/12/17',
    source: 'Indeed',
    status: '就業時期が先',
    desired_occupation: '倉庫作業',
    name: '伊藤四郎',
    age: 25,
    employee_name: '佐藤美咲',
  },
  {
    id: '5',
    applied_date: '2024/12/16',
    source: 'マイナビ',
    status: '有効応募',
    desired_occupation: '製造業',
    name: '渡辺五郎',
    age: 31,
    employee_name: '鈴木一郎',
  },
]

const sourceOptions = [
  { value: '', label: 'すべて' },
  { value: 'Indeed', label: 'Indeed' },
  { value: 'タウンワーク', label: 'タウンワーク' },
  { value: 'リクナビ', label: 'リクナビ' },
  { value: 'マイナビ', label: 'マイナビ' },
]

const statusOptions = [
  { value: '', label: 'すべて' },
  { value: '有効応募', label: '有効応募' },
  { value: '無効応募', label: '無効応募' },
  { value: '電話出ず', label: '電話出ず' },
  { value: '就業時期が先', label: '就業時期が先' },
]

const occupationOptions = [
  { value: '', label: 'すべて' },
  { value: '製造業', label: '製造業' },
  { value: '軽作業', label: '軽作業' },
  { value: '事務', label: '事務' },
  { value: '倉庫作業', label: '倉庫作業' },
]

const employeeOptions = [
  { value: '', label: 'すべて' },
  { value: '山田花子', label: '山田花子' },
  { value: '鈴木一郎', label: '鈴木一郎' },
  { value: '佐藤美咲', label: '佐藤美咲' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '有効応募':
      return <Badge variant="success">{status}</Badge>
    case '無効応募':
      return <Badge variant="danger">{status}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{status}</Badge>
    case '就業時期が先':
      return <Badge variant="purple">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function CandidatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [occupationFilter, setOccupationFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')

  const filteredCandidates = demoCandidates.filter((candidate) => {
    const matchesSearch =
      candidate.name.includes(searchQuery) ||
      candidate.id.includes(searchQuery)
    const matchesSource = !sourceFilter || candidate.source === sourceFilter
    const matchesStatus = !statusFilter || candidate.status === statusFilter
    const matchesOccupation =
      !occupationFilter || candidate.desired_occupation === occupationFilter
    const matchesEmployee =
      !employeeFilter || candidate.employee_name === employeeFilter

    return (
      matchesSearch &&
      matchesSource &&
      matchesStatus &&
      matchesOccupation &&
      matchesEmployee
    )
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">求職者一覧</h1>
        <Link href="/candidates/new">
          <Button>新規登録</Button>
        </Link>
      </div>

      {/* 検索・フィルター */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            placeholder="名前・ID・電話番号で検索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            options={sourceOptions}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <Select
            options={occupationOptions}
            value={occupationFilter}
            onChange={(e) => setOccupationFilter(e.target.value)}
          />
          <Select
            options={employeeOptions}
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* テーブル */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>応募日</TableHead>
              <TableHead>応募媒体</TableHead>
              <TableHead>応募状態</TableHead>
              <TableHead>希望職種</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>年齢</TableHead>
              <TableHead>担当者</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.map((candidate) => (
              <TableRow key={candidate.id} className="cursor-pointer">
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {candidate.applied_date}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {candidate.source}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {getStatusBadge(candidate.status)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {candidate.desired_occupation}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full font-medium text-blue-600 hover:underline"
                  >
                    {candidate.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {candidate.age}歳
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${candidate.id}`}
                    className="block w-full"
                  >
                    {candidate.employee_name}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredCandidates.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当する求職者が見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
