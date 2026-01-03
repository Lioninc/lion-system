'use client'

import { useState, useEffect } from 'react'
import { Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

interface Source {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSource, setEditingSource] = useState<Source | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    is_active: true,
  })

  useEffect(() => {
    fetchSources()
  }, [])

  async function fetchSources() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error fetching sources:', error)
      setLoading(false)
      return
    }

    setSources(data || [])
    setLoading(false)
  }

  function handleOpenModal(source?: Source) {
    if (source) {
      setEditingSource(source)
      setFormData({
        name: source.name,
        is_active: source.is_active,
      })
    } else {
      setEditingSource(null)
      setFormData({
        name: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  function handleCloseModal() {
    setShowModal(false)
    setEditingSource(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    const payload = {
      name: formData.name,
      is_active: formData.is_active,
    }

    if (editingSource) {
      const { error } = await (supabase
        .from('sources') as any)
        .update(payload)
        .eq('id', editingSource.id)

      if (error) {
        console.error('Error updating source:', error)
        alert('更新に失敗しました')
        return
      }
    } else {
      const { error } = await (supabase
        .from('sources') as any)
        .insert(payload)

      if (error) {
        console.error('Error creating source:', error)
        alert('登録に失敗しました')
        return
      }
    }

    handleCloseModal()
    fetchSources()
  }

  async function handleToggleActive(source: Source) {
    const supabase = createClient()
    const { error } = await (supabase
      .from('sources') as any)
      .update({ is_active: !source.is_active })
      .eq('id', source.id)

    if (error) {
      console.error('Error toggling source status:', error)
      alert('更新に失敗しました')
      return
    }

    fetchSources()
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">媒体管理</h1>
        <Button onClick={() => handleOpenModal()}>新規登録</Button>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="p-8 text-center text-slate-500">読み込み中...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>媒体名</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    {source.is_active ? (
                      <Badge variant="success">有効</Badge>
                    ) : (
                      <Badge variant="danger">無効</Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(source.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(source)}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleToggleActive(source)}
                        className="text-slate-600 hover:underline text-sm"
                      >
                        {source.is_active ? '無効化' : '有効化'}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && sources.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            媒体が登録されていません
          </div>
        )}
      </Card>

      {/* モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editingSource ? '媒体を編集' : '媒体を登録'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="媒体名"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例: Indeed, タウンワーク"
                required
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
                  {editingSource ? '更新' : '登録'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
