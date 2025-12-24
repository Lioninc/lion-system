'use client'

import { useState } from 'react'
import { Card, Badge } from '@/components/ui'

// デモデータ
const demoEvents = [
  { date: '2024-12-23', type: '面談', title: '田中太郎', time: '10:00' },
  { date: '2024-12-23', type: '企業面接', title: '佐藤次郎 - 株式会社ABC', time: '14:00' },
  { date: '2024-12-24', type: '面談', title: '高橋三郎', time: '11:00' },
  { date: '2024-12-25', type: '企業面接', title: '田中太郎 - 株式会社ABC', time: '10:00' },
  { date: '2024-12-26', type: '面談', title: '伊藤四郎', time: '15:00' },
  { date: '2024-12-27', type: '面談', title: '渡辺五郎', time: '09:00' },
]

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

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth)

  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

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

  const getEventsForDate = (date: string) => {
    return demoEvents.filter((event) => event.date === date)
  }

  const formatDate = (day: number) => {
    const month = (currentMonth + 1).toString().padStart(2, '0')
    const dayStr = day.toString().padStart(2, '0')
    return `${currentYear}-${month}-${dayStr}`
  }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : []

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
              const events = getEventsForDate(dateStr)
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
                  className={`p-2 min-h-[80px] text-left rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
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
                  {events.slice(0, 2).map((event, i) => (
                    <div
                      key={i}
                      className={`text-xs px-1 py-0.5 rounded mb-0.5 truncate ${
                        event.type === '面談'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-xs text-slate-400">
                      +{events.length - 2}件
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </Card>

        {/* 選択日の予定 */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            {selectedDate
              ? `${selectedDate.replace(/-/g, '/')}の予定`
              : '日付を選択してください'}
          </h2>
          {selectedDate && selectedEvents.length > 0 ? (
            <div className="space-y-3">
              {selectedEvents.map((event, index) => (
                <div
                  key={index}
                  className="p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-600">
                      {event.time}
                    </span>
                    <Badge
                      variant={event.type === '面談' ? 'info' : 'purple'}
                    >
                      {event.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-800">{event.title}</p>
                </div>
              ))}
            </div>
          ) : selectedDate ? (
            <p className="text-sm text-slate-500">予定はありません</p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
