'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoAttackList = [
  {
    id: '1',
    priority: 1,
    priority_label: '今日応募',
    name: '田中太郎',
    phone: '090-1234-5678',
    last_contact: '2024/12/23 10:00',
    status: '有効応募',
  },
  {
    id: '2',
    priority: 1,
    priority_label: '今日応募',
    name: '佐藤次郎',
    phone: '090-2345-6789',
    last_contact: null,
    status: '電話出ず',
  },
  {
    id: '3',
    priority: 2,
    priority_label: '3日以内',
    name: '高橋三郎',
    phone: '090-3456-7890',
    last_contact: '2024/12/21 15:00',
    status: '有効応募',
  },
  {
    id: '4',
    priority: 2,
    priority_label: '3日以内',
    name: '伊藤四郎',
    phone: '090-4567-8901',
    last_contact: '2024/12/20 11:00',
    status: '電話出ず',
  },
  {
    id: '5',
    priority: 3,
    priority_label: '紹介待ち',
    name: '渡辺五郎',
    phone: '090-5678-9012',
    last_contact: '2024/12/22 14:00',
    status: '有効応募',
  },
  {
    id: '6',
    priority: 4,
    priority_label: '時期先',
    name: '山本六郎',
    phone: '090-6789-0123',
    last_contact: '2024/12/19 09:00',
    status: '就業時期が先',
  },
]

function getPriorityBadge(label: string) {
  switch (label) {
    case '今日応募':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
          <span>🔥</span>
          {label}
        </span>
      )
    case '3日以内':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
          <span>🟠</span>
          {label}
        </span>
      )
    case '紹介待ち':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          <span>🟡</span>
          {label}
        </span>
      )
    case '時期先':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
          <span>🔵</span>
          {label}
        </span>
      )
    default:
      return <Badge>{label}</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case '有効応募':
      return <Badge variant="success">{status}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{status}</Badge>
    case '就業時期が先':
      return <Badge variant="purple">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function AttackListPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredList = demoAttackList.filter((item) =>
    item.name.includes(searchQuery) ||
    item.phone.includes(searchQuery)
  )

  const handleCall = (phone: string) => {
    // 実際はここで連絡記録を保存
    console.log('Calling:', phone)
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">アタックリスト</h1>

      {/* 優先度別サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔥</span>
            <div>
              <p className="text-sm text-slate-500">今日応募</p>
              <p className="text-xl font-bold text-red-600">
                {demoAttackList.filter((i) => i.priority === 1).length}件
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🟠</span>
            <div>
              <p className="text-sm text-slate-500">3日以内</p>
              <p className="text-xl font-bold text-orange-600">
                {demoAttackList.filter((i) => i.priority === 2).length}件
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🟡</span>
            <div>
              <p className="text-sm text-slate-500">紹介待ち</p>
              <p className="text-xl font-bold text-yellow-600">
                {demoAttackList.filter((i) => i.priority === 3).length}件
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔵</span>
            <div>
              <p className="text-sm text-slate-500">時期先</p>
              <p className="text-xl font-bold text-blue-600">
                {demoAttackList.filter((i) => i.priority === 4).length}件
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 検索 */}
      <Card>
        <Input
          placeholder="名前・電話番号で検索"
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
              <TableHead>優先度</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>前回連絡</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>アクション</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{getPriorityBadge(item.priority_label)}</TableCell>
                <TableCell>
                  <Link
                    href={`/candidates/${item.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {item.name}
                  </Link>
                </TableCell>
                <TableCell>{item.phone}</TableCell>
                <TableCell>
                  {item.last_contact || (
                    <span className="text-slate-400">未連絡</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(item.status)}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleCall(item.phone)}
                  >
                    架電
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredList.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            該当するデータが見つかりません
          </div>
        )}
      </Card>
    </div>
  )
}
