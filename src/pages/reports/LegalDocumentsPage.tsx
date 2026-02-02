import { useEffect, useState } from 'react'
import {
  FileText,
  Download,
} from 'lucide-react'
import { Card, Button, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

interface JobSeekerRecord {
  id: string
  registrationDate: string
  name: string
  nameKana: string | null
  birthDate: string | null
  gender: string | null
  address: string
  phone: string
  desiredJobType: string | null
  desiredWorkLocation: string | null
  applicationStatus: string
  referralDate: string | null
  referralCompany: string | null
  referralJob: string | null
  result: string | null
  notes: string | null
}

interface FeeRecord {
  id: string
  transactionDate: string
  jobSeekerName: string
  companyName: string
  jobTitle: string
  hireDate: string | null
  feeType: string | null
  feeAmount: number | null
  invoiceDate: string | null
  paymentDate: string | null
  paymentAmount: number | null
  notes: string | null
}

export function LegalDocumentsPage() {
  const [activeTab, setActiveTab] = useState<'job-seeker' | 'fee'>('job-seeker')
  const [loading, setLoading] = useState(true)
  const [jobSeekerRecords, setJobSeekerRecords] = useState<JobSeekerRecord[]>([])
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([])
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (activeTab === 'job-seeker') {
      fetchJobSeekerRecords()
    } else {
      fetchFeeRecords()
    }
  }, [activeTab, yearMonth])

  async function fetchJobSeekerRecords() {
    setLoading(true)

    const [year, month] = yearMonth.split('-')
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)

    const { data: applications, error } = await supabase
      .from('applications')
      .select(`
        id,
        applied_at,
        application_status,
        notes,
        job_seeker:job_seekers (
          id,
          name,
          name_kana,
          birth_date,
          gender,
          prefecture,
          city,
          address,
          phone,
          desired_period
        ),
        referrals (
          id,
          referred_at,
          referral_status,
          job:jobs (
            title,
            job_type,
            prefecture,
            company:companies (name)
          )
        )
      `)
      .gte('applied_at', startDate.toISOString())
      .lte('applied_at', endDate.toISOString())
      .order('applied_at', { ascending: true })

    if (error) {
      console.error('Error fetching job seeker records:', error)
      setLoading(false)
      return
    }

    const records: JobSeekerRecord[] = (applications || []).map((app) => {
      const js = app.job_seeker as unknown as {
        id: string
        name: string
        name_kana: string | null
        birth_date: string | null
        gender: string | null
        prefecture: string | null
        city: string | null
        address: string | null
        phone: string
        desired_period: string | null
      } | null
      const referrals = app.referrals as unknown as Array<{
        id: string
        referred_at: string
        referral_status: string
        job: {
          title: string
          job_type: string | null
          prefecture: string | null
          company: { name: string } | null
        } | null
      }> | null
      const latestReferral = referrals?.[0]

      return {
        id: app.id,
        registrationDate: app.applied_at,
        name: js?.name || '',
        nameKana: js?.name_kana ?? null,
        birthDate: js?.birth_date ?? null,
        gender: js?.gender === 'male' ? '男' : js?.gender === 'female' ? '女' : null,
        address: `${js?.prefecture || ''}${js?.city || ''}${js?.address || ''}`,
        phone: js?.phone || '',
        desiredJobType: latestReferral?.job?.job_type ?? null,
        desiredWorkLocation: latestReferral?.job?.prefecture ?? js?.prefecture ?? null,
        applicationStatus: getStatusLabel(app.application_status),
        referralDate: latestReferral?.referred_at ?? null,
        referralCompany: latestReferral?.job?.company?.name ?? null,
        referralJob: latestReferral?.job?.title ?? null,
        result: latestReferral ? getReferralResultLabel(latestReferral.referral_status) : null,
        notes: app.notes ?? null,
      }
    })

    setJobSeekerRecords(records)
    setLoading(false)
  }

  async function fetchFeeRecords() {
    setLoading(true)

    const [year, month] = yearMonth.split('-')
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59)

    const { data: sales, error } = await supabase
      .from('sales')
      .select(`
        id,
        amount,
        status,
        expected_date,
        invoiced_date,
        paid_date,
        notes,
        referral:referrals (
          id,
          referred_at,
          hired_at,
          application:applications (
            job_seeker:job_seekers (name)
          ),
          job:jobs (
            title,
            fee_type,
            fee_amount,
            company:companies (name)
          )
        )
      `)
      .or(`invoiced_date.gte.${startDate.toISOString()},paid_date.gte.${startDate.toISOString()}`)
      .or(`invoiced_date.lte.${endDate.toISOString()},paid_date.lte.${endDate.toISOString()}`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching fee records:', error)
      setLoading(false)
      return
    }

    const records: FeeRecord[] = (sales || []).map((sale) => {
      const referral = sale.referral as unknown as {
        id: string
        referred_at: string
        hired_at: string | null
        application: {
          job_seeker: { name: string } | null
        } | null
        job: {
          title: string
          fee_type: string | null
          fee_amount: number | null
          company: { name: string } | null
        } | null
      } | null

      return {
        id: sale.id,
        transactionDate: referral?.referred_at || '',
        jobSeekerName: referral?.application?.job_seeker?.name || '',
        companyName: referral?.job?.company?.name || '',
        jobTitle: referral?.job?.title || '',
        hireDate: referral?.hired_at ?? null,
        feeType: referral?.job?.fee_type === 'fixed' ? '定額' : referral?.job?.fee_type === 'percentage' ? '歩合' : null,
        feeAmount: sale.amount,
        invoiceDate: sale.invoiced_date ?? null,
        paymentDate: sale.paid_date ?? null,
        paymentAmount: sale.status === 'paid' ? sale.amount : null,
        notes: sale.notes ?? null,
      }
    })

    setFeeRecords(records)
    setLoading(false)
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      new: '新規',
      valid: '有効',
      invalid: '無効',
      no_answer: '未連絡',
      connected: '対応中',
      working: '稼働中',
      completed: '完了',
    }
    return labels[status] || status
  }

  function getReferralResultLabel(status: string): string {
    const labels: Record<string, string> = {
      referred: '紹介中',
      interview_scheduled: '面接予定',
      interview_done: '面接済',
      hired: '採用',
      pre_assignment: '赴任前',
      assigned: '赴任済',
      working: '稼働中',
      cancelled: '辞退',
      declined: '不採用',
    }
    return labels[status] || status
  }

  function downloadJobSeekerCSV() {
    const headers = [
      '登録日',
      '氏名',
      'フリガナ',
      '生年月日',
      '性別',
      '住所',
      '電話番号',
      '希望職種',
      '希望勤務地',
      '状態',
      '紹介日',
      '紹介先会社',
      '紹介求人',
      '結果',
      '備考',
    ]

    const rows = jobSeekerRecords.map((r) => [
      formatDate(r.registrationDate),
      r.name,
      r.nameKana || '',
      r.birthDate ? formatDate(r.birthDate) : '',
      r.gender || '',
      r.address,
      r.phone,
      r.desiredJobType || '',
      r.desiredWorkLocation || '',
      r.applicationStatus,
      r.referralDate ? formatDate(r.referralDate) : '',
      r.referralCompany || '',
      r.referralJob || '',
      r.result || '',
      r.notes || '',
    ])

    downloadCSV(headers, rows, `求職管理簿_${yearMonth}.csv`)
  }

  function downloadFeeCSV() {
    const headers = [
      '取引日',
      '求職者名',
      '紹介先会社',
      '求人名',
      '採用日',
      '手数料種別',
      '手数料額',
      '請求日',
      '入金日',
      '入金額',
      '備考',
    ]

    const rows = feeRecords.map((r) => [
      formatDate(r.transactionDate),
      r.jobSeekerName,
      r.companyName,
      r.jobTitle,
      r.hireDate ? formatDate(r.hireDate) : '',
      r.feeType || '',
      r.feeAmount?.toString() || '',
      r.invoiceDate ? formatDate(r.invoiceDate) : '',
      r.paymentDate ? formatDate(r.paymentDate) : '',
      r.paymentAmount?.toString() || '',
      r.notes || '',
    ])

    downloadCSV(headers, rows, `手数料管理簿_${yearMonth}.csv`)
  }

  function downloadCSV(headers: string[], rows: string[][], filename: string) {
    const bom = '\uFEFF'
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  function printDocument() {
    window.print()
  }

  // Generate year-month options for last 24 months
  const yearMonthOptions = Array.from({ length: 24 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月`
    return { value, label }
  })

  return (
    <div>
      <Header
        title="法定帳票"
        action={
          <div className="flex items-center gap-2">
            <Select
              options={yearMonthOptions}
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="w-36"
            />
            <Button variant="outline" onClick={printDocument}>
              <FileText className="w-4 h-4 mr-2" />
              印刷
            </Button>
            <Button onClick={activeTab === 'job-seeker' ? downloadJobSeekerCSV : downloadFeeCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV出力
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('job-seeker')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'job-seeker'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">求職管理簿</span>
            </button>
            <button
              onClick={() => setActiveTab('fee')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === 'fee'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="font-medium">手数料管理簿</span>
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : activeTab === 'job-seeker' ? (
          <Card padding="none" className="print:shadow-none print:border-none">
            {/* Header for print */}
            <div className="p-4 border-b border-slate-200 print:border-b-2 print:border-black">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">求職管理簿</h2>
                <div className="text-sm text-slate-600">
                  <span className="mr-4">対象期間: {yearMonth.replace('-', '年')}月</span>
                  <span>件数: {jobSeekerRecords.length}件</span>
                </div>
              </div>
            </div>

            {jobSeekerRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">登録日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">氏名</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">生年月日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">性別</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">住所</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">電話番号</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">状態</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">紹介日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">紹介先</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">結果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobSeekerRecords.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {formatDate(record.registrationDate)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {record.name}
                          {record.nameKana && (
                            <span className="block text-xs text-slate-400">{record.nameKana}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {record.birthDate ? formatDate(record.birthDate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{record.gender || '-'}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                          {record.address || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{record.phone}</td>
                        <td className="px-3 py-2 text-slate-600">{record.applicationStatus}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {record.referralDate ? formatDate(record.referralDate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                          {record.referralCompany || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{record.result || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                該当するデータがありません
              </div>
            )}
          </Card>
        ) : (
          <Card padding="none" className="print:shadow-none print:border-none">
            {/* Header for print */}
            <div className="p-4 border-b border-slate-200 print:border-b-2 print:border-black">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">手数料管理簿</h2>
                <div className="text-sm text-slate-600">
                  <span className="mr-4">対象期間: {yearMonth.replace('-', '年')}月</span>
                  <span>件数: {feeRecords.length}件</span>
                </div>
              </div>
            </div>

            {feeRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left font-medium text-slate-600">取引日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">求職者名</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">紹介先会社</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">求人名</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">採用日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">手数料種別</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">手数料額</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">請求日</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">入金日</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">入金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeRecords.map((record) => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {formatDate(record.transactionDate)}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{record.jobSeekerName}</td>
                        <td className="px-3 py-2 text-slate-600">{record.companyName}</td>
                        <td className="px-3 py-2 text-slate-600 max-w-[150px] truncate">
                          {record.jobTitle}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {record.hireDate ? formatDate(record.hireDate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{record.feeType || '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-800 font-medium">
                          {record.feeAmount ? `¥${record.feeAmount.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {record.invoiceDate ? formatDate(record.invoiceDate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {record.paymentDate ? formatDate(record.paymentDate) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600 font-medium">
                          {record.paymentAmount ? `¥${record.paymentAmount.toLocaleString()}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={6} className="px-3 py-2 text-right text-slate-600">合計</td>
                      <td className="px-3 py-2 text-right text-slate-800">
                        ¥{feeRecords.reduce((sum, r) => sum + (r.feeAmount || 0), 0).toLocaleString()}
                      </td>
                      <td colSpan={2}></td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        ¥{feeRecords.reduce((sum, r) => sum + (r.paymentAmount || 0), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                該当するデータがありません
              </div>
            )}
          </Card>
        )}

        {/* Print styles note */}
        <Card className="print:hidden">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="font-medium text-slate-800">大阪労働局提出用帳票について</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-500">
                <li>求職管理簿：求職者の登録から紹介、採用結果までを記録</li>
                <li>手数料管理簿：紹介手数料の発生から入金までを記録</li>
                <li>CSV出力でExcelでの編集が可能です</li>
                <li>印刷ボタンで直接印刷、またはPDFとして保存できます</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:shadow-none,
          .print\\:shadow-none * {
            visibility: visible;
          }
          .print\\:shadow-none {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
