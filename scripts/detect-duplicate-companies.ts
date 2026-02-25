/**
 * 派遣会社の重複検出・統合スクリプト
 *
 * 使用方法:
 *   npx tsx scripts/detect-duplicate-companies.ts          # 検出のみ（dry-run）
 *   npx tsx scripts/detect-duplicate-companies.ts --merge   # 完全一致の重複を統合
 *
 * 処理内容:
 *   1. 全会社データを取得
 *   2. 会社名を正規化して重複グループを検出
 *   3. --merge 指定時、完全一致グループのみ自動統合
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// 会社名を正規化
function normalizeCompanyName(name: string): string {
  let n = name.trim()
  // 全角スペース→半角
  n = n.replace(/　/g, ' ')
  // 法人格を除去
  n = n.replace(/株式会社|（株）|\(株\)|有限会社|（有）|\(有\)|合同会社|合資会社/g, '')
  // スペースをすべて除去
  n = n.replace(/\s+/g, '')
  // 英字を小文字化
  n = n.toLowerCase()
  // 全角英数→半角英数
  n = n.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  )
  return n
}

interface CompanyRecord {
  id: string
  name: string
  is_active: boolean
  created_at: string
  job_count: number
}

interface DuplicateGroup {
  type: 'exact' | 'prefix'
  normalizedName: string
  companies: CompanyRecord[]
}

async function main() {
  const doMerge = process.argv.includes('--merge')

  console.log('\n' + '='.repeat(60))
  console.log('派遣会社 重複検出ツール')
  console.log('='.repeat(60))
  console.log(`モード: ${doMerge ? '統合実行' : '検出のみ（dry-run）'}`)

  // テナントID取得
  const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
  if (!tenants || tenants.length === 0) {
    console.error('テナントが見つかりません')
    process.exit(1)
  }
  const tenantId = tenants[0].id

  // 全会社データ取得（ページネーション付き）
  console.log('\n会社データを取得中...')
  const allCompanies: CompanyRecord[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data: batch } = await supabase
      .from('companies')
      .select('id, name, is_active, created_at, jobs(id)')
      .eq('tenant_id', tenantId)
      .range(offset, offset + pageSize - 1)

    if (!batch || batch.length === 0) break

    for (const c of batch as any[]) {
      allCompanies.push({
        id: c.id,
        name: c.name,
        is_active: c.is_active,
        created_at: c.created_at,
        job_count: c.jobs?.length || 0,
      })
    }

    offset += batch.length
    if (batch.length < pageSize) break
  }

  console.log(`会社数: ${allCompanies.length}件`)

  // 正規化名でグルーピング（完全一致）
  const normalizedMap = new Map<string, CompanyRecord[]>()
  for (const company of allCompanies) {
    const normalized = normalizeCompanyName(company.name)
    if (!normalized) continue
    const group = normalizedMap.get(normalized) || []
    group.push(company)
    normalizedMap.set(normalized, group)
  }

  // 完全一致の重複グループ
  const exactGroups: DuplicateGroup[] = []
  for (const [normalizedName, companies] of normalizedMap) {
    if (companies.length >= 2) {
      exactGroups.push({ type: 'exact', normalizedName, companies })
    }
  }

  // 前方一致の重複候補（完全一致に含まれないもの）
  const prefixGroups: DuplicateGroup[] = []
  const normalizedKeys = [...normalizedMap.keys()].sort((a, b) => a.length - b.length)
  const usedInExact = new Set(exactGroups.map(g => g.normalizedName))

  for (let i = 0; i < normalizedKeys.length; i++) {
    const shorter = normalizedKeys[i]
    if (shorter.length < 2) continue // 1文字は除外
    if (usedInExact.has(shorter)) continue

    const matched: CompanyRecord[] = []
    for (let j = i + 1; j < normalizedKeys.length; j++) {
      const longer = normalizedKeys[j]
      if (longer.startsWith(shorter) && longer !== shorter) {
        const shorterCompanies = normalizedMap.get(shorter) || []
        const longerCompanies = normalizedMap.get(longer) || []
        if (matched.length === 0) {
          matched.push(...shorterCompanies)
        }
        matched.push(...longerCompanies)
      }
    }

    if (matched.length >= 2) {
      prefixGroups.push({ type: 'prefix', normalizedName: shorter, companies: matched })
    }
  }

  // 結果表示
  console.log('\n' + '='.repeat(60))
  console.log('検出結果')
  console.log('='.repeat(60))

  if (exactGroups.length === 0 && prefixGroups.length === 0) {
    console.log('\n重複候補は見つかりませんでした。')
    return
  }

  // 完全一致グループ
  if (exactGroups.length > 0) {
    console.log(`\n--- 正規化名が完全一致（${exactGroups.length}グループ）---`)
    console.log('  ※ --merge で自動統合可能\n')

    for (let i = 0; i < exactGroups.length; i++) {
      const group = exactGroups[i]
      // 求人数が多い方をマスター、同数なら古い方
      const sorted = [...group.companies].sort((a, b) => {
        if (b.job_count !== a.job_count) return b.job_count - a.job_count
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      const master = sorted[0]
      const duplicates = sorted.slice(1)
      const totalJobs = sorted.reduce((sum, c) => sum + c.job_count, 0)

      console.log(`  グループ${i + 1} (正規化: "${group.normalizedName}"):`)
      console.log(`    [MASTER]    ${master.name} (求人: ${master.job_count}件, ID: ${master.id.slice(0, 8)}...)`)
      for (const dup of duplicates) {
        console.log(`    [DUPLICATE] ${dup.name} (求人: ${dup.job_count}件, ID: ${dup.id.slice(0, 8)}...)`)
      }
      console.log(`    → 統合後: ${totalJobs}件の求人をマスターに集約`)
      console.log()
    }
  }

  // 前方一致グループ
  if (prefixGroups.length > 0) {
    console.log(`\n--- 前方一致候補（${prefixGroups.length}グループ）---`)
    console.log('  ※ 手動確認が必要\n')

    for (let i = 0; i < prefixGroups.length; i++) {
      const group = prefixGroups[i]
      console.log(`  候補${i + 1} (前方一致: "${group.normalizedName}"):`)
      for (const c of group.companies) {
        console.log(`    - ${c.name} (求人: ${c.job_count}件${!c.is_active ? ', 取引停止' : ''})`)
      }
      console.log()
    }
  }

  // サマリー
  const exactDupCount = exactGroups.reduce((sum, g) => sum + g.companies.length - 1, 0)
  console.log('='.repeat(60))
  console.log('サマリー')
  console.log('='.repeat(60))
  console.log(`  完全一致グループ:    ${exactGroups.length}件 (重複会社: ${exactDupCount}件)`)
  console.log(`  前方一致候補:        ${prefixGroups.length}件`)

  // --merge 実行
  if (doMerge && exactGroups.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('統合処理を実行中...')
    console.log('='.repeat(60))

    let mergedCount = 0
    let jobsUpdated = 0
    const errors: string[] = []

    for (const group of exactGroups) {
      const sorted = [...group.companies].sort((a, b) => {
        if (b.job_count !== a.job_count) return b.job_count - a.job_count
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

      const master = sorted[0]
      const duplicates = sorted.slice(1)

      for (const dup of duplicates) {
        // 求人を付け替え
        if (dup.job_count > 0) {
          const { error: jobError, count } = await supabase
            .from('jobs')
            .update({ company_id: master.id })
            .eq('company_id', dup.id)
            .select('*', { count: 'exact', head: true })

          if (jobError) {
            errors.push(`求人付替失敗 (${dup.name}): ${jobError.message}`)
            continue
          }
          jobsUpdated += count || 0
        }

        // 重複を非アクティブに
        const { error: deactivateError } = await supabase
          .from('companies')
          .update({
            is_active: false,
            notes: `[統合済み] マスター: ${master.name} (${master.id.slice(0, 8)}...)`,
          })
          .eq('id', dup.id)

        if (deactivateError) {
          errors.push(`非アクティブ化失敗 (${dup.name}): ${deactivateError.message}`)
          continue
        }

        mergedCount++
        console.log(`  ${dup.name} → ${master.name} に統合`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('統合結果')
    console.log('='.repeat(60))
    console.log(`  統合した会社:      ${mergedCount}件`)
    console.log(`  付替えた求人:      ${jobsUpdated}件`)
    console.log(`  エラー:            ${errors.length}件`)

    if (errors.length > 0) {
      console.log('\nエラー詳細:')
      errors.forEach(err => console.log(`  - ${err}`))
    }
  } else if (!doMerge && exactGroups.length > 0) {
    console.log('\n統合を実行するには --merge オプションを付けてください:')
    console.log('  npx tsx scripts/detect-duplicate-companies.ts --merge')
  }

  console.log('\n完了!')
}

main()
