/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { CitizenReportPage } from './pages/CitizenReportPage';
import { TrackComplaintPage } from './pages/TrackComplaintPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { testConnection } from './firebase';

type AppPage = 'home' | 'report' | 'track' | 'admin-login' | 'admin-dashboard';

const MainContent: React.FC = () => {
  const { isAdmin, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [trackingId, setTrackingId] = useState<string>('');

  // Validate Firestore server reachability on app boot
  useEffect(() => {
    testConnection();
  }, []);

  const handleNavigate = (page: AppPage, complaintId?: string) => {
    if (complaintId) {
      setTrackingId(complaintId);
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      <Navbar
        currentPage={currentPage}
        onNavigate={(page) => handleNavigate(page)}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={(page) => handleNavigate(page)}
            isAdmin={isAdmin}
          />
        )}

        {currentPage === 'report' && (
          <CitizenReportPage
            onNavigateToTrack={(id) => handleNavigate('track', id)}
            onNavigateHome={() => handleNavigate('home')}
          />
        )}

        {currentPage === 'track' && (
          <TrackComplaintPage
            initialComplaintId={trackingId}
            onNavigateToReport={() => handleNavigate('report')}
          />
        )}

        {currentPage === 'admin-login' && (
          <AdminLoginPage
            onNavigateToDashboard={() => handleNavigate('admin-dashboard')}
          />
        )}

        {currentPage === 'admin-dashboard' && (
          <>
            {isAdmin ? (
              <AdminDashboardPage
                onNavigateHome={() => handleNavigate('home')}
              />
            ) : (
              <AdminLoginPage
                onNavigateToDashboard={() => handleNavigate('admin-dashboard')}
              />
            )}
          </>
        )}
      </main>

      <Footer onNavigate={(page) => handleNavigate(page)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <MainContent />
      </LanguageProvider>
    </AuthProvider>
  );
}
