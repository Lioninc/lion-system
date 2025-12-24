'use client'

import { useState } from 'react'
import { Card, Select } from '@/components/ui'

// デモデータ
const demoFunnelData = {
  thisMonth: {
    applications: 150,
    validApplications: 120,
    interviews: 80,
    introductions: 45,
    hires: 12,
  },
  lastMonth: {
    applications: 180,
    validApplications: 140,
    interviews: 95,
    introductions: 55,
    hires: 15,
  },
  all: {
    applications: 1500,
    validApplications: 1200,
    interviews: 800,
    introductions: 450,
    hires: 120,
  },
}

const periodOptions = [
  { value: 'thisMonth', label: '今月' },
  { value: 'lastMonth', label: '先月' },
  { value: 'all', label: '全期間' },
]

export default function FunnelPage() {
  const [period, setPeriod] = useState('thisMonth')

  const data = demoFunnelData[period as keyof typeof demoFunnelData]

  const stages = [
    { label: '応募', value: data.applications, color: 'bg-slate-200' },
    { label: '有効応募', value: data.validApplications, color: 'bg-blue-200' },
    { label: '面談', value: data.interviews, color: 'bg-blue-400' },
    { label: '紹介', value: data.introductions, color: 'bg-blue-500' },
    { label: '成約', value: data.hires, color: 'bg-emerald-500' },
  ]

  const calculateRate = (current: number, previous: number) => {
    if (previous === 0) return 0
    return Math.round((current / previous) * 100)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">歩留確認</h1>
        <div className="w-40">
          <Select
            options={periodOptions}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {/* ファネルチャート */}
      <Card>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const maxValue = stages[0].value
            const width = (stage.value / maxValue) * 100
            const prevValue = index > 0 ? stages[index - 1].value : stage.value
            const rate = calculateRate(stage.value, prevValue)

            return (
              <div key={stage.label} className="flex items-center gap-4">
                <div className="w-20 text-sm font-medium text-slate-600 text-right">
                  {stage.label}
                </div>
                <div className="flex-1">
                  <div
                    className={`${stage.color} h-10 rounded-r-lg flex items-center justify-end pr-3 transition-all duration-500`}
                    style={{ width: `${Math.max(width, 10)}%` }}
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {stage.value.toLocaleString()}件
                    </span>
                  </div>
                </div>
                <div className="w-16 text-right">
                  {index > 0 && (
                    <span
                      className={`text-sm font-medium ${
                        rate >= 80
                          ? 'text-emerald-600'
                          : rate >= 50
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {rate}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 詳細数値 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {stages.map((stage, index) => {
          const prevValue = index > 0 ? stages[index - 1].value : stage.value
          const rate = calculateRate(stage.value, prevValue)

          return (
            <Card key={stage.label}>
              <h3 className="text-sm text-slate-500 mb-1">{stage.label}</h3>
              <p className="text-2xl font-bold text-slate-800">
                {stage.value.toLocaleString()}
                <span className="text-sm font-normal text-slate-500">件</span>
              </p>
              {index > 0 && (
                <p
                  className={`text-sm mt-1 ${
                    rate >= 80
                      ? 'text-emerald-600'
                      : rate >= 50
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  遷移率: {rate}%
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* 全体の成約率 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">全体成約率</h3>
            <p className="text-sm text-slate-500">応募から成約までの遷移率</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold text-emerald-600">
              {calculateRate(data.hires, data.applications)}%
            </p>
            <p className="text-sm text-slate-500">
              {data.hires.toLocaleString()}件 / {data.applications.toLocaleString()}件
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
