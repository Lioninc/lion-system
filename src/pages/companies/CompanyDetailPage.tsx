import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Edit2,
  Plus,
  Briefcase,
  Users,
  DollarSign,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import type { Company, Job } from '../../types/database'

interface CompanyDetail extends Company {
  jobs: Job[]
}

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchCompany()
    }
  }, [id])

  async function fetchCompany() {
    setLoading(true)

    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        jobs (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching company:', error)
      navigate('/companies')
      return
    }

    setCompany(data as CompanyDetail)
    setLoading(false)
  }

  async function toggleActiveStatus() {
    if (!company) return

    const { error } = await supabase
      .from('companies')
      .update({ is_active: !company.is_active })
      .eq('id', company.id)

    if (!error) {
      setCompany({ ...company, is_active: !company.is_active })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!company) {
    return null
  }

  const openJobs = company.jobs?.filter((j) => j.status === 'open') || []
  const closedJobs = company.jobs?.filter((j) => j.status !== 'open') || []

  return (
    <div>
      <Header
        title={company.name}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleActiveStatus}>
              {company.is_active ? (
                <>
                  <ToggleRight className="w-4 h-4 mr-2" />
                  取引停止にする
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 mr-2" />
                  取引再開する
                </>
              )}
            </Button>
            <Button onClick={() => navigate(`/companies/${id}/edit`)}>
              <Edit2 className="w-4 h-4 mr-2" />
              編集
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {!company.is_active && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-800">この会社は取引停止中です</p>
              <p className="text-sm text-amber-600">新規の紹介は行えません</p>
            </div>
          </div>
        )}

        {/* Company Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Info */}
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-slate-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{company.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {company.business_type && (
                      <Badge variant="info">{company.business_type}</Badge>
                    )}
                    <Badge variant={company.is_active ? 'success' : 'default'}>
                      {company.is_active ? '取引中' : '取引停止'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {company.contact_person && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>担当: {company.contact_person}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <a href={`tel:${company.phone}`} className="hover:text-primary">
                    {company.phone}
                  </a>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <a href={`mailto:${company.email}`} className="hover:text-primary">
                    {company.email}
                  </a>
                </div>
              )}
              {company.prefecture && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>
                    {company.postal_code && `〒${company.postal_code} `}
                    {company.prefecture}{company.city}{company.address}
                  </span>
                </div>
              )}
            </div>

            {company.notes && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-500 mb-2">備考</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
          </Card>

          {/* Stats */}
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">公開中の求人</p>
                  <p className="text-2xl font-bold text-emerald-600">{openJobs.length}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">非公開の求人</p>
                  <p className="text-2xl font-bold text-slate-600">{closedJobs.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Jobs List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">求人一覧</h3>
            <Link to={`/jobs/new?company=${company.id}`}>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                求人を追加
              </Button>
            </Link>
          </div>
          {company.jobs && company.jobs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {company.jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{job.title}</p>
                        <Badge
                          variant={
                            job.status === 'open' ? 'success' :
                            job.status === 'paused' ? 'warning' : 'default'
                          }
                        >
                          {job.status === 'open' ? '公開中' :
                           job.status === 'paused' ? '一時停止' : '終了'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        {job.job_type && <span>{job.job_type}</span>}
                        {job.prefecture && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.prefecture}{job.city}
                          </span>
                        )}
                        {job.salary_min && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(job.salary_min)}〜
                          </span>
                        )}
                        {job.has_dormitory && (
                          <Badge variant="purple">寮あり</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              求人がありません
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
