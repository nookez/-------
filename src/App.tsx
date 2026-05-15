import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Routes, Route, useLocation } from 'react-router-dom';
import { onAuthStateChanged, auth } from './firebase';
import type { User } from 'firebase/auth';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import HomeFeedPage from './pages/HomeFeedPage';
import HomeMapPage from './pages/HomeMapPage';
import ReportFormPage from './pages/ReportFormPage';
import ProfilePage from './pages/ProfilePage';
import DetailPage from './pages/DetailPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-slate-50 text-slate-900">
      <AppShell user={user} />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8"
        >
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="rounded-3xl bg-white/90 p-6 shadow-glass">
                <p className="text-orange-600">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <Routes location={location}>
              <Route path="/" element={<LandingPage user={user} />} />
              <Route path="/auth/:mode" element={<AuthPage />} />
              <Route path="/map" element={<HomeMapPage user={user} />} />
              <Route path="/feed" element={<HomeFeedPage user={user} />} />
              <Route
                path="/report/:type"
                element={
                  <ProtectedRoute user={user}>
                    <ReportFormPage user={user} />
                  </ProtectedRoute>
                }
              />
              {/* เพิ่ม route นี้ */}
              <Route
                path="/report/edit/:id"
                element={
                  <ProtectedRoute user={user}>
                    <ReportFormPage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route path="/detail/:id" element={<DetailPage user={user} />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute user={user}>
                    <ProfilePage user={user} />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<LandingPage user={user} />} />
            </Routes>
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

export default App;