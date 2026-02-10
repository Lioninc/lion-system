/**
 * jobsテーブルのカラムを確認するスクリプト
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase.from('jobs').select('*').limit(1)
  if (error) {
    console.log('Error:', error)
  } else {
    console.log('Jobs columns:', Object.keys(data?.[0] || {}))
    console.log('Sample data:', JSON.stringify(data?.[0], null, 2))
  }
}

main()
