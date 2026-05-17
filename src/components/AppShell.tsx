import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import {
  PawPrint, Menu, X, User as UserIcon, LogOut, Plus, MapPin, Home,
  Search, Bell, Settings, ChevronDown,
} from 'lucide-react';

import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

const auth = getAuth();

interface AppShellProps {
  user: User | null;
}

// ─── Nav items ────────────────────────────────────────────────
const navItems = [
  { path: '/',     label: 'หน้าหลัก', icon: Home   },
  { path: '/feed', label: 'ฟีด',       icon: Search },
  { path: '/map',  label: 'แผนที่',     icon: MapPin },
];

// ─── Helpers ──────────────────────────────────────────────────
function isActivePath(current: string, path: string) {
  if (path === '/') return current === '/';
  return current === path || current.startsWith(path + '/');
}

// ─── UserAvatar Dropdown ──────────────────────────────────────
function UserAvatar({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const initials =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U';

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm border border-orange-100 hover:border-orange-300 transition-all"
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[100px] truncate">
          {user.displayName || user.email?.split('@')[0]}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden z-[60]"
          >
            <div className="p-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user.displayName || 'ผู้ใช้'}
              </p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
            <div className="py-1">
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition"
              >
                <UserIcon className="h-4 w-4" />
                โปรไฟล์ของฉัน
              </Link>
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-orange-50 hover:text-orange-600 transition"
              >
                <Settings className="h-4 w-4" />
                การตั้งค่า
              </Link>
              <button
                onClick={() => { setOpen(false); onSignOut(); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition text-left"
              >
                <LogOut className="h-4 w-4" />
                ออกจากระบบ
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mobile Bottom Nav Button ─────────────────────────────────
function BottomNavBtn({
  onClick,
  icon: Icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-2xl transition-all ${
        active
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
          : 'text-slate-500 hover:bg-orange-50 hover:text-orange-600'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </motion.button>
  );
}

// ─── AppShell ─────────────────────────────────────────────────
export default function AppShell({ user }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled]         = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const active = (path: string) => isActivePath(location.pathname, path);

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          DESKTOP + TABLET HEADER  (hidden on mobile)
      ══════════════════════════════════════════════════════ */}
      <header
        className={`
          hidden md:block
          fixed top-0 inset-x-0 z-50
          transition-all duration-300
          ${scrolled
            ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-slate-200/60'
            : 'bg-white border-b border-transparent'}
        `}
      >
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow-md group-hover:scale-105 transition-transform">
              <PawPrint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 group-hover:text-orange-600 transition leading-tight">
                ช่วยกันหา
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">Pet Rescue TH</p>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  active(path)
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active(path) ? 'text-orange-500' : ''}`} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {user && (
              <Link
                to="/report/lost"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-orange-600 hover:to-amber-600 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">แจ้งเหตุ</span>
              </Link>
            )}

            {user && (
              <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-orange-500 transition">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
              </button>
            )}

            {user ? (
              <UserAvatar user={user} onSignOut={handleSignOut} />
            ) : (
              <Link
                to="/auth/login"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-orange-300 hover:text-orange-600 transition"
              >
                <UserIcon className="h-4 w-4" />
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MOBILE TOP BAR  (visible only on mobile)
      ══════════════════════════════════════════════════════ */}
      <header
        className={`
          flex md:hidden
          fixed top-0 inset-x-0 z-50 h-14 items-center justify-between px-4
          transition-all duration-300
          ${scrolled
            ? 'bg-white/90 backdrop-blur-xl shadow-sm border-b border-slate-200/60'
            : 'bg-white border-b border-slate-100'}
        `}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow">
            <PawPrint className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-slate-800">ช่วยกันหา</span>
        </Link>

        {/* Right: bell + hamburger */}
        <div className="flex items-center gap-1">
          {user && (
            <button className="relative p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-orange-500 transition">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
            aria-label="เมนู"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MOBILE SLIDE-OUT MENU
      ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-sm md:hidden"
            />

            {/* Panel */}
            <motion.div
              key="panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 z-[60] w-72 bg-white shadow-2xl flex flex-col md:hidden"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white">
                    <PawPrint className="h-4 w-4" />
                  </div>
                  <span className="font-bold text-slate-800">ช่วยกันหา</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              {/* User info (if logged in) */}
              {user && (
                <div className="px-4 py-3 border-b border-slate-100 bg-orange-50/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold shrink-0">
                      {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {user.displayName || 'ผู้ใช้'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                {navItems.map(({ path, label, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                      active(path)
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active(path) ? 'text-orange-500' : ''}`} />
                    {label}
                  </Link>
                ))}

                {user && (
                  <>
                    <div className="h-px bg-slate-100 my-2" />
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      <UserIcon className="h-5 w-5" />
                      โปรไฟล์ของฉัน
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      <Settings className="h-5 w-5" />
                      การตั้งค่า
                    </Link>
                  </>
                )}

                <div className="h-px bg-slate-100 my-2" />

                {/* Report CTA */}
                {user ? (
                  <Link
                    to="/report/lost"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-md"
                  >
                    <Plus className="h-5 w-5" />
                    แจ้งสัตว์เลี้ยงหาย
                  </Link>
                ) : (
                  <Link
                    to="/auth/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700"
                  >
                    <UserIcon className="h-5 w-5" />
                    เข้าสู่ระบบเพื่อแจ้งเหตุ
                  </Link>
                )}
              </nav>

              {/* Sign out footer */}
              {user && (
                <div className="px-3 py-3 border-t border-slate-100 shrink-0">
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition"
                  >
                    <LogOut className="h-5 w-5" />
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════
          MOBILE BOTTOM NAV  (hidden on md+)
      ══════════════════════════════════════════════════════ */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/60 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {/* Nav items (first 2) */}
          {navItems.slice(0, 2).map(({ path, label, icon: Icon }) => (
            <BottomNavBtn
              key={path}
              onClick={() => navigate(path)}
              icon={Icon}
              label={label}
              active={active(path)}
            />
          ))}

          {/* Center FAB */}
          <div className="flex items-center justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(user ? '/report/lost' : '/auth/login')}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-xl shadow-orange-300 -mt-5 border-4 border-white"
              aria-label="แจ้งเหตุ"
            >
              <Plus className="h-6 w-6" />
            </motion.button>
          </div>

          {/* Nav items (last 1) */}
          {navItems.slice(2).map(({ path, label, icon: Icon }) => (
            <BottomNavBtn
              key={path}
              onClick={() => navigate(path)}
              icon={Icon}
              label={label}
              active={active(path)}
            />
          ))}

          {/* Profile / Login */}
          <BottomNavBtn
            onClick={() => navigate(user ? '/profile' : '/auth/login')}
            icon={UserIcon}
            label={user ? 'ฉัน' : 'เข้าระบบ'}
            active={active('/profile')}
          />
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          CONTENT SPACING SHIMS
          - top: 14 (mobile top bar) / 16 (desktop header)
          - bottom: 16 (mobile bottom nav) / 0 (desktop)
      ══════════════════════════════════════════════════════ */}
      <div className="h-14 md:h-16" aria-hidden="true" />
      {/* Bottom spacing for mobile bottom nav — add this class to your page wrapper instead if preferred */}
      {/* pb-16 md:pb-0 on <main> is the recommended approach */}
    </>
  );
}