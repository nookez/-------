import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

import {
  ArrowRight, MapPin, Heart, MessageCircle,
  Clock3, AlertCircle, Loader2, Search, PawPrint, CheckCircle2,
  Bell, Users, Megaphone, QrCode, Copy, Check, Navigation,
  Lightbulb, Volume2, Flashlight, MapPinned, PhoneCall, Camera,
  Sparkles, Target, Timer, Share2, Info, ShieldCheck, HandHeart, Home, Plus, ArrowUp, ArrowDown
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection, db, getCountFromServer, getDocs,
  query, orderBy, limit, where, Timestamp,
} from '../firebase';
import type { Report } from '../types';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const PLACEHOLDER = 'https://placehold.co/200x120/f8fafc/cbd5e1?text=🐾+No+Image&font=noto';

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

function useStats() {
  const [stats, setStats] = useState({ users: 0, resolved: 0, posts: 0, loading: true });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersSnap, resolvedSnap, postsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'reports'), where('status', '==', 'resolved'))),
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

        if (data.length > 0) {
          const reportIds = data.map(r => r.id);
          const commentCounts = await fetchCommentCounts(reportIds);
          data = data.map(r => ({
            ...r,
            commentsCount: commentCounts[r.id] ?? r.commentsCount ?? 0
          }));
        }

        setReports(data.length > 0 ? data : []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  return { reports, loading };
}

function StatNum({ n, loading }: { n: number; loading: boolean }) {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-orange-400" />;
  return <>{n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : `${n}+`}</>;
}

const HOW_TO = [
  {
    icon: AlertCircle,
    label: 'แจ้งสัตว์หาย',
    desc: 'สำหรับเจ้าของ: ลงโพสต์พร้อมรายละเอียดและตำแหน่งสุดท้ายที่เห็นน้อง',
    color: 'orange'
  },
  {
    icon: HandHeart,
    label: 'แจ้งพบสัตว์',
    desc: 'สำหรับผู้พบ: แจ้งตำแหน่งและลักษณะสัตว์ที่พบ เพื่อช่วยตามหาเจ้าของ',
    color: 'emerald'
  },
  {
    icon: PhoneCall,
    label: 'ติดต่อประสานงาน',
    desc: 'ใช้ข้อมูลติดต่อในโพสต์เพื่อประสานงานและส่งน้องกลับบ้าน',
    color: 'blue'
  },
  {
    icon: Home,
    label: 'ยืนยันคืนสัตว์',
    desc: 'เมื่อพบกันแล้ว: กดยืนยัน "พบแล้ว" เพื่อปิดเคสและอัปเดตสถานะ',
    color: 'slate'
  },
];

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

function DonationSection() {
  const [copied, setCopied] = useState(false);
  const accountNumber = '6626126431';
  const accountName = 'ฐนกร ทองสา';
  const bankName = 'ธนาคารกรุงไทย';

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl bg-gradient-to-br from-green-50 via-white to-emerald-50 p-6 sm:p-8 shadow-glass border border-green-100">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1.5">
            <Heart className="h-4 w-4 text-green-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-green-700">โดเนทสนับสนุน</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">ช่วยให้เว็บไซต์เดินต่อได้</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            เว็บไซต์นี้พัฒนาขึ้นด้วยความตั้งใจที่จะช่วยเหลือสัตว์เลี้ยงและเจ้าของ
            เงินบริจาคทุกบาทจะนำไปใช้ <span className="font-semibold text-green-700">ค่าเซิร์ฟเวอร์และพัฒนาระบบ</span>
            เพื่อให้แพลตฟอร์มนี้ฟรีและใช้งานได้ตลอดไป 🐾
          </p>
          <p className="text-xs text-slate-400">ไม่มีขั้นต่ำ โอนได้ตามกำลังใจ ขอบคุณมากๆ ครับ/ค่ะ</p>
        </div>

        <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm sm:min-w-[240px]">
          <div className="flex h-36 w-36 mx-auto items-center justify-center rounded-xl bg-slate-50 mb-4 overflow-hidden border border-slate-200">
            <img
              src="/qr.JPG"
              alt="QR Code พร้อมเพย์"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
            <QrCode className="h-16 w-16 text-slate-300 hidden" />
          </div>
          <p className="text-center text-[10px] text-slate-400 mb-4">สแกนเพื่อโอนผ่านพร้อมเพย์</p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">{bankName}</p>
            <p className="text-xs text-slate-400">ชื่อบัญชี: {accountName}</p>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
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

function MiniPetMap({ reports }: { reports: Report[] }) {
  const navigate = useNavigate();

  const validReports = useMemo(() =>
    reports
      .filter(r => r.lat && r.lng && r.lat !== 0 && r.lng !== 0)
      .slice(0, 10),
    [reports]
  );

  const center: [number, number] = [15.8700, 100.9925];
  const defaultZoom = 6;

  const getMarkerColor = (type: string, status?: string) => {
    if (status === 'resolved') return '#94a3b8';
    return type === 'lost' ? '#f97316' : '#10b981';
  };

  return (
    <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-800">แผนที่สัตว์เลี้ยงล่าสุด</h3>
        </div>
        <Link to="/map" className="text-xs text-orange-500 hover:text-orange-600 font-medium">
          ดูแผนที่เต็ม →
        </Link>
      </div>

      <div
        className="h-48 sm:h-56 w-full bg-slate-100 relative cursor-pointer group"
        onClick={() => navigate('/map')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/map')}
        aria-label="คลิกเพื่อดูแผนที่แบบเต็ม"
      >
        <MapContainer
          center={center}
          zoom={defaultZoom}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl={false}
          className="pointer-events-none"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {validReports.map((report) => {
            const thumbnail = report.images?.[0] || PLACEHOLDER;
            const isResolved = report.status === 'resolved';
            return (
              <Marker
                key={report.id}
                position={[report.lat, report.lng]}
                icon={L.divIcon({
                  className: 'custom-marker',
                  html: `<div style="width:28px;height:28px;border-radius:50%;background:${getMarkerColor(report.type, report.status)};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">${isResolved ? '✅' : report.type === 'lost' ? '🔍' : '🐾'}</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Popup minWidth={220} maxWidth={240}>
                  <div className="p-0 min-w-[200px]">
                    <div className="h-28 w-full bg-slate-100 overflow-hidden rounded-t-lg">
                      <img src={thumbnail} alt={report.title} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-slate-800 line-clamp-2">{report.title}</p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin className="h-3 w-3" />{report.province || 'ไม่ระบุ'}</p>
                      <Link to={`/detail/${report.id}`} className="inline-flex items-center justify-center w-full mt-3 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition" onClick={(e) => e.stopPropagation()}>ดูรายละเอียด →</Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl border border-slate-200 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold text-slate-700">คลิกเพื่อดูแผนที่เต็ม</span>
              <ArrowRight className="h-4 w-4 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /><span className="text-slate-500">สัตว์หาย</span></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-slate-500">พบสัตว์</span></span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /><span className="text-slate-500">ปิดเคสแล้ว</span></span>
      </div>
    </section>
  );
}

function TipsSection() {
  const tips = [
    { icon: Timer, title: 'เริ่มค้นหาทันที', desc: 'เวลาเป็นปัจจัยสำคัญ! สัตว์ที่หายใหม่ๆ มักยังอยู่ไม่ไกลจากจุดสุดท้ายที่เห็น เริ่มค้นหาบริเวณใกล้เคียงภายใน 1-2 ชั่วโมงแรก', color: 'orange' },
    { icon: Volume2, title: 'เรียกชื่อเบาๆ', desc: 'ใช้เสียงเรียกชื่อสัตว์เลี้ยงด้วยน้ำเสียงปกติ ไม่ตะโกนแรง เพราะอาจทำให้สัตว์ตกใจและวิ่งหนีไกลออกไป', color: 'blue' },
    { icon: Flashlight, title: 'ค้นหาตอนกลางคืน', desc: 'สัตว์หลายชนิดออกหากินตอนกลางคืน ใช้ไฟฉายส่องตามพุ่มไม้ ใต้รถ หรือมุมอับ พร้อมนำอาหารที่ชอบไปล่อ', color: 'amber' },
    { icon: MapPinned, title: 'ตรวจสอบจุดคุ้นเคย', desc: 'สัตว์มักกลับไปยังสถานที่ที่เคยไปบ่อยๆ เช่น สวนสาธารณะ ร้านขายอาหารสัตว์ หรือบ้านเพื่อนบ้านที่เคยไปเล่น', color: 'emerald' },
    { icon: Share2, title: 'แจ้งชุมชนออนไลน์', desc: 'โพสต์ในกลุ่มเฟซบุ๊กหมู่บ้าน ไลน์ชุมชน หรือแพลตฟอร์ม "ช่วยกันหา" พร้อมรูปชัดเจนและข้อมูลติดต่อ', color: 'purple' },
    { icon: PhoneCall, title: 'ติดต่อหน่วยงานที่เกี่ยวข้อง', desc: 'แจ้งปศุสัตว์อำเภอ มูลนิธิช่วยเหลือสัตว์ หรือโรงพยาบาลสัตว์ใกล้เคียง พร้อมให้ข้อมูลและรูปภาพ', color: 'rose' },
    { icon: Camera, title: 'เตรียมรูปหลายมุม', desc: 'มีรูปสัตว์เลี้ยงหลายมุม ทั้งด้านหน้า ด้านข้าง และจุดเด่น เช่น รอยด่าง สีขน หรืออุปกรณ์ประจำตัว', color: 'cyan' },
    { icon: Target, title: 'วางของที่มีกลิ่นเจ้าของ', desc: 'วางเสื้อผ้าที่ใช้แล้วหรือผ้าห่มที่มีกลิ่นเจ้าของไว้บริเวณบ้าน สัตว์อาจตามกลิ่นกลับมาได้', color: 'pink' },
  ];

  const colorMap: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-600 border-orange-200',
    blue: 'bg-blue-100 text-blue-600 border-blue-200',
    amber: 'bg-amber-100 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-100 text-purple-600 border-purple-200',
    rose: 'bg-rose-100 text-rose-600 border-rose-200',
    cyan: 'bg-cyan-100 text-cyan-600 border-cyan-200',
    pink: 'bg-pink-100 text-pink-600 border-pink-200',
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            เคล็ดลับตามหาสัตว์หาย
          </h2>
          <p className="mt-1 text-sm text-slate-500">เทคนิคจากผู้เชี่ยวชาญและประสบการณ์จริง</p>
        </div>
        <Link to="/feed" className="text-sm font-semibold text-orange-500 hover:text-orange-600">ดูโพสต์ช่วยเหลือ →</Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tips.map((tip, i) => {
          const Icon = tip.icon;
          return (
            <motion.div key={tip.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }} whileHover={{ y: -4 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${colorMap[tip.color]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{tip.title}</h3>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">{tip.desc}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">💡 เคล็ดลับเพิ่มเติม</p>
            <p className="mt-1 text-sm text-amber-700/90">
              สัตว์ที่หายมักไม่ไปไกล! 80% ของสัตว์เลี้ยงที่พบ กลับมาอยู่ในรัศมี 2 กิโลเมตรจากจุดสุดท้ายที่เห็น
              <span className="font-semibold">อย่าเพิ่งท้อ และค้นหาอย่างมีระบบ</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ThreeStatusGuide() {
  const statuses = [
    { icon: AlertCircle, title: '🐕 สัตว์หาย', description: 'คุณเป็นเจ้าของที่กำลังตามหาน้อง?', action: 'แจ้งสัตว์เลี้ยงหาย', link: '/report/lost', bgColor: 'from-orange-50 to-amber-50', borderColor: 'border-orange-200', textColor: 'text-orange-700', buttonColor: 'bg-orange-500 hover:bg-orange-600' },
    { icon: HandHeart, title: '🐾 พบสัตว์เร่ร่อน', description: 'คุณพบน้องที่อาจกำลังหลงทาง?', action: 'แจ้งพบสัตว์', link: '/report/found', bgColor: 'from-emerald-50 to-teal-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', buttonColor: 'bg-emerald-500 hover:bg-emerald-600' },
    { icon: Home, title: '🤝 คืนสัตว์สู่เจ้าของ', description: 'พบกันแล้วหรือต้องการปิดเคส?', action: 'ยืนยันพบแล้ว', link: '/profile', bgColor: 'from-slate-50 to-gray-50', borderColor: 'border-slate-200', textColor: 'text-slate-700', buttonColor: 'bg-slate-600 hover:bg-slate-700' },
  ];

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">คุณอยู่ในสถานการณ์ไหน?</h2>
        <p className="mt-1 text-sm text-slate-500">เลือกสถานการณ์ของคุณเพื่อเริ่มต้นช่วยเหลือ</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {statuses.map((status, i) => {
          const Icon = status.icon;
          return (
            <motion.div key={status.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.1 }} whileHover={{ y: -4 }} className={`rounded-2xl border ${status.borderColor} bg-gradient-to-br ${status.bgColor} p-6 shadow-sm hover:shadow-md transition-all`}>
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ${status.textColor}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className={`mt-4 text-lg font-bold ${status.textColor}`}>{status.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{status.description}</p>
              <Link to={status.link} className={`mt-4 inline-flex items-center justify-center w-full rounded-xl ${status.buttonColor} px-4 py-2.5 text-sm font-semibold text-white transition`}>
                {status.action} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <p className="text-center text-sm font-semibold text-slate-700 mb-4">🔄 กระบวนการช่วยเหลือ</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">1</div><span>แจ้งเหตุ</span></div>
          <ArrowRight className="hidden sm:block h-4 w-4 text-slate-300" />
          <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">2</div><span>ประสานงาน</span></div>
          <ArrowRight className="hidden sm:block h-4 w-4 text-slate-300" />
          <div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">3</div><span>กลับบ้าน</span></div>
        </div>
      </div>
    </section>
  );
}

// ✅ Redesigned: Flexible Empty/Info Card - สามารถเป็นข้อความหรืออะไรก็ได้
function HelpPetsCard({ variant = 'empty' }: { variant?: 'empty' | 'info' | 'cta' }) {
  const variants = {
    empty: {
      title: 'ยังไม่มีโพสต์ในพื้นที่นี้',
      desc: 'เป็นคนแรกที่แจ้งช่วยเหลือกันไหม?',
      icon: <PawPrint className="h-8 w-8 text-orange-300" />,
      action: { label: 'แจ้งสัตว์หาย', link: '/report/lost', icon: <Plus className="h-3 w-3" /> },
      bg: 'from-slate-50 to-orange-50/30',
      border: 'border-dashed border-slate-200 hover:border-orange-300',
    },
    info: {
      title: 'ช่วยสัตว์เลี้ยงกลับบ้าน',
      desc: 'แพลตฟอร์มกลางสำหรับแจ้งสัตว์หายและพบสัตว์เร่ร่อน',
      icon: <Heart className="h-8 w-8 text-orange-400" />,
      action: { label: 'เรียนรู้เพิ่มเติม', link: '#', icon: <ArrowRight className="h-3 w-3" /> },
      bg: 'from-orange-50 to-amber-50',
      border: 'border-orange-200 hover:border-orange-300',
    },
    cta: {
      title: 'เริ่มช่วยเหลือวันนี้',
      desc: 'ฟรี ปลอดภัย และง่ายต่อการใช้งาน',
      icon: <Sparkles className="h-8 w-8 text-orange-500" />,
      action: { label: 'สร้างโพสต์แรก', link: '/report/lost', icon: <Plus className="h-3 w-3" /> },
      bg: 'from-orange-100 to-orange-50',
      border: 'border-orange-300 hover:border-orange-400',
    },
  };

  const v = variants[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group rounded-2xl border ${v.border} bg-gradient-to-br ${v.bg} p-5 sm:p-6 text-center hover:shadow-md transition-all`}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Icon with subtle animation */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white shadow-sm"
        >
          {v.icon}
        </motion.div>
        
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-slate-800">{v.title}</h3>
          <p className="text-sm text-slate-500">{v.desc}</p>
        </div>
        
        {v.action && (
          <Link 
            to={v.action.link}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
          >
            {v.action.icon}
            {v.action.label}
          </Link>
        )}
      </div>
    </motion.div>
  );
}

// ✅ Hero Right Side - Beautiful Placeholder when no reports
function HeroPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.16 }}
      className="relative rounded-2xl sm:rounded-[2rem] bg-white/90 p-4 sm:p-6 shadow-glass ring-1 ring-orange-100"
    >
      <div className="flex flex-col items-center justify-center gap-4 py-6 sm:py-8">
        {/* Animated Illustration */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <PawPrint className="h-10 w-10 sm:h-12 sm:w-12 text-orange-400" />
            </motion.div>
          </div>
          {/* Floating hearts */}
          <motion.div
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-100 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart className="h-3 w-3 text-red-400" />
          </motion.div>
        </motion.div>
        
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-slate-700">ชุมชนกำลังเติบโต 🌱</p>
          <p className="text-xs text-slate-400 max-w-[200px]">
            เป็นคนแรกๆ ที่ช่วยสร้างชุมชนตามหาสัตว์เลี้ยงให้เข้มแข็ง
          </p>
        </div>
        
        <div className="flex gap-2">
          <Link 
            to="/report/lost"
            className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-600 transition"
          >
            🐕 แจ้งสัตว์หาย
          </Link>
          <Link 
            to="/report/found"
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
          >
            🐾 พบสัตว์
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function LandingPage({ user }: LandingPageProps) {
  const stats = useStats();
  const { reports: latestReports, loading: loadingReports } = useLatestReports();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      
      {/* ✅ SECTION 1: HERO - "ช่วยสัตว์เลี้ยง" อยู่บนสุด */}
      <section className="relative overflow-hidden pt-4 sm:pt-6 pb-8 sm:pb-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl sm:rounded-[2rem] bg-gradient-to-br from-orange-100 via-white to-orange-50 p-6 sm:p-8 md:p-12 shadow-glass">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,125,0,0.15),_transparent_40%)]" />
            
            <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr]">
              {/* Left: Text & CTAs */}
              <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                  <p className="inline-flex items-center gap-2 rounded-full bg-orange-200 px-4 py-2 text-sm font-semibold text-orange-800">
                    🐾 แพลตฟอร์มตามหาสัตว์เลี้ยงของไทย
                  </p>
                  <h1 className="mt-4 max-w-2xl text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-slate-900">
                    ช่วยสัตว์เลี้ยงกลับบ้านอีกครั้ง
                  </h1>
                  <p className="mt-4 max-w-xl text-sm sm:text-base text-slate-600 leading-relaxed">
                    พื้นที่กลางสำหรับ <span className="font-semibold text-orange-600">แจ้งสัตว์เลี้ยงหาย</span>,
                    <span className="font-semibold text-emerald-600"> พบสัตว์เร่ร่อน</span> และ
                    <span className="font-semibold text-slate-600">ยืนยันการคืนสัตว์สู่เจ้าของ</span>
                    เชื่อมต่อชุมชนคนรักสัตว์เพื่อให้น้องๆ ได้กลับสู่อ้อมกอดเร็วที่สุด
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }} className="flex flex-wrap gap-3">
                  <Link to="/report/lost" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-600 hover:shadow-xl">🐕 แจ้งสัตว์หาย</Link>
                  <Link to="/report/found" className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-600 hover:shadow-xl">🐾 พบสัตว์เร่ร่อน</Link>
                  <Link to="/feed" className="rounded-2xl border border-orange-200 bg-white px-6 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50">ดูโพสต์ทั้งหมด</Link>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="grid grid-cols-3 gap-3 sm:gap-4 max-w-md">
                  {[
                    { label: 'ผู้ใช้', icon: Users, value: stats.users },
                    { label: 'โพสต์', icon: PawPrint, value: stats.posts },
                    { label: 'สำเร็จ', icon: CheckCircle2, value: stats.resolved },
                  ].map(({ label, icon: Icon, value }) => (
                    <div key={label} className="rounded-2xl bg-white/90 p-3 shadow-glass text-center">
                      <Icon className="mx-auto mb-1 h-4 w-4 text-orange-400" />
                      <p className="text-lg font-bold text-slate-900"><StatNum n={value} loading={stats.loading} /></p>
                      <p className="text-[10px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Right: Dynamic Content */}
              {latestReports.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.16 }}
                  className="rounded-2xl bg-white/90 p-4 shadow-glass ring-1 ring-orange-100"
                >
                  <div className="space-y-4">
                    {latestReports.slice(0, 2).map((report) => {
                      const isResolved = report.status === 'resolved';
                      return (
                        <Link key={report.id} to={`/detail/${report.id}`} className={`block rounded-xl border p-4 shadow-sm transition hover:shadow-md ${isResolved ? 'border-slate-200 bg-slate-50' : 'border-orange-200 bg-orange-50/80'}`}>
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              <img src={report.images?.[0] || PLACEHOLDER} alt={report.title} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className={`text-[10px] font-semibold ${isResolved ? 'text-slate-500' : report.type === 'lost' ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {isResolved ? '✅ ปิดเคส' : report.type === 'lost' ? '🐕 หาย' : '🐾 พบ'}
                              </span>
                              <p className="mt-0.5 text-sm font-semibold text-slate-800 line-clamp-1">{report.title}</p>
                              <p className="text-[10px] text-slate-400">{(report as any).province || 'ไม่ระบุ'}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              ) : (
                <HeroPlaceholder />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ✅ SECTION 2: Three Status Guide */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ThreeStatusGuide />
        </div>
      </section>

      {/* ✅ SECTION 3: Sponsor Banner */}
      <section className="py-4 sm:py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SponsorBanner />
        </div>
      </section>

      {/* ✅ SECTION 4: How To */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">วิธีใช้งานง่ายๆ ใน 4 ขั้นตอน</h2>
              <p className="mt-1 text-sm text-slate-500">ตั้งแต่แจ้งเหตุจนน้องกลับบ้าน</p>
            </div>
            {!user && (
              <Link to="/auth/login" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-600">
                เริ่มใช้งานทันที <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            {HOW_TO.map(({ icon: Icon, label, desc, color }, i) => {
              const colorClasses: Record<string, string> = {
                orange: 'bg-orange-100 text-orange-600',
                emerald: 'bg-emerald-100 text-emerald-600',
                blue: 'bg-blue-100 text-blue-600',
                slate: 'bg-slate-100 text-slate-600',
              };
              return (
                <motion.div key={label} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300 }} className="rounded-2xl bg-white p-5 shadow-glass border border-slate-100">
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1">ขั้นที่ {i + 1}</p>
                  <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ✅ SECTION 5: Latest Posts - ถอยลงมา 1 ขั้น */}
      <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">โพสต์ล่าสุดจากชุมชน</h2>
              <p className="mt-1 text-sm text-slate-500">อัปเดตแบบ Real-time ทั่วประเทศไทย</p>
            </div>
            <Link to="/feed" className="rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600">
              ดูทั้งหมด
            </Link>
          </div>

          {loadingReports ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-100 p-12 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              <span className="text-slate-400 text-sm">กำลังโหลด...</span>
            </div>
          ) : latestReports.length === 0 ? (
            /* ✅ Flexible Empty Card - สามารถเปลี่ยน variant ได้ */
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              <HelpPetsCard variant="empty" />
              <HelpPetsCard variant="info" />
              <HelpPetsCard variant="cta" />
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {latestReports.map((report) => {
                const isResolved = report.status === 'resolved';
                return (
                  <Link key={report.id} to={`/detail/${report.id}`}
                    className={`group rounded-2xl border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                      isResolved ? 'border-slate-200 bg-slate-50' : 'border-slate-100 bg-white hover:border-orange-200'
                    }`}>
                    <div className="flex items-start gap-4">
                      <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                        {report.images?.[0] ? (
                          <img src={report.images[0]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">🐾</div>
                        )}
                        {isResolved && (
                          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isResolved
                              ? 'bg-slate-100 text-slate-600'
                              : report.type === 'lost' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isResolved ? '✅ ปิดเคส' : report.type === 'lost' ? '🐕 หาย' : '🐾 พบ'}
                          </span>
                          {report.urgent && !isResolved && (
                            <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              <AlertCircle className="h-2.5 w-2.5" /> ด่วน
                            </span>
                          )}
                        </div>
                        <h3 className={`text-sm font-semibold line-clamp-2 transition ${
                          isResolved ? 'text-slate-500' : 'text-slate-900 group-hover:text-orange-600'
                        }`}>
                          {report.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-400 line-clamp-1">{report.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {(report as any).province || '—'}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{report.likesCount ?? 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{report.commentsCount ?? 0}</span>
                        <span className="hidden sm:flex items-center gap-1"><Clock3 className="h-3 w-3" />{timeAgo(report.createdAt)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* CTA when no user & no reports */}
          {!user && latestReports.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-6 sm:p-8 text-center"
            >
              <p className="font-semibold text-slate-800">ร่วมสร้างชุมชนช่วยเหลือสัตว์เลี้ยงด้วยกัน</p>
              <p className="mt-1 text-sm text-slate-500">ฟรี ปลอดภัย และง่ายต่อการใช้งาน</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link to="/auth/register" className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-600">สมัครสมาชิก</Link>
                <Link to="/auth/login" className="rounded-2xl border border-orange-200 bg-white px-6 py-3 text-sm font-semibold text-orange-600 transition hover:bg-orange-50">เข้าสู่ระบบ</Link>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* ✅ SECTION 6: Mini Map */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">ตำแหน่งล่าสุดบนแผนที่</h2>
              <p className="text-sm text-slate-500">เช็กพื้นที่ที่มีการแจ้งหาย พบสัตว์ หรือปิดเคสแล้ว</p>
            </div>
            <Link to="/map" className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1">ดูแผนที่เต็ม <ArrowRight size={16} /></Link>
          </div>
          <MiniPetMap reports={latestReports} />
        </div>
      </section>

      {/* ✅ SECTION 7: Tips */}
      <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <TipsSection />
        </div>
      </section>

      {/* ✅ SECTION 8: FAQ */}
      <section className="py-8 sm:py-12 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-orange-50 via-white to-orange-50 p-6 sm:p-8 shadow-glass">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">คำถามที่พบบ่อย</h2>
            <div className="space-y-3">
              {[
                { q: 'เว็บนี้ใช้งานฟรีไหม?', a: 'ฟรี 100% ครับ ไม่มีค่าใช้จ่ายใดๆ ทั้งในการแจ้งเหตุหรือค้นหา' },
                { q: 'ต้องสมัครสมาชิกไหม?', a: 'สามารถดูโพสต์ได้โดยไม่ต้องสมัคร แต่ต้องล็อกอินเพื่อแจ้งเหตุหรือคอมเมนต์' },
                { q: 'ข้อมูลส่วนตัวปลอดภัยไหม?', a: 'เราเก็บข้อมูลเท่าที่จำเป็น และไม่เปิดเผยเบอร์โทรต่อสาธารณะโดยไม่ได้รับอนุญาต' },
                { q: 'แจ้งเหตุผิดได้ไหม?', a: 'สามารถแก้ไขหรือลบโพสต์ของตัวเองได้ตลอดเวลาผ่านหน้าโปรไฟล์' },
              ].map((item, i) => (
                <div key={i} className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{item.q}</p>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ✅ SECTION 9: Donation */}
      <section className="py-8 sm:py-12 bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <DonationSection />
        </div>
      </section>

      {/* ✅ SECTION 10: Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">🐾 ตามหาน้อง</p>
              <p className="mt-1 text-sm text-slate-400">ชุมชนช่วยพาสัตว์เลี้ยงกลับบ้านอย่างปลอดภัย</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {user ? (
                <>
                  <Link to="/report/lost" className="rounded-full bg-orange-500 px-4 py-2 text-white transition hover:bg-orange-600 font-semibold">แจ้งสัตว์หาย</Link>
                  <Link to="/feed" className="rounded-full bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-slate-200">ดูฟีด</Link>
                </>
              ) : (
                <>
                  <Link to="/auth/login" className="rounded-full bg-orange-50 px-4 py-2 text-orange-700 transition hover:bg-orange-100">เข้าสู่ระบบ</Link>
                  <Link to="/report/lost" className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800">แจ้งสัตว์หาย</Link>
                </>
              )}
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
            <p>© {new Date().getFullYear()} ช่วยกันหา · พัฒนาด้วยความตั้งใจเพื่อสัตว์เลี้ยงไทย 🐾</p>
          </div>
        </div>
      </footer>

      {/* ✅ Floating "Create Post" Button (Mobile) */}
      {user && (
        <Link
          to="/report/lost"
          className="fixed bottom-6 right-6 z-50 sm:hidden flex items-center justify-center h-14 w-14 rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-all"
          aria-label="แจ้งสัตว์เลี้ยงหาย"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}

      {/* ✅ Scroll to Top Button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 left-6 z-40 hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:border-orange-300 hover:text-orange-500 transition"
        aria-label="กลับด้านบน"
      >
        <ArrowUp className="h-4 w-4" />
      </button>

      {/* ✅ Scroll to Latest Posts Button */}
      <button
        onClick={() => document.querySelector('section:nth-of-type(5)')?.scrollIntoView({ behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-40 hidden sm:flex items-center justify-center h-10 w-10 rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:border-orange-300 hover:text-orange-500 transition"
        aria-label="ไปโพสต์ล่าสุด"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}