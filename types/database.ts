export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      divisions: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          division_id: string | null
          name: string
          email: string
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          division_id?: string | null
          name: string
          email: string
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          division_id?: string | null
          name?: string
          email?: string
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          industry: string | null
          address: string | null
          phone: string | null
          email: string | null
          contact_person: string | null
          employee_id: string | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          industry?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          employee_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          industry?: string | null
          address?: string | null
          phone?: string | null
          email?: string | null
          contact_person?: string | null
          employee_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      jobs: {
        Row: {
          id: string
          company_id: string
          title: string
          description: string | null
          location: string | null
          hourly_rate: number | null
          employment_type: string | null
          requirements: string | null
          benefits: string | null
          working_hours: string | null
          holidays: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          description?: string | null
          location?: string | null
          hourly_rate?: number | null
          employment_type?: string | null
          requirements?: string | null
          benefits?: string | null
          working_hours?: string | null
          holidays?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          title?: string
          description?: string | null
          location?: string | null
          hourly_rate?: number | null
          employment_type?: string | null
          requirements?: string | null
          benefits?: string | null
          working_hours?: string | null
          holidays?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      candidates: {
        Row: {
          id: string
          employee_id: string | null
          name: string
          furigana: string | null
          gender: string | null
          birth_date: string | null
          phone: string | null
          email: string | null
          address: string | null
          preferred_job: string | null
          preferred_location: string | null
          desired_salary: number | null
          available_date: string | null
          stage: string
          stage_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id?: string | null
          name: string
          furigana?: string | null
          gender?: string | null
          birth_date?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          preferred_job?: string | null
          preferred_location?: string | null
          desired_salary?: number | null
          available_date?: string | null
          stage?: string
          stage_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string | null
          name?: string
          furigana?: string | null
          gender?: string | null
          birth_date?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          preferred_job?: string | null
          preferred_location?: string | null
          desired_salary?: number | null
          available_date?: string | null
          stage?: string
          stage_reason?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      applications: {
        Row: {
          id: string
          candidate_id: string
          source: string
          application_date: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          source: string
          application_date?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          source?: string
          application_date?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      interviews: {
        Row: {
          id: string
          candidate_id: string
          employee_id: string | null
          interview_date: string
          interview_time: string | null
          interview_type: string
          result: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          employee_id?: string | null
          interview_date: string
          interview_time?: string | null
          interview_type?: string
          result?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          employee_id?: string | null
          interview_date?: string
          interview_time?: string | null
          interview_type?: string
          result?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      introductions: {
        Row: {
          id: string
          candidate_id: string
          company_id: string
          job_id: string | null
          employee_id: string | null
          introduced_date: string
          status: string
          interview_date: string | null
          hire_date: string | null
          fee_amount: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          company_id: string
          job_id?: string | null
          employee_id?: string | null
          introduced_date?: string
          status?: string
          interview_date?: string | null
          hire_date?: string | null
          fee_amount?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          company_id?: string
          job_id?: string | null
          employee_id?: string | null
          introduced_date?: string
          status?: string
          interview_date?: string | null
          hire_date?: string | null
          fee_amount?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          introduction_id: string
          total_amount: number
          status: string
          invoice_date: string | null
          due_date: string | null
          paid_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          introduction_id: string
          total_amount: number
          status?: string
          invoice_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          introduction_id?: string
          total_amount?: number
          status?: string
          invoice_date?: string | null
          due_date?: string | null
          paid_date?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      v_attack_list: {
        Row: {
          id: string | null
          name: string | null
          phone: string | null
          status: string | null
          last_contact: string | null
          priority: number | null
          priority_label: string | null
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
