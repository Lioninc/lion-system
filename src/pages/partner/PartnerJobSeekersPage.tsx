import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, Button } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import type { JobSeeker } from '../../types/database'
import { calculateAge, formatPhone, formatDate } from '../../lib/utils'
import { PartnerJobSeekerEditModal } from './PartnerJobSeekerEditModal'

interface PartnerJobSeeker extends JobSeeker {
  age: number | null
  latest_applied_at: string | null
}

const PAGE_SIZE = 20

export function PartnerJobSeekersPage() {
  const [jobSeekers, setJobSeekers] = useState<PartnerJobSeeker[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [editingSeeker, setEditingSeeker] = useState<JobSeeker | null>(null)

  useEffect(() => {
    fetchJobSeekers()
  }, [])

  async function fetchJobSeekers() {
    setLoading(true)

    // RLS により partner には条件に合致した求職者のみ返却される
    // 念のためフロント側でも applied_at + referrals 条件で絞り込む
    const { data, error } = await supabase
      .from('job_seekers')
      .select(`
        *,
        applications (
          id, applied_at,
          referrals ( id, referral_status )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching partner job seekers:', error)
      setLoading(false)
      return
    }

    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const filtered: PartnerJobSeeker[] = []
    for (const js of (data || []) as any[]) {
      const apps = js.applications || []
      // 条件に合致する応募が1件以上あるか
      const eligibleApp = apps.find((app: any) => {
        if (!app.applied_at) return false
        const appliedAt = new Date(app.applied_at)
        if (appliedAt > twoMonthsAgo) return false
        const refs = app.referrals || []
        const blocked = refs.some(
          (r: any) => r.referral_status === 'working' || r.referral_status === 'assigned',
        )
        return !blocked
      })
      if (!eligibleApp) continue

      const latestApplied = apps
        .map((a: any) => a.applied_at)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null

      filtered.push({
        ...(js as JobSeeker),
        age: js.birth_date ? calculateAge(js.birth_date) : null,
        latest_applied_at: latestApplied,
      })
    }

    setJobSeekers(filtered)
    setLoading(false)
  }

  const filteredSeekers = useMemo(() => {
    if (!search) return jobSeekers
    const lower = search.toLowerCase()
    return jobSeekers.filter((js) => {
      return (
        js.name?.toLowerCase().includes(lower) ||
        js.name_kana?.toLowerCase().includes(lower) ||
        js.phone?.includes(search) ||
        js.prefecture?.toLowerCase().includes(lower) ||
        js.city?.toLowerCase().includes(lower) ||
        js.desired_job_type?.toLowerCase().includes(lower) ||
        js.desired_work_location?.toLowerCase().includes(lower)
      )
    })
  }, [jobSeekers, search])

  const totalPages = Math.max(1, Math.ceil(filteredSeekers.length / PAGE_SIZE))
  const pagedSeekers = filteredSeekers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setCurrentPage(1)
  }

  async function handleSave(updates: Partial<JobSeeker>) {
    if (!editingSeeker) return
    const { error } = await supabase
      .from('job_seekers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingSeeker.id)

    if (error) {
      alert(`更新に失敗しました: ${error.message}`)
      return
    }

    setEditingSeeker(null)
    await fetchJobSeekers()
  }

  return (
    <div>
      <Header title="求職者リスト（パートナー）" />

      <div className="p-4 lg:p-6 space-y-4">
        <Card>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="氏名・電話番号・希望職種などで検索..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <Button type="submit">検索</Button>
          </form>
        </Card>

        {loading ? (
          <Card>
            <div className="py-12 text-center text-slate-500">読み込み中...</div>
          </Card>
        ) : pagedSeekers.length === 0 ? (
          <Card>
            <div className="py-12 text-center text-slate-500">
              対象となる求職者が見つかりません
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pagedSeekers.map((js) => (
                <Card key={js.id}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* 基本情報 */}
                      <div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-slate-800">{js.name}</h3>
                          {js.name_kana && (
                            <span className="text-xs text-slate-500">{js.name_kana}</span>
                          )}
                          {js.age !== null && (
                            <span className="text-sm text-slate-600">{js.age}歳</span>
                          )}
                          {js.gender && (
                            <span className="text-xs text-slate-500">
                              {js.gender === 'male' ? '男性' : js.gender === 'female' ? '女性' : 'その他'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{formatPhone(js.phone)}</p>
                      </div>

                      {/* 居住地 */}
                      {(js.prefecture || js.city) && (
                        <div className="text-sm">
                          <span className="text-slate-500">居住地: </span>
                          <span className="text-slate-700">
                            {js.prefecture}{js.city ? ` ${js.city}` : ''}
                          </span>
                        </div>
                      )}

                      {/* 希望条件 */}
                      <div className="text-sm space-y-1">
                        {js.desired_job_type && (
                          <div>
                            <span className="text-slate-500">希望職種: </span>
                            <span className="text-slate-700">{js.desired_job_type}</span>
                          </div>
                        )}
                        {js.desired_work_location && (
                          <div>
                            <span className="text-slate-500">希望勤務地: </span>
                            <span className="text-slate-700">{js.desired_work_location}</span>
                          </div>
                        )}
                        {js.desired_employment_type && (
                          <div>
                            <span className="text-slate-500">希望雇用形態: </span>
                            <span className="text-slate-700">{js.desired_employment_type}</span>
                          </div>
                        )}
                      </div>

                      {/* スキル */}
                      {(js.qualifications || js.has_car_license || js.has_forklift || js.pc_skill_level) && (
                        <div className="text-sm">
                          <span className="text-slate-500">スキル: </span>
                          <span className="text-slate-700">
                            {[
                              js.qualifications,
                              js.has_car_license ? '普通自動車免許' : null,
                              js.has_forklift ? 'フォークリフト' : null,
                              js.pc_skill_level ? `PC: ${js.pc_skill_level}` : null,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </span>
                        </div>
                      )}

                      {/* 就業状況 */}
                      <div className="text-sm flex gap-3 flex-wrap">
                        {js.employment_status && (
                          <div>
                            <span className="text-slate-500">就業状況: </span>
                            <span className="text-slate-700">
                              {js.employment_status === 'employed' ? '就業中' : '離職中'}
                            </span>
                          </div>
                        )}
                        {js.desired_start_date && (
                          <div>
                            <span className="text-slate-500">希望開始: </span>
                            <span className="text-slate-700">{formatDate(js.desired_start_date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingSeeker(js)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        編集
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                全{filteredSeekers.length}件中 {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, filteredSeekers.length)}件
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600 self-center">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {editingSeeker && (
        <PartnerJobSeekerEditModal
          jobSeeker={editingSeeker}
          onClose={() => setEditingSeeker(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
