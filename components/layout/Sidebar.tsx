'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
  { href: '/dashboard', icon: '🏠', label: 'ダッシュボード' },
  { href: '/candidates', icon: '👤', label: '求職者一覧' },
  { href: '/interviews', icon: '💬', label: '面談一覧' },
  { href: '/introductions', icon: '🏢', label: '紹介一覧' },
  { href: '/payments', icon: '💰', label: '入金一覧' },
  { href: '/calendar', icon: '📅', label: 'カレンダー' },
  { href: '/funnel', icon: '📊', label: '歩留確認' },
  { href: '/attack-list', icon: '📋', label: 'アタックリスト' },
  { href: '/companies', icon: '🏭', label: '企業管理' },
  { href: '/jobs', icon: '📝', label: '案件管理' },
]

const settingsItems = [
  { href: '/employees', icon: '👥', label: '担当者管理' },
  { href: '/sources', icon: '📢', label: '媒体管理' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] bg-[#1e293b] text-white flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold">
          <span>🦁</span>
          <span>Lion System</span>
        </Link>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                isActive
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          )
        })}

        {/* 設定グループ */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="px-4 py-2 text-xs text-slate-500 uppercase tracking-wider">
            設定
          </div>
          {settingsItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
        © 2024 Lion System
      </div>
    </aside>
  )
}
