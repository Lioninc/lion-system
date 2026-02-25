/**
 * BG/BH/CF列の値分布を確認
 * BG(58)=派遣予定_年, BH(59)=派遣予定_月, CF(83)=稼働日
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

const COL_BG = 58
const COL_BH = 59
const COL_CF = 83
const COL_BF = 57
const COL_BX = 75
const COL_CG = 84
const COL_AU = 46

// Header check
const header = parseCsvLine(lines[1])
console.log(`BG(${COL_BG}): "${header[COL_BG]}"`)
console.log(`BH(${COL_BH}): "${header[COL_BH]}"`)
console.log(`CF(${COL_CF}): "${header[COL_CF]}"`)
console.log(`AU(${COL_AU}): "${header[COL_AU]}"`)
console.log()

// Sample values
let bgSamples: string[] = []
let bhSamples: string[] = []
let cfSamples: string[] = []

let countBF = 0
let countBfWithCF = 0
let countBfWithBGBH = 0
let countBfWithBX = 0
let countBfWithCG = 0
let countBfWithCGandCF = 0
let countBfWithBXnoWorkMonth = 0

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])

  const bf = row[COL_BF]?.trim() || ''
  if (bf !== '繋ぎ') continue
  countBF++

  const bg = row[COL_BG]?.trim() || ''
  const bh = row[COL_BH]?.trim() || ''
  const cf = row[COL_CF]?.trim() || ''
  const bx = row[COL_BX]?.trim() || ''
  const cg = row[COL_CG]?.trim() || ''

  if (cf) countBfWithCF++
  if (bg && bh) countBfWithBGBH++
  if (bx) countBfWithBX++
  if (cg) countBfWithCG++
  if (cg && cf) countBfWithCGandCF++

  // Work month determination
  const hasCF = !!cf
  const hasBGBH = !!(bg && bh)
  if (bx && !hasCF && !hasBGBH) countBfWithBXnoWorkMonth++

  if (bg && bgSamples.length < 10) bgSamples.push(bg)
  if (bh && bhSamples.length < 10) bhSamples.push(bh)
  if (cf && cfSamples.length < 10) cfSamples.push(cf)
}

console.log(`BF=繋ぎ total: ${countBF}`)
console.log(`  CF(稼働日)あり: ${countBfWithCF}`)
console.log(`  BG+BH(派遣予定)あり: ${countBfWithBGBH}`)
console.log(`  BX(見込売上)あり: ${countBfWithBX}`)
console.log(`  CG(確定売上)あり: ${countBfWithCG}`)
console.log(`  CG+CFあり: ${countBfWithCGandCF}`)
console.log(`  BXありだがCFもBGBHもなし: ${countBfWithBXnoWorkMonth}`)

console.log('\nBG samples:', [...new Set(bgSamples)])
console.log('BH samples:', [...new Set(bhSamples)])
console.log('CF samples:', [...new Set(cfSamples)])

// Monthly distribution of work months
const byWorkMonth = new Map<string, { prospect: number, working: number }>()

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  if (row[COL_BF]?.trim() !== '繋ぎ') continue

  const bg = row[COL_BG]?.trim() || ''
  const bh = row[COL_BH]?.trim() || ''
  const cf = row[COL_CF]?.trim() || ''
  const au = row[COL_AU]?.trim() || ''
  const bx = row[COL_BX]?.trim() || ''
  const cg = row[COL_CG]?.trim() || ''

  // Work month determination
  let workMonth: string | null = null
  const year = bg || au

  if (cf) {
    // CF = MM/DD or M/D format
    const cfMatch = cf.match(/^(\d{1,2})\/(\d{1,2})/)
    if (cfMatch && year) {
      workMonth = `${year}-${cfMatch[1].padStart(2, '0')}`
    }
  }
  if (!workMonth && bh && year) {
    workMonth = `${year}-${bh.padStart(2, '0')}`
  }

  if (!workMonth) continue

  if (!byWorkMonth.has(workMonth)) byWorkMonth.set(workMonth, { prospect: 0, working: 0 })
  const entry = byWorkMonth.get(workMonth)!
  if (bx) entry.prospect++
  if (cg && cf) entry.working++
}

console.log('\n稼働月ベース集計:')
console.log('Month     | 見込み件数 | 実働件数')
console.log('-'.repeat(40))
let tP = 0, tW = 0
for (const [m, v] of [...byWorkMonth.entries()].sort()) {
  tP += v.prospect
  tW += v.working
  console.log(`${m.padEnd(10)}| ${String(v.prospect).padStart(10)} | ${String(v.working).padStart(8)}`)
}
console.log('-'.repeat(40))
console.log(`${'TOTAL'.padEnd(10)}| ${String(tP).padStart(10)} | ${String(tW).padStart(8)}`)
