import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  auth,
  signOut,
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  deleteDoc,
  Timestamp,
} from '../firebase';

import type { User } from 'firebase/auth';
import type { Report } from '../types';

import {
  Loader2,
  LogOut,
  MapPin,
  Clock3,
  Heart,
  MessageCircle,
  Eye,
  Plus,
  PackageOpen,
  Trash2,
  Pencil,
} from 'lucide-react';

interface ProfilePageProps {
  user: User | null;
}

function timeAgo(dateString: string) {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาที`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วัน`;
    return new Date(dateString).toLocaleDateString('th-TH');
  } catch {
    return '—';
  }
}

function mapReport(d: any): Report {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : new Date().toISOString(),
    likesCount: data.likesCount || 0,
    commentsCount: data.commentsCount || 0,
    viewsCount: data.viewsCount || 0,
  };
}

export default function ProfilePage({ user }: ProfilePageProps) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function loadMyPosts() {
      try {
        setLoading(true);
        const q = query(
          collection(db, 'reports'),
          where('userId', '==', user!.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        setMyReports(snap.docs.map(mapReport));
      } catch (err) {
        console.error(err);
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
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleDelete(reportId: string) {
    if (!confirm('ต้องการลบโพสต์นี้ใช่ไหม?')) return;
    try {
      setDeletingId(reportId);
      await deleteDoc(doc(db, 'reports', reportId));
      setMyReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      console.error(err);
      alert('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDeletingId(null);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[32px] border border-orange-100 bg-white p-8 text-center shadow-xl shadow-orange-100/30">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-4xl">👋</div>
          <h1 className="text-2xl font-black text-gray-900">ยังไม่ได้เข้าสู่ระบบ</h1>
          <p className="mt-2 text-sm text-gray-500">เข้าสู่ระบบเพื่อดูโพสต์ของคุณ</p>
          <Link to="/auth/login" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-5 py-4 text-sm font-bold text-white transition hover:bg-orange-600">
            เข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'สมาชิก';
  const totalLikes = myReports.reduce((sum, item) => sum + (item.likesCount || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-5">
      {/* PROFILE HEADER */}
      <div className="overflow-hidden rounded-[36px] bg-gradient-to-br from-orange-500 via-orange-400 to-orange-300 p-[1px] shadow-2xl shadow-orange-200">
        <div className="rounded-[35px] bg-white">
          <div className="relative overflow-hidden px-6 pb-7 pt-8 sm:px-8">
            <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-orange-200/40 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-gradient-to-br from-orange-400 to-orange-600 text-4xl font-black text-white shadow-xl shadow-orange-300">
                  {displayName.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-orange-500">โปรไฟล์</p>
                  <h1 className="mt-1 text-3xl font-black text-gray-900">{displayName}</h1>
                  <p className="mt-1 text-sm text-gray-500">{user.email}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <div className="rounded-2xl bg-orange-50 px-4 py-2">
                      <p className="text-xs text-orange-500">โพสต์ทั้งหมด</p>
                      <p className="text-lg font-black text-orange-600">{myReports.length}</p>
                    </div>
                    <div className="rounded-2xl bg-red-50 px-4 py-2">
                      <p className="text-xs text-red-400">ถูกใจรวม</p>
                      <p className="text-lg font-black text-red-500">{totalLikes}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Link to="/report/lost" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:scale-[1.02] hover:bg-orange-600">
                  <Plus size={18} /> สร้างโพสต์
                </Link>
                <button onClick={handleLogout} disabled={loggingOut} className="inline-flex items-center gap-2 rounded-2xl bg-gray-100 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200">
                  {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POSTS */}
      <div className="mt-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900">โพสต์ของฉัน</h2>
            <p className="mt-1 text-sm text-gray-500">รายการโพสต์ทั้งหมดที่คุณเคยแจ้งไว้</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : myReports.length === 0 ? (
          <div className="rounded-[32px] border border-dashed border-orange-200 bg-white py-20 text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-orange-50">
              <PackageOpen className="h-10 w-10 text-orange-400" />
            </div>
            <h3 className="mt-5 text-xl font-black text-gray-900">ยังไม่มีโพสต์</h3>
            <p className="mt-2 text-sm text-gray-500">เริ่มแจ้งของหายหรือของที่พบได้เลย</p>
            <Link to="/report/lost" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600">
              <Plus size={18} /> สร้างโพสต์แรก
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myReports.map((report) => (
              <div key={report.id} className="group overflow-hidden rounded-[28px] border border-white bg-white shadow-lg shadow-gray-100 transition-all hover:-translate-y-1 hover:shadow-2xl">
                
                {/* IMAGE */}
                <Link to={`/detail/${report.id}`} className="relative block overflow-hidden">
                  <img
                    src={report.images?.[0]}
                    alt=""
                    className="h-[220px] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className={`absolute left-4 top-4 rounded-2xl px-3 py-2 text-xs font-black shadow-lg ${
                    report.type === 'lost' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {report.type === 'lost' ? 'ของหาย' : 'ของพบ'}
                  </div>
                </Link>

                {/* CONTENT */}
                <div className="space-y-4 p-5">
                  <div>
                    <h3 className="line-clamp-1 text-lg font-black text-gray-900 transition group-hover:text-orange-500">
                      {report.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-500">
                      {report.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                      <MapPin size={12} /> {report.province}
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      <Clock3 size={12} /> {timeAgo(report.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-4 text-gray-400">
                      <div className="flex items-center gap-1 text-sm">
                        <Heart size={15} /> {report.likesCount || 0}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <MessageCircle size={15} /> {report.commentsCount || 0}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Eye size={15} /> {report.viewsCount || 0}
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/report/edit/${report.id}`}
                        className="flex items-center gap-1 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-500 transition hover:bg-orange-100"
                      >
                        <Pencil size={13} /> แก้ไข
                      </Link>
                      <button
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === report.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}