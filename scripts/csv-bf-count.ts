/**
 * BF列(繋ぎ状況)の値分布 + BL(紹介先)との関係
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

const COL_BF = 57  // 繋ぎ状況
const COL_BL = 63  // 紹介先
const COL_AU = 46
const COL_AV = 47

// BF値の分布
const bfDist = new Map<string, number>()
let bfTotal = 0
let bfTsunagiTotal = 0
let bfTsunagiNoBL = 0
let bfTsunagiWithBL = 0

// 月別: BF=繋ぎ+BLあり vs BF=繋ぎ+BLなし
const byMonthWithBL = new Map<string, number>()
const byMonthNoBL = new Map<string, number>()
const byMonthTotal = new Map<string, number>()

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const bf = row[COL_BF]?.trim() || ''
  if (!bf) continue
  bfTotal++
  bfDist.set(bf, (bfDist.get(bf) || 0) + 1)

  if (bf === '繋ぎ') {
    bfTsunagiTotal++
    const bl = row[COL_BL]?.trim() || ''
    const au = row[COL_AU] || ''
    const av = row[COL_AV] || ''
    const month = au && av ? `${au}-${av.padStart(2, '0')}` : ''

    if (bl) {
      bfTsunagiWithBL++
      if (month) byMonthWithBL.set(month, (byMonthWithBL.get(month) || 0) + 1)
    } else {
      bfTsunagiNoBL++
      if (month) byMonthNoBL.set(month, (byMonthNoBL.get(month) || 0) + 1)
    }
    if (month) byMonthTotal.set(month, (byMonthTotal.get(month) || 0) + 1)
  }
}

console.log('【BF列の値分布】')
for (const [v, c] of [...bfDist.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${v}": ${c}`)
}

console.log(`\n【BF=繋ぎの内訳】`)
console.log(`  合計: ${bfTsunagiTotal}`)
console.log(`  BL(紹介先)あり: ${bfTsunagiWithBL}`)
console.log(`  BL(紹介先)なし: ${bfTsunagiNoBL}`)

const spushi: Record<string, number> = {
  '2025-01': 103, '2025-02': 93, '2025-03': 118,
  '2025-04': 127, '2025-05': 119, '2025-06': 164,
  '2025-07': 168, '2025-08': 124, '2025-09': 145,
  '2025-10': 149, '2025-11': 86, '2025-12': 85,
}

console.log('\n【月別: BF=繋ぎ】')
console.log('Month     | 合計 | BLあり | BLなし | スプシ')
for (const m of Object.keys(spushi).sort()) {
  const total = byMonthTotal.get(m) || 0
  const withBL = byMonthWithBL.get(m) || 0
  const noBL = byMonthNoBL.get(m) || 0
  console.log(`${m.padEnd(10)}| ${String(total).padStart(4)} | ${String(withBL).padStart(6)} | ${String(noBL).padStart(6)} | ${String(spushi[m]).padStart(6)}`)
}
