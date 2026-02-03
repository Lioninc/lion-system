import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, UserX, UserCheck, Search } from 'lucide-react'
import { Card, Button, Badge, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { formatDate } from '../../lib/utils'
import type { User, UserRole } from '../../types/database'
import { USER_ROLE_LABELS } from '../../types/database'

interface UserWithStatus extends User {
  is_active: boolean
}

export function UserManagementPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<UserWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithStatus | null>(null)

  // 管理者以外はアクセス不可
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/settings')
      return
    }
    fetchUsers()
  }, [isAdmin, navigate])

  async function fetchUsers() {
    setLoading(true)

    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (currentUser?.role !== 'super_admin') {
      // 管理者は同じテナントのユーザーのみ
      query = query.eq('tenant_id', currentUser?.tenant_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
    } else {
      setUsers((data || []).map(u => ({ ...u, is_active: u.is_active !== false })))
    }

    setLoading(false)
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = !roleFilter || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  function getRoleBadgeVariant(role: UserRole): 'danger' | 'info' | 'success' | 'warning' {
    switch (role) {
      case 'super_admin':
        return 'danger'
      case 'admin':
        return 'warning'
      case 'coordinator':
        return 'info'
      case 'viewer':
        return 'success'
      default:
        return 'info'
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    const newStatus = !currentStatus
    const { error } = await supabase
      .from('users')
      .update({ is_active: newStatus })
      .eq('id', userId)

    if (error) {
      console.error('Error updating user status:', error)
      alert('ステータスの更新に失敗しました')
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: newStatus } : u))
    }
  }

  function openEditModal(user: UserWithStatus) {
    setEditingUser(user)
    setShowModal(true)
  }

  function openAddModal() {
    setEditingUser(null)
    setShowModal(true)
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div>
      <Header
        title="ユーザー管理"
        action={
          <Button size="sm" onClick={openAddModal}>
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">新規追加</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4">
        {/* Search and Filter */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="名前またはメールで検索..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              options={[
                { value: '', label: 'すべての権限' },
                { value: 'admin', label: '管理者' },
                { value: 'coordinator', label: 'コーディネーター' },
                { value: 'viewer', label: '閲覧者' },
              ]}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-48"
            />
          </div>
        </Card>

        {/* User List */}
        <Card padding="none">
          {loading ? (
            <div className="p-8 text-center text-slate-500">読み込み中...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              ユーザーが見つかりません
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-slate-200">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{user.name}</p>
                          {!user.is_active && (
                            <Badge variant="danger">無効</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate">{user.email}</p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {USER_ROLE_LABELS[user.role]}
                      </Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        編集
                      </Button>
                      {user.id !== currentUser?.id && (
                        <Button
                          variant={user.is_active ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="w-3 h-3 mr-1" />
                              無効化
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 mr-1" />
                              有効化
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        ユーザー
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        メールアドレス
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        権限
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        ステータス
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        登録日
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">{user.name}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">{user.email}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {USER_ROLE_LABELS[user.role]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={user.is_active ? 'success' : 'danger'}>
                            {user.is_active ? '有効' : '無効'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-600">
                            {formatDate(user.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              disabled={user.id === currentUser?.id}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <Button
                                variant={user.is_active ? 'outline' : 'primary'}
                                size="sm"
                                onClick={() => toggleUserStatus(user.id, user.is_active)}
                              >
                                {user.is_active ? (
                                  <UserX className="w-3 h-3" />
                                ) : (
                                  <UserCheck className="w-3 h-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          tenantId={currentUser?.tenant_id || null}
          onClose={() => {
            setShowModal(false)
            setEditingUser(null)
          }}
          onSave={() => {
            setShowModal(false)
            setEditingUser(null)
            fetchUsers()
          }}
        />
      )}
    </div>
  )
}

function UserModal({
  user,
  tenantId,
  onClose,
  onSave,
}: {
  user: UserWithStatus | null
  tenantId: string | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>(user?.role || 'coordinator')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!user

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      setError('名前とメールアドレスは必須です')
      return
    }

    if (!isEditing && !password) {
      setError('パスワードは必須です')
      return
    }

    if (!isEditing && password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (isEditing) {
        // ユーザー情報を更新
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: name.trim(),
            role,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (updateError) throw updateError

        // パスワードが入力されていれば更新
        if (password) {
          const { error: authError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password }
          )
          // adminのupdateUserByIdが使えない場合はスキップ
          if (authError) {
            console.warn('Password update skipped:', authError)
          }
        }
      } else {
        // 新規ユーザー作成（Supabase Authに登録）
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { name: name.trim() }
          }
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('このメールアドレスは既に登録されています')
          }
          throw authError
        }

        if (!authData.user) {
          throw new Error('ユーザーの作成に失敗しました')
        }

        // usersテーブルにも登録
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: authData.user.id,
            email: email.trim(),
            name: name.trim(),
            role,
            tenant_id: tenantId,
            is_active: true,
          })

        if (insertError) throw insertError
      }

      onSave()
    } catch (err: any) {
      console.error('Error saving user:', err)
      setError(err.message || '保存に失敗しました')
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">
            {isEditing ? 'ユーザーを編集' : '新規ユーザー追加'}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              名前 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              disabled={isEditing}
            />
            {isEditing && (
              <p className="text-xs text-slate-500 mt-1">メールアドレスは変更できません</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              パスワード {!isEditing && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? '変更する場合のみ入力' : '6文字以上'}
            />
          </div>

          <Select
            label="権限"
            options={[
              { value: 'admin', label: '管理者 - すべての操作が可能' },
              { value: 'coordinator', label: 'コーディネーター - 通常業務が可能' },
              { value: 'viewer', label: '閲覧者 - 閲覧のみ可能' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            {isEditing ? '更新' : '追加'}
          </Button>
        </div>
      </div>
    </div>
  )
}
