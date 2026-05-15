import { Link, useLocation } from 'react-router-dom';
import { Home, Map, Search, PlusCircle, User as UserIcon } from 'lucide-react';
import type { User } from 'firebase/auth';

interface AppShellProps {
  user: User | null;
}

export default function AppShell({ user }: AppShellProps) {
  const location = useLocation();
  const navItems = [
    { label: 'หน้าแรก', to: '/', icon: Home },
    { label: 'แผนที่', to: '/map', icon: Map },
    { label: 'ฟีด', to: '/feed', icon: Search },
    { label: 'แจ้งของ', to: '/report/lost', icon: PlusCircle },
    { label: 'โปรไฟล์', to: '/profile', icon: UserIcon },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/80 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 text-sm font-semibold text-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-400 to-orange-200 text-white shadow-glass">
            ช.
          </div>
          <div>
            <div className="text-lg font-bold">ช่วยกันหา</div>
            <div className="text-xs text-slate-500">ชุมชนช่วยตามของหาย</div>
          </div>
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          <Link to="/map" className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-100">แผนที่</Link>
          <Link to="/feed" className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-2 text-sm text-orange-700 transition hover:bg-orange-100">โพสต์ล่าสุด</Link>
          {user ? (
            <Link to="/profile" className="rounded-3xl bg-orange-500 px-4 py-2 text-sm text-white shadow-md transition hover:bg-orange-600">โปรไฟล์</Link>
          ) : (
            <Link to="/auth/login" className="rounded-3xl bg-orange-500 px-4 py-2 text-sm text-white shadow-md transition hover:bg-orange-600">เข้าสู่ระบบ</Link>
          )}
        </div>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 block md:hidden bg-white/90 border-t border-slate-200 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || (item.to === '/' && location.pathname === '/');
            return (
              <Link key={item.to} to={item.to} className="flex flex-col items-center gap-1 text-[11px] text-slate-500 transition hover:text-orange-600">
                <Icon className={`h-5 w-5 ${active ? 'text-orange-500' : ''}`} />
                <span className={active ? 'text-orange-600 font-semibold' : ''}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
