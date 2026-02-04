/**
 * テストデータを削除するスクリプト
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🗑️  テストデータを削除します...\n')

  const tenantId = '00000000-0000-0000-0000-000000000001'

  // 売上を削除
  const { count: salesCount } = await supabase
    .from('sales')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: sales ${salesCount || 0}件`)

  // 紹介を削除
  const { count: referralsCount } = await supabase
    .from('referrals')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: referrals ${referralsCount || 0}件`)

  // 面談を削除
  const { count: interviewsCount } = await supabase
    .from('interviews')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: interviews ${interviewsCount || 0}件`)

  // 対応記録を削除
  const { count: contactLogsCount } = await supabase
    .from('contact_logs')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: contact_logs ${contactLogsCount || 0}件`)

  // 応募を削除
  const { count: applicationsCount } = await supabase
    .from('applications')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: applications ${applicationsCount || 0}件`)

  // 求職者を削除
  const { count: jobSeekersCount } = await supabase
    .from('job_seekers')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: job_seekers ${jobSeekersCount || 0}件`)

  // 求人を削除
  const { count: jobsCount } = await supabase
    .from('jobs')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: jobs ${jobsCount || 0}件`)

  // 会社を削除
  const { count: companiesCount } = await supabase
    .from('companies')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: companies ${companiesCount || 0}件`)

  // 流入元を削除
  const { count: sourcesCount } = await supabase
    .from('sources')
    .delete()
    .eq('tenant_id', tenantId)
    .select('*', { count: 'exact', head: true })
  console.log(`削除: sources ${sourcesCount || 0}件`)

  console.log('\n✅ テストデータ削除完了!')
}

main()
