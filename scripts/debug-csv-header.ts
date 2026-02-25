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

// Show ALL headers with Excel column letter mapping
const header = parseCsvLine(lines[1])
console.log('=== 全ヘッダー ===')
for (let i = 0; i < header.length; i++) {
  // Convert 0-indexed to Excel letter
  const letter = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26))
  if (header[i]) console.log(`  ${letter} (col ${i}): "${header[i]}"`)
}

// Show first 2 data rows for key columns
console.log('\n=== 主要列のデータサンプル (2行) ===')
const keyCols = [
  { idx: 46, name: 'AU=日程_年' },
  { idx: 47, name: 'AV=日程_月' },
  { idx: 51, name: 'AZ=面談ステータス' },
  { idx: 53, name: 'BB=担当CD' },
  { idx: 57, name: 'BF=繋ぎ状況' },
  { idx: 61, name: 'BJ=面接日' },
  { idx: 64, name: 'BM=進捗' },
  { idx: 65, name: 'BN=合否' },
  { idx: 75, name: 'BX=見込み売上' },
  { idx: 84, name: 'CG=確定売上' },
  { idx: 85, name: 'CH=入金金額' },
]
for (const row of [2, 3]) {
  if (row >= lines.length) break
  const data = parseCsvLine(lines[row])
  console.log(`\nRow ${row}:`)
  for (const col of keyCols) {
    const val = data[col.idx] || '(empty)'
    console.log(`  ${col.name}: "${val}"`)
  }
}

// Count total data rows
let dataRows = 0
for (let i = 2; i < lines.length; i++) {
  if (lines[i].trim()) dataRows++
}
console.log(`\n全データ行数: ${dataRows}`)
