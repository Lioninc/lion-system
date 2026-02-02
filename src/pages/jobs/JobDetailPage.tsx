import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  MapPin,
  DollarSign,
  Clock,
  Calendar,
  Home,
  Edit2,
  Users,
  Play,
  Pause,
  XCircle,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { Job, Company } from '../../types/database'

interface JobDetail extends Job {
  company: Company
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchJob()
    }
  }, [id])

  async function fetchJob() {
    setLoading(true)

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        company:companies (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching job:', error)
      navigate('/jobs')
      return
    }

    setJob(data as JobDetail)
    setLoading(false)
  }

  async function updateStatus(newStatus: 'open' | 'paused' | 'closed') {
    if (!job) return

    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', job.id)

    if (!error) {
      setJob({ ...job, status: newStatus })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!job) {
    return null
  }

  const statusConfig = {
    open: { label: '公開中', variant: 'success' as const, icon: Play },
    paused: { label: '一時停止', variant: 'warning' as const, icon: Pause },
    closed: { label: '終了', variant: 'default' as const, icon: XCircle },
  }

  const currentStatus = statusConfig[job.status as keyof typeof statusConfig]

  return (
    <div>
      <Header
        title={job.title}
        action={
          <div className="flex gap-2">
            {job.status !== 'open' && (
              <Button variant="outline" onClick={() => updateStatus('open')}>
                <Play className="w-4 h-4 mr-2" />
                公開する
              </Button>
            )}
            {job.status === 'open' && (
              <Button variant="outline" onClick={() => updateStatus('paused')}>
                <Pause className="w-4 h-4 mr-2" />
                一時停止
              </Button>
            )}
            {job.status !== 'closed' && (
              <Button variant="outline" onClick={() => updateStatus('closed')}>
                <XCircle className="w-4 h-4 mr-2" />
                終了する
              </Button>
            )}
            <Button onClick={() => navigate(`/jobs/${id}/edit`)}>
              <Edit2 className="w-4 h-4 mr-2" />
              編集
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {job.status !== 'open' && (
          <div className={`rounded-lg p-4 flex items-center gap-3 ${
            job.status === 'paused'
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              job.status === 'paused' ? 'bg-amber-100' : 'bg-slate-100'
            }`}>
              <currentStatus.icon className={`w-5 h-5 ${
                job.status === 'paused' ? 'text-amber-600' : 'text-slate-600'
              }`} />
            </div>
            <div>
              <p className={`font-medium ${
                job.status === 'paused' ? 'text-amber-800' : 'text-slate-800'
              }`}>
                この求人は{currentStatus.label}です
              </p>
              <p className={`text-sm ${
                job.status === 'paused' ? 'text-amber-600' : 'text-slate-600'
              }`}>
                {job.status === 'paused'
                  ? '一時的に募集を停止しています'
                  : '募集は終了しました'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-7 h-7 text-slate-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{job.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {job.job_type && <Badge variant="info">{job.job_type}</Badge>}
                    <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
                    {job.has_dormitory && <Badge variant="purple">寮あり</Badge>}
                  </div>
                </div>
              </div>
            </div>

            {/* Company Link */}
            <Link
              to={`/companies/${job.company_id}`}
              className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors mb-4"
            >
              <Building2 className="w-5 h-5 text-slate-500" />
              <span className="font-medium text-slate-700">{job.company?.name}</span>
            </Link>

            {/* Description */}
            {job.description && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">仕事内容</h4>
                <p className="text-slate-700 whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Requirements */}
            {job.requirements && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-500 mb-2">応募要件</h4>
                <p className="text-slate-700 whitespace-pre-wrap">{job.requirements}</p>
              </div>
            )}

            {/* Location */}
            {job.prefecture && (
              <div className="flex items-start gap-2 mb-4">
                <MapPin className="w-4 h-4 text-slate-400 mt-1" />
                <div>
                  <h4 className="text-sm font-medium text-slate-500">勤務地</h4>
                  <p className="text-slate-700">
                    {job.postal_code && `〒${job.postal_code} `}
                    {job.prefecture}{job.city}{job.address}
                  </p>
                </div>
              </div>
            )}

            {/* Working Conditions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              {(job.salary_min || job.salary_max) && (
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <h4 className="text-sm font-medium text-slate-500">給与</h4>
                    <p className="text-slate-700">
                      {job.salary_min && formatCurrency(job.salary_min)}
                      {job.salary_min && job.salary_max && ' 〜 '}
                      {job.salary_max && formatCurrency(job.salary_max)}
                    </p>
                  </div>
                </div>
              )}
              {job.working_hours && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <h4 className="text-sm font-medium text-slate-500">勤務時間</h4>
                    <p className="text-slate-700">{job.working_hours}</p>
                  </div>
                </div>
              )}
              {job.holidays && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <h4 className="text-sm font-medium text-slate-500">休日</h4>
                    <p className="text-slate-700">{job.holidays}</p>
                  </div>
                </div>
              )}
              {job.benefits && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-slate-400 mt-1" />
                  <div>
                    <h4 className="text-sm font-medium text-slate-500">福利厚生</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">{job.benefits}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Dormitory */}
            {job.has_dormitory && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-start gap-2">
                  <Home className="w-4 h-4 text-purple-500 mt-1" />
                  <div>
                    <h4 className="text-sm font-medium text-slate-500">寮情報</h4>
                    <p className="text-slate-700 whitespace-pre-wrap">
                      {job.dormitory_details || '寮完備'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {job.notes && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-500 mb-2">備考</h4>
                <p className="text-slate-600 whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}
          </Card>

          {/* Side Panel */}
          <div className="space-y-4">
            {/* Fee Info */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">成功報酬</h3>
              {job.fee_amount || job.fee_percentage ? (
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">
                    {job.fee_type === 'fixed' && job.fee_amount
                      ? formatCurrency(job.fee_amount)
                      : job.fee_percentage
                      ? `${job.fee_percentage}%`
                      : '-'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {job.fee_type === 'fixed' ? '固定報酬' : '年収の割合'}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 text-center">未設定</p>
              )}
            </Card>

            {/* Stats */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">求人情報</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">登録日</span>
                  <span className="text-slate-700">{formatDate(job.created_at)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">最終更新</span>
                  <span className="text-slate-700">{formatDate(job.updated_at)}</span>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card>
              <h3 className="font-semibold text-slate-800 mb-4">クイックアクション</h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate(`/companies/${job.company_id}`)}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  派遣会社を見る
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate('/job-seekers')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  求職者を探す
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
