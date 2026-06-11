import { type ClassValue, clsx } from 'clsx'

// Utility function to combine class names
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Format currency
export function formatCurrency(value: number): string {
  if (value === 0) return '-'
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    minimumFractionDigits: 0,
  }).format(value)
}

// Format date
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'short') {
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

// Format date and time
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Normalize phone number (leading-0 補完含む)
//   - 数字以外を除去
//   - +81 から始まる場合は +81 を 0 に置換
//   - 10桁で先頭が 7/8/9 → 携帯番号と判定し先頭に 0 追加 (Excel 数値化で 0 が落ちたケース)
//   - 9桁で先頭が 1-9 → 固定電話と判定し先頭に 0 追加
//   - その他の桁数 (11桁/10桁の0始まり/不明) は数字のみ返す
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  let s = String(input).trim()

  // 全角→半角
  s = s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))

  // +81 の処理
  if (s.startsWith('+81')) {
    s = '0' + s.slice(3)
  } else if (s.startsWith('81') && s.length >= 12) {
    // "81-90-1234-5678" など (国コード付きだが + なし)
    s = '0' + s.slice(2)
  }

  // 数字以外を除去
  const digits = s.replace(/\D/g, '')

  if (digits.length === 11 && digits.startsWith('0')) return digits
  if (digits.length === 10 && digits.startsWith('0')) return digits
  if (digits.length === 10 && /^[789]/.test(digits)) return '0' + digits
  if (digits.length === 9 && /^[1-9]/.test(digits)) return '0' + digits

  return digits
}

// Format phone number (ハイフン付き表記用)
export function formatPhone(phone: string): string {
  const cleaned = normalizePhone(phone)

  // 11桁携帯 0XX-YYYY-ZZZZ
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
  }

  // 10桁固定電話
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // 03/06 → 2桁市外局番
    if (/^0(3|6)/.test(cleaned)) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    // それ以外は3桁市外局番
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }

  return phone
}

// Calculate age from birthdate
export function calculateAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// Calculate BMI
export function calculateBMI(height: number, weight: number): number {
  if (!height || !weight) return 0
  const heightInMeters = height / 100
  return Math.round((weight / (heightInMeters * heightInMeters)) * 10) / 10
}
