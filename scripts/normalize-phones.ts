/**
 * 既存の job_seekers.phone を一括正規化
 *
 *   - Excelで先頭0が落ちた携帯番号 (8012345678 → 08012345678)
 *   - ハイフン/空白/全角数字混じり
 *   - +81 国コード付き
 *
 * 使い方:
 *   npx tsx scripts/normalize-phones.ts            # dry-run (デフォルト・更新しない)
 *   npx tsx scripts/normalize-phones.ts --apply    # 実際にDBを更新
 *
 * 注意: 正規化後に既存レコードと重複するケース (例: "08012345678" と "8012345678" が両方DBにある)
 *       はスキップし logs/phone-duplicates.json に書き出します。手動マージが必要です。
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 50

// src/lib/utils.ts の normalizePhone と同じロジック
function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let s = String(input).trim()
  s = s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
  if (s.startsWith('+81')) {
    s = '0' + s.slice(3)
  } else if (s.startsWith('81') && s.length >= 12) {
    s = '0' + s.slice(2)
  }
  const digits = s.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) return digits
  if (digits.length === 10 && digits.startsWith('0')) return digits
  if (digits.length === 10 && /^[789]/.test(digits)) return '0' + digits
  if (digits.length === 9 && /^[1-9]/.test(digits)) return '0' + digits
  return digits
}

interface JobSeekerRow {
  id: string
  name: string | null
  phone: string | null
  tenant_id: string | null
}

async function fetchAllJobSeekers(): Promise<JobSeekerRow[]> {
  const PAGE = 1000
  const result: JobSeekerRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('job_seekers')
      .select('id, name, phone, tenant_id')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    result.push(...(data as JobSeekerRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return result
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (DB を更新します)' : 'DRY-RUN (更新しません)'}`)
  console.log('Fetching all job_seekers...')

  const all = await fetchAllJobSeekers()
  console.log(`Total job_seekers: ${all.length}`)

  // tenant_id + 正規化後の phone のキーで既存マッピングを構築
  // 同じテナント内で正規化後に衝突するレコードを検出
  const byNormKey = new Map<string, JobSeekerRow[]>() // `${tenant_id}::${normalized}` → rows
  for (const row of all) {
    const norm = normalizePhone(row.phone)
    if (!norm) continue
    const key = `${row.tenant_id || ''}::${norm}`
    const arr = byNormKey.get(key) || []
    arr.push(row)
    byNormKey.set(key, arr)
  }

  const needUpdate: Array<{ id: string; name: string | null; oldPhone: string; newPhone: string; tenantId: string | null }> = []
  const duplicates: Array<{ normalized: string; tenant_id: string | null; rows: { id: string; name: string | null; phone: string | null }[] }> = []

  let skippedPlaceholder = 0
  for (const row of all) {
    const original = row.phone || ''

    // reimport-all.ts が phone 欠落時に作る "U{idx}-{random}" 形式の
    // プレースホルダはアルファベットを含む。正規化対象から除外
    if (/[a-zA-Z]/.test(original)) {
      skippedPlaceholder++
      continue
    }

    const normalized = normalizePhone(original)
    if (!normalized || normalized === original) continue

    const key = `${row.tenant_id || ''}::${normalized}`
    const collisions = byNormKey.get(key) || []

    if (collisions.length > 1) {
      // 重複: 既に同じ正規化後の値を持つレコードが存在
      const dupKey = `${row.tenant_id || ''}::${normalized}`
      if (!duplicates.find((d) => `${d.tenant_id || ''}::${d.normalized}` === dupKey)) {
        duplicates.push({
          normalized,
          tenant_id: row.tenant_id,
          rows: collisions.map((r) => ({ id: r.id, name: r.name, phone: r.phone })),
        })
      }
      continue
    }

    needUpdate.push({
      id: row.id,
      name: row.name,
      oldPhone: original,
      newPhone: normalized,
      tenantId: row.tenant_id,
    })
  }

  console.log('')
  console.log(`変更必要: ${needUpdate.length}件 / 全 ${all.length}件`)
  console.log(`重複検出 (スキップ): ${duplicates.length}グループ`)
  console.log(`プレースホルダ除外 (U... 形式): ${skippedPlaceholder}件`)
  console.log('')

  // サンプル表示 (最大30件)
  const sampleN = Math.min(30, needUpdate.length)
  console.log(`--- 変更予定サンプル (先頭${sampleN}件) ---`)
  for (let i = 0; i < sampleN; i++) {
    const u = needUpdate[i]
    console.log(`  ${u.name || '(no name)'} (${u.id}): "${u.oldPhone}" → "${u.newPhone}"`)
  }
  if (needUpdate.length > sampleN) {
    console.log(`  ... 他 ${needUpdate.length - sampleN}件`)
  }
  console.log('')

  if (duplicates.length > 0) {
    console.log('--- 重複検出 (手動対応が必要) ---')
    for (const dup of duplicates.slice(0, 10)) {
      console.log(`  normalized="${dup.normalized}" tenant=${dup.tenant_id}`)
      for (const r of dup.rows) {
        console.log(`    - ${r.name || '(no name)'} (${r.id}): "${r.phone}"`)
      }
    }
    if (duplicates.length > 10) {
      console.log(`  ... 他 ${duplicates.length - 10}グループ`)
    }

    // ファイル出力
    const logsDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const outPath = path.join(logsDir, 'phone-duplicates.json')
    fs.writeFileSync(outPath, JSON.stringify(duplicates, null, 2), 'utf-8')
    console.log(`重複レコード詳細: ${outPath}`)
    console.log('')
  }

  if (!APPLY) {
    console.log('DRY-RUN 完了。実際に更新するには --apply を付けて再実行してください。')
    return
  }

  if (needUpdate.length === 0) {
    console.log('更新対象なし。終了します。')
    return
  }

  // バッチ更新
  console.log(`APPLY モードで ${needUpdate.length}件を更新します...`)
  const now = new Date().toISOString()
  let done = 0
  let failed = 0

  for (let i = 0; i < needUpdate.length; i += BATCH_SIZE) {
    const batch = needUpdate.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (u) => {
        const { error } = await supabase
          .from('job_seekers')
          .update({ phone: u.newPhone, updated_at: now })
          .eq('id', u.id)
        if (error) {
          console.error(`  ERROR ${u.id}: ${error.message}`)
          failed++
        } else {
          done++
        }
      }),
    )
    console.log(`  ${Math.min(i + BATCH_SIZE, needUpdate.length)} / ${needUpdate.length} 完了`)
  }

  console.log('')
  console.log(`更新完了: ${done}件成功 / ${failed}件失敗`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
