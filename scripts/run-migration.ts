/**
 * Supabase DBにマイグレーションを実行するスクリプト
 * DB直接接続またはSupabase Management APIを使用
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')

const MIGRATIONS = [
  'ALTER TABLE referrals ADD COLUMN IF NOT EXISTS work_month DATE',
]

async function trySupabaseAPI() {
  // Try Supabase pg/query endpoint (available in newer versions)
  for (const sql of MIGRATIONS) {
    console.log('Running:', sql.substring(0, 60) + '...')
    const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'exec', args: { sql } }),
    })
    if (resp.ok) {
      console.log('  OK')
    } else {
      const text = await resp.text()
      console.log('  Failed:', resp.status, text.substring(0, 100))
      return false
    }
  }
  return true
}

async function tryPgDirect() {
  // Try connecting with pg module using common Supabase connection patterns
  try {
    const { default: pg } = await import('pg')
    const passwords = [
      serviceKey,
      process.env.SUPABASE_DB_PASSWORD || '',
    ].filter(Boolean)

    for (const password of passwords) {
      for (const host of [
        `db.${projectRef}.supabase.co`,
        `aws-0-ap-northeast-1.pooler.supabase.com`,
      ]) {
        for (const port of [5432, 6543]) {
          try {
            console.log(`Trying ${host}:${port}...`)
            const client = new pg.Client({
              host,
              port,
              database: 'postgres',
              user: `postgres.${projectRef}`,
              password,
              ssl: { rejectUnauthorized: false },
              connectionTimeoutMillis: 5000,
            })
            await client.connect()
            console.log('Connected!')
            for (const sql of MIGRATIONS) {
              console.log('Running:', sql.substring(0, 60) + '...')
              await client.query(sql)
              console.log('  OK')
            }
            await client.end()
            return true
          } catch (e: any) {
            console.log(`  Failed: ${e.message?.substring(0, 80)}`)
          }
        }
      }
    }
  } catch (e: any) {
    console.log('pg module error:', e.message)
  }
  return false
}

async function main() {
  console.log('=== Supabase Migration Runner ===')
  console.log('Project:', projectRef)
  console.log('')

  // Try API first
  console.log('--- Trying Supabase API ---')
  if (await trySupabaseAPI()) {
    console.log('\nMigration completed via API!')
    return
  }

  console.log('\n--- Trying direct PG connection ---')
  if (await tryPgDirect()) {
    console.log('\nMigration completed via PG!')
    return
  }

  console.log('\n--- Manual migration required ---')
  console.log('Please run the following SQL in the Supabase SQL Editor:')
  console.log('(https://supabase.com/dashboard/project/' + projectRef + '/sql)')
  console.log('')
  for (const sql of MIGRATIONS) {
    console.log(sql + ';')
  }
}

main()
