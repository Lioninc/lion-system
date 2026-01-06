'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  industry: string | null
  address: string | null
  phone: string | null
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  staff_id: string | null
  staff_name: string | null
  status: string
  notes: string | null
}

interface Job {
  id: string
  title: string
  location: string | null
  site_name: string | null
  monthly_salary: number | null
  salary_min: number | null
  salary_max: number | null
  status: string | null
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '取引中':
      return <Badge variant="success">{status}</Badge>
    case '取引停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

function getJobStatusBadge(status: string | null) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

function formatSalary(monthly: number | null, min: number | null, max: number | null): string {
  if (monthly !== null && monthly !== undefined) {
    return `月収 ¥${monthly.toLocaleString()}`
  }
  if (min !== null || max !== null) {
    if (min !== null && max !== null) {
      return `¥${min.toLocaleString()}〜¥${max.toLocaleString()}`
    }
    if (min !== null) {
      return `¥${min.toLocaleString()}〜`
    }
    if (max !== null) {
      return `〜¥${max.toLocaleString()}`
    }
  }
  return '-'
}

export default function CompanyDetailPage() {
  const params = useParams()
  const companyId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (companyId) {
      fetchCompanyData()
    }
  }, [companyId])

  async function fetchCompanyData() {
    setLoading(true)
    const supabase = createClient()

    // 企業情報を取得
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        industry,
        address,
        phone,
        contact_person,
        contact_email,
        contact_phone,
        staff_id,
        status,
        notes,
        employees:staff_id (
          name
        )
      `)
      .eq('id', companyId)
      .single()

    if (companyError || !companyData) {
      console.error('Error fetching company:', companyError)
      setLoading(false)
      return
    }

    const data = companyData as any
    setCompany({
      id: data.id,
      name: data.name,
      industry: data.industry,
      address: data.address,
      phone: data.phone,
      contact_person: data.contact_person,
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      staff_id: data.staff_id,
      staff_name: data.employees?.name || null,
      status: data.status,
      notes: data.notes,
    })

    // 案件一覧を取得
    const { data: jobsData, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        location,
        site_name,
        monthly_salary,
        salary_min,
        salary_max,
        status
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
    } else {
      setJobs(jobsData || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-slate-500">読み込み中...</div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-slate-500 mb-4">企業が見つかりません</p>
          <Link href="/companies">
            <Button variant="secondary">一覧に戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-bold text-slate-800">{company.name}</h1>
          {getStatusBadge(company.status)}
        </div>
        <Link href={`/companies/${companyId}/edit`}>
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
              <dd className="text-sm text-slate-800">{company.name}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">業界</dt>
              <dd className="text-sm text-slate-800">{company.industry || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">住所</dt>
              <dd className="text-sm text-slate-800">{company.address || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">電話番号</dt>
              <dd className="text-sm text-slate-800">{company.phone || '-'}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">担当者情報</h2>
          <dl className="space-y-3">
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">先方担当者</dt>
              <dd className="text-sm text-slate-800">{company.contact_person || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">担当者電話</dt>
              <dd className="text-sm text-slate-800">{company.contact_phone || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">担当者メール</dt>
              <dd className="text-sm text-slate-800">{company.contact_email || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">弊社担当</dt>
              <dd className="text-sm text-slate-800">{company.staff_name || '-'}</dd>
            </div>
            <div className="flex">
              <dt className="w-32 text-sm text-slate-500">ステータス</dt>
              <dd className="text-sm text-slate-800">{getStatusBadge(company.status)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <p className="text-sm text-slate-700">{company.notes || '備考はありません'}</p>
        </Card>
      </div>

      {/* 案件一覧 */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">案件一覧</h2>
          <Link href={`/jobs/new?company_id=${companyId}`}>
            <Button size="sm">新規案件</Button>
          </Link>
        </div>
        {jobs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>案件名</TableHead>
                <TableHead>現場名</TableHead>
                <TableHead>勤務地</TableHead>
                <TableHead>給与</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell>{job.site_name || '-'}</TableCell>
                  <TableCell>{job.location || '-'}</TableCell>
                  <TableCell>
                    {formatSalary(job.monthly_salary, job.salary_min, job.salary_max)}
                  </TableCell>
                  <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-slate-500">
            案件がありません
          </div>
        )}
      </Card>
    </div>
  )
}
