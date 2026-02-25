/**
 * CSVのAZ=済みを3つの方法で月別集計:
 * 1. 単純カウント (AU+AV月)
 * 2. 電話番号でユニーク化 (同一電話+同月は1件)
 * 3. 電話番号+日付でユニーク化
 *
 * スプシの面談数(258,266,306...)がどの方法と一致するか特定
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

const COL_PHONE = 19
const COL_AU = 46
const COL_AV = 47
const COL_AZ = 51

const expected: Record<string, number> = {
  '2025-01': 258, '2025-02': 266, '2025-03': 306,
  '2025-04': 332, '2025-05': 310, '2025-06': 385,
  '2025-07': 384, '2025-08': 306, '2025-09': 306,
  '2025-10': 293, '2025-11': 193, '2025-12': 172,
}

// Method 1: simple count
const simpleCount = new Map<string, number>()
// Method 2: unique by phone+month
const uniquePhoneMonth = new Map<string, Set<string>>()
// Method 3: unique by phone+date
const uniquePhoneDate = new Map<string, Set<string>>()

for (let i = 2; i < lines.length; i++) {
  if (!lines[i].trim()) continue
  const row = parseCsvLine(lines[i])
  if (row[COL_AZ] !== '済み') continue
  const au = row[COL_AU] || ''
  const av = row[COL_AV] || ''
  if (!au || !av) continue
  const month = `${au}-${av.padStart(2, '0')}`

  // Method 1
  simpleCount.set(month, (simpleCount.get(month) || 0) + 1)

  const phone = (row[COL_PHONE] || '').replace(/[-\s\u3000()（）]/g, '')
  if (!phone) continue

  // Method 2
  if (!uniquePhoneMonth.has(month)) uniquePhoneMonth.set(month, new Set())
  uniquePhoneMonth.get(month)!.add(phone)

  // Method 3
  const ay = row[50] || ''
  const dateKey = phone + ':' + ay
  if (!uniquePhoneDate.has(month)) uniquePhoneDate.set(month, new Set())
  uniquePhoneDate.get(month)!.add(dateKey)
}

console.log('='.repeat(100))
console.log('Month     | スプシ | 単純Count | 差  | UniquePhone月 | 差  | UniquePhoneDate | 差')
console.log('-'.repeat(100))

for (const month of Object.keys(expected).sort()) {
  const exp = expected[month]
  const s = simpleCount.get(month) || 0
  const up = uniquePhoneMonth.get(month)?.size || 0
  const upd = uniquePhoneDate.get(month)?.size || 0
  console.log(
    `${month.padEnd(10)}| ${String(exp).padStart(6)} | ${String(s).padStart(10)} | ${String(s - exp).padStart(3)} | ${String(up).padStart(13)} | ${String(up - exp).padStart(3)} | ${String(upd).padStart(15)} | ${String(upd - exp).padStart(3)}`
  )
}

// Totals
const totalExp = Object.values(expected).reduce((s, v) => s + v, 0)
const totalS = [...simpleCount.entries()].filter(([m]) => m.startsWith('2025')).reduce((s, [, v]) => s + v, 0)
const totalUP = [...uniquePhoneMonth.entries()].filter(([m]) => m.startsWith('2025')).reduce((s, [, v]) => s + v.size, 0)
const totalUPD = [...uniquePhoneDate.entries()].filter(([m]) => m.startsWith('2025')).reduce((s, [, v]) => s + v.size, 0)
console.log('-'.repeat(100))
console.log(
  `${'TOTAL'.padEnd(10)}| ${String(totalExp).padStart(6)} | ${String(totalS).padStart(10)} | ${String(totalS - totalExp).padStart(3)} | ${String(totalUP).padStart(13)} | ${String(totalUP - totalExp).padStart(3)} | ${String(totalUPD).padStart(15)} | ${String(totalUPD - totalExp).padStart(3)}`
)
