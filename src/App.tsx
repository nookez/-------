import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Routes, Route, useLocation } from 'react-router-dom';
import { onAuthStateChanged, auth } from './firebase';
import type { User } from 'firebase/auth';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import HomeFeedPage from './pages/HomeFeedPage';
import HomeMapPage from './pages/HomeMapPage'; // หรือ MapPage ตามชื่อไฟล์จริงของคุณ
import ReportFormPage from './pages/ReportFormPage';
import ProfilePage from './pages/ProfilePage';
import AppShell from './components/AppShell';
import DetailPage from './pages/DetailPage';
// ✅ เพิ่ม Import หน้า Admin
import AdminPage from './pages/AdminPage'; 

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
              <Route path="/map" element={<HomeMapPage user={user} />} />
              <Route path="/feed" element={<HomeFeedPage user={user} />} />
              
              {/* Detail View */}
              <Route path="/detail/:id" element={<DetailPage user={user} />} />

              {/* Protected Routes: Reporting */}
              <Route
                path="/report/:type"
                element={
                  <ProtectedRoute user={user}>
                    <ReportFormPage user={user} />
                  </ProtectedRoute>
                }
              />
              
              {/* Protected Routes: Edit Post */}
              <Route
                path="/report/edit/:id"
                element={
                  <ProtectedRoute user={user}>
                    <ReportFormPage user={user} />
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

              {/* ✅ Admin Route (เช็กสิทธิ์ภายใน Component แล้ว แต่ใส่ไว้ใน Routes ให้ชัดเจน) */}
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute user={user}>
                    <AdminPage />
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