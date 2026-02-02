import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  Phone,
  MapPin,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { Company } from '../../types/database'

interface CompanyWithJobCount extends Company {
  job_count: number
}

export function CompanyListPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyWithJobCount[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCompanies()
  }, [])

  async function fetchCompanies() {
    setLoading(true)

    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        jobs (id)
      `)
      .order('name')

    if (error) {
      console.error('Error fetching companies:', error)
      setLoading(false)
      return
    }

    const companiesWithCount = (data || []).map((company: any) => ({
      ...company,
      job_count: company.jobs?.length || 0,
    }))

    setCompanies(companiesWithCount)
    setLoading(false)
  }

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.prefecture?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.business_type?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const activeCompanies = filteredCompanies.filter((c) => c.is_active)
  const inactiveCompanies = filteredCompanies.filter((c) => !c.is_active)

  return (
    <div>
      <Header
        title="派遣会社管理"
        action={
          <Link to="/companies/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新規登録
            </Button>
          </Link>
        }
      />

      <div className="p-6 space-y-6">
        {/* Search */}
        <Card>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="会社名、エリア、業種で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">取引先企業</p>
                <p className="text-2xl font-bold text-slate-800">{activeCompanies.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">公開求人数</p>
                <p className="text-2xl font-bold text-slate-800">
                  {companies.reduce((sum, c) => sum + c.job_count, 0)}
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">取引停止中</p>
                <p className="text-2xl font-bold text-slate-800">{inactiveCompanies.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Company List */}
        <Card padding="none">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">取引先一覧</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              該当する派遣会社が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                  onClick={() => navigate(`/companies/${company.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800">{company.name}</p>
                        {!company.is_active && (
                          <Badge variant="default">取引停止</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {company.business_type && (
                          <span className="text-sm text-slate-500">{company.business_type}</span>
                        )}
                        {company.prefecture && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="w-3 h-3" />
                            {company.prefecture}{company.city}
                          </div>
                        )}
                        {company.phone && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Phone className="w-3 h-3" />
                            {company.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">求人数</p>
                      <p className="text-lg font-semibold text-slate-800">{company.job_count}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
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
