import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import LogoReveal from '@/components/LogoReveal';
import TopNav from '@/components/TopNav';
import Footer from '@/components/Footer';
import ProtectedRoute from '@/components/ProtectedRoute';

import LandingPage from '@/pages/LandingPage';
import BookingPage from '@/pages/BookingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AccountPage from '@/pages/AccountPage';
import MasterPanel from '@/pages/MasterPanel';
import NotFoundPage from '@/pages/NotFoundPage';

import AdminLayout from '@/pages/admin/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import MastersPage from '@/pages/admin/MastersPage';
import ServicesPage from '@/pages/admin/ServicesPage';
import BookingsPage from '@/pages/admin/BookingsPage';
import SettingsPage from '@/pages/admin/SettingsPage';

function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 pt-20">{children}</main>
      <Footer />
    </div>
  );
}

function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 pb-28 pt-20">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <>
      <LogoReveal />
      <Routes>
        <Route
          path="/"
          element={
            <SiteLayout>
              <LandingPage />
            </SiteLayout>
          }
        />

        <Route
          path="/book"
          element={
            <BookingLayout>
              <BookingPage />
            </BookingLayout>
          }
        />

        <Route
          path="/login"
          element={
            <SiteLayout>
              <LoginPage />
            </SiteLayout>
          }
        />

        <Route
          path="/register"
          element={
            <SiteLayout>
              <RegisterPage />
            </SiteLayout>
          }
        />

        <Route
          path="/account"
          element={
            <ProtectedRoute roles={['client']}>
              <SiteLayout>
                <AccountPage />
              </SiteLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/master"
          element={
            <ProtectedRoute roles={['master']}>
              <SiteLayout>
                <MasterPanel />
              </SiteLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="masters" element={<MastersPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="*"
          element={
            <SiteLayout>
              <NotFoundPage />
            </SiteLayout>
          }
        />
      </Routes>
    </>
  );
}
