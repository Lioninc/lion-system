/**
 * 担当者別応募件数を確認するスクリプト
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: 環境変数を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('📊 担当者別応募件数を集計中...\n')

  // 全応募データを取得（ページング対応）
  const allApplications: { coordinator_id: string | null }[] = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const { data: batch } = await supabase
      .from('applications')
      .select('coordinator_id')
      .range(offset, offset + pageSize - 1)

    if (!batch || batch.length === 0) break
    allApplications.push(...batch)
    offset += batch.length
    if (batch.length < pageSize) break
  }

  console.log(`📝 総応募数: ${allApplications.length}件\n`)

  // ユーザー情報を取得
  const { data: users } = await supabase
    .from('users')
    .select('id, name')

  const userMap = new Map<string, string>()
  users?.forEach(u => userMap.set(u.id, u.name))

  // 担当者別にカウント
  const counts: Record<string, number> = {}
  allApplications.forEach(a => {
    const name = a.coordinator_id ? (userMap.get(a.coordinator_id) || '不明') : '未設定'
    counts[name] = (counts[name] || 0) + 1
  })

  console.log('📈 担当者別応募件数:')
  console.log('='.repeat(40))
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      console.log(`   ${name}: ${count}件`)
    })

  // 設定済み件数
  const setCount = allApplications.filter(a => a.coordinator_id).length
  console.log('')
  console.log(`✅ 担当者設定済み: ${setCount}件`)
  console.log(`⚠️  未設定: ${allApplications.length - setCount}件`)
}

main()
