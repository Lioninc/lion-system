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

const COL_AX = 49  // 面談時間
const COL_AY = 50  // 面談日程
const COL_AZ = 51  // 状態
const COL_BB = 53  // 担当CD

const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025 (1).csv'
const content = fs.readFileSync(csvPath, 'utf-8')
const lines = content.split('\n')

// ヘッダー確認
const header = parseCsvLine(lines[0])
console.log('=== ヘッダー確認 ===')
console.log(`AX (index ${COL_AX}): ${header[COL_AX]}`)
console.log(`AY (index ${COL_AY}): ${header[COL_AY]}`)
console.log(`AZ (index ${COL_AZ}): ${header[COL_AZ]}`)
console.log(`BB (index ${COL_BB}): ${header[COL_BB]}`)

// AY列のユニーク値（最初の30個）
const ayValues = new Map<string, number>()
const axValues = new Map<string, number>()
let ayNonEmpty = 0
let axNonEmpty = 0
let bothNonEmpty = 0

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const ay = row[COL_AY]?.trim() || ''
  const ax = row[COL_AX]?.trim() || ''

  if (ay) {
    ayNonEmpty++
    ayValues.set(ay, (ayValues.get(ay) || 0) + 1)
  }
  if (ax) {
    axNonEmpty++
    axValues.set(ax, (axValues.get(ax) || 0) + 1)
  }
  if (ay && ax) bothNonEmpty++
}

console.log(`\n=== 件数 ===`)
console.log(`AY非空: ${ayNonEmpty}`)
console.log(`AX非空: ${axNonEmpty}`)
console.log(`両方非空: ${bothNonEmpty}`)

console.log(`\n=== AY列 サンプル値 (上位30) ===`)
const aySorted = [...ayValues.entries()].sort((a, b) => b[1] - a[1])
for (const [val, cnt] of aySorted.slice(0, 30)) {
  console.log(`  "${val}" : ${cnt}件`)
}

console.log(`\n=== AX列 サンプル値 (上位30) ===`)
const axSorted = [...axValues.entries()].sort((a, b) => b[1] - a[1])
for (const [val, cnt] of axSorted.slice(0, 30)) {
  console.log(`  "${val}" : ${cnt}件`)
}

// 組み合わせサンプル（最初の20件）
console.log(`\n=== AY+AX 組み合わせサンプル (最初20件) ===`)
let shown = 0
for (let i = 2; i < lines.length && shown < 20; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  const ay = row[COL_AY]?.trim() || ''
  const ax = row[COL_AX]?.trim() || ''
  const az = row[COL_AZ]?.trim() || ''
  if (ay) {
    console.log(`  AY="${ay}" AX="${ax}" AZ="${az}"`)
    shown++
  }
}
