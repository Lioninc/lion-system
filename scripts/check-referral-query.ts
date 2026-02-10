/**
 * 紹介管理ページのクエリをデバッグするスクリプト
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  console.log('🔍 紹介管理ページのクエリをテスト中...\n')

  // Step 1: シンプルなクエリ
  console.log('=== Step 1: シンプルなreferralsクエリ ===')
  const { data: simple, error: simpleError, count: simpleCount } = await supabase
    .from('referrals')
    .select('*', { count: 'exact' })
    .limit(5)

  if (simpleError) {
    console.log('❌ エラー:', simpleError)
  } else {
    console.log(`✅ 件数: ${simpleCount}`)
    console.log('サンプル:', simple?.[0])
  }

  // Step 2: application結合のみ
  console.log('\n=== Step 2: application結合 ===')
  const { data: withApp, error: appError } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_status,
      application:applications (
        id
      )
    `)
    .limit(5)

  if (appError) {
    console.log('❌ エラー:', appError)
  } else {
    console.log(`✅ 件数: ${withApp?.length}`)
    console.log('サンプル:', withApp?.[0])
  }

  // Step 3: job_seeker結合
  console.log('\n=== Step 3: job_seeker結合 ===')
  const { data: withJs, error: jsError } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_status,
      application:applications (
        id,
        job_seeker:job_seekers (
          id,
          name
        )
      )
    `)
    .limit(5)

  if (jsError) {
    console.log('❌ エラー:', jsError)
  } else {
    console.log(`✅ 件数: ${withJs?.length}`)
    console.log('サンプル:', withJs?.[0])
  }

  // Step 4: coordinator結合（問題の可能性）
  console.log('\n=== Step 4: coordinator結合 ===')
  const { data: withCoord, error: coordError } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_status,
      application:applications (
        id,
        coordinator:users!applications_coordinator_id_fkey (
          id,
          name
        )
      )
    `)
    .limit(5)

  if (coordError) {
    console.log('❌ エラー:', coordError)
  } else {
    console.log(`✅ 件数: ${withCoord?.length}`)
    console.log('サンプル:', withCoord?.[0])
  }

  // Step 5: job結合
  console.log('\n=== Step 5: job結合 ===')
  const { data: withJob, error: jobError } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_status,
      job:jobs (
        id,
        title
      )
    `)
    .limit(5)

  if (jobError) {
    console.log('❌ エラー:', jobError)
  } else {
    console.log(`✅ 件数: ${withJob?.length}`)
    console.log('サンプル:', withJob?.[0])
  }

  // Step 6: company結合
  console.log('\n=== Step 6: company結合 ===')
  const { data: withCompany, error: companyError } = await supabase
    .from('referrals')
    .select(`
      id,
      referral_status,
      job:jobs (
        id,
        title,
        company:companies (
          id,
          name
        )
      )
    `)
    .limit(5)

  if (companyError) {
    console.log('❌ エラー:', companyError)
  } else {
    console.log(`✅ 件数: ${withCompany?.length}`)
    console.log('サンプル:', withCompany?.[0])
  }

  // Step 7: 完全なクエリ（修正後）
  console.log('\n=== Step 7: 完全なクエリ（修正後） ===')
  const { data: full, error: fullError } = await supabase
    .from('referrals')
    .select(`
      *,
      application:applications (
        id,
        job_seeker:job_seekers (
          id,
          name,
          phone
        ),
        coordinator:users!applications_coordinator_id_fkey (
          id,
          name
        )
      ),
      job:jobs (
        id,
        title,
        company:companies (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  if (fullError) {
    console.log('❌ エラー:', fullError)
  } else {
    console.log(`✅ 件数: ${full?.length}`)
    console.log('サンプル:', JSON.stringify(full?.[0], null, 2))
  }

  console.log('\n✅ デバッグ完了!')
}

main()
