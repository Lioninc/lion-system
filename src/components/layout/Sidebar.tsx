import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  Users,
  Building2,
  Briefcase,
  DollarSign,
  BarChart3,
  Settings,
  FileText,
  Send,
  Calendar,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/authStore'

interface MenuItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  roles?: string[]
}

const mainMenuItems: MenuItem[] = [
  { href: '/', icon: Home, label: 'ダッシュボード' },
  { href: '/job-seekers', icon: Users, label: '求職者管理' },
  { href: '/interviews', icon: Calendar, label: '面談予定' },
  { href: '/companies', icon: Building2, label: '派遣会社管理' },
  { href: '/jobs', icon: Briefcase, label: '求人管理' },
  { href: '/referrals', icon: Send, label: '紹介管理' },
  { href: '/sales', icon: DollarSign, label: '売上・入金' },
  { href: '/reports', icon: BarChart3, label: 'レポート' },
]

const settingsMenuItems: MenuItem[] = [
  { href: '/reports/legal', icon: FileText, label: '法定帳票' },
  { href: '/settings', icon: Settings, label: '設定', roles: ['super_admin', 'admin'] },
]

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuthStore()

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  const canAccess = (roles?: string[]) => {
    if (!roles) return true
    if (!user) return false
    return roles.includes(user.role)
  }

  const handleLinkClick = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <aside className="h-screen w-60 bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" onClick={handleLinkClick}>
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-xl font-bold">R</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">RION System</h1>
            <p className="text-xs text-slate-400">人材紹介管理</p>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-4 mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">メインメニュー</p>
        </div>
        {mainMenuItems.map((item) => {
          if (!canAccess(item.roles)) return null
          const isActive = isActiveRoute(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          )
        })}

        {/* Settings Menu */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="px-4 mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider">その他</p>
          </div>
          {settingsMenuItems.map((item) => {
            if (!canAccess(item.roles)) return null
            const isActive = isActiveRoute(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium">{user.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
