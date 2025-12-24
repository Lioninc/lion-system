import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // テーブル一覧を取得してみる
    const { data, error } = await supabase
      .from('candidates')
      .select('count')
      .limit(1)

    if (error) {
      // テーブルが存在しない場合でも接続自体は成功
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          message: 'Supabase接続成功（テーブル未作成）',
          details: 'candidatesテーブルが存在しません。DBスキーマを作成してください。'
        })
      }

      return NextResponse.json({
        success: false,
        message: 'Supabaseエラー',
        error: error.message,
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase接続成功',
      data
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: '接続エラー',
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}
