import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, db, Timestamp } from '../firebase';
import MapComponent from '../components/MapComponent';
import type { User } from 'firebase/auth';
import type { Report, ReportStatus } from '../types';
import {
  MapPin, X, Loader2, PawPrint, Eye, Heart,
  Filter, Navigation, AlertCircle, Clock, Phone,
  Share2, LocateFixed, CheckCircle2
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────
const PLACEHOLDER =
  'https://placehold.co/400x300/fff7ed/f97316?text=🐾+ไม่มีรูป&font=noto';

const NEAR_RADIUS_KM = 10;
const GEO_TIMEOUT_MS = 10000;
const GEO_MAX_AGE_MS = 300000;

// ─── Types ─────────────────────────────────────────────────
interface MapPageProps {
  user: User | null;
}

interface Coords {
  lat: number;
  lng: number;
}

// ─── Utils ─────────────────────────────────────────────────
const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatTimeAgo = (dateString?: string): string => {
  if (!dateString) return 'ไม่ระบุเวลา';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'ไม่ระบุเวลา';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'เมื่อสักครู่';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชม. ที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// ─── Report Card ───────────────────────────────────────────
function ReportCard({
  report,
  onClose,
  onViewDetail,
  onCall,
  onShare,
}: {
  report: Report;
  onClose: () => void;
  onViewDetail: (id: string) => void;
  onCall: (phone?: string) => void;
  onShare: (report: Report) => void;
}) {
  const imageUrl = report.images?.[0] || PLACEHOLDER;
  const normalizedStatus = String(report.status || '').toLowerCase();
  const isResolved: boolean = normalizedStatus === 'resolved' || normalizedStatus === 'closed';

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur-xl">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-black/10 p-2 hover:bg-black/20"
      >
        <X size={16} />
      </button>

      <div className="flex gap-4 p-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          <img
            src={imageUrl}
            alt={report.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = PLACEHOLDER;
            }}
          />
          {report.urgent && !isResolved && (
            <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white animate-pulse">
              ด่วน
            </div>
          )}
          {isResolved && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-[2px]">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 drop-shadow-lg" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-black text-white transition-colors ${
                isResolved
                  ? 'bg-emerald-500'
                  : report.type === 'lost'
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
              }`}
            >
              {isResolved ? '✅ พบแล้ว' : report.type === 'lost' ? '🐕 หาย' : '🐾 พบ'}
            </span>
            {report.breed && (
              <span className="text-[11px] text-slate-400">{report.breed}</span>
            )}
          </div>
          <h2 className="mt-2 truncate text-base font-black text-slate-800">
            {report.title}
          </h2>
          <p className="mt-1 line-clamp-2 text-[13px] text-slate-500">
            {report.description || '-'}
          </p>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
            <Clock size={12} />
            {formatTimeAgo(report.createdAt)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin size={12} className="text-orange-500" />
            {[report.district, report.province].filter(Boolean).join(', ')}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <Heart size={12} />
              {report.likesCount || 0}
            </div>
            <div className="flex items-center gap-1">
              <Eye size={12} />
              {report.viewsCount || 0}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50 p-4">
        <div className="flex gap-2">
          {report.contactPhone && !isResolved && (
            <button
              onClick={() => onCall(report.contactPhone)}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-bold text-slate-700 hover:border-orange-400 hover:text-orange-500 transition"
            >
              <Phone size={14} className="mr-1 inline" />
              ติดต่อ
            </button>
          )}
          <button
            onClick={() => onShare(report)}
            className="rounded-xl border border-slate-200 bg-white px-3 hover:border-orange-400 hover:text-orange-500 transition"
          >
            <Share2 size={15} />
          </button>
          <button
            onClick={() => !isResolved && onViewDetail(report.id)}
            className={`flex-[2] rounded-xl py-2 text-sm font-black text-white transition ${
              isResolved
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
            disabled={isResolved}
            title={isResolved ? 'เคสนี้ปิดแล้ว' : 'ดูรายละเอียด'}
          >
            {isResolved ? 'ปิดเคสแล้ว' : 'ดูรายละเอียด'}
          </button>
        </div>
      </div>
    </article>
  );
}

// ─── Main ──────────────────────────────────────────────────
export default function MapPage({ user }: MapPageProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'lost' | 'found'>('lost');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'near'>('all');
  const [myCoords, setMyCoords] = useState<Coords | null>(null);
  const [geoTracking, setGeoTracking] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // ─── Fetch User Location ────────────────────────────────
  const fetchUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('อุปกรณ์ไม่รองรับตำแหน่ง');
      return;
    }
    setGeoTracking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoTracking(false);
      },
      (err) => {
        setGeoTracking(false);
        if (err.code === 1) setGeoError('กรุณาอนุญาตตำแหน่ง');
        else setGeoError('ไม่สามารถระบุตำแหน่งได้');
        setRangeFilter('all');
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  }, []);

  useEffect(() => {
    if (rangeFilter === 'near') fetchUserLocation();
  }, [rangeFilter, fetchUserLocation]);

  // ─── Firestore ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'reports'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((docSnap) => {
          const raw = docSnap.data() as any;

          // ── Normalize type ──────────────────────────────
          const rawType = String(raw.type || '').toLowerCase();
          let normalizedType: 'lost' | 'found' = 'lost';
          if (rawType === 'found' || rawType === 'พบ') {
            normalizedType = 'found';
          }

          // ── Normalize status ────────────────────────────
          // รองรับ: 'resolved', 'closed', 'กำลังตาม', 'พบแล้ว', '', undefined
          const rawStatus = String(raw.status || '').toLowerCase();
          let normalizedStatus: ReportStatus = 'active';
          if (rawStatus === 'resolved' || rawStatus === 'พบแล้ว') {
            normalizedStatus = 'resolved';
          } else if (rawStatus === 'closed' || rawStatus === 'ปิด') {
            normalizedStatus = 'closed';
          }
          // 'กำลังตาม', '', undefined → 'active'

          // ── Normalize lat/lng ───────────────────────────
          let lat = parseFloat(raw.lat);
          let lng = parseFloat(raw.lng);
          if (isNaN(lat)) lat = 0;
          if (isNaN(lng)) lng = 0;

          // ── Normalize createdAt ─────────────────────────
          const createdAt =
            raw.createdAt instanceof Timestamp
              ? raw.createdAt.toDate().toISOString()
              : raw.createdAt || new Date().toISOString();

          return {
            id: docSnap.id,
            ...raw,
            lat,
            lng,
            type: normalizedType,
            status: normalizedStatus,
            createdAt,
          } as Report;
        })
        .filter((r) => {
          // 1. ต้องมีพิกัดที่ valid
          if (!r.lat || !r.lng || r.lat === 0 || r.lng === 0) return false;

          // 2. ต้องมี type ที่ถูกต้อง
          if (r.type !== 'lost' && r.type !== 'found') return false;

          // 3. กรองตามประเภท + สถานะ
          if (r.type === 'lost') {
            // ✅ แสดง lost ทั้ง active และ resolved (พบแล้ว)
            // ซ่อนเฉพาะ closed
            return r.status === 'active' || r.status === 'resolved';
          }

          // found: แสดงทั้งหมด
          return true;
        });
console.log('ALL TYPES:', data.map(r => ({ id: r.id.slice(0,6), type: r.type, status: r.status })));
setReports(data);
      setReports(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ─── Filtered Reports ───────────────────────────────────
  const filteredReports = useMemo(() => {
    let data = reports.filter((r) => r.type === tab);

    if (rangeFilter === 'near' && myCoords) {
      data = data.filter((r) => {
        if (!r.lat || !r.lng) return false;
        return haversineKm(myCoords.lat, myCoords.lng, r.lat, r.lng) <= NEAR_RADIUS_KM;
      });
    }

    return data;
  }, [reports, tab, rangeFilter, myCoords]);

  // ─── Counts ─────────────────────────────────────────────
  // นับเฉพาะ active สำหรับ badge "หาย"
  const lostCount = reports.filter((r) => r.type === 'lost' && r.status === 'active').length;
  const foundCount = reports.filter((r) => r.type === 'found').length;

  // ─── Handlers ───────────────────────────────────────────
  const handleViewDetail = useCallback((id: string) => {
    window.location.href = `/detail/${id}`;
  }, []);

  const handleCall = useCallback((phone?: string) => {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  }, []);

  const handleShare = useCallback(async (report: Report) => {
    const url = `${window.location.origin}/detail/${report.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: report.title, text: report.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('คัดลอกลิงก์แล้ว');
      }
    } catch {
      // Silent fail
    }
  }, []);

  const handleMarkerClick = useCallback((report: Report) => {
    setSelectedReport(report);
  }, []);

  // ─── ESC Close ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedReport(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="relative h-[calc(100vh-56px)] overflow-hidden bg-slate-100">
      {/* ─── Map ───────────────────────────────────────── */}
      <div className="absolute inset-0">
        <MapComponent
          reports={filteredReports}
          height="h-full"
          zoom={rangeFilter === 'near' ? 12 : 6}
          selectedReport={selectedReport}
          userCoords={myCoords}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* ─── Top Controls ─────────────────────────────── */}
      <div className="absolute left-1/2 top-4 z-40 w-full max-w-lg -translate-x-1/2 px-4">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 text-white">
                <PawPrint size={18} />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-800">แผนที่สัตว์เลี้ยง</h1>
                <p className="text-[11px] text-slate-400">ติดตามสัตว์หายทั่วไทย</p>
              </div>
            </div>
            {loading && <Loader2 size={18} className="animate-spin text-orange-500" />}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {/* LOST / FOUND Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setTab('lost')}
                className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                  tab === 'lost'
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                🐕 หาย ({lostCount})
              </button>
              <button
                onClick={() => setTab('found')}
                className={`flex-1 rounded-xl py-2 text-xs font-black transition ${
                  tab === 'found'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                🐾 พบ ({foundCount})
              </button>
            </div>

            {/* RANGE Filter */}
            <div className="flex rounded-2xl bg-slate-100 p-1">
              <button
                onClick={() => setRangeFilter('all')}
                className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                  rangeFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setRangeFilter('near')}
                disabled={geoTracking}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition ${
                  rangeFilter === 'near'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                {geoTracking ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <LocateFixed size={12} />
                )}
                ใกล้ฉัน
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Sheet ─────────────────────────────── */}
      {selectedReport && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 pb-5 sm:bottom-6">
            <ReportCard
              report={selectedReport}
              onClose={() => setSelectedReport(null)}
              onViewDetail={handleViewDetail}
              onCall={handleCall}
              onShare={handleShare}
            />
          </div>
        </>
      )}

      {/* ─── Empty State ────────────────────────────────── */}
      {!loading && filteredReports.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="text-center px-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow">
              <PawPrint size={28} className="text-slate-300" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-700">ไม่พบข้อมูล</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xs">
              {tab === 'found'
                ? 'ยังไม่มีผู้แจ้งพบสัตว์ในพื้นที่นี้'
                : 'ยังไม่มีรายงานสัตว์หายในพื้นที่นี้'}
            </p>
            {rangeFilter === 'near' && (
              <button
                onClick={() => setRangeFilter('all')}
                className="mt-4 text-xs font-medium text-orange-500 hover:text-orange-600"
              >
                แสดงทั้งหมดแทน
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Error Toast ─────────────────────────────── */}
      {geoError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <AlertCircle size={16} />
            {geoError}
            <button
              onClick={() => setGeoError(null)}
              className="rounded p-1 hover:bg-white/20 transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Floating Button (Mobile) ─────────────────── */}
      {!selectedReport && (
        <button
          onClick={() => setRangeFilter('near')}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-orange-600 transition sm:hidden"
        >
          <Navigation size={16} />
          ใกล้ฉัน
        </button>
      )}
    </main>
  );
  
}
