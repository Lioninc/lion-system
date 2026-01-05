'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button, Input, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Company {
  id: string
  name: string
  industry: string | null
  contact_person: string | null
  phone: string | null
  status: string | null
  job_count: number
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case '取引中':
      return <Badge variant="success">{status}</Badge>
    case '取引停止':
      return <Badge variant="danger">{status}</Badge>
    case '新規':
      return <Badge variant="info">{status}</Badge>
    default:
      return <Badge>{status || '-'}</Badge>
  }
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    setLoading(true)
    const supabase = createClient()

    // 企業データを取得
    const { data: companiesData, error } = await supabase
      .from('companies')
      .select('id, name, industry, contact_person, phone, status')
      .order('name')

    if (error) {
      console.error('Error fetching companies:', error)
      setLoading(false)
      return
    }

    // 各企業の募集中案件数を取得
    const companyIds = (companiesData || []).map((c: any) => c.id)

    let jobCounts: { [key: string]: number } = {}
    if (companyIds.length > 0) {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('company_id')
        .in('company_id', companyIds)
        .eq('status', '募集中')

      // 企業ごとの案件数を集計
      ;(jobsData || []).forEach((job: any) => {
        jobCounts[job.company_id] = (jobCounts[job.company_id] || 0) + 1
      })
    }

    // データを整形
    const formattedData: Company[] = (companiesData || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      contact_person: c.contact_person,
      phone: c.phone,
      status: c.status,
      job_count: jobCounts[c.id] || 0,
    }))

    setCompanies(formattedData)
    setLoading(false)
  }

  const filteredCompanies = companies.filter((company) =>
    company.name.includes(searchQuery) ||
    (company.industry || '').includes(searchQuery) ||
    (company.contact_person || '').includes(searchQuery)
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
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            読み込み中...
          </div>
        ) : (
          <>
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
                    <TableCell>{company.industry || '-'}</TableCell>
                    <TableCell>{company.contact_person || '-'}</TableCell>
                    <TableCell>{company.phone || '-'}</TableCell>
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
          </>
        )}
      </Card>
    </div>
  )
}
