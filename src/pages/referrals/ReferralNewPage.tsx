import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  MapPin,
  DollarSign,
  Briefcase,
  Home,
  User,
  Phone,
  CheckCircle2,
  HardHat,
  UserRound,
  Plus,
  ArrowRight,
  Search,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import type { CompanyType } from '../../types/database'

interface ApplicationWithSeeker {
  id: string
  job_seeker: {
    id: string
    name: string
    phone: string
    prefecture: string | null
    city: string | null
  }
}

interface CompanyItem {
  id: string
  name: string
  company_type: CompanyType | null
}

interface JobWithCompany {
  id: string
  title: string
  job_type: string | null
  prefecture: string | null
  city: string | null
  salary_min: number | null
  salary_max: number | null
  has_dormitory: boolean
  fee_amount: number | null
  status: string
  client_company_id: string | null
  company: {
    id: string
    name: string
  }
  client_company: {
    id: string
    name: string
  } | null
}

type ReferralType = 'dispatch' | 'direct'

export function ReferralNewPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const applicationId = searchParams.get('application')

  const [application, setApplication] = useState<ApplicationWithSeeker | null>(null)
  const [referralType, setReferralType] = useState<ReferralType | null>(null)

  // Dispatch flow
  const [dispatchCompanies, setDispatchCompanies] = useState<CompanyItem[]>([])
  const [clientCompanies, setClientCompanies] = useState<CompanyItem[]>([])
  const [selectedDispatchCompany, setSelectedDispatchCompany] = useState<string | null>(null)
  const [selectedClientCompany, setSelectedClientCompany] = useState<string | null>(null)
  const [dispatchSearch, setDispatchSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [newDispatchName, setNewDispatchName] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [showAddDispatch, setShowAddDispatch] = useState(false)
  const [showAddClient, setShowAddClient] = useState(false)

  // Direct flow
  const [directCompanies, setDirectCompanies] = useState<CompanyItem[]>([])
  const [selectedDirectCompany, setSelectedDirectCompany] = useState<string | null>(null)
  const [directJobs, setDirectJobs] = useState<JobWithCompany[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [directSearch, setDirectSearch] = useState('')
  const [jobSearch, setJobSearch] = useState('')
  const [newDirectName, setNewDirectName] = useState('')
  const [showAddDirect, setShowAddDirect] = useState(false)

  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (applicationId) {
      fetchApplication()
    } else {
      navigate('/job-seekers')
    }
  }, [applicationId])

  useEffect(() => {
    if (referralType === 'dispatch') {
      fetchCompanies('dispatch')
      fetchCompanies('client')
    } else if (referralType === 'direct') {
      fetchCompanies('direct')
    }
    // Reset selections on type change
    setSelectedDispatchCompany(null)
    setSelectedClientCompany(null)
    setSelectedDirectCompany(null)
    setSelectedJob(null)
  }, [referralType])

  useEffect(() => {
    if (selectedDirectCompany) {
      fetchDirectJobs(selectedDirectCompany)
    }
  }, [selectedDirectCompany])

  async function fetchApplication() {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        id,
        job_seeker:job_seekers (
          id, name, phone, prefecture, city
        )
      `)
      .eq('id', applicationId)
      .single()

    if (error) {
      console.error('Error fetching application:', error)
      navigate('/job-seekers')
      return
    }
    setApplication(data as unknown as ApplicationWithSeeker)
    setLoading(false)
  }

  async function fetchCompanies(type: CompanyType) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, company_type')
      .eq('company_type', type)
      .eq('is_active', true)
      .order('name')

    if (data) {
      if (type === 'dispatch') setDispatchCompanies(data as CompanyItem[])
      else if (type === 'client') setClientCompanies(data as CompanyItem[])
      else if (type === 'direct') setDirectCompanies(data as CompanyItem[])
    }
  }

  async function fetchDirectJobs(companyId: string) {
    const { data } = await supabase
      .from('jobs')
      .select(`
        id, title, job_type, prefecture, city,
        salary_min, salary_max, has_dormitory, fee_amount, status, client_company_id,
        company:companies!jobs_company_id_fkey ( id, name ),
        client_company:companies!jobs_client_company_id_fkey ( id, name )
      `)
      .eq('company_id', companyId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (data) {
      setDirectJobs(data as unknown as JobWithCompany[])
    }
  }

  async function addCompany(name: string, type: CompanyType): Promise<string | null> {
    const { data, error } = await supabase
      .from('companies')
      .insert({
        name,
        company_type: type,
        company_type_v2: type,
        tenant_id: user?.tenant_id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating company:', error)
      alert('会社の追加に失敗しました')
      return null
    }

    // Refresh the list
    await fetchCompanies(type)
    return data.id
  }

  async function handleAddDispatch() {
    if (!newDispatchName.trim()) return
    const id = await addCompany(newDispatchName.trim(), 'dispatch')
    if (id) {
      setSelectedDispatchCompany(id)
      setNewDispatchName('')
      setShowAddDispatch(false)
    }
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return
    const id = await addCompany(newClientName.trim(), 'client')
    if (id) {
      setSelectedClientCompany(id)
      setNewClientName('')
      setShowAddClient(false)
    }
  }

  async function handleAddDirect() {
    if (!newDirectName.trim()) return
    const id = await addCompany(newDirectName.trim(), 'direct')
    if (id) {
      setSelectedDirectCompany(id)
      setNewDirectName('')
      setShowAddDirect(false)
    }
  }

  async function handleSubmitDispatch() {
    if (!applicationId || !selectedDispatchCompany || !selectedClientCompany) return
    setSaving(true)

    const dispatchName = dispatchCompanies.find((c) => c.id === selectedDispatchCompany)?.name || ''
    const clientName = clientCompanies.find((c) => c.id === selectedClientCompany)?.name || ''

    // Check for existing job with same combination
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('company_id', selectedDispatchCompany)
      .eq('client_company_id', selectedClientCompany)
      .eq('status', 'open')
      .limit(1)
      .maybeSingle()

    let jobId: string

    if (existingJob) {
      jobId = existingJob.id
    } else {
      // Auto-create job
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          tenant_id: user?.tenant_id,
          company_id: selectedDispatchCompany,
          client_company_id: selectedClientCompany,
          title: `${dispatchName} → ${clientName}`,
          status: 'open',
        })
        .select('id')
        .single()

      if (jobError || !newJob) {
        console.error('Error creating job:', jobError)
        alert('求人の作成に失敗しました')
        setSaving(false)
        return
      }
      jobId = newJob.id
    }

    // Create referral
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        application_id: applicationId,
        job_id: jobId,
        referral_status: 'referred',
        referred_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating referral:', error)
      alert('紹介の作成に失敗しました')
      setSaving(false)
      return
    }

    await supabase
      .from('applications')
      .update({ progress_status: 'referred' })
      .eq('id', applicationId)

    navigate(`/referrals/${referral.id}`)
  }

  async function handleSubmitDirect() {
    if (!applicationId || !selectedJob) return
    setSaving(true)

    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        application_id: applicationId,
        job_id: selectedJob,
        referral_status: 'referred',
        referred_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating referral:', error)
      alert('紹介の作成に失敗しました')
      setSaving(false)
      return
    }

    await supabase
      .from('applications')
      .update({ progress_status: 'referred' })
      .eq('id', applicationId)

    navigate(`/referrals/${referral.id}`)
  }

  function handleSubmit() {
    if (referralType === 'dispatch') handleSubmitDispatch()
    else if (referralType === 'direct') handleSubmitDirect()
  }

  const canSubmit =
    referralType === 'dispatch'
      ? !!selectedDispatchCompany && !!selectedClientCompany
      : referralType === 'direct'
      ? !!selectedJob
      : false

  const filteredDispatch = dispatchCompanies.filter((c) =>
    !dispatchSearch || c.name.toLowerCase().includes(dispatchSearch.toLowerCase())
  )
  const filteredClient = clientCompanies.filter((c) =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )
  const filteredDirect = directCompanies.filter((c) =>
    !directSearch || c.name.toLowerCase().includes(directSearch.toLowerCase())
  )
  const filteredJobs = directJobs.filter((j) =>
    !jobSearch || j.title.toLowerCase().includes(jobSearch.toLowerCase())
  )

  if (!application) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="求人を紹介"
        action={
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            isLoading={saving}
          >
            紹介を作成
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Job Seeker Info */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3">紹介対象の求職者</h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{application.job_seeker?.name}</p>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {application.job_seeker?.phone}
                </div>
                {application.job_seeker?.prefecture && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {application.job_seeker.prefecture}{application.job_seeker.city}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Referral Type Selection */}
        <Card>
          <h3 className="font-semibold text-slate-800 mb-3">紹介タイプを選択</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setReferralType('dispatch')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                referralType === 'dispatch'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <HardHat className={`w-8 h-8 ${referralType === 'dispatch' ? 'text-blue-500' : 'text-slate-400'}`} />
              <span className="font-medium text-sm">派遣（ブルーカラー）</span>
            </button>
            <button
              onClick={() => setReferralType('direct')}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                referralType === 'direct'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <UserRound className={`w-8 h-8 ${referralType === 'direct' ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="font-medium text-sm">紹介（ホワイトカラー）</span>
            </button>
          </div>
        </Card>

        {/* ===== DISPATCH FLOW ===== */}
        {referralType === 'dispatch' && (
          <>
            {/* Step 1: Select Dispatch Company */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                <h3 className="font-semibold text-slate-800">派遣会社を選択</h3>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="派遣会社を検索..."
                  value={dispatchSearch}
                  onChange={(e) => setDispatchSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {filteredDispatch.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedDispatchCompany(c.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      selectedDispatchCompany === c.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    </div>
                    {selectedDispatchCompany === c.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                ))}
                {filteredDispatch.length === 0 && !showAddDispatch && (
                  <p className="text-sm text-slate-500 text-center py-3">該当する会社がありません</p>
                )}
              </div>
              {!showAddDispatch ? (
                <button
                  onClick={() => setShowAddDispatch(true)}
                  className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4" /> 派遣会社を追加
                </button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="会社名を入力..."
                    value={newDispatchName}
                    onChange={(e) => setNewDispatchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDispatch()}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddDispatch} disabled={!newDispatchName.trim()}>追加</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddDispatch(false); setNewDispatchName('') }}>取消</Button>
                </div>
              )}
            </Card>

            {/* Step 2: Select Client Company */}
            {selectedDispatchCompany && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <h3 className="font-semibold text-slate-800">派遣先企業を選択</h3>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="派遣先企業を検索..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {filteredClient.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClientCompany(c.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                        selectedClientCompany === c.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      </div>
                      {selectedClientCompany === c.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  ))}
                  {filteredClient.length === 0 && !showAddClient && (
                    <p className="text-sm text-slate-500 text-center py-3">該当する企業がありません</p>
                  )}
                </div>
                {!showAddClient ? (
                  <button
                    onClick={() => setShowAddClient(true)}
                    className="mt-3 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="w-4 h-4" /> 派遣先企業を追加
                  </button>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      placeholder="企業名を入力..."
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <Button size="sm" onClick={handleAddClient} disabled={!newClientName.trim()}>追加</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddClient(false); setNewClientName('') }}>取消</Button>
                  </div>
                )}
              </Card>
            )}

            {/* Dispatch Summary */}
            {selectedDispatchCompany && selectedClientCompany && (
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-800">紹介内容</h3>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-slate-800">
                    {dispatchCompanies.find((c) => c.id === selectedDispatchCompany)?.name}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-800">
                    {clientCompanies.find((c) => c.id === selectedClientCompany)?.name}
                  </span>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ===== DIRECT FLOW ===== */}
        {referralType === 'direct' && (
          <>
            {/* Step 1: Select Company */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                <h3 className="font-semibold text-slate-800">企業を選択</h3>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="企業を検索..."
                  value={directSearch}
                  onChange={(e) => setDirectSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {filteredDirect.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => { setSelectedDirectCompany(c.id); setSelectedJob(null) }}
                    className={`p-3 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      selectedDirectCompany === c.id
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    </div>
                    {selectedDirectCompany === c.id && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                ))}
                {filteredDirect.length === 0 && !showAddDirect && (
                  <p className="text-sm text-slate-500 text-center py-3">該当する企業がありません</p>
                )}
              </div>
              {!showAddDirect ? (
                <button
                  onClick={() => setShowAddDirect(true)}
                  className="mt-3 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800"
                >
                  <Plus className="w-4 h-4" /> 企業を追加
                </button>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="企業名を入力..."
                    value={newDirectName}
                    onChange={(e) => setNewDirectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddDirect()}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleAddDirect} disabled={!newDirectName.trim()}>追加</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddDirect(false); setNewDirectName('') }}>取消</Button>
                </div>
              )}
            </Card>

            {/* Step 2: Select Job */}
            {selectedDirectCompany && (
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                  <h3 className="font-semibold text-slate-800">求人を選択</h3>
                </div>

                {directJobs.length > 3 && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="求人を検索..."
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                  </div>
                )}

                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJob(job.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedJob === job.id
                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                            : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-800">{job.title}</p>
                              {job.has_dormitory && (
                                <Badge variant="purple">
                                  <Home className="w-3 h-3 mr-1" />
                                  寮あり
                                </Badge>
                              )}
                              {selectedJob === job.id && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              {job.prefecture && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {job.prefecture}{job.city}
                                </div>
                              )}
                              {job.job_type && (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" />
                                  {job.job_type}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            {job.salary_min && (
                              <p className="text-sm text-slate-600">
                                <DollarSign className="w-3 h-3 inline" />
                                {formatCurrency(job.salary_min)}〜
                              </p>
                            )}
                            {job.fee_amount && (
                              <p className="text-emerald-600 font-semibold mt-1">
                                報酬: {formatCurrency(job.fee_amount)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-6">
                      この企業の募集中の求人はありません
                    </p>
                  )}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Notes */}
        {referralType && (
          <Card>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              紹介メモ（任意）
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="紹介時のメモを入力..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Card>
        )}
      </div>
    </div>
  )
}
