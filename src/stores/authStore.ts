import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User } from '../types/database'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          // Supabase Auth でログイン
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (authError) {
            return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' }
          }

          if (!authData.user) {
            return { success: false, error: 'ログインに失敗しました' }
          }

          // usersテーブルからユーザー情報を取得
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single()

          if (userError || !userData) {
            // usersテーブルにない場合はログアウト
            await supabase.auth.signOut()
            return { success: false, error: 'ユーザー情報が見つかりません' }
          }

          set({
            user: userData as User,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true }
        } catch (error) {
          console.error('Login error:', error)
          return { success: false, error: 'ログイン中にエラーが発生しました' }
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      checkAuth: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()

          if (!session) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          // usersテーブルからユーザー情報を取得
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (error || !userData) {
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          set({
            user: userData as User,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          console.error('Check auth error:', error)
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
