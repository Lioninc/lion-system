/**
 * AZ列=「済み」をAU列(日程_年)+AV列(日程_月)ベースで月別集計
 * AU = 0-indexed 46 = 日程_年
 * AV = 0-indexed 47 = 日程_月
 * AZ = 0-indexed 51 = 面談ステータス
 */
import * as fs from 'fs'

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

async function main() {
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')

  const COL_AU = 46  // 日程_年
  const COL_AV = 47  // 日程_月
  const COL_AZ = 51  // 面談ステータス

  // Verify
  const header = parseCsvLine(lines[1])
  console.log(`AU(${COL_AU}): "${header[COL_AU]}"`)
  console.log(`AV(${COL_AV}): "${header[COL_AV]}"`)
  console.log(`AZ(${COL_AZ}): "${header[COL_AZ]}"`)

  // スプシの数字
  const spushi: Record<string, number> = {
    '2025-01': 258, '2025-02': 266, '2025-03': 306, '2025-04': 332,
    '2025-05': 310, '2025-06': 385, '2025-07': 384, '2025-08': 306,
    '2025-09': 306, '2025-10': 293, '2025-11': 193, '2025-12': 172,
  }

  const byMonth = new Map<string, number>()

  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    const az = row[COL_AZ] || ''
    if (az !== '済み') continue

    const year = row[COL_AU] || ''
    const month = row[COL_AV] || ''
    if (!year || !month) continue

    const key = `${year}-${month.padStart(2, '0')}`
    byMonth.set(key, (byMonth.get(key) || 0) + 1)
  }

  console.log('\n' + '='.repeat(70))
  console.log('【AZ=済み を AU+AV(日程年月) で集計 vs スプシ vs DB】')
  console.log('='.repeat(70))
  console.log('Month    | CSV(AU+AV) | スプシ  | 差(CSV-スプシ) | DB(conducted_at)')
  console.log('-'.repeat(70))

  // DB numbers from previous investigation
  const db: Record<string, number> = {
    '2024-01': 1, '2024-11': 2, '2024-12': 23,
    '2025-01': 311, '2025-02': 282, '2025-03': 307, '2025-04': 335,
    '2025-05': 309, '2025-06': 386, '2025-07': 383, '2025-08': 306,
    '2025-09': 305, '2025-10': 289, '2025-11': 190, '2025-12': 171,
    '2026-01': 185, '2026-02': 19,
  }

  const allMonths = new Set([...byMonth.keys(), ...Object.keys(spushi), ...Object.keys(db)])
  let tCsv = 0, tSp = 0, tDb = 0
  for (const month of [...allMonths].sort()) {
    const csv = byMonth.get(month) || 0
    const sp = spushi[month] || 0
    const d = db[month] || 0
    const diff = csv - sp
    tCsv += csv; tSp += sp; tDb += d
    console.log(
      `${month.padEnd(9)}| ${String(csv).padStart(10)} | ${String(sp || '-').padStart(7)} | ${sp ? String(diff).padStart(14) : '              '} | ${String(d || '-').padStart(16)}`
    )
  }
  console.log('-'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(9)}| ${String(tCsv).padStart(10)} | ${String(tSp).padStart(7)} | ${String(tCsv - tSp).padStart(14)} | ${String(tDb).padStart(16)}`
  )
}

main()
