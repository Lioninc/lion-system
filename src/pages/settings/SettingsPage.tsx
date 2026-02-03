import { Link } from 'react-router-dom'
import { Users, Building, Database, Bell } from 'lucide-react'
import { Card } from '../../components/ui'
import { Header } from '../../components/layout'
import { useAuthStore } from '../../stores/authStore'

export function SettingsPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const settingsItems = [
    {
      title: 'ユーザー管理',
      description: '従業員の追加・編集・権限管理',
      icon: Users,
      href: '/settings/users',
      adminOnly: true,
    },
    {
      title: '流入元管理',
      description: '応募の流入元を管理',
      icon: Database,
      href: '/settings/sources',
      adminOnly: false,
    },
    {
      title: 'テナント設定',
      description: '会社情報の設定',
      icon: Building,
      href: '/settings/tenant',
      adminOnly: true,
    },
    {
      title: '通知設定',
      description: '通知のオン/オフ設定',
      icon: Bell,
      href: '/settings/notifications',
      adminOnly: false,
    },
  ]

  const visibleItems = settingsItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div>
      <Header title="設定" />

      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map((item) => {
            const Icon = item.icon
            return (
              <Link key={item.href} to={item.href}>
                <Card className="p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer h-full">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{item.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
