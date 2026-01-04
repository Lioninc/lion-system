'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, Badge } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Interview {
  id: string
  interview_date: string
  interview_time: string | null
  interview_type: string | null
  candidate_id: string
  candidate_name: string
  interviewer_name: string | null
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function CalendarPage() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth)

  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

  useEffect(() => {
    fetchInterviews()
  }, [currentYear, currentMonth])

  async function fetchInterviews() {
    setLoading(true)
    const supabase = createClient()

    // 月の最初と最後の日付を計算
    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('interviews')
      .select(`
        id,
        interview_date,
        interview_time,
        interview_type,
        candidate_id,
        candidates:candidate_id (
          name
        ),
        employees:interviewer_id (
          name
        )
      `)
      .gte('interview_date', startDate)
      .lte('interview_date', endDate)
      .order('interview_date', { ascending: true })
      .order('interview_time', { ascending: true })

    if (error) {
      console.error('Error fetching interviews:', error)
      setLoading(false)
      return
    }

    const formattedData: Interview[] = (data || []).map((i: any) => ({
      id: i.id,
      interview_date: i.interview_date,
      interview_time: i.interview_time,
      interview_type: i.interview_type,
      candidate_id: i.candidate_id,
      candidate_name: i.candidates?.name || '',
      interviewer_name: i.employees?.name || null,
    }))

    setInterviews(formattedData)
    setLoading(false)
  }

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1)
      setCurrentMonth(11)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1)
      setCurrentMonth(0)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const getInterviewsForDate = (date: string) => {
    return interviews.filter((interview) => interview.interview_date === date)
  }

  const formatDate = (day: number) => {
    const month = (currentMonth + 1).toString().padStart(2, '0')
    const dayStr = day.toString().padStart(2, '0')
    return `${currentYear}-${month}-${dayStr}`
  }

  const formatDisplayDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-')
    return `${year}/${month}/${day}`
  }

  const getInterviewTypeBadgeVariant = (type: string | null) => {
    switch (type) {
      case '対面':
        return 'success'
      case '電話':
        return 'warning'
      case 'Web':
        return 'info'
      default:
        return 'default'
    }
  }

  const selectedInterviews = selectedDate ? getInterviewsForDate(selectedDate) : []

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">カレンダー</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* カレンダー */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors"
            >
              ←
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {currentYear}年 {currentMonth + 1}月
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-slate-100 rounded-md transition-colors"
            >
              →
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-500">読み込み中...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day, index) => (
                <div
                  key={day}
                  className={`text-center py-2 text-sm font-medium ${
                    index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-slate-600'
                  }`}
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="p-2" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dateStr = formatDate(day)
                const dayInterviews = getInterviewsForDate(dateStr)
                const hasInterviews = dayInterviews.length > 0
                const isToday =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear()
                const isSelected = dateStr === selectedDate
                const dayOfWeek = (firstDayOfMonth + index) % 7

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-2 min-h-[80px] text-left rounded-md transition-colors relative ${
                      isSelected
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : hasInterviews
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`text-sm font-medium mb-1 ${
                          isToday
                            ? 'w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center'
                            : dayOfWeek === 0
                            ? 'text-red-500'
                            : dayOfWeek === 6
                            ? 'text-blue-500'
                            : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </div>
                      {hasInterviews && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    {dayInterviews.slice(0, 2).map((interview, i) => (
                      <div
                        key={i}
                        className="text-xs px-1 py-0.5 rounded mb-0.5 truncate bg-blue-100 text-blue-700"
                      >
                        {interview.interview_time ? `${interview.interview_time.slice(0, 5)} ` : ''}
                        {interview.candidate_name}
                      </div>
                    ))}
                    {dayInterviews.length > 2 && (
                      <div className="text-xs text-slate-400">
                        +{dayInterviews.length - 2}件
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* 選択日の予定 */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {selectedDate
              ? `${formatDisplayDate(selectedDate)}の面談`
              : '日付を選択してください'}
          </h2>
          {selectedDate && selectedInterviews.length > 0 ? (
            <div className="space-y-3">
              {selectedInterviews.map((interview) => (
                <div
                  key={interview.id}
                  className="p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-slate-600">
                      {interview.interview_time ? interview.interview_time.slice(0, 5) : '時間未定'}
                    </span>
                    <Badge variant={getInterviewTypeBadgeVariant(interview.interview_type) as any}>
                      {interview.interview_type || '未設定'}
                    </Badge>
                  </div>
                  <Link
                    href={`/candidates/${interview.candidate_id}`}
                    className="text-sm font-medium text-blue-600 hover:underline block mb-1"
                  >
                    {interview.candidate_name}
                  </Link>
                  {interview.interviewer_name && (
                    <p className="text-xs text-slate-500">
                      担当: {interview.interviewer_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : selectedDate ? (
            <p className="text-sm text-slate-500">面談予定はありません</p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
