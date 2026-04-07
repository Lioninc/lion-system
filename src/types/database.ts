// Database types for Supabase

export type ApplicationStatus =
  | 'new'
  | 'valid'
  | 'invalid'
  | 'no_answer'
  | 'connected'
  | 'working'
  | 'completed'

export type ProgressStatus =
  | 'phone_interview_scheduled'
  | 'phone_interview_done'
  | 'referred'
  | 'dispatch_interview_scheduled'
  | 'dispatch_interview_done'
  | 'hired'
  | 'pre_assignment'
  | 'assigned'
  | 'working'
  | 'full_paid'

export type UserRole = 'super_admin' | 'admin' | 'coordinator' | 'clerk' | 'viewer' | 'partner'

export type EmploymentStatus = 'active' | 'retired'

export interface User {
  id: string
  employee_id: string | null
  email: string
  name: string
  role: UserRole
  department: string | null
  employment_status: EmploymentStatus
  tenant_id: string | null
  created_at: string
  updated_at: string
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: '在職中',
  retired: '退職済み',
}

export interface Tenant {
  id: string
  name: string
  code: string
  tenant_type: 'main' | 'agent'
  parent_tenant_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface JobSeeker {
  id: string
  tenant_id: string
  phone: string
  name: string
  name_kana: string | null
  email: string | null
  line_id: string | null
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  height: number | null
  weight: number | null
  has_tattoo: boolean
  has_medical_condition: boolean
  medical_condition_detail: string | null
  has_spouse: boolean
  has_children: boolean
  employment_status: 'unemployed' | 'employed' | null
  desired_start_date: string | null
  desired_period: string | null
  notes: string | null
  photo_url: string | null
  resume_url: string | null
  education: string | null
  work_history_1: string | null
  work_history_2: string | null
  work_history_3: string | null
  qualifications: string | null
  hobbies: string | null
  education_level: string | null
  education_school: string | null
  education_faculty: string | null
  graduation_year: number | null
  work_history: string | null
  current_job_type: string | null
  reason_for_change: string | null
  current_annual_income: number | null
  desired_annual_income: number | null
  desired_job_type: string | null
  desired_employment_type: string | null
  desired_work_location: string | null
  remote_work_preference: string | null
  pc_skill_level: string | null
  language_skill: string | null
  toeic_score: number | null
  has_car_license: boolean
  has_forklift: boolean
  commute_method: string | null
  commute_time: number | null
  other_job_hunting: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Application {
  id: string
  tenant_id: string
  job_seeker_id: string
  source_id: string | null
  coordinator_id: string | null
  application_status: ApplicationStatus
  progress_status: ProgressStatus | null
  job_type: string | null
  applied_at: string
  notes: string | null
  created_at: string
  updated_at: string
  job_seeker?: JobSeeker
  source?: Source
  coordinator?: User
}

export interface Source {
  id: string
  tenant_id: string
  name: string
  cost_per_application: number | null
  is_active: boolean
  created_at: string
}

export type CompanyType = 'dispatch' | 'direct' | 'client'

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  dispatch: '派遣会社',
  direct: '紹介企業（ホワイトカラー）',
  client: '派遣先企業',
}

export interface Company {
  id: string
  tenant_id: string
  name: string
  business_type: string | null
  company_type: CompanyType
  company_type_v2: CompanyType | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  contact_person: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  tenant_id: string
  company_id: string
  title: string
  job_type: string | null
  postal_code: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  salary_type: 'hourly' | 'daily' | 'monthly' | null
  salary_min: number | null
  salary_max: number | null
  working_hours: string | null
  holidays: string | null
  benefits: string | null
  employment_type: string | null
  description: string | null
  requirements: string | null
  has_dormitory: boolean
  dormitory_details: string | null
  fee_type: 'fixed' | 'percentage' | null
  fee_amount: number | null
  fee_percentage: number | null
  notes: string | null
  client_company_id: string | null
  status: 'open' | 'closed' | 'paused'
  created_at: string
  updated_at: string
  company?: Company
  client_company?: Company
}

export interface Referral {
  id: string
  tenant_id: string
  application_id: string
  job_id: string
  referral_status: string
  referred_at: string
  dispatch_interview_at: string | null
  hired_at: string | null
  assignment_date: string | null
  start_work_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  application?: Application
  job?: Job
}

export type ContactResult = 'connected' | 'absent' | 'callback' | 'voicemail' | 'other'

export const CONTACT_RESULT_LABELS: Record<ContactResult, string> = {
  connected: '繋がった',
  absent: '不在',
  callback: '折り返し依頼',
  voicemail: '留守電',
  other: 'その他',
}

export interface ContactLog {
  id: string
  tenant_id: string
  application_id: string
  contact_type: 'phone' | 'email' | 'line' | 'other'
  direction: 'inbound' | 'outbound'
  result: ContactResult | null
  notes: string | null
  contacted_by: string | null
  contacted_at: string
  created_at: string
}

export type InterviewResult = 'referred' | 'considering' | 'not_connected'

export const INTERVIEW_RESULT_LABELS: Record<InterviewResult, string> = {
  referred: '派遣面接組み',
  considering: '検討中',
  not_connected: '繋げず',
}

export interface Interview {
  id: string
  tenant_id: string
  application_id: string
  contact_log_id: string | null
  scheduled_at: string
  conducted_at: string | null
  result: InterviewResult | null
  transcript: string | null
  eval_hearing: number | null
  eval_proposal: number | null
  eval_closing: number | null
  eval_impression: number | null
  eval_comment: string | null
  notes: string | null
  interviewer_id: string | null
  employment_status: string | null
  available_from: string | null
  work_period: string | null
  has_side_job: boolean
  family_status: string | null
  health_notes: string | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  tenant_id: string
  referral_id: string
  amount: number
  status: 'expected' | 'confirmed' | 'invoiced' | 'paid'
  expected_date: string | null
  confirmed_date: string | null
  invoiced_date: string | null
  paid_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  tenant_id: string
  sale_id: string
  amount: number
  paid_at: string
  payment_month: string | null
  payment_method: string | null
  refund_reason: string | null
  notes: string | null
  created_at: string
}

export interface DispatchHistory {
  id: string
  tenant_id: string
  job_seeker_id: string
  company_name: string
  created_at: string
}

export type WorkStartContactType = 'week_before' | 'three_days_before' | 'on_day' | 'week_after'

export const WORK_START_CONTACT_TYPE_LABELS: Record<WorkStartContactType, string> = {
  week_before: '1週間前',
  three_days_before: '3日前',
  on_day: '当日',
  week_after: '1週間後',
}

export interface WorkStartContact {
  id: string
  tenant_id: string
  referral_id: string
  contact_type: WorkStartContactType
  status: 'pending' | 'contacted'
  created_at: string
  updated_at: string
}

// Status display labels
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: '新規応募',
  valid: '有効応募',
  invalid: '無効応募',
  no_answer: '電話出ず',
  connected: '繋ぎ済み',
  working: '稼働中',
  completed: '完了',
}

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  phone_interview_scheduled: '電話面談予約済み',
  phone_interview_done: '電話面談済み',
  referred: '派遣会社紹介済み',
  dispatch_interview_scheduled: '派遣面接予定',
  dispatch_interview_done: '派遣面接済み',
  hired: '採用',
  pre_assignment: '赴任前',
  assigned: '赴任済み',
  working: '稼働中',
  full_paid: '全額入金',
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'スーパー管理者',
  admin: '管理者',
  coordinator: 'コーディネーター',
  clerk: '事務員',
  viewer: '閲覧者',
  partner: 'パートナー',
}

export type ReferralStatus =
  | 'referred'
  | 'interview_scheduled'
  | 'interview_done'
  | 'hired'
  | 'pre_assignment'
  | 'assigned'
  | 'working'
  | 'cancelled'
  | 'declined'

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  referred: '紹介済み',
  interview_scheduled: '面接予定',
  interview_done: '面接済み',
  hired: '採用',
  pre_assignment: '赴任前',
  assigned: '赴任済み',
  working: '稼働中',
  cancelled: 'キャンセル',
  declined: '不採用',
}

export type SaleStatus = 'expected' | 'confirmed' | 'invoiced' | 'paid'

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  expected: '売上見込',
  confirmed: '売上確定',
  invoiced: '請求済み',
  paid: '入金済み',
}
