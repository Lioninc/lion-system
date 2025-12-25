'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'

// デモデータ
const demoCandidate = {
  id: '1',
  name: '田中太郎',
  name_kana: 'タナカタロウ',
  gender: '男性',
  birth_date: '1996/05/15',
  age: 28,
  phone: '090-1234-5678',
  email: 'tanaka@example.com',
  address: '東京都新宿区西新宿1-1-1',
  desired_occupation: '製造業',
  preferred_location: '東京都、埼玉県',
  desired_salary: 250000,
  available_date: '即日',
  status: '有効応募',
  employee_name: '山田花子',
  notes: '経験豊富で即戦力となりうる。コミュニケーション能力が高い。',
}

const demoApplications = [
  { id: '1', applied_date: '2024/12/20', source: 'Indeed', status: '有効応募' },
  { id: '2', applied_date: '2024/11/15', source: 'タウンワーク', status: '無効応募' },
]

const demoInterviews = [
  { id: '1', date: '2024/12/22', time: '10:00', employee: '山田花子', result: '繋ぎ', notes: '製造業に興味あり' },
  { id: '2', date: '2024/12/21', time: '14:00', employee: '鈴木一郎', result: '繋げず', notes: '電話つながらず' },
]

const demoIntroductions = [
  { id: '1', date: '2024/12/23', company: '株式会社ABC', job: '製造スタッフ', status: '面接予定', interview_date: '2024/12/25' },
]

const tabs = [
  { id: 'summary', label: '詳細' },
  { id: 'basic', label: '基本情報' },
  { id: 'applications', label: '応募履歴' },
  { id: 'interviews', label: '面談履歴' },
  { id: 'introductions', label: '企業紹介' },
]

function getStatusBadge(status: string) {
  switch (status) {
    case '有効応募':
      return <Badge variant="success">{status}</Badge>
    case '無効応募':
      return <Badge variant="danger">{status}</Badge>
    case '電話出ず':
      return <Badge variant="warning">{status}</Badge>
    case '就業時期が先':
      return <Badge variant="purple">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

function getResultBadge(result: string) {
  switch (result) {
    case '繋ぎ':
      return <Badge variant="success">{result}</Badge>
    case '繋げず':
      return <Badge variant="danger">{result}</Badge>
    default:
      return <Badge>{result}</Badge>
  }
}

function getIntroductionStatusBadge(status: string) {
  switch (status) {
    case '採用':
      return <Badge variant="success">{status}</Badge>
    case '面接予定':
      return <Badge variant="info">{status}</Badge>
    case '面接済':
      return <Badge variant="purple">{status}</Badge>
    case '不採用':
      return <Badge variant="danger">{status}</Badge>
    default:
      return <Badge>{status}</Badge>
  }
}

export default function CandidateDetailPage() {
  const params = useParams()
  const [activeTab, setActiveTab] = useState('summary')

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/candidates"
            className="text-slate-600 hover:text-slate-800 flex items-center gap-1"
          >
            <span>←</span>
            <span>一覧に戻る</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">{demoCandidate.name}</h1>
          {getStatusBadge(demoCandidate.status)}
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

      {/* 詳細（サマリー） */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">氏名</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.name}（{demoCandidate.name_kana}）</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">性別・年齢</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.gender} / {demoCandidate.age}歳</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">電話番号</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.phone}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">担当者</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.employee_name}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">希望条件</h2>
            <dl className="space-y-3">
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望職種</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.desired_occupation}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望勤務地</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.preferred_location}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">希望給与</dt>
                <dd className="text-sm text-slate-800">¥{demoCandidate.desired_salary?.toLocaleString()}</dd>
              </div>
              <div className="flex">
                <dt className="w-32 text-sm text-slate-500">就業可能日</dt>
                <dd className="text-sm text-slate-800">{demoCandidate.available_date}</dd>
              </div>
            </dl>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">備考</h2>
            <p className="text-sm text-slate-700">{demoCandidate.notes}</p>
          </Card>
        </div>
      )}

      {/* 基本情報 */}
      {activeTab === 'basic' && (
        <Card>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">基本情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">氏名</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.name}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">ふりがな</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.name_kana}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">性別</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.gender}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">生年月日</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.birth_date}（{demoCandidate.age}歳）</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">電話番号</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.phone}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">メールアドレス</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.email}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded md:col-span-2">
              <dt className="text-xs text-slate-500">住所</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.address}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">希望職種</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.desired_occupation}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">希望勤務地</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.preferred_location}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">希望給与</dt>
              <dd className="text-sm text-slate-800 mt-1">¥{demoCandidate.desired_salary?.toLocaleString()}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">就業可能日</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.available_date}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">ステータス</dt>
              <dd className="text-sm text-slate-800 mt-1">{getStatusBadge(demoCandidate.status)}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded">
              <dt className="text-xs text-slate-500">担当者</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.employee_name}</dd>
            </div>
            <div className="p-3 bg-slate-50 rounded md:col-span-2">
              <dt className="text-xs text-slate-500">備考</dt>
              <dd className="text-sm text-slate-800 mt-1">{demoCandidate.notes}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* 応募履歴 */}
      {activeTab === 'applications' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">応募履歴</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>応募日</TableHead>
                <TableHead>応募媒体</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoApplications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>{app.applied_date}</TableCell>
                  <TableCell>{app.source}</TableCell>
                  <TableCell>{getStatusBadge(app.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 面談履歴 */}
      {activeTab === 'interviews' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">面談履歴</h2>
            <Button size="sm">新規面談</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>担当</TableHead>
                <TableHead>結果</TableHead>
                <TableHead>備考</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoInterviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>{interview.date}</TableCell>
                  <TableCell>{interview.time}</TableCell>
                  <TableCell>{interview.employee}</TableCell>
                  <TableCell>{getResultBadge(interview.result)}</TableCell>
                  <TableCell className="max-w-xs truncate">{interview.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 企業紹介 */}
      {activeTab === 'introductions' && (
        <Card padding="none">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">企業紹介</h2>
            <Button size="sm">新規紹介</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>紹介日</TableHead>
                <TableHead>企業名</TableHead>
                <TableHead>案件</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>面接日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoIntroductions.map((intro) => (
                <TableRow key={intro.id}>
                  <TableCell>{intro.date}</TableCell>
                  <TableCell>{intro.company}</TableCell>
                  <TableCell>{intro.job}</TableCell>
                  <TableCell>{getIntroductionStatusBadge(intro.status)}</TableCell>
                  <TableCell>{intro.interview_date || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
