import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Check, AlertCircle } from 'lucide-react'
import { Card, Button, Input, Select } from '../../components/ui'
import { Header } from '../../components/layout'
import { supabase } from '../../lib/supabase'

interface CompanySuggestion {
  id: string
  name: string
  job_count: number
}

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

const BUSINESS_TYPES = [
  '製造業派遣',
  '物流派遣',
  '倉庫・軽作業派遣',
  '建設・土木派遣',
  '食品加工派遣',
  '介護・福祉派遣',
  'オフィスワーク派遣',
  'その他',
]

interface CompanyFormData {
  name: string
  business_type?: string
  postal_code?: string
  prefecture?: string
  city?: string
  address?: string
  phone?: string
  email?: string
  contact_person?: string
  notes?: string
}

const companySchema = z.object({
  name: z.string().min(1, '会社名は必須です'),
  business_type: z.string().optional(),
  postal_code: z.string().optional(),
  prefecture: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  contact_person: z.string().optional(),
  notes: z.string().optional(),
})

export function CompanyNewPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  })

  const searchCompanies = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const { data } = await supabase
      .from('companies')
      .select('id, name, jobs(id)')
      .ilike('name', `%${query}%`)
      .eq('is_active', true)
      .limit(8)

    if (data && data.length > 0) {
      setSuggestions(
        data.map((c: any) => ({
          id: c.id,
          name: c.name,
          job_count: c.jobs?.length || 0,
        }))
      )
      setShowSuggestions(true)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  // クリック外でサジェストを閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const nameField = register('name')
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    nameField.onChange(e)
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchCompanies(value), 300)
  }

  async function onSubmit(data: CompanyFormData) {
    setSubmitting(true)

    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name: data.name,
        business_type: data.business_type || null,
        postal_code: data.postal_code || null,
        prefecture: data.prefecture || null,
        city: data.city || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        contact_person: data.contact_person || null,
        notes: data.notes || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating company:', error)
      alert('登録に失敗しました')
      setSubmitting(false)
      return
    }

    navigate(`/companies/${company.id}`)
  }

  return (
    <div>
      <Header title="派遣会社登録" />

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Basic Info */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">基本情報</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative" ref={suggestionsRef}>
              <Input
                label="会社名 *"
                {...nameField}
                onChange={handleNameChange}
                onFocus={(e) => { if (e.target.value.length >= 1) setShowSuggestions(suggestions.length > 0) }}
                error={errors.name?.message}
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs text-amber-600 font-medium">類似する会社が登録済みです</span>
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full px-3 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-b-0"
                      onClick={() => {
                        if (confirm(`「${s.name}」は既に登録されています。\n詳細ページを開きますか？`)) {
                          navigate(`/companies/${s.id}`)
                        }
                        setShowSuggestions(false)
                      }}
                    >
                      <span className="text-sm font-medium text-slate-700">{s.name}</span>
                      <span className="text-xs text-slate-400">求人 {s.job_count}件</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Select
              label="業種"
              options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))}
              placeholder="選択してください"
              {...register('business_type')}
            />
            <Input
              label="担当者名"
              {...register('contact_person')}
            />
            <Input
              label="電話番号"
              {...register('phone')}
            />
            <Input
              label="メールアドレス"
              type="email"
              {...register('email')}
              error={errors.email?.message}
            />
          </div>
        </Card>

        {/* Address */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">所在地</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="郵便番号"
              placeholder="1234567"
              {...register('postal_code')}
            />
            <Select
              label="都道府県"
              options={PREFECTURES.map((p) => ({ value: p, label: p }))}
              placeholder="選択してください"
              {...register('prefecture')}
            />
            <Input
              label="市区町村"
              {...register('city')}
            />
            <Input
              label="番地・建物名"
              {...register('address')}
            />
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="報酬体系や特記事項など..."
          />
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/companies')}
          >
            キャンセル
          </Button>
          <Button type="submit" isLoading={submitting}>
            <Check className="w-4 h-4 mr-2" />
            登録する
          </Button>
        </div>
      </form>
    </div>
  )
}
