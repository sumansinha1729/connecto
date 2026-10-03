import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ApiError } from './api/client';
import { DialogHost, ToastHost } from './components/dialogs';
import { Layout } from './components/Layout';
import './index.css';
import { useSession } from './lib/hooks';
import { ActivityPage } from './pages/Activity';
import { ApplicationsPage } from './pages/Applications';
import { AuditPage } from './pages/Audit';
import { LivePage } from './pages/Live';
import { LoginPage } from './pages/Login';
import { MoneyPage } from './pages/Money';
import { PayoutsPage } from './pages/Payouts';
import { ReportsPage } from './pages/Reports';
import { SafetyPage } from './pages/Safety';
import { UserDetailPage } from './pages/UserDetail';
import { UsersPage } from './pages/Users';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry "not allowed" / "not found"; do retry network blips
      retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  const session = useSession();

  // Signed out (or the session expired): only the login page
  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LivePage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="money" element={<MoneyPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="applications" element={<ApplicationsPage />} />
        <Route path="payouts" element={<PayoutsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <DialogHost />
        <ToastHost />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
