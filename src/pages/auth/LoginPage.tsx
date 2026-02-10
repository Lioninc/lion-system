import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Card } from '../../components/ui'
import { useAuthStore } from '../../stores/authStore'

const loginSchema = z.object({
  employeeId: z.string().min(1, '社員番号を入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
})

type LoginFormData = z.infer<typeof loginSchema>

// 社員番号からメールアドレスを生成
function employeeIdToEmail(employeeId: string): string {
  return `emp${employeeId}@example.com`
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError(null)

    // 社員番号をメールアドレスに変換してログイン
    const email = employeeIdToEmail(data.employeeId)
    const result = await login(email, data.password)

    if (result.success) {
      navigate('/')
    } else {
      setError('社員番号またはパスワードが正しくありません')
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" padding="lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-xl mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl font-bold text-white">R</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">RION System</h1>
          <p className="text-slate-500 mt-2">人材紹介管理システム</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="社員番号"
            type="text"
            placeholder="001"
            error={errors.employeeId?.message}
            {...register('employeeId')}
          />

          <Input
            label="パスワード"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isLoading}
          >
            ログイン
          </Button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 RION System. All rights reserved.
        </p>
      </Card>
    </div>
  )
}
