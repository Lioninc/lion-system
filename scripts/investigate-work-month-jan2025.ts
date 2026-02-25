/**
 * 2025年1月の見込み49件を調査
 * - AU列(面談年度) vs BG列(派遣予定_年) の内訳
 * - BG空白でAUフォールバックのケースを特定
 */
import * as fs from 'fs'

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
const content = fs.readFileSync(csvPath, 'utf-8')
const lines = content.split('\n')

const COL_AU = 46   // 日程_年
const COL_AV = 47   // 日程_月
const COL_BF = 57   // 繋ぎ状況
const COL_BG = 58   // 派遣予定_年
const COL_BH = 59   // 派遣予定_月
const COL_BX = 75   // 見込み売上
const COL_CG = 84   // 確定売上
const COL_CF = 83   // 稼働日

function parseAmount(v: string): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/[,，円¥\\"]/g, ''))
  return isNaN(n) ? 0 : n
}

// 稼働月=2025-01 & BX>0 のレコードを収集
interface Record {
  rowNum: number
  au: string
  av: string
  bg: string
  bh: string
  cf: string
  bx: number
  cg: number
  workMonthSource: string  // 'CF' or 'BG+BH' or 'AU fallback'
}

const records: Record[] = []

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  if (row[COL_BF]?.trim() !== '繋ぎ') continue

  const au = row[COL_AU]?.trim() || ''
  const av = row[COL_AV]?.trim() || ''
  const bg = row[COL_BG]?.trim() || ''
  const bh = row[COL_BH]?.trim() || ''
  const cf = row[COL_CF]?.trim() || ''
  const bx = parseAmount(row[COL_BX])
  const cg = parseAmount(row[COL_CG])

  if (bx <= 0) continue

  // 稼働月を計算
  const year = bg || au
  let workMonth: string | null = null
  let source = ''

  if (cf) {
    const m = cf.match(/^(\d{1,2})\/(\d{1,2})/)
    if (m) {
      workMonth = `${year}-${m[1].padStart(2, '0')}`
      source = bg ? 'CF+BG年' : 'CF+AU年(fallback)'
    }
  }
  if (!workMonth && bh) {
    workMonth = `${year}-${bh.padStart(2, '0')}`
    source = bg ? 'BG+BH' : 'AU+BH(fallback)'
  }

  if (workMonth !== '2025-01') continue

  records.push({ rowNum: i + 1, au, av, bg, bh, cf, bx, cg, workMonthSource: source })
}

console.log(`=== 稼働月=2025-01 & BX>0: ${records.length}件 ===\n`)

// パターン分類
const patterns = new Map<string, Record[]>()
for (const r of records) {
  const key = `AU=${r.au}, AV=${r.av}, BG=${r.bg || '(空)'}, BH=${r.bh || '(空)'}, Source=${r.workMonthSource}`
  if (!patterns.has(key)) patterns.set(key, [])
  patterns.get(key)!.push(r)
}

console.log('--- パターン別 ---')
for (const [key, recs] of [...patterns.entries()].sort()) {
  console.log(`\n${key}: ${recs.length}件`)
  for (const r of recs.slice(0, 3)) {
    console.log(`  行${r.rowNum}: CF="${r.cf}" BX=${r.bx.toLocaleString()} CG=${r.cg.toLocaleString()}`)
  }
  if (recs.length > 3) console.log(`  ... 他${recs.length - 3}件`)
}

// サマリ
console.log('\n\n--- サマリ ---')
const bgPresent = records.filter(r => r.bg !== '')
const bgEmpty = records.filter(r => r.bg === '')
console.log(`BG列あり: ${bgPresent.length}件`)
console.log(`BG列なし(AUフォールバック): ${bgEmpty.length}件`)

// BGなしの詳細
if (bgEmpty.length > 0) {
  console.log('\n--- BG空白でAUフォールバックの詳細 ---')
  for (const r of bgEmpty) {
    const auMonth = `${r.au}-${r.av.padStart(2, '0')}`
    const suspicious = r.au === '2025' && parseInt(r.av) >= 10
      ? ' ⚠️ 面談10月以降→1月稼働はAU年で正しい可能性低い'
      : ''
    console.log(`  行${r.rowNum}: AU=${r.au}, AV=${r.av}(面談月=${auMonth}), CF="${r.cf}", BH=${r.bh || '(空)'}, BX=${r.bx.toLocaleString()}${suspicious}`)
  }
}

// AUフォールバックで年ミスの可能性を特定
// 例: AU=2025, AV=12(12月面談) → CF=01/xx → 稼働月2025-01 (本来2026-01)
console.log('\n--- 年ミスの可能性があるレコード ---')
console.log('（面談月が稼働月より後のケース = 年がずれている可能性）')
let suspiciousCount = 0
for (const r of records) {
  const interviewMonth = parseInt(r.av)
  const cfMonth = r.cf ? parseInt(r.cf.split('/')[0]) : parseInt(r.bh || '0')

  // 面談月 > 稼働月（同年内で逆転）→ 年越しの可能性
  if (interviewMonth > cfMonth && r.bg === '') {
    suspiciousCount++
    console.log(`  行${r.rowNum}: 面談=${r.au}-${r.av.padStart(2, '0')}, 稼働CF/BH→01月, BG=(空), Source=${r.workMonthSource}`)
    console.log(`    → 本来は${parseInt(r.au) + 1}年1月の可能性`)
  }
}
if (suspiciousCount === 0) console.log('  なし')
console.log(`\n年ミスの疑い: ${suspiciousCount}件`)
