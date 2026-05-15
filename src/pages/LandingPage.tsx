import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { categories, faqs, sampleReports } from '../data';
import {
  ArrowRight, MapPin, Heart, MessageCircle,
  Clock3, AlertCircle, Loader2, Search, PawPrint, CheckCircle2,
  Bell, Users, Megaphone, QrCode, Copy, Check,
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

// ─── helpers ────────────────────────────────────────────────────────────────
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

// ─── Helper: Fetch real comment counts from sub-collection ─────────────────
async function fetchCommentCounts(reportIds: string[]): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  await Promise.all(
    reportIds.map(async (reportId) => {
      try {
        const snap = await getCountFromServer(
          collection(db, 'reports', reportId, 'comments')
        );
        counts[reportId] = snap.data().count ?? 0;
      } catch {
        counts[reportId] = 0;
      }
    })
  );
  
  return counts;
}

// ─── Stats Hook ────────────────────────────────────────────────────────────
function useStats() {
  const [stats, setStats] = useState({ users: 0, resolved: 0, posts: 0, loading: true });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersSnap, resolvedSnap, postsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'reports'), where('resolved', '==', true))),
          getCountFromServer(collection(db, 'reports')),
        ]);
        setStats({
          users: usersSnap.data().count,
          resolved: resolvedSnap.data().count,
          posts: postsSnap.data().count,
          loading: false,
        });
      } catch {
        setStats({ users: 0, resolved: 0, posts: 0, loading: false });
      }
    }
    fetchStats();
  }, []);

  return stats;
}

// ─── Latest Reports Hook (with real comment counts) ────────────────────────
function useLatestReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        const snap = await getDocs(
          query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(4))
        );
        let data = snap.docs.map(mapDoc);
        
        // ✅ Fetch real comment counts from sub-collection
        if (data.length > 0) {
          const reportIds = data.map(r => r.id);
          const commentCounts = await fetchCommentCounts(reportIds);
          // Merge real counts into reports
          data = data.map(r => ({ 
            ...r, 
            commentsCount: commentCounts[r.id] ?? r.commentsCount ?? 0 
          }));
        }
        
        setReports(data.length > 0 ? data : sampleReports.slice(0, 4) as any);
      } catch {
        setReports(sampleReports.slice(0, 4) as any);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  return { reports, loading };
}

// ─── Stats Number Display ──────────────────────────────────────────────────
function StatNum({ n, loading }: { n: number; loading: boolean }) {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-orange-400" />;
  return <>{n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : `${n}+`}</>;
}

// ─── How To Steps ──────────────────────────────────────────────────────────
const HOW_TO = [
  { icon: Search,       label: 'ค้นหาโพสต์',       desc: 'กรองตามประเภทสัตว์ จังหวัด หรือคำค้นหา' },
  { icon: PawPrint,     label: 'แจ้งสัตว์หาย/พบ',   desc: 'ลงโพสต์พร้อมรูปภาพและรายละเอียดสัตว์' },
  { icon: Bell,         label: 'รับการแจ้งเตือน',    desc: 'ได้รับแจ้งเมื่อมีโพสต์ที่ตรงกับสัตว์ของคุณ' },
  { icon: CheckCircle2, label: 'ปิดเคส',             desc: 'กดยืนยันเมื่อพบสัตว์หรือเจ้าของแล้ว' },
];

// ── Sponsor Banner Component ──
function SponsorBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-dashed border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 p-6 text-center">
      <div className="absolute left-0 top-0 rounded-br-xl bg-orange-400 px-3 py-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white">Sponsor</p>
      </div>
      <div className="mt-4">
        <Megaphone className="mx-auto mb-3 h-8 w-8 text-orange-400" />
        <p className="text-base font-bold text-slate-700">พื้นที่โฆษณา / สปอนเซอร์</p>
        <p className="mt-1 text-sm text-slate-500">
          ร่วมเป็นส่วนหนึ่งในการช่วยเหลือสัตว์หาย สนใจลงโฆษณาติดต่อ
        </p>
        <a
          href="https://www.facebook.com/Nknooky12"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          FB: Thanakorn Thongsa
        </a>
      </div>
    </section>
  );
}

// ── Donation Section Component ──
function DonationSection() {
  const [copied, setCopied] = useState(false);
  const accountNumber = '123-4-56789-0'; // ตัวเลขปลอม — แก้เป็นบัญชีจริงก่อนเปิดใช้งาน

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber.replace(/-/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-green-50 via-white to-emerald-50 p-8 shadow-glass border border-green-100">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5">
            <Heart className="h-4 w-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-green-700">โดเนทสนับสนุน</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">ช่วยให้เว็บไซต์เดินต่อได้</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            เว็บไซต์นี้ทำขึ้นเพื่อช่วยเหลือสัตว์เลี้ยงที่หายและเจ้าของที่กำลังตามหา
            การโดเนทของคุณจะนำไปใช้ <span className="font-semibold text-green-700">พัฒนาระบบ ดูแลเซิร์ฟเวอร์</span> และเป็น
            <span className="font-semibold text-green-700"> ค่าขนมผู้พัฒนา</span> เพื่อให้แพลตฟอร์มนี้ฟรีสำหรับทุกคนตลอดไป 🐾
          </p>
          <p className="text-xs text-slate-400">ไม่มีขั้นต่ำ โอนได้ตามกำลังใจ ขอบคุณมากๆ ครับ/ค่ะ</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm sm:min-w-[220px]">
          <div className="flex h-32 w-32 mx-auto items-center justify-center rounded-xl bg-slate-100 mb-3">
            <QrCode className="h-16 w-16 text-slate-300" />
            <span className="sr-only">QR Code พร้อมเพย์</span>
          </div>
          <p className="text-center text-[10px] text-slate-400 mb-3">QR พร้อมเพย์ (อัปเดตเร็วๆ นี้)</p>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">ธนาคารกรุงไทย</p>
            <p className="text-xs text-slate-400">ชื่อบัญชี: ธนากร ทองสา</p>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="flex-1 font-mono text-sm font-bold tracking-wider text-slate-800">
                {accountNumber}
              </span>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-green-500 p-1.5 text-white transition hover:bg-green-600"
                title="คัดลอกเลขบัญชี"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function LandingPage({ user }: LandingPageProps) {
  const stats = useStats();
  const { reports: latestReports, loading: loadingReports } = useLatestReports();

  return (
    <div className="space-y-16 pb-20 pt-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-100 via-white to-orange-50 p-6 shadow-glass md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,125,0,0.18),_transparent_35%)]" />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="inline-flex items-center gap-2 rounded-full bg-orange-200 px-4 py-2 text-sm font-semibold text-orange-800">
                🐾 แพลตฟอร์มตามหาสัตว์เลี้ยงของไทย
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                ช่วยสัตว์เลี้ยงกลับบ้านอีกครั้ง
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
                แจ้งสัตว์เลี้ยงหายหรือพบสัตว์เร่ร่อนในชุมชนไทย เชื่อมต่อเจ้าของกับสัตว์เลี้ยงที่พลัดพรากได้ง่ายขึ้น
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/report/lost" className="rounded-3xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-orange-600">
                🐕 แจ้งสัตว์หาย
              </Link>
              <Link to="/report/found" className="rounded-3xl bg-white px-6 py-3 text-sm font-semibold text-orange-700 shadow-sm transition hover:bg-orange-50">
                🐈 พบสัตว์เร่ร่อน
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
                { label: 'ผู้ใช้ทั้งหมด',      icon: Users,        value: stats.users },
                { label: 'โพสต์ทั้งหมด',        icon: PawPrint,     value: stats.posts },
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
                        {report.type === 'lost' ? '🐾 สัตว์หาย' : '🐾 พบสัตว์'}
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

      {/* ── Sponsor Banner ── */}
      <SponsorBanner />

      {/* ── How To ── */}
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

      {/* ── Categories ── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">หมวดหมู่สัตว์เลี้ยง</h2>
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

      {/* ── Latest Posts (with real comment counts) ── */}
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
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">🐾</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        report.type === 'lost' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {report.type === 'lost' ? '🐾 สัตว์หาย' : '🐾 พบสัตว์'}
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
                    {/* ✅ แสดงจำนวนคอมเมนต์จริงจาก sub-collection */}
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
            <p className="font-semibold text-slate-800">เข้าร่วมชุมชนเพื่อแจ้งและติดตามสัตว์เลี้ยงที่หาย</p>
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

      {/* ── Testimonials + FAQ ── */}
      <section className="grid gap-8 lg:grid-cols-[1.3fr_0.95fr]">
        <div className="rounded-2xl bg-white p-8 shadow-glass">
          <h2 className="text-2xl font-bold text-slate-900">เสียงจากผู้ใช้จริง</h2>
          <div className="mt-6 space-y-4">
            {[
              { text: 'โพสต์ไปไม่ถึง 2 ชั่วโมง มีคนทักมาว่าเจอน้องหมาของเรา ขอบคุณมากๆ', name: 'คุณนิดา, กรุงเทพฯ' },
              { text: 'เจอแมวเร่ร่อนหน้าบ้านแล้วโพสต์ที่นี่ เจ้าของมารับภายในวันเดียว', name: 'คุณก้อง, เชียงใหม่' },
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

      {/* ── Donation ── */}
      <DonationSection />

      {/* ── Footer ── */}
      <footer className="rounded-2xl bg-white p-8 text-slate-600 shadow-glass">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">🐾 ตามหาน้อง</p>
            <p className="mt-1 text-sm text-slate-400">ชุมชนช่วยพาสัตว์เลี้ยงกลับบ้านอย่างปลอดภัย</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {user ? (
              <>
                <Link to="/report/lost" className="rounded-full bg-orange-500 px-4 py-2 text-white transition hover:bg-orange-600 font-semibold">
                  แจ้งสัตว์หาย
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
                  แจ้งสัตว์หาย
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}