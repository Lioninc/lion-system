import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'
import { Card, Button, Badge } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'

interface InterviewWithDetails {
  id: string
  scheduled_at: string
  conducted_at: string | null
  result: string | null
  application: {
    id: string
    job_seeker: {
      id: string
      name: string
      phone: string
    }
    coordinator: {
      id: string
      name: string
    } | null
  }
}

type ViewMode = 'day' | 'week'

export function InterviewSchedulePage() {
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState<InterviewWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    fetchInterviews()
  }, [currentDate, viewMode])

  async function fetchInterviews() {
    setLoading(true)

    let startDate: Date
    let endDate: Date

    if (viewMode === 'day') {
      startDate = new Date(currentDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(currentDate)
      endDate.setHours(23, 59, 59, 999)
    } else {
      // week view - start from Monday
      startDate = new Date(currentDate)
      const day = startDate.getDay()
      const diff = day === 0 ? -6 : 1 - day
      startDate.setDate(startDate.getDate() + diff)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)
    }

    const { data, error } = await supabase
      .from('interviews')
      .select(`
        id,
        scheduled_at,
        conducted_at,
        result,
        application:applications (
          id,
          job_seeker:job_seekers (
            id,
            name,
            phone
          ),
          coordinator:users!applications_coordinator_id_fkey (
            id,
            name
          )
        )
      `)
      .gte('scheduled_at', startDate.toISOString())
      .lte('scheduled_at', endDate.toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) {
      console.error('Error fetching interviews:', error)
    } else {
      setInterviews((data || []) as unknown as InterviewWithDetails[])
    }

    setLoading(false)
  }

  function navigateDate(direction: number) {
    const newDate = new Date(currentDate)
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + direction)
    } else {
      newDate.setDate(newDate.getDate() + direction * 7)
    }
    setCurrentDate(newDate)
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  function getWeekDays(): Date[] {
    const startDate = new Date(currentDate)
    const day = startDate.getDay()
    const diff = day === 0 ? -6 : 1 - day
    startDate.setDate(startDate.getDate() + diff)

    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  function getInterviewsForDate(date: Date): InterviewWithDetails[] {
    return interviews.filter((interview) => {
      const iDate = new Date(interview.scheduled_at)
      return (
        iDate.getFullYear() === date.getFullYear() &&
        iDate.getMonth() === date.getMonth() &&
        iDate.getDate() === date.getDate()
      )
    })
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  }

  const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土']

  function renderInterviewCard(interview: InterviewWithDetails) {
    return (
      <div
        key={interview.id}
        className="p-3 bg-white rounded-lg border border-slate-200 hover:border-primary cursor-pointer transition-colors"
        onClick={() => navigate(`/job-seekers/${interview.application?.id}`)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">{formatTime(interview.scheduled_at)}</span>
            {interview.conducted_at ? (
              <Badge variant="success">実施済み</Badge>
            ) : (
              <Badge variant="info">予定</Badge>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <User className="w-3 h-3 text-slate-400" />
          <span className="text-sm text-slate-700">{interview.application?.job_seeker?.name}</span>
          <span className="text-xs text-slate-400">{interview.application?.job_seeker?.phone}</span>
        </div>
        {interview.application?.coordinator && (
          <p className="mt-1 text-xs text-slate-500">
            担当: {interview.application.coordinator.name}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header title="面談予定" />

      <div className="p-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              今日
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold text-slate-800 ml-2">
              {viewMode === 'day'
                ? formatDate(currentDate.toISOString())
                : `${formatDate(getWeekDays()[0].toISOString())} 〜 ${formatDate(getWeekDays()[6].toISOString())}`}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'day' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setViewMode('day')}
            >
              日別
            </button>
            <button
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'week' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setViewMode('week')}
            >
              週別
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : viewMode === 'day' ? (
          /* Day View */
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-slate-800">
                {formatDate(currentDate.toISOString())}（{DAY_NAMES[currentDate.getDay()]}）
              </h3>
              <span className="text-sm text-slate-500">
                {getInterviewsForDate(currentDate).length}件
              </span>
            </div>
            {getInterviewsForDate(currentDate).length > 0 ? (
              <div className="space-y-2">
                {getInterviewsForDate(currentDate).map(renderInterviewCard)}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500">
                この日の面談予定はありません
              </div>
            )}
          </Card>
        ) : (
          /* Week View */
          <div className="grid grid-cols-7 gap-2">
            {getWeekDays().map((day) => {
              const dayInterviews = getInterviewsForDate(day)
              const isToday =
                day.toDateString() === new Date().toDateString()

              return (
                <div key={day.toISOString()} className="min-h-[200px]">
                  <div
                    className={`text-center py-2 rounded-t-lg text-sm font-medium ${
                      isToday ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div>{DAY_NAMES[day.getDay()]}</div>
                    <div className="text-lg">{day.getDate()}</div>
                  </div>
                  <div className="border border-t-0 border-slate-200 rounded-b-lg p-1 space-y-1">
                    {dayInterviews.length > 0 ? (
                      dayInterviews.map((interview) => (
                        <div
                          key={interview.id}
                          className={`p-1.5 rounded text-xs cursor-pointer transition-colors ${
                            interview.conducted_at
                              ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                              : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                          }`}
                          onClick={() => navigate(`/job-seekers/${interview.application?.id}`)}
                        >
                          <div className="font-medium">{formatTime(interview.scheduled_at)}</div>
                          <div className="text-slate-600 truncate">
                            {interview.application?.job_seeker?.name}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-slate-400">-</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
