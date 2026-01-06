'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Introduction {
  id: string
  introduction_date: string | null
  candidate_id: string
  candidate_name: string | null
  company_id: string
  company_name: string | null
  job_id: string | null
  job_title: string | null
  status: string
  staff_id: string | null
  staff_name: string | null
  salary_offered: number | null
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '採用':
    case '採用決定':
      return <Badge variant="success">{status}</Badge>
    case '面接予定':
      return <Badge variant="info">{status}</Badge>
    case '面接済':
    case '面接済み':
      return <Badge variant="purple">{status}</Badge>
    case '不採用':
    case '辞退':
      return <Badge variant="danger">{status}</Badge>
    case '紹介済み':
      return <Badge variant="warning">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

// 数値を安全にフォーマット
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString()
}

export default function IntroductionsPage() {
  const [introductions, setIntroductions] = useState<Introduction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchIntroductions()
  }, [])

  async function fetchIntroductions() {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('introductions')
      .select(`
        id,
        introduction_date,
        candidate_id,
        company_id,
        job_id,
        status,
        staff_id,
        salary_offered,
        candidates:candidate_id (
          name
        ),
        companies:company_id (
          name
        ),
        jobs:job_id (
          title
        ),
        employees:staff_id (
          name
        )
      `)
      .order('introduction_date', { ascending: false })

    if (error) {
      console.error('Error fetching introductions:', error)
      setLoading(false)
      return
    }

    const formattedData: Introduction[] = (data || []).map((d: any) => ({
      id: d.id,
      introduction_date: d.introduction_date,
      candidate_id: d.candidate_id,
      candidate_name: d.candidates?.name || null,
      company_id: d.company_id,
      company_name: d.companies?.name || null,
      job_id: d.job_id,
      job_title: d.jobs?.title || null,
      status: d.status,
      staff_id: d.staff_id,
      staff_name: d.employees?.name || null,
      salary_offered: d.salary_offered,
    }))

    setIntroductions(formattedData)
    setLoading(false)
  }

  const filteredIntroductions = introductions.filter((intro) =>
    (intro.candidate_name || '').includes(searchQuery) ||
    (intro.company_name || '').includes(searchQuery) ||
    (intro.job_title || '').includes(searchQuery)
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
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            読み込み中...
          </div>
        ) : (
          <>
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
                    <TableCell>{intro.introduction_date || '-'}</TableCell>
                    <TableCell>
                      {intro.candidate_id ? (
                        <Link
                          href={`/candidates/${intro.candidate_id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {intro.candidate_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {intro.company_id ? (
                        <Link
                          href={`/companies/${intro.company_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {intro.company_name || '-'}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {intro.job_id ? (
                        <Link
                          href={`/jobs/${intro.job_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {intro.job_title || '-'}
                        </Link>
                      ) : (
                        intro.job_title || '-'
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(intro.status)}</TableCell>
                    <TableCell>{intro.staff_name || '-'}</TableCell>
                    <TableCell>
                      {intro.salary_offered !== null && intro.salary_offered > 0 ? (
                        <span className="font-medium text-emerald-600">
                          ¥{formatNumber(intro.salary_offered)}
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
                {introductions.length === 0 ? '紹介データがありません' : '該当する紹介が見つかりません'}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
