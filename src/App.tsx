import { useEffect, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Routes, Route, useLocation } from 'react-router-dom';
import { onAuthStateChanged, auth } from './firebase';
import type { User } from 'firebase/auth';
import ProtectedRoute from './components/ProtectedRoute';

// ✅ 1. Import หน้าหลักที่จำเป็นทันที (Critical Path)
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import HomeFeedPage from './pages/HomeFeedPage';
import DetailPage from './pages/DetailPage';
import ProfilePage from './pages/ProfilePage';
import AppShell from './components/AppShell';

// ✅ 2. Lazy Load หน้าที่หนักหรือไม่สำคัญต่อหน้าแรก (Non-Critical)
// ช่วยลดขนาด Bundle เริ่มต้น ทำให้เว็บโหลดเร็วขึ้น
const HomeMapPage = lazy(() => import('./pages/HomeMapPage'));
const ReportFormPage = lazy(() => import('./pages/ReportFormPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// ✅ Component สำหรับแสดงขณะรอโหลดหน้า (Fallback)
const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/90 p-6 shadow-glass">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500"></div>
      <p className="font-medium text-orange-600">กำลังโหลดหน้า...</p>
    </div>
  </div>
);

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
      {/* AppShell แสดงตลอดทุกหน้า */}
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
              <div className="rounded-3xl bg-white/90 p-6 shadow-glass flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                <p className="text-orange-600 font-medium">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <Routes location={location}>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage user={user} />} />
              <Route path="/auth/:mode" element={<AuthPage />} />
              
              {/* Map & Feed */}
              <Route 
                path="/map" 
                element={
                  <Suspense fallback={<PageLoader />}>
                    <HomeMapPage user={user} />
                  </Suspense>
                } 
              />
              <Route path="/feed" element={<HomeFeedPage user={user} />} />
              
              {/* Detail View */}
              <Route path="/detail/:id" element={<DetailPage user={user} />} />

              {/* Protected Routes: Reporting */}
              <Route
                path="/report/:type"
                element={
                  <ProtectedRoute user={user}>
                    <Suspense fallback={<PageLoader />}>
                      <ReportFormPage user={user} />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              
              {/* Protected Routes: Edit Post */}
              <Route
                path="/report/edit/:id"
                element={
                  <ProtectedRoute user={user}>
                    <Suspense fallback={<PageLoader />}>
                      <ReportFormPage user={user} />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes: Profile */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute user={user}>
                    <ProfilePage user={user} />
                  </ProtectedRoute>
                }
              />

              {/* ✅ Admin Route */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute user={user}>
                    <Suspense fallback={<PageLoader />}>
                      <AdminPage />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />

              {/* Fallback */}
              <Route path="*" element={<LandingPage user={user} />} />
            </Routes>
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

export default App;