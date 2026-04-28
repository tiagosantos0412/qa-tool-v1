// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth }     from './context/contexts';
import { ToastProvider }             from './context/contexts';
import { ProjectProvider }           from './context/contexts';

import AppLayout        from './components/Layout/AppLayout';
import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import ProjectsPage     from './pages/ProjectsPage';
import ProjectViewPage  from './pages/ProjectViewPage';
import TestCasesPage    from './pages/TestCasesPage';
import BugReportPage    from './pages/BugReportPage';
import BugDetailPage    from './pages/BugDetailPage';
import AIAssistantPage  from './pages/AIAssistantPage';
import AdminPage from './pages/AdminPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-base)' }}>
      <span className="spinner" style={{ width:28, height:28 }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ProjectProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route path="/" element={
                  <ProtectedRoute><AppLayout /></ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard"                          element={<DashboardPage />} />
                  <Route path="projects"                           element={<ProjectsPage />} />
                  <Route path="projects/:projectId"                element={<ProjectViewPage />} />
                  <Route path="projects/:projectId/test-cases"     element={<TestCasesPage />} />
                  <Route path="projects/:projectId/bugs"           element={<BugReportPage />} />
                  <Route path="projects/:projectId/bugs/:bugId"    element={<BugDetailPage />} />
                  <Route path="projects/:projectId/ai"             element={<AIAssistantPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                <Route path="admin" element={<AdminPage />} />
              </Routes>
            </BrowserRouter>
          </ProjectProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
