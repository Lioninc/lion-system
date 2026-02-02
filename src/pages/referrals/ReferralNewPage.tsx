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
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'

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
  company: {
    id: string
    name: string
  }
}

export function ReferralNewPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const applicationId = searchParams.get('application')

  const [application, setApplication] = useState<ApplicationWithSeeker | null>(null)
  const [jobs, setJobs] = useState<JobWithCompany[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (applicationId) {
      fetchApplication()
      fetchJobs()
    } else {
      navigate('/job-seekers')
    }
  }, [applicationId])

  async function fetchApplication() {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        id,
        job_seeker:job_seekers (
          id,
          name,
          phone,
          prefecture,
          city
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
  }

  async function fetchJobs() {
    setLoading(true)

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        job_type,
        prefecture,
        city,
        salary_min,
        salary_max,
        has_dormitory,
        fee_amount,
        status,
        company:companies (
          id,
          name
        )
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching jobs:', error)
      setLoading(false)
      return
    }

    setJobs(data as unknown as JobWithCompany[])
    setLoading(false)
  }

  const filteredJobs = jobs.filter((job) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      job.title.toLowerCase().includes(search) ||
      job.company?.name.toLowerCase().includes(search) ||
      job.prefecture?.toLowerCase().includes(search) ||
      job.job_type?.toLowerCase().includes(search)
    )
  })

  async function handleSubmit() {
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

    // Update application progress status
    await supabase
      .from('applications')
      .update({ progress_status: 'referred' })
      .eq('id', applicationId)

    navigate(`/referrals/${referral.id}`)
  }

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
            disabled={!selectedJob || saving}
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

        {/* Notes */}
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

        {/* Job Search */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">紹介する求人を選択</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="求人を検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当する求人が見つかりません
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedJob === job.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary'
                      : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
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
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {job.company?.name}
                        </div>
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
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
