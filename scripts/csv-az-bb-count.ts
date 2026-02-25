/**
 * 元CSVのAZ列(面談ステータス)とBB列(担当CD)を月別集計
 *
 * AZ = 0-indexed col 51 = 面談の状態 (済み/流れ/辞退)
 * BB = 0-indexed col 53 = 担当CD
 * 日付 = 0-indexed col 5 = 日付 (2024/10/29形式)
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

  console.log(`CSV行数: ${lines.length}`)
  console.log(`ヘッダー行(2行目): ${lines[1].substring(0, 200)}`)

  // Column indices (0-indexed)
  const COL_DATE = 5        // 日付 (F列)
  const COL_AZ = 51         // AZ: 面談ステータス (状態)
  const COL_AY = 50         // AY: 面談日程
  const COL_BB = 53         // BB: 担当CD

  // Verify column names from header
  const header = parseCsvLine(lines[1])
  console.log(`\nカラム確認:`)
  console.log(`  col ${COL_DATE} (F): "${header[COL_DATE]}"`)
  console.log(`  col ${COL_AY} (AY): "${header[COL_AY]}"`)
  console.log(`  col ${COL_AZ} (AZ): "${header[COL_AZ]}"`)
  console.log(`  col ${COL_BB} (BB): "${header[COL_BB]}"`)

  // Parse data rows (skip row 0 = summary, row 1 = header)
  interface MonthData {
    total: number
    azSumi: number       // AZ = "済み"
    azNotEmpty: number   // AZ ≠ 空白
    bbNotEmpty: number   // BB ≠ 空白
    ayNotEmpty: number   // AY(面談日程) ≠ 空白
  }

  const byMonth = new Map<string, MonthData>()
  const emptyData = (): MonthData => ({ total: 0, azSumi: 0, azNotEmpty: 0, bbNotEmpty: 0, ayNotEmpty: 0 })

  // AZ value distribution
  const azDist = new Map<string, number>()

  let totalRows = 0
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const row = parseCsvLine(lines[i])
    totalRows++

    const dateStr = row[COL_DATE] || ''
    const month = dateStr.replace(/\//g, '-').substring(0, 7)
    if (!month || month.length < 7) continue

    if (!byMonth.has(month)) byMonth.set(month, emptyData())
    const m = byMonth.get(month)!
    m.total++

    const az = row[COL_AZ] || ''
    const bb = row[COL_BB] || ''
    const ay = row[COL_AY] || ''

    if (az === '済み') m.azSumi++
    if (az !== '') {
      m.azNotEmpty++
      azDist.set(az, (azDist.get(az) || 0) + 1)
    }
    if (bb !== '') m.bbNotEmpty++
    if (ay !== '') m.ayNotEmpty++
  }

  console.log(`\nデータ行数: ${totalRows}`)

  // AZ value distribution
  console.log('\n【AZ列（面談ステータス）の値分布】')
  for (const [val, count] of [...azDist.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${val}": ${count}`)
  }

  // Monthly comparison
  console.log('\n' + '='.repeat(90))
  console.log('【月別集計: AZ列 vs BB列】')
  console.log('='.repeat(90))
  console.log('Month    | 応募数  | AZ=済み | AZ≠空白 | AY≠空白 | BB≠空白 | 差(AZ済み - BB)')
  console.log('-'.repeat(90))

  let tTotal = 0, tAzSumi = 0, tAzNE = 0, tAyNE = 0, tBbNE = 0
  for (const [month, m] of [...byMonth.entries()].sort()) {
    tTotal += m.total; tAzSumi += m.azSumi; tAzNE += m.azNotEmpty; tAyNE += m.ayNotEmpty; tBbNE += m.bbNotEmpty
    const diff = m.azSumi - m.bbNotEmpty
    console.log(
      `${month.padEnd(9)}| ${String(m.total).padStart(7)} | ${String(m.azSumi).padStart(7)} | ${String(m.azNotEmpty).padStart(7)} | ${String(m.ayNotEmpty).padStart(7)} | ${String(m.bbNotEmpty).padStart(7)} | ${String(diff).padStart(6)}`
    )
  }
  console.log('-'.repeat(90))
  const tDiff = tAzSumi - tBbNE
  console.log(
    `${'TOTAL'.padEnd(9)}| ${String(tTotal).padStart(7)} | ${String(tAzSumi).padStart(7)} | ${String(tAzNE).padStart(7)} | ${String(tAyNE).padStart(7)} | ${String(tBbNE).padStart(7)} | ${String(tDiff).padStart(6)}`
  )
}

main()
