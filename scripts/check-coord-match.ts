import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')

async function main() {
  const { data: users } = await supabase.from('users').select('id, name')
  if (users === null) return

  const coordMap = new Map<string, string>()
  users.forEach((u: any) => coordMap.set(u.name, u.id))

  function findCoord(lastName: string): string | null {
    if (!lastName) return null
    if (coordMap.has(lastName)) return coordMap.get(lastName) || null
    const match = users.filter((u: any) => u.name.startsWith(lastName))
    if (match.length === 1) return match[0].id
    return null
  }

  const csvNames = ['神尾', '酒本', '林', '田原', '西村', '植平', '山本', '浅川', '山田', '山口', '松枝', '富岡', '森', '米澤', '奥埜', '倉田']
  console.log('=== BB列名 → findCoord結果 ===')
  for (const name of csvNames) {
    const id = findCoord(name)
    const matched = users.filter((u: any) => u.name.startsWith(name))
    console.log(`${name} → ${id ? 'OK' : 'NULL'} (candidates: ${matched.length} - ${matched.map((u: any) => u.name).join(', ')})`)
  }

  // applicationsのcoordinator_id null率
  const { count: appTotal } = await supabase.from('applications').select('*', { count: 'exact', head: true })
  const { count: appWithCoord } = await supabase.from('applications').select('*', { count: 'exact', head: true }).not('coordinator_id', 'is', null)
  console.log('\n=== applications ===')
  console.log(`total: ${appTotal}, coordinator_id NOT NULL: ${appWithCoord}, NULL: ${(appTotal || 0) - (appWithCoord || 0)}`)
}
main()
