import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './stores/authStore'
import { MainLayout } from './components/layout'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { JobSeekerListPage, JobSeekerNewPage, JobSeekerDetailPage } from './pages/job-seekers'
import { CompanyListPage, CompanyNewPage, CompanyDetailPage } from './pages/companies'
import { JobListPage, JobNewPage, JobDetailPage } from './pages/jobs'
import { ReferralListPage, ReferralNewPage, ReferralDetailPage } from './pages/referrals'
import { InterviewSchedulePage } from './pages/interviews'
import { SalesListPage, SaleDetailPage } from './pages/sales'
import { ReportsPage, LegalDocumentsPage } from './pages/reports'
import { SettingsPage, UserManagementPage } from './pages/settings'

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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/job-seekers" element={<JobSeekerListPage />} />
            <Route path="/job-seekers/new" element={<JobSeekerNewPage />} />
            <Route path="/job-seekers/:id" element={<JobSeekerDetailPage />} />
            <Route path="/companies" element={<CompanyListPage />} />
            <Route path="/companies/new" element={<CompanyNewPage />} />
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/jobs" element={<JobListPage />} />
            <Route path="/jobs/new" element={<JobNewPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/interviews" element={<InterviewSchedulePage />} />
            <Route path="/referrals" element={<ReferralListPage />} />
            <Route path="/referrals/new" element={<ReferralNewPage />} />
            <Route path="/referrals/:id" element={<ReferralDetailPage />} />
            <Route path="/sales" element={<SalesListPage />} />
            <Route path="/sales/:id" element={<SaleDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/legal" element={<LegalDocumentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/users" element={<UserManagementPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
