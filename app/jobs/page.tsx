'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Job {
  id: string
  title: string
  company_id: string
  company_name: string | null
  location: string | null
  site_name: string | null
  monthly_salary: number | null
  hourly_rate: number | null
  status: string | null
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchJobs()
  }, [])

  async function fetchJobs() {
    setLoading(true)
    const supabase = createClient()

    // 案件データを取得（企業名も結合）
    const { data: jobsData, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        company_id,
        location,
        site_name,
        monthly_salary,
        hourly_rate,
        status,
        companies:company_id (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      setLoading(false)
      return
    }

    // データを整形
    const formattedData: Job[] = (jobsData || []).map((j: any) => ({
      id: j.id,
      title: j.title,
      company_id: j.company_id,
      company_name: j.companies?.name || null,
      location: j.location,
      site_name: j.site_name,
      monthly_salary: j.monthly_salary,
      hourly_rate: j.hourly_rate,
      status: j.status,
    }))

    setJobs(formattedData)
    setLoading(false)
  }

  const filteredJobs = jobs.filter((job) =>
    (job.title || '').includes(searchQuery) ||
    (job.company_name || '').includes(searchQuery) ||
    (job.location || '').includes(searchQuery) ||
    (job.site_name || '').includes(searchQuery)
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
          placeholder="案件名・企業名・勤務地・現場名で検索"
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
                  <TableHead>案件名</TableHead>
                  <TableHead>企業</TableHead>
                  <TableHead>現場名</TableHead>
                  <TableHead>勤務地</TableHead>
                  <TableHead>月収/時給</TableHead>
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
                    <TableCell>{job.company_name || '-'}</TableCell>
                    <TableCell>{job.site_name || '-'}</TableCell>
                    <TableCell>{job.location || '-'}</TableCell>
                    <TableCell>
                      {job.monthly_salary ? (
                        <span>月収 ¥{job.monthly_salary.toLocaleString()}</span>
                      ) : job.hourly_rate ? (
                        <span>時給 ¥{job.hourly_rate.toLocaleString()}</span>
                      ) : (
                        '-'
                      )}
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
          </>
        )}
      </Card>
    </div>
  )
}
