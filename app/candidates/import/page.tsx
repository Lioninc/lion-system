import Link from 'next/link'
import CsvImporter from '@/components/features/CsvImporter'

export default function CsvImportPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/candidates"
          className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
        >
          <span>←</span>
          <span>一覧に戻る</span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">CSVインポート</h1>
      </div>

      <CsvImporter />
    </div>
  )
}
