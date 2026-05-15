import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { categories, faqs, sampleReports } from '../data';
import {
  ArrowRight, MapPin, Heart, MessageCircle,
  Clock3, AlertCircle, Loader2, Search, Package, CheckCircle2,
  Bell, Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection, db, getCountFromServer, getDocs,
  query, orderBy, limit, where, Timestamp,
} from '../firebase';
import type { Report } from '../types';

interface LandingPageProps {
  user: User | null;
}

function timeAgo(dateString: string): string {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  } catch { return '—'; }
}

function mapDoc(d: any): Report {
  const data = d.data() as any;
  return {
    id: d.id,
    ...data,
    createdAt:
      data?.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data?.createdAt || new Date().toISOString(),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
  };
}

// ── แก้ตรงนี้: ตัด users ออก ดึงแค่ resolved และ posts ──
function useStats() {
  const [stats, setStats] = useState({ users: 0, resolved: 0, posts: 0, loading: true });

  useEffect(() => {
    async function fetch() {
      try {
        const [resolvedSnap, postsSnap] = await Promise.all([
          getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', true))),
          getCountFromServer(collection(db, 'reports')),
        ]);
        setStats({
          users: postsSnap.data().count, // ใช้จำนวนโพสต์แทน users ชั่วคราว
          resolved: resolvedSnap.data().count,
          posts: postsSnap.data().count,
          loading: false,
        });
      } catch {
        setStats({ users: 0, resolved: 0, posts: 0, loading: false });
      }
    }
    fetch();
  }, []);

  return stats;
}

function useLatestReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const snap = await getDocs(
          query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(4))
        );
        const data = snap.docs.map(mapDoc);
        setReports(data.length > 0 ? data : sampleReports.slice(0, 4) as any);
      } catch {
        setReports(sampleReports.slice(0, 4) as any);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  return { reports, loading };
}

function StatNum({ n, loading }: { n: number; loading: boolean }) {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-orange-400" />;
  return <>{n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : `${n}+`}</>;
}

const HOW_TO = [
  { icon: Search,       label: 'ค้นหาโพสต์',    desc: 'กรองตามหมวดหมู่ จังหวัด หรือคำค้นหา' },
  { icon: Package,      label: 'แจ้งของหาย/พบ',  desc: 'ลงโพสต์พร้อมรูปภาพและรายละเอียด' },
  { icon: Bell,         label: 'รับการแจ้งเตือน', desc: 'ได้รับแจ้งเมื่อมีโพสต์ที่ตรงกัน' },
  { icon: CheckCircle2, label: 'ปิดเคส',          desc: 'กดยืนยันเมื่อพบของหรือเจ้าของแล้ว' },
];

export default function LandingPage({ user }: LandingPageProps) {
  const stats = useStats();
  const { reports: latestReports, loading: loadingReports } = useLatestReports();

  return (
    <div className="space-y-16 pb-20 pt-6">

      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-100 via-white to-orange-50 p-6 shadow-glass md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,125,0,0.18),_transparent_35%)]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="inline-flex rounded-full bg-orange-200 px-4 py-2 text-sm font-semibold text-orange-800">
                แพลตฟอร์มช่วยตามของหายของไทย
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                ช่วยของสำคัญกลับบ้านอีกครั้ง
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
                แจ้งของหายหรือของที่พบในชุมชนไทย ด้วยระบบที่เชื่อถือได้และเชื่อมต่อกันได้ง่ายบนมือถือ
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/report/lost" className="rounded-3xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-orange-600">
                แจ้งของหาย
              </Link>
              <Link to="/report/found" className="rounded-3xl bg-white px-6 py-3 text-sm font-semibold text-orange-700 shadow-sm transition hover:bg-orange-50">
                แจ้งพบของ
              </Link>
              <Link to="/feed" className="rounded-3xl border border-orange-200 bg-orange-50 px-6 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-100">
                ดูโพสต์ทั้งหมด
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-3 gap-4"
            >
              {[
                { label: 'โพสต์ทั้งหมด',   icon: Package,      value: stats.posts },
                { label: 'คืนของสำเร็จ',    icon: CheckCircle2, value: stats.resolved },
                { label: 'โพสต์ล่าสุด',     icon: Users,        value: stats.posts },
              ].map(({ label, icon: Icon, value }) => (
                <div key={label} className="rounded-2xl bg-white/90 p-4 shadow-glass text-center">
                  <Icon className="mx-auto mb-1 h-5 w-5 text-orange-400" />
                  <p className="text-2xl font-bold text-slate-900">
                    <StatNum n={value} loading={stats.loading} />
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="relative rounded-[2rem] bg-white/90 p-6 shadow-glass ring-1 ring-orange-100 sm:p-8"
          >
            <div className="grid gap-5">
              {sampleReports.slice(0, 2).map((report) => (
                <div key={report.id} className="rounded-2xl border border-slate-200 bg-orange-50/80 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className={`text-xs font-semibold uppercase tracking-widest ${report.type === 'lost' ? 'text-orange-600' : 'text-green-600'}`}>
                        {report.type === 'lost' ? 'ของหาย' : 'พบของ'}
                      </span>
                      <h3 className="mt-1 text-base font-semibold text-slate-900">{report.title}</h3>
                    </div>
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <img src={report.images[0]} alt={report.title} className="h-full w-full object-cover" />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-2">{report.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {[report.category, report.province, report.tags?.[0]].filter(Boolean).map((t, i) => (
                      <span key={`${t}-${i}`} className="rounded-full bg-white px-2.5 py-1 text-slate-600">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">วิธีใช้งาน</h2>
            <p className="mt-1 text-slate-500">4 ขั้นตอนง่ายๆ เริ่มได้เลยตอนนี้</p>
          </div>
          {!user && (
            <Link to="/auth/login" className="inline-flex items-center gap-2 rounded-3xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-600">
              เริ่มใช้งานทันที <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {HOW_TO.map(({ icon: Icon, label, desc }, i) => (
            <motion.div key={label} whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300 }}
              className="rounded-2xl bg-white p-6 shadow-glass">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">ขั้นที่ {i + 1}</p>
              <h3 className="text-base font-semibold text-slate-900">{label}</h3>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">หมวดหมู่ยอดนิยม</h2>
          <Link to="/feed" className="text-sm font-semibold text-orange-500 hover:underline">ดูทั้งหมด</Link>
        </div>
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-6">
          {categories.map((item) => (
            <Link key={item.value} to={`/feed?cat=${item.value}`}
              className="group rounded-2xl border border-orange-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-md">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-2xl group-hover:bg-orange-100 transition">
                {item.icon ?? item.value.slice(0, 2)}
              </div>
              <p className="text-xs font-semibold text-slate-700">{item.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">โพสต์ล่าสุด</h2>
            <p className="mt-1 text-sm text-slate-500">อัปเดตแบบ real-time จากชุมชนทั่วไทย</p>
          </div>
          <Link to="/feed" className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600">
            ดูทั้งหมด
          </Link>
        </div>

        {loadingReports ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white p-12 shadow-glass">
            <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
            <span className="text-slate-400 text-sm">กำลังโหลด...</span>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {latestReports.map((report) => (
              <Link key={report.id} to={`/detail/${report.id}`}
                className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  {report.images?.[0] ? (
                    <img src={report.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">📦</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        report.type === 'lost' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {report.type === 'lost' ? 'ของหาย' : 'พบของ'}
                      </span>
                      {report.urgent && (
                        <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                          <AlertCircle className="h-3 w-3" /> ด่วน
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-1 group-hover:text-orange-600 transition">
                      {report.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{report.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {(report as any).province || '—'}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {report.likesCount ?? 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {report.commentsCount ?? 0}</span>
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {timeAgo(report.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!user && (
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-8 text-center">
            <p className="font-semibold text-slate-800">เข้าร่วมชุมชนเพื่อแจ้งและติดตามของหาย</p>
            <p className="mt-1 text-sm text-slate-500">ฟรี ไม่มีค่าใช้จ่าย</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/auth/register" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">
                สมัครสมาชิก
              </Link>
              <Link to="/auth/login" className="rounded-2xl border border-orange-200 bg-white px-6 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-50">
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.95fr]">
        <div className="rounded-2xl bg-white p-8 shadow-glass">
          <h2 className="text-2xl font-bold text-slate-900">เสียงจากผู้ใช้จริง</h2>
          <div className="mt-6 space-y-4">
            {[
              { text: 'โพสต์ไปไม่ถึง 2 ชั่วโมง มีคนทักมาว่าเจอแมวของเรา ขอบคุณมากๆ', name: 'คุณนิดา, กรุงเทพฯ' },
              { text: 'เจอกระเป๋าสตางค์คนอื่นแล้วโพสต์ที่นี่ เจ้าของมารับภายในวันเดียว', name: 'คุณก้อง, เชียงใหม่' },
              { text: 'ชุมชนตอบรับเร็วมาก และทุกคนช่วยแชร์ให้ด้วย ประทับใจมาก', name: 'คุณมิ้ว, ขอนแก่น' },
            ].map(({ text, name }) => (
              <div key={name} className="rounded-2xl border border-slate-100 bg-orange-50/50 p-5">
                <p className="text-slate-700 text-sm leading-relaxed">"{text}"</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">{name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-orange-50 via-white to-orange-50 p-8 shadow-glass">
          <h2 className="text-2xl font-bold text-slate-900">คำถามที่พบบ่อย</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="rounded-2xl bg-white p-8 text-slate-600 shadow-glass">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">ช่วยกันหา</p>
            <p className="mt-1 text-sm text-slate-400">ชุมชนคืนของกลับบ้านอย่างปลอดภัย</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {user ? (
              <>
                <Link to="/report/lost" className="rounded-full bg-orange-500 px-4 py-2 text-white transition hover:bg-orange-600 font-semibold">
                  แจ้งของหาย
                </Link>
                <Link to="/feed" className="rounded-full bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200">
                  ดูฟีด
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth/login" className="rounded-full bg-orange-50 px-4 py-2 text-orange-700 transition hover:bg-orange-100">
                  เข้าสู่ระบบ
                </Link>
                <Link to="/report/lost" className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800">
                  แจ้งของหาย
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}