import { useState } from 'react'
import { X } from 'lucide-react'
import { Button, Input } from '../../components/ui'
import type { JobSeeker } from '../../types/database'

interface PartnerJobSeekerEditModalProps {
  jobSeeker: JobSeeker
  onClose: () => void
  onSave: (updates: Partial<JobSeeker>) => Promise<void>
}

export function PartnerJobSeekerEditModal({
  jobSeeker,
  onClose,
  onSave,
}: PartnerJobSeekerEditModalProps) {
  // 基本情報
  const [name, setName] = useState(jobSeeker.name || '')
  const [nameKana, setNameKana] = useState(jobSeeker.name_kana || '')
  const [phone, setPhone] = useState(jobSeeker.phone || '')
  const [birthDate, setBirthDate] = useState(jobSeeker.birth_date || '')
  const [gender, setGender] = useState<string>(jobSeeker.gender || '')
  const [prefecture, setPrefecture] = useState(jobSeeker.prefecture || '')
  const [city, setCity] = useState(jobSeeker.city || '')
  const [address, setAddress] = useState(jobSeeker.address || '')

  // スキル・資格
  const [qualifications, setQualifications] = useState(jobSeeker.qualifications || '')
  const [hasCarLicense, setHasCarLicense] = useState(jobSeeker.has_car_license || false)
  const [hasForklift, setHasForklift] = useState(jobSeeker.has_forklift || false)
  const [pcSkillLevel, setPcSkillLevel] = useState(jobSeeker.pc_skill_level || '')

  // 希望条件
  const [desiredJobType, setDesiredJobType] = useState(jobSeeker.desired_job_type || '')
  const [desiredEmploymentType, setDesiredEmploymentType] = useState(
    jobSeeker.desired_employment_type || '',
  )
  const [desiredWorkLocation, setDesiredWorkLocation] = useState(
    jobSeeker.desired_work_location || '',
  )
  const [desiredAnnualIncome, setDesiredAnnualIncome] = useState(
    jobSeeker.desired_annual_income?.toString() || '',
  )
  const [desiredStartDate, setDesiredStartDate] = useState(jobSeeker.desired_start_date || '')
  const [employmentStatus, setEmploymentStatus] = useState<string>(
    jobSeeker.employment_status || '',
  )

  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        name,
        name_kana: nameKana || null,
        phone,
        birth_date: birthDate || null,
        gender: (gender || null) as JobSeeker['gender'],
        prefecture: prefecture || null,
        city: city || null,
        address: address || null,
        qualifications: qualifications || null,
        has_car_license: hasCarLicense,
        has_forklift: hasForklift,
        pc_skill_level: pcSkillLevel || null,
        desired_job_type: desiredJobType || null,
        desired_employment_type: desiredEmploymentType || null,
        desired_work_location: desiredWorkLocation || null,
        desired_annual_income: desiredAnnualIncome ? Number(desiredAnnualIncome) : null,
        desired_start_date: desiredStartDate || null,
        employment_status: (employmentStatus || null) as JobSeeker['employment_status'],
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">プロフィール編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* 基本情報 */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
              基本情報
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="氏名 *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="フリガナ"
                value={nameKana}
                onChange={(e) => setNameKana(e.target.value)}
              />
              <Input
                label="電話番号 *"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Input
                label="生年月日"
                type="date"
                value={birthDate ? birthDate.split('T')[0] : ''}
                onChange={(e) => setBirthDate(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">性別</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">未設定</option>
                  <option value="male">男性</option>
                  <option value="female">女性</option>
                  <option value="other">その他</option>
                </select>
              </div>
            </div>
          </section>

          {/* 居住地 */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
              居住地
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="都道府県"
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
              />
              <Input
                label="市区町村"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <div className="sm:col-span-2">
                <Input
                  label="番地・建物名"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* スキル・資格 */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
              スキル・資格
            </h3>
            <div className="space-y-3">
              <Input
                label="保有資格"
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="例: 簿記2級, MOS, 危険物取扱者乙4"
              />
              <Input
                label="PCスキル"
                value={pcSkillLevel}
                onChange={(e) => setPcSkillLevel(e.target.value)}
                placeholder="例: Word/Excel基本操作"
              />
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasCarLicense}
                    onChange={(e) => setHasCarLicense(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">普通自動車免許</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasForklift}
                    onChange={(e) => setHasForklift(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">フォークリフト</span>
                </label>
              </div>
            </div>
          </section>

          {/* 希望条件 */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 mb-3 pb-1 border-b border-slate-200">
              希望条件
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="希望職種"
                value={desiredJobType}
                onChange={(e) => setDesiredJobType(e.target.value)}
              />
              <Input
                label="希望雇用形態"
                value={desiredEmploymentType}
                onChange={(e) => setDesiredEmploymentType(e.target.value)}
                placeholder="例: 派遣, 正社員"
              />
              <Input
                label="希望勤務地"
                value={desiredWorkLocation}
                onChange={(e) => setDesiredWorkLocation(e.target.value)}
              />
              <Input
                label="希望年収（万円）"
                type="number"
                value={desiredAnnualIncome}
                onChange={(e) => setDesiredAnnualIncome(e.target.value)}
              />
              <Input
                label="希望開始日"
                type="date"
                value={desiredStartDate ? desiredStartDate.split('T')[0] : ''}
                onChange={(e) => setDesiredStartDate(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">就業状況</label>
                <select
                  value={employmentStatus}
                  onChange={(e) => setEmploymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">未設定</option>
                  <option value="employed">就業中</option>
                  <option value="unemployed">離職中</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}
