'use client'

import { useState, useEffect } from 'react'
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Button, Select } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Employee {
  id: string
  name: string
  email: string
  role: string
  division_id: string | null
  is_active: boolean
  employee_code: string | null
  division_name: string | null
}

interface Division {
  id: string
  name: string
}

const roleOptions = [
  { value: '', label: '選択してください' },
  { value: 'admin', label: '管理者' },
  { value: 'manager', label: 'マネージャー' },
  { value: 'staff', label: 'スタッフ' },
]

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'staff',
    division_id: '',
    employee_code: '',
    is_active: true,
  })

  useEffect(() => {
    fetchEmployees()
    fetchDivisions()
  }, [])

  async function fetchEmployees() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        email,
        role,
        division_id,
        is_active,
        employee_code,
        divisions (
          name
        )
      `)
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      setLoading(false)
      return
    }

    const formattedData: Employee[] = (data || []).map((emp: any) => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: emp.role,
      division_id: emp.division_id,
      is_active: emp.is_active ?? true,
      employee_code: emp.employee_code,
      division_name: emp.divisions?.name || null,
    }))

    setEmployees(formattedData)
    setLoading(false)
  }

  async function fetchDivisions() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('divisions')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching divisions:', error)
      return
    }

    setDivisions(data || [])
  }

  function handleOpenModal(employee?: Employee) {
    if (employee) {
      setEditingEmployee(employee)
      setFormData({
        name: employee.name,
        email: employee.email,
        role: employee.role,
        division_id: employee.division_id || '',
        employee_code: employee.employee_code || '',
        is_active: employee.is_active,
      })
    } else {
      setEditingEmployee(null)
      setFormData({
        name: '',
        email: '',
        role: 'staff',
        division_id: '',
        employee_code: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingEmployee(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      division_id: formData.division_id || null,
      employee_code: formData.employee_code || null,
      is_active: formData.is_active,
    }

    if (editingEmployee) {
      const { error } = await (supabase
        .from('employees') as any)
        .update(payload)
        .eq('id', editingEmployee.id)

      if (error) {
        console.error('Error updating employee:', error)
        alert('更新に失敗しました')
        return
      }
    } else {
      const { error } = await (supabase
        .from('employees') as any)
        .insert(payload)

      if (error) {
        console.error('Error creating employee:', error)
        alert('登録に失敗しました')
        return
      }
    }

    handleCloseModal()
    fetchEmployees()
  }

  async function handleToggleActive(employee: Employee) {
    const supabase = createClient()
    const { error } = await (supabase
      .from('employees') as any)
      .update({ is_active: !employee.is_active })
      .eq('id', employee.id)

    if (error) {
      console.error('Error toggling employee status:', error)
      alert('更新に失敗しました')
      return
    }

    fetchEmployees()
  }

  function getRoleBadge(role: string) {
    switch (role) {
      case 'admin':
        return <Badge variant="danger">管理者</Badge>
      case 'manager':
        return <Badge variant="purple">マネージャー</Badge>
      case 'staff':
        return <Badge variant="info">スタッフ</Badge>
      default:
        return <Badge>{role}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">担当者管理</h1>
        <Button onClick={() => handleOpenModal()}>新規登録</Button>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>社員コード</TableHead>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.employee_code || '-'}</TableCell>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.division_name || '-'}</TableCell>
                  <TableCell>{getRoleBadge(employee.role)}</TableCell>
                  <TableCell>
                    {employee.is_active ? (
                      <Badge variant="success">有効</Badge>
                    ) : (
                      <Badge variant="danger">無効</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(employee)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(employee)}
                        className="text-slate-600 hover:underline text-sm"
                      >
                        {employee.is_active ? '無効化' : '有効化'}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && employees.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            担当者が登録されていません
          </div>
        )}
      </Card>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editingEmployee ? '担当者を編集' : '担当者を登録'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="社員コード"
                value={formData.employee_code}
                onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                placeholder="例: EMP001"
              />
              <Input
                label="名前"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="メールアドレス"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <Select
                label="部署"
                options={[
                  { value: '', label: '選択してください' },
                  ...divisions.map((d) => ({ value: d.id, label: d.name })),
                ]}
                value={formData.division_id}
                onChange={(e) => setFormData({ ...formData, division_id: e.target.value })}
              />
              <Select
                label="役割"
                options={roleOptions}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">有効</label>
              </div>
              <div className="flex gap-2 justify-end pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  キャンセル
                </Button>
                <Button type="submit">
                  {editingEmployee ? '更新' : '登録'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
