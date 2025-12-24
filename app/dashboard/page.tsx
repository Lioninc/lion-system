import { Card } from '@/components/ui'

// デモデータ
const stats = [
  { label: '今月の成約数', value: '12', icon: '📈', color: 'text-blue-600' },
  { label: '今月の売上', value: '¥3,600,000', icon: '💰', color: 'text-emerald-600' },
  { label: '面談待ち', value: '8', icon: '💬', color: 'text-amber-600' },
  { label: '本日のアタック', value: '15', icon: '📋', color: 'text-purple-600' },
]

const todaySchedule = [
  { time: '10:00', type: '面談', candidate: '田中太郎', employee: '山田花子' },
  { time: '14:00', type: '企業面接', candidate: '佐藤次郎', company: '株式会社ABC' },
  { time: '16:00', type: '面談', candidate: '鈴木三郎', employee: '山田花子' },
]

const recentHires = [
  { date: '2024/12/20', candidate: '高橋四郎', company: '株式会社XYZ', fee: '¥300,000' },
  { date: '2024/12/18', candidate: '伊藤五郎', company: '株式会社DEF', fee: '¥350,000' },
  { date: '2024/12/15', candidate: '渡辺六郎', company: '株式会社GHI', fee: '¥280,000' },
]

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">ダッシュボード</h1>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="flex items-center gap-4">
            <div className="text-3xl">{stat.icon}</div>
            <div>
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 今日の予定 */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">今日の予定</h2>
          {todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((schedule, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="text-sm font-medium text-slate-600 w-14">
                    {schedule.time}
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      schedule.type === '面談'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {schedule.type}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">
                      {schedule.candidate}
                    </p>
                    <p className="text-xs text-slate-500">
                      {schedule.employee || schedule.company}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">本日の予定はありません</p>
          )}
        </Card>

        {/* 最近の成約 */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">最近の成約</h2>
          {recentHires.length > 0 ? (
            <div className="space-y-3">
              {recentHires.map((hire, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {hire.candidate}
                    </p>
                    <p className="text-xs text-slate-500">
                      {hire.company} / {hire.date}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-emerald-600">
                    {hire.fee}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">最近の成約はありません</p>
          )}
        </Card>
      </div>
    </div>
  )
}
