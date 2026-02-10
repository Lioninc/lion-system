/**
 * 紹介データのステータス分布を確認するスクリプト
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 紹介データのステータス分布を確認中...\n')

  // 全件数
  const { count: total } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 全紹介件数: ${total}`)

  // ステータス別件数
  const { data: referrals } = await supabase
    .from('referrals')
    .select('referral_status')

  const statusCounts: Record<string, number> = {}
  referrals?.forEach(r => {
    statusCounts[r.referral_status] = (statusCounts[r.referral_status] || 0) + 1
  })

  console.log('\n📈 ステータス別件数:')
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })

  // ダッシュボードのフィルター条件で件数確認
  const inProgressStatuses = [
    'referred',
    'interview_scheduled',
    'interview_done',
    'dispatch_interview_scheduled',
    'dispatch_interview_done'
  ]

  const { count: inProgressCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .in('referral_status', inProgressStatuses)

  console.log(`\n🎯 進行中（ダッシュボード条件）: ${inProgressCount}`)

  // 終了ステータスの件数
  const finalStatuses = ['hired', 'pre_assignment', 'assigned', 'working', 'cancelled', 'declined']
  const finalCount = finalStatuses.reduce((sum, status) => sum + (statusCounts[status] || 0), 0)
  console.log(`✅ 終了ステータス合計: ${finalCount}`)

  console.log('\n✅ 確認完了!')
}

main()
