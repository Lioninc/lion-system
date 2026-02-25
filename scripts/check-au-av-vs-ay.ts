/**
 * AU+AV(日程年月) と AY(面談日程)の月が一致するか確認
 * 一致すればDB上のscheduled_atの月でそのまま集計可能
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

async function main() {
  const csvPath = '/Users/yamaguchitatsuya/Downloads/2025年応募シート - 2025.csv'
  const content = fs.readFileSync(csvPath, 'utf-8')
  const lines = content.split('\n')

  const COL_AU = 46  // 日程_年
  const COL_AV = 47  // 日程_月
  const COL_AY = 50  // 面談日程
  const COL_AZ = 51  // 状態

  let match = 0, mismatch = 0, noAY = 0
  const mismatches: { au: string; av: string; ay: string; ayMonth: string }[] = []

  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    const az = row[COL_AZ] || ''
    if (az !== '済み') continue

    const au = row[COL_AU] || ''
    const av = row[COL_AV] || ''
    const ay = row[COL_AY] || ''

    if (!ay) { noAY++; continue }

    // Parse AY date: "2025/01/07" or "2025/1/7"
    const ayParts = ay.split('/')
    if (ayParts.length < 2) { noAY++; continue }
    const ayYear = ayParts[0]
    const ayMonth = String(parseInt(ayParts[1]))

    const auAvKey = `${au}-${av}`
    const ayKey = `${ayYear}-${ayMonth}`

    if (auAvKey === ayKey) {
      match++
    } else {
      mismatch++
      if (mismatches.length < 20) {
        mismatches.push({ au, av, ay, ayMonth: ayKey })
      }
    }
  }

  console.log('【AU+AV vs AY(面談日程) の月一致チェック】(AZ=済みのみ)')
  console.log(`  一致: ${match}`)
  console.log(`  不一致: ${mismatch}`)
  console.log(`  AYなし: ${noAY}`)
  console.log(`  一致率: ${(match / (match + mismatch) * 100).toFixed(1)}%`)

  if (mismatch > 0) {
    console.log('\n【不一致例】')
    for (const m of mismatches) {
      console.log(`  AU+AV: ${m.au}-${m.av}, AY: ${m.ay} → AY月: ${m.ayMonth}`)
    }
  }
}

main()
