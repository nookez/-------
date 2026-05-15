import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  auth, signOut, db, collection, query, where, orderBy, limit,
  getDocs, getCountFromServer, doc, deleteDoc, updateDoc, Timestamp
} from '../firebase';
import type { User } from 'firebase/auth';
import type { Report } from '../types';
import {
  Loader2, LogOut, MapPin, Clock3, Heart, MessageCircle,
  Eye, Plus, PackageOpen, Trash2, Pencil, CheckCircle2, Sparkles
} from 'lucide-react';

interface ProfilePageProps {
  user: User | null;
}

// ─── Type Extension: เพิ่มฟิลด์สถานะชั่วคราว ───────────────────────────────
type ReportWithStatus = Report & {
  status?: 'active' | 'resolved' | 'closed';
};

const PLACEHOLDER = 'https://placehold.co/400x300/f8fafc/cbd5e1?text=No+Image';

function timeAgo(dateString: string): string {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return new Date(dateString).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function mapReport(d: any): ReportWithStatus {
  const data = d.data();
  return {
    id: d.id, ...data,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : new Date().toISOString(),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    viewsCount: typeof data.viewsCount === 'number' ? data.viewsCount : 0,
    status: data.status ?? 'active',
  };
}

async function fetchRealCommentCounts(reportIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await Promise.all(
    reportIds.map(async (id) => {
      try {
        const snap = await getCountFromServer(collection(db, 'reports', id, 'comments'));
        counts[id] = snap.data().count ?? 0;
      } catch { counts[id] = 0; }
    })
  );
  return counts;
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [myReports, setMyReports] = useState<ReportWithStatus[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [markingFoundId, setMarkingFoundId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const currentUid = user.uid;

    async function loadMyPosts() {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'reports'),
          where('userId', '==', currentUid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const reports = snap.docs.map(mapReport);
        
        setMyReports(reports);
        
        if (reports.length > 0) {
          const realCounts = await fetchRealCommentCounts(reports.map(r => r.id));
          setCommentCounts(realCounts);
        }
      } catch (err) {
        console.error('Failed to load posts:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMyPosts();
  }, [user]);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  }

  // 🎯 Handle marking a lost pet report as FOUND (owner confirmation)
  async function handleMarkAsFound(reportId: string) {
    if (!confirm('ยืนยันว่าพบสัตว์เลี้ยงนี้แล้วใช่ไหม?\n\nโพสต์นี้จะถูกทำเครื่องหมายว่า "พบแล้ว" และแสดงบนแผนที่')) return;
    
    try {
      setMarkingFoundId(reportId);
      
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        updatedAt: Timestamp.now(),
      });
      
      setMyReports(prev => prev.map(r => 
        r.id === reportId ? { ...r, status: 'resolved' } : r
      ));
      
      alert('✅ อัปเดตสำเร็จ! โพสต์นี้แสดงเป็น "พบแล้ว" บนแผนที่แล้ว');
    } catch (err) {
      console.error('Mark as found failed:', err);
      alert('❌ อัปเดตไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setMarkingFoundId(null);
    }
  }

  async function handleDelete(reportId: string) {
    if (!confirm('ต้องการลบโพสต์นี้ใช่ไหม? การกระทำนี้ไม่สามารถย้อนกลับได้')) return;
    try {
      setDeletingId(reportId);
      await deleteDoc(doc(db, 'reports', reportId));
      setMyReports(prev => prev.filter(r => r.id !== reportId));
      setCommentCounts(prev => {
        const next = { ...prev };
        delete next[reportId];
        return next;
      });
    } catch (err) {
      console.error('Delete failed:', err);
      alert('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-3xl">👋</div>
          <h1 className="text-xl font-bold text-slate-900">ยังไม่ได้เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-slate-500">เข้าสู่ระบบเพื่อดูโพสต์และจัดการบัญชีของคุณ</p>
          <Link to="/auth/login" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'สมาชิก';
  const totalLikes = myReports.reduce((sum, r) => sum + (r.likesCount || 0), 0);
  const resolvedCount = myReports.filter(r => r.status === 'resolved').length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      
      {/* ── Profile Header ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">บัญชีของฉัน</p>
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
            
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-2">
                <p className="text-xs font-medium text-orange-600">โพสต์ทั้งหมด</p>
                <p className="text-xl font-bold text-orange-700">{myReports.length}</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-2">
                <p className="text-xs font-medium text-rose-600">ถูกใจรวม</p>
                <p className="text-xl font-bold text-rose-700">{totalLikes}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2">
                <p className="text-xs font-medium text-emerald-600">พบแล้ว</p>
                <p className="text-xl font-bold text-emerald-700">{resolvedCount}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/report/lost" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600">
              <Plus size={18} /> สร้างโพสต์
            </Link>
            <button 
              onClick={handleLogout} 
              disabled={loggingOut} 
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              ออกจากระบบ
            </button>
          </div>
        </div>
      </section>

      {/* ── My Posts ── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">โพสต์ของฉัน</h2>
            <p className="mt-1 text-sm text-slate-500">รายการที่คุณเคยแจ้งไว้ในระบบ</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            <span className="text-sm text-slate-500">กำลังโหลดข้อมูล...</span>
          </div>
        ) : myReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
              <PackageOpen className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">ยังไม่มีโพสต์</h3>
            <p className="mt-2 text-sm text-slate-500">เริ่มแจ้งสัตว์เลี้ยงหายหรือพบสัตว์เร่ร่อนได้เลย</p>
            <Link to="/report/lost" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
              <Plus size={18} /> สร้างโพสต์แรก
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myReports.map((report) => {
              const isResolved = report.status === 'resolved';
              const isLostType = report.type === 'lost';
              
              return (
                <article 
                  key={report.id} 
                  className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                    isResolved 
                      ? 'border-emerald-300 ring-1 ring-emerald-100' 
                      : 'border-slate-200 hover:border-orange-200'
                  }`}
                >
                  {/* Image */}
                  <Link to={`/detail/${report.id}`} className="relative block overflow-hidden">
                    <img
                      src={report.images?.[0] || PLACEHOLDER}
                      alt={report.title}
                      className={`h-48 w-full object-cover transition duration-300 ${
                        isResolved ? 'opacity-80' : 'group-hover:scale-105'
                      }`}
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
                    />
                    
                    {/* Status Badge */}
                    <div className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${
                      isResolved 
                        ? 'bg-emerald-500/90 text-white' 
                        : report.type === 'lost' 
                          ? 'bg-red-500/90 text-white' 
                          : 'bg-emerald-500/90 text-white'
                    }`}>
                      {isResolved ? '✅ พบแล้ว' : report.type === 'lost' ? 'สัตว์หาย' : 'พบสัตว์'}
                    </div>
                    
                    {/* Resolved Overlay */}
                    {isResolved && (
                      <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center pointer-events-none">
                        <CheckCircle2 className="h-16 w-16 text-emerald-500/50" />
                      </div>
                    )}
                  </Link>

                  {/* Content */}
                  <div className="p-5 space-y-3">
                    <div>
                      <h3 className={`font-semibold line-clamp-1 transition ${
                        isResolved ? 'text-slate-500' : 'text-slate-900 group-hover:text-orange-600'
                      }`}>
                        {report.title}
                      </h3>
                      <p className={`mt-1 text-sm line-clamp-2 leading-relaxed ${
                        isResolved ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {report.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        <MapPin size={12} /> {report.province || 'ไม่ระบุ'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        <Clock3 size={12} /> {timeAgo(report.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Heart size={14} /> {report.likesCount || 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={14} /> {commentCounts[report.id] ?? 0}</span>
                        <span className="flex items-center gap-1"><Eye size={14} /> {report.viewsCount || 0}</span>
                      </div>

                      {/* ── Action Buttons Group ── */}
                      <div className="flex items-center gap-2">
                        
                        {/* ✅ PROMINENT "Mark as Found" Button */}
                        {isLostType && !isResolved && (
                          <button
                            onClick={() => handleMarkAsFound(report.id)}
                            disabled={markingFoundId === report.id}
                            className="group relative inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                            title="ยืนยันว่าพบสัตว์แล้ว"
                          >
                            {/* ✨ Sparkle animation */}
                            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-300 animate-pulse" />
                            
                            {/* Icon + Text */}
                            {markingFoundId === report.id 
                              ? <Loader2 size={14} className="animate-spin" /> 
                              : <CheckCircle2 size={14} className="transition-transform group-hover:scale-110" />
                            }
                            <span className="hidden sm:inline">พบแล้ว</span>
                          </button>
                        )}
                        
                        {/* Edit Button (subtle) */}
                        <Link
                          to={`/report/edit/${report.id}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition"
                          title="แก้ไขโพสต์"
                        >
                          <Pencil size={16} />
                        </Link>
                        
                        {/* Delete Button (subtle) */}
                        <button
                          onClick={() => handleDelete(report.id)}
                          disabled={deletingId === report.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                          title="ลบโพสต์"
                        >
                          {deletingId === report.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}