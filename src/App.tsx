import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'
import { MainLayout } from './components/layout'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { JobSeekerListPage, JobSeekerNewPage, JobSeekerDetailPage, JobSeekerEditPage } from './pages/job-seekers'
import { CompanyListPage, CompanyNewPage, CompanyDetailPage } from './pages/companies'
import { JobListPage, JobNewPage, JobDetailPage } from './pages/jobs'
import { ReferralListPage, ReferralNewPage, ReferralDetailPage } from './pages/referrals'
import { InterviewSchedulePage } from './pages/interviews'
import { SalesListPage, SaleDetailPage } from './pages/sales'
import { ReportsPage, LegalDocumentsPage } from './pages/reports'
import { SettingsPage, UserManagementPage } from './pages/settings'
import { PartnerJobSeekersPage } from './pages/partner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Partner-only redirect: パートナーが通常ページにアクセスしたら/partner/job-seekersへ
function NonPartnerRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role === 'partner') {
    return <Navigate to="/partner/job-seekers" replace />
  }
  return <>{children}</>
}

// Partner-only: パートナー以外がアクセスしたら/にリダイレクト
function PartnerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (user?.role !== 'partner') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// Public Route wrapper (redirects to dashboard if already logged in)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<NonPartnerRoute><DashboardPage /></NonPartnerRoute>} />
            <Route path="/job-seekers" element={<NonPartnerRoute><JobSeekerListPage /></NonPartnerRoute>} />
            <Route path="/job-seekers/new" element={<NonPartnerRoute><JobSeekerNewPage /></NonPartnerRoute>} />
            <Route path="/job-seekers/:id" element={<NonPartnerRoute><JobSeekerDetailPage /></NonPartnerRoute>} />
            <Route path="/job-seekers/:id/edit" element={<NonPartnerRoute><JobSeekerEditPage /></NonPartnerRoute>} />
            <Route path="/companies" element={<NonPartnerRoute><CompanyListPage /></NonPartnerRoute>} />
            <Route path="/companies/new" element={<NonPartnerRoute><CompanyNewPage /></NonPartnerRoute>} />
            <Route path="/companies/:id" element={<NonPartnerRoute><CompanyDetailPage /></NonPartnerRoute>} />
            <Route path="/jobs" element={<NonPartnerRoute><JobListPage /></NonPartnerRoute>} />
            <Route path="/jobs/new" element={<NonPartnerRoute><JobNewPage /></NonPartnerRoute>} />
            <Route path="/jobs/:id" element={<NonPartnerRoute><JobDetailPage /></NonPartnerRoute>} />
            <Route path="/interviews" element={<NonPartnerRoute><InterviewSchedulePage /></NonPartnerRoute>} />
            <Route path="/referrals" element={<NonPartnerRoute><ReferralListPage /></NonPartnerRoute>} />
            <Route path="/referrals/new" element={<NonPartnerRoute><ReferralNewPage /></NonPartnerRoute>} />
            <Route path="/referrals/:id" element={<NonPartnerRoute><ReferralDetailPage /></NonPartnerRoute>} />
            <Route path="/sales" element={<NonPartnerRoute><SalesListPage /></NonPartnerRoute>} />
            <Route path="/sales/:id" element={<NonPartnerRoute><SaleDetailPage /></NonPartnerRoute>} />
            <Route path="/reports" element={<NonPartnerRoute><ReportsPage /></NonPartnerRoute>} />
            <Route path="/reports/legal" element={<NonPartnerRoute><LegalDocumentsPage /></NonPartnerRoute>} />
            <Route path="/settings" element={<NonPartnerRoute><SettingsPage /></NonPartnerRoute>} />
            <Route path="/settings/users" element={<NonPartnerRoute><UserManagementPage /></NonPartnerRoute>} />

            {/* Partner Routes */}
            <Route path="/partner/job-seekers" element={<PartnerOnlyRoute><PartnerJobSeekersPage /></PartnerOnlyRoute>} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
