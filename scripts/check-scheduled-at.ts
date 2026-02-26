import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

async function main() {
  // サンプル10件
  const { data } = await supabase
    .from('interviews')
    .select('id, scheduled_at, conducted_at, result')
    .order('scheduled_at', { ascending: false })
    .limit(10)

  console.log('=== 最新10件のscheduled_at ===')
  data?.forEach(iv => {
    console.log(`  ${iv.scheduled_at} | result=${iv.result}`)
  })

  // 時間あり/なしの内訳
  const { data: all } = await supabase
    .from('interviews')
    .select('scheduled_at')

  let withTime = 0, dateOnly = 0
  all?.forEach(iv => {
    if (iv.scheduled_at?.includes('T')) withTime++
    else dateOnly++
  })
  console.log(`\n=== 内訳 ===`)
  console.log(`  時間あり(T含む): ${withTime}`)
  console.log(`  日付のみ: ${dateOnly}`)
  console.log(`  合計: ${(all?.length || 0)}`)

  // 今週のデータ
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: thisWeek } = await supabase
    .from('interviews')
    .select('scheduled_at, result')
    .gte('scheduled_at', monday.toISOString())
    .lte('scheduled_at', sunday.toISOString())
    .order('scheduled_at')

  console.log(`\n=== 今週 (${monday.toISOString().split('T')[0]} ~ ${sunday.toISOString().split('T')[0]}) ===`)
  console.log(`  件数: ${thisWeek?.length || 0}`)
  thisWeek?.slice(0, 5).forEach(iv => {
    console.log(`  ${iv.scheduled_at} | ${iv.result}`)
  })
}

main()
