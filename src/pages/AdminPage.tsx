import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, orderBy, limit, getDocs, deleteDoc, doc, 
  updateDoc, serverTimestamp, where, getCountFromServer, db,
  signInWithEmailAndPassword, signOut
} from '../firebase';
import { auth } from '../firebase';
import type { Report } from '../types';
import { 
  Trash2, Eye, ShieldCheck, FileText, 
  AlertCircle, CheckCircle2, XCircle, Search,
  MapPin, Clock, ArrowLeft, LogOut, Lock, User
} from 'lucide-react';

// ─── Config: Admin Credentials ────────────────────────────────────────
const ADMIN_EMAIL = 'thanakorn.tho.work@gmail.com';
const ADMIN_PASSWORD = '0613155116N.'; // ✅ รหัสผ่านที่กำหนดให้ (เปลี่ยนได้ภายหลังใน Firebase Console)

interface AdminReport extends Report {
  userEmail?: string;
}

export default function AdminPage() {
  const navigate = useNavigate();
  
  // State for Auth
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // State for Data
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, lost: 0, found: 0, resolved: 0 });

  // ─── Check Auth Status on Mount ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user && user.email === ADMIN_EMAIL) {
        setIsAdminVerified(true);
        fetchData();
      } else {
        setIsAdminVerified(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // ─── Fetch Data Functions ─────────────────────────────────────────
  const fetchData = async () => {
    setLoadingData(true);
    try {
      await Promise.all([fetchReports(), fetchStats()]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchReports = async () => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as AdminReport[];
    setReports(data);
  };

  const fetchStats = async () => {
    const [totalSnap, lostSnap, foundSnap, resolvedSnap] = await Promise.all([
      getCountFromServer(collection(db, 'reports')),
      getCountFromServer(query(collection(db, 'reports'), where('type', '==', 'lost'))),
      getCountFromServer(query(collection(db, 'reports'), where('type', '==', 'found'))),
      getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'resolved'))),
    ]);

    setStats({
      total: totalSnap.data().count,
      lost: lostSnap.data().count,
      found: foundSnap.data().count,
      resolved: resolvedSnap.data().count,
    });
  };

  // ─── Auth Handlers ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    if (loginEmail !== ADMIN_EMAIL) {
      setAuthError('อีเมลนี้ไม่ใช่ผู้ดูแลระบบ');
      setIsLoggingIn(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      // onAuthStateChanged จะจัดการเปลี่ยนหน้าเอง
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setAuthError('รหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/user-not-found') {
        setAuthError('ไม่พบบัญชีผู้ใช้นี้ กรุณาติดต่อผู้พัฒนา');
      } else {
        setAuthError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginEmail('');
    setLoginPassword('');
    setIsAdminVerified(false);
  };

  // ─── Admin Actions ────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('⚠️ ยืนยันการลบโพสต์นี้?')) return;
    try {
      await deleteDoc(doc(db, 'reports', id));
      setReports(prev => prev.filter(r => r.id !== id));
      fetchStats();
      alert('✅ ลบสำเร็จ');
    } catch (err) {
      alert('❌ ลบไม่สำเร็จ');
    }
  };

  const handleToggleResolved = async (report: AdminReport) => {
    const newStatus = report.status === 'resolved' ? 'active' : 'resolved';
    const newType = report.type === 'lost' && newStatus === 'resolved' ? 'found' : report.type;

    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: newStatus,
        type: newType,
        updatedAt: serverTimestamp(),
      });
      setReports(prev => prev.map(r => 
        r.id === report.id ? { ...r, status: newStatus, type: newType } : r
      ));
      fetchStats();
    } catch (err) {
      alert('❌ อัปเดตไม่สำเร็จ');
    }
  };

  // ─── Filter Logic ─────────────────────────────────────────────────
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.province?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (filterType === 'all') return true;
      if (filterType === 'resolved') return r.status === 'resolved';
      return r.type === filterType;
    });
  }, [reports, searchTerm, filterType]);

  // ─── Render: Login Form (If not Admin) ────────────────────────────
  if (!isAdminVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 text-orange-600 mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Login</h1>
            <p className="text-sm text-slate-500 mt-2">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition"
                  placeholder="admin@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="password" 
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                <AlertCircle size={16} /> {authError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-orange-600 flex items-center justify-center gap-1 mx-auto">
              <ArrowLeft size={14} /> กลับหน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Loading Data ─────────────────────────────────────────
  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // ─── Render: Admin Dashboard ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">{currentUser?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <ArrowLeft size={16} /> กลับหน้าเว็บ
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="โพสต์ทั้งหมด" value={stats.total} icon={FileText} color="blue" />
          <StatCard title="สัตว์หาย" value={stats.lost} icon={AlertCircle} color="red" />
          <StatCard title="พบสัตว์" value={stats.found} icon={CheckCircle2} color="emerald" />
          <StatCard title="ปิดเคสแล้ว" value={stats.resolved} icon={ShieldCheck} color="slate" />
        </div>

        {/* Controls */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="ค้นหาจากชื่อเรื่อง หรือจังหวัด..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {[
              { label: 'ทั้งหมด', value: 'all' },
              { label: 'สัตว์หาย', value: 'lost' },
              { label: 'พบสัตว์', value: 'found' },
              { label: 'ปิดเคส', value: 'resolved' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterType(opt.value as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  filterType === opt.value 
                    ? 'bg-orange-500 text-white shadow-md' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">รูปภาพ</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">หัวข้อ</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">สถานะ</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">ตำแหน่ง</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  filteredReports.map(report => (
                    <tr key={report.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4">
                        <img 
                          src={report.images?.[0] || 'https://placehold.co/100x100/f1f5f9/cbd5e1?text=No+Img'} 
                          alt="" 
                          className="h-12 w-12 rounded-lg object-cover border border-slate-200"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{report.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                           <Clock size={12} className="inline mr-1"/> 
                           {new Date(report.createdAt).toLocaleDateString('th-TH')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge type={report.type} />
                          <Badge status={report.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-slate-600">
                          <MapPin size={14} className="text-slate-400" />
                          <span className="line-clamp-1">{report.province}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => window.open(`/detail/${report.id}`, '_blank')}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="ดูรายละเอียด"
                          >
                            <Eye size={18} />
                          </button>
                          
                          <button 
                            onClick={() => handleToggleResolved(report)}
                            className={`p-2 rounded-lg transition ${
                              report.status === 'resolved' 
                                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' 
                                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={report.status === 'resolved' ? 'เปิดเคสใหม่' : 'ปิดเคส'}
                          >
                            {report.status === 'resolved' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                          </button>

                          <button 
                            onClick={() => handleDelete(report.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="ลบโพสต์"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Badge({ type, status }: any) {
  if (type) {
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        type === 'lost' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
      }`}>
        {type === 'lost' ? 'หาย' : 'พบ'}
      </span>
    );
  }
  if (status) {
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
        status === 'resolved' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-600'
      }`}>
        {status === 'resolved' ? 'ปิดเคส' : 'Active'}
      </span>
    );
  }
  return null;
}