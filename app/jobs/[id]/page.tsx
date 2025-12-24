'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge } from '@/components/ui'

// デモデータ
const demoJob = {
  id: '1',
  title: '製造スタッフ',
  company_id: '1',
  company_name: '株式会社ABC',
  description: '自動車部品の製造ラインでの作業をお任せします。未経験者歓迎、丁寧に指導いたします。',
  location: '東京都大田区',
  nearest_station: 'JR蒲田駅 徒歩10分',
  hourly_rate: 1200,
  employment_type: '派遣',
  working_hours: '8:00〜17:00（休憩60分）',
  holidays: '土日祝、GW、夏季休暇、年末年始',
  requirements: '・18歳以上\n・長期勤務可能な方\n・未経験歓迎',
  benefits: '・交通費支給（上限15,000円/月）\n・社会保険完備\n・制服貸与\n・食堂あり',
  status: '募集中',
}

const tabs = [
  { id: 'basic', label: '基本情報' },
  { id: 'description', label: '求人内容' },
  { id: 'conditions', label: '勤務条件' },
  { id: 'benefits', label: '待遇・福利厚生' },
  { id: 'requirements', label: '採用要件' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '募集中':
      return <Badge variant="success">{status}</Badge>
    case '募集停止':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function JobDetailPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState('basic')

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/jobs"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{demoJob.title}</h1>
          {getStatusBadge(demoJob.status)}
        </div>
        <Button>編集</Button>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 基本情報 */}
      {activeTab === 'basic' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">案件名</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.title}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">企業名</dt>
              <dd className="text-sm text-slate-800 mt-1">
                <Link href={`/companies/${demoJob.company_id}`} className="text-blue-600 hover:underline">
                  {demoJob.company_name}
                </Link>
              </dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">勤務地</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.location}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">最寄り駅</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.nearest_station}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">時給</dt>
              <dd className="text-sm text-slate-800 mt-1">¥{demoJob.hourly_rate.toLocaleString()}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">雇用形態</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.employment_type}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* 求人内容 */}
      {activeTab === 'description' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">求人内容</h2>
          <p className="text-sm text-slate-700 whitespace-pre-line">{demoJob.description}</p>
        </Card>
      )}

      {/* 勤務条件 */}
      {activeTab === 'conditions' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">勤務条件</h2>
          <dl className="space-y-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">勤務時間</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.working_hours}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">休日</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoJob.holidays}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* 待遇・福利厚生 */}
      {activeTab === 'benefits' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">待遇・福利厚生</h2>
          <p className="text-sm text-slate-700 whitespace-pre-line">{demoJob.benefits}</p>
        </Card>
      )}

      {/* 採用要件 */}
      {activeTab === 'requirements' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">採用要件</h2>
          <p className="text-sm text-slate-700 whitespace-pre-line">{demoJob.requirements}</p>
        </Card>
      )}
    </div>
  )
}
