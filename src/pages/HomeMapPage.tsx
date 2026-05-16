
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, db, Timestamp } from '../firebase';
import MapComponent from '../components/MapComponent';
import type { User } from 'firebase/auth';
import type { Report, ReportStatus } from '../types';
import {
  MapPin, X, Loader2, PawPrint, Eye, Heart,
  Navigation, AlertCircle, Clock, Phone,
  Share2, LocateFixed, CheckCircle2, ChevronDown
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────
const PLACEHOLDER =
  'https://placehold.co/400x300/fff7ed/f97316?text=🐾+ไม่มีรูป&font=noto';

const NEAR_RADIUS_KM = 10;
const GEO_TIMEOUT_MS = 10000;
const GEO_MAX_AGE_MS = 300000;

// ─── Province → center coords + zoom ─────────────────────
const PROVINCE_COORDS: Record<string, { lat: number; lng: number; zoom: number }> = {
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018, zoom: 11 },
  'กระบี่':        { lat: 8.0863,  lng: 98.9063,  zoom: 10 },
  'กาญจนบุรี':     { lat: 14.0023, lng: 99.5328,  zoom: 9  },
  'กาฬสินธุ์':     { lat: 16.4314, lng: 103.5059, zoom: 10 },
  'กำแพงเพชร':    { lat: 16.4827, lng: 99.5226,  zoom: 10 },
  'ขอนแก่น':      { lat: 16.4419, lng: 102.8360, zoom: 10 },
  'จันทบุรี':      { lat: 12.6113, lng: 102.1040, zoom: 10 },
  'ฉะเชิงเทรา':   { lat: 13.6902, lng: 101.0779, zoom: 10 },
  'ชลบุรี':        { lat: 13.3611, lng: 100.9847, zoom: 10 },
  'ชัยนาท':        { lat: 15.1851, lng: 100.1253, zoom: 10 },
  'ชัยภูมิ':       { lat: 15.8068, lng: 102.0317, zoom: 9  },
  'ชุมพร':         { lat: 10.4930, lng: 99.1800,  zoom: 10 },
  'เชียงราย':      { lat: 19.9105, lng: 99.8406,  zoom: 9  },
  'เชียงใหม่':     { lat: 18.7883, lng: 98.9853,  zoom: 9  },
  'ตรัง':          { lat: 7.5590,  lng: 99.6114,  zoom: 10 },
  'ตราด':          { lat: 12.2427, lng: 102.5176, zoom: 10 },
  'ตาก':           { lat: 16.8798, lng: 99.1257,  zoom: 9  },
  'นครนายก':       { lat: 14.2057, lng: 101.2131, zoom: 10 },
  'นครปฐม':        { lat: 13.8199, lng: 100.0624, zoom: 10 },
  'นครพนม':        { lat: 17.3920, lng: 104.7754, zoom: 10 },
  'นครราชสีมา':    { lat: 14.9799, lng: 102.0978, zoom: 9  },
  'นครศรีธรรมราช': { lat: 8.4326,  lng: 99.9631,  zoom: 9  },
  'นครสวรรค์':     { lat: 15.6987, lng: 100.1199, zoom: 9  },
  'นนทบุรี':       { lat: 13.8591, lng: 100.5151, zoom: 11 },
  'นราธิวาส':      { lat: 6.4254,  lng: 101.8253, zoom: 10 },
  'น่าน':          { lat: 18.7756, lng: 100.7730, zoom: 9  },
  'บึงกาฬ':        { lat: 18.3609, lng: 103.6466, zoom: 10 },
  'บุรีรัมย์':     { lat: 14.9950, lng: 103.1116, zoom: 9  },
  'ปทุมธานี':      { lat: 14.0208, lng: 100.5255, zoom: 11 },
  'ประจวบคีรีขันธ์':{ lat: 11.8126, lng: 99.7957, zoom: 9  },
  'ปราจีนบุรี':    { lat: 14.0506, lng: 101.3705, zoom: 10 },
  'ปัตตานี':       { lat: 6.8694,  lng: 101.2505, zoom: 10 },
  'พระนครศรีอยุธยา':{ lat: 14.3692, lng: 100.5877, zoom: 10 },
  'พะเยา':         { lat: 19.1664, lng: 99.9019,  zoom: 10 },
  'พังงา':         { lat: 8.4509,  lng: 98.5254,  zoom: 10 },
  'พัทลุง':        { lat: 7.6167,  lng: 100.0740, zoom: 10 },
  'พิจิตร':        { lat: 16.4416, lng: 100.3490, zoom: 10 },
  'พิษณุโลก':      { lat: 16.8211, lng: 100.2659, zoom: 9  },
  'เพชรบุรี':      { lat: 13.1119, lng: 99.9390,  zoom: 10 },
  'เพชรบูรณ์':     { lat: 16.4189, lng: 101.1590, zoom: 9  },
  'แพร่':          { lat: 18.1445, lng: 100.1400, zoom: 10 },
  'ภูเก็ต':        { lat: 7.8804,  lng: 98.3923,  zoom: 11 },
  'มหาสารคาม':     { lat: 16.1851, lng: 103.3028, zoom: 10 },
  'มุกดาหาร':      { lat: 16.5428, lng: 104.7234, zoom: 10 },
  'แม่ฮ่องสอน':    { lat: 19.2986, lng: 97.9654,  zoom: 9  },
  'ยโสธร':         { lat: 15.7924, lng: 104.1452, zoom: 10 },
  'ยะลา':          { lat: 6.5413,  lng: 101.2803, zoom: 10 },
  'ร้อยเอ็ด':      { lat: 16.0538, lng: 103.6520, zoom: 9  },
  'ระนอง':         { lat: 9.9529,  lng: 98.6085,  zoom: 10 },
  'ระยอง':         { lat: 12.6814, lng: 101.2816, zoom: 10 },
  'ราชบุรี':       { lat: 13.5282, lng: 99.8134,  zoom: 10 },
  'ลพบุรี':        { lat: 14.7995, lng: 100.6534, zoom: 10 },
  'ลำปาง':         { lat: 18.2888, lng: 99.4928,  zoom: 9  },
  'ลำพูน':         { lat: 18.5745, lng: 99.0087,  zoom: 10 },
  'เลย':           { lat: 17.4860, lng: 101.7223, zoom: 9  },
  'ศรีสะเกษ':      { lat: 15.1186, lng: 104.3220, zoom: 9  },
  'สกลนคร':        { lat: 17.1556, lng: 104.1348, zoom: 9  },
  'สงขลา':         { lat: 7.1897,  lng: 100.5954, zoom: 9  },
  'สตูล':          { lat: 6.6238,  lng: 100.0673, zoom: 10 },
  'สมุทรปราการ':   { lat: 13.5991, lng: 100.5998, zoom: 11 },
  'สมุทรสงคราม':   { lat: 13.4098, lng: 100.0023, zoom: 11 },
  'สมุทรสาคร':     { lat: 13.5475, lng: 100.2747, zoom: 11 },
  'สระแก้ว':       { lat: 13.8240, lng: 102.0644, zoom: 10 },
  'สระบุรี':       { lat: 14.5289, lng: 100.9101, zoom: 10 },
  'สิงห์บุรี':     { lat: 14.8908, lng: 100.3965, zoom: 11 },
  'สุโขทัย':       { lat: 17.0070, lng: 99.8265,  zoom: 10 },
  'สุพรรณบุรี':    { lat: 14.4744, lng: 100.1177, zoom: 9  },
  'สุราษฎร์ธานี':  { lat: 9.1382,  lng: 99.3217,  zoom: 9  },
  'สุรินทร์':      { lat: 14.8830, lng: 103.4937, zoom: 9  },
  'หนองคาย':       { lat: 17.8782, lng: 102.7416, zoom: 10 },
  'หนองบัวลำภู':   { lat: 17.2218, lng: 102.4260, zoom: 10 },
  'อ่างทอง':       { lat: 14.5896, lng: 100.4550, zoom: 11 },
  'อำนาจเจริญ':    { lat: 15.8656, lng: 104.6257, zoom: 10 },
  'อุดรธานี':      { lat: 17.4138, lng: 102.7870, zoom: 9  },
  'อุตรดิตถ์':     { lat: 17.6243, lng: 100.0993, zoom: 10 },
  'อุทัยธานี':     { lat: 15.3785, lng: 100.0245, zoom: 10 },
  'อุบลราชธานี':   { lat: 15.2448, lng: 104.8473, zoom: 9  },
};

const PROVINCES = Object.keys(PROVINCE_COORDS);

// ─── Types ─────────────────────────────────────────────────
interface MapPageProps { user: User | null; }
interface Coords { lat: number; lng: number; }
interface MapView { center: Coords; zoom: number; }
interface LocationFilter { province: string; district: string; }

// ✅ Type สำหรับ 3 สถานะที่ชัดเจน
type MapTab = 'lost-active' | 'found' | 'resolved';

// ─── Utils ─────────────────────────────────────────────────
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
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
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Geocode district via Nominatim ──
const geocodeDistrict = async (district: string, province: string): Promise<Coords | null> => {
  try {
    const q = encodeURIComponent(`อำเภอ${district} จังหวัด${province} ประเทศไทย`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=th`,
      { headers: { 'User-Agent': 'PetFinderApp/1.0' } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { /* silent */ }
  return null;
};

// ─── Report Card ───────────────────────────────────────────
function ReportCard({ report, onClose, onViewDetail, onCall, onShare }: {
  report: Report; onClose: () => void; onViewDetail: (id: string) => void;
  onCall: (phone?: string) => void; onShare: (report: Report) => void;
}) {
  const imageUrl = report.images?.[0] || PLACEHOLDER;
  const normalizedStatus = String(report.status || '').toLowerCase();
  const isResolved = normalizedStatus === 'resolved' || normalizedStatus === 'closed';

  // ✅ กำหนดสีและป้ายตาม 3 สถานะ
  const statusConfig = {
    label: isResolved ? '✅ พบแล้ว' : report.type === 'lost' ? '🐕 หาย' : '🐾 พบ',
    bgColor: isResolved ? 'bg-slate-500' : report.type === 'lost' ? 'bg-red-500' : 'bg-emerald-500',
    isDisabled: isResolved,
  };

  return (
    <article className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur-xl">
      <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/10 p-2 hover:bg-black/20 transition">
        <X size={16} />
      </button>
      <div className="flex gap-4 p-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          <img src={imageUrl} alt={report.title} className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }} />
          
          {/* Urgent Badge - แสดงเฉพาะเคสที่ยังไม่ปิด */}
          {report.urgent && !isResolved && (
            <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[10px] font-black text-white animate-pulse">ด่วน</div>
          )}
          
          {/* Resolved Overlay - แสดงเมื่อเคสปิดแล้ว */}
          {isResolved && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]">
              <CheckCircle2 className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* ✅ Status Badge - สีต่างกันตามสถานะ */}
            <span className={`rounded-full px-2 py-1 text-[10px] font-black text-white ${statusConfig.bgColor}`}>
              {statusConfig.label}
            </span>
            {report.breed && <span className="text-[11px] text-slate-400">{report.breed}</span>}
          </div>
          <h2 className="mt-2 truncate text-base font-black text-slate-800">{report.title}</h2>
          <p className="mt-1 line-clamp-2 text-[13px] text-slate-500">{report.description || '-'}</p>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
            <Clock size={12} />{formatTimeAgo(report.createdAt)}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
            <MapPin size={12} className="text-orange-500" />
            {[report.district, report.province].filter(Boolean).join(', ')}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
            <div className="flex items-center gap-1"><Heart size={12} />{report.likesCount || 0}</div>
            <div className="flex items-center gap-1"><Eye size={12} />{report.viewsCount || 0}</div>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 bg-slate-50 p-4">
        <div className="flex gap-2">
          {/* ปุ่มติดต่อ - ซ่อนเมื่อเคสปิดแล้ว */}
          {report.contactPhone && !isResolved && (
            <button onClick={() => onCall(report.contactPhone)} className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-bold text-slate-700 hover:border-orange-400 hover:text-orange-500 transition">
              <Phone size={14} className="mr-1 inline" />ติดต่อ
            </button>
          )}
          <button onClick={() => onShare(report)} className="rounded-xl border border-slate-200 bg-white px-3 hover:border-orange-400 hover:text-orange-500 transition">
            <Share2 size={15} />
          </button>
          <button onClick={() => !statusConfig.isDisabled && onViewDetail(report.id)}
            className={`flex-[2] rounded-xl py-2 text-sm font-black text-white transition ${
              statusConfig.isDisabled ? 'bg-slate-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
            }`}
            disabled={statusConfig.isDisabled}
          >
            {statusConfig.isDisabled ? 'ปิดเคสแล้ว' : 'ดูรายละเอียด'}
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
  
  // ✅ เปลี่ยนจาก 2 แท็บ เป็น 3 แท็บที่ชัดเจน
  const [tab, setTab] = useState<MapTab>('lost-active');
  const [rangeFilter, setRangeFilter] = useState<'all' | 'near'>('all');
  const [myCoords, setMyCoords] = useState<Coords | null>(null);
  const [geoTracking, setGeoTracking] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [locationFilter, setLocationFilter] = useState<LocationFilter>({ province: '', district: '' });

  // ─── Map view state ──────────────────────────────────────
  const [mapView, setMapView] = useState<MapView>({
    center: { lat: 13.0, lng: 101.5 },
    zoom: 6,
  });
  const districtTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Geo ────────────────────────────────────────────────
  const fetchUserLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoError('อุปกรณ์ไม่รองรับตำแหน่ง'); return; }
    setGeoTracking(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyCoords(coords);
        setGeoTracking(false);
        setMapView({ center: coords, zoom: 12 });
      },
      (err) => {
        setGeoTracking(false);
        setGeoError(err.code === 1 ? 'กรุณาอนุญาตตำแหน่ง' : 'ไม่สามารถระบุตำแหน่งได้');
        setRangeFilter('all');
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  }, []);

  useEffect(() => {
    if (rangeFilter === 'near') fetchUserLocation();
  }, [rangeFilter, fetchUserLocation]);

  // ─── Zoom when province changes ───────────────────────────
  useEffect(() => {
    if (!locationFilter.province) {
      if (rangeFilter !== 'near') setMapView({ center: { lat: 13.0, lng: 101.5 }, zoom: 6 });
      return;
    }
    const c = PROVINCE_COORDS[locationFilter.province];
    if (c) setMapView({ center: { lat: c.lat, lng: c.lng }, zoom: c.zoom });
  }, [locationFilter.province]);

  // ─── Zoom when district changes ───────
  useEffect(() => {
    if (districtTimer.current) clearTimeout(districtTimer.current);

    if (!locationFilter.district) {
      if (locationFilter.province) {
        const c = PROVINCE_COORDS[locationFilter.province];
        if (c) setMapView({ center: { lat: c.lat, lng: c.lng }, zoom: c.zoom });
      }
      return;
    }

    districtTimer.current = setTimeout(async () => {
      const coords = await geocodeDistrict(locationFilter.district, locationFilter.province);
      if (coords) setMapView({ center: coords, zoom: 12 });
    }, 700);

    return () => { if (districtTimer.current) clearTimeout(districtTimer.current); };
  }, [locationFilter.district]);

  // ─── Firestore ──────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'reports'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((docSnap) => {
        const raw = docSnap.data() as any;
        const rawType = String(raw.type || '').toLowerCase();
        const normalizedType: 'lost' | 'found' = (rawType === 'found' || rawType === 'พบ') ? 'found' : 'lost';
        const rawStatus = String(raw.status || '').toLowerCase();
        let normalizedStatus: ReportStatus = 'active';
        if (rawStatus === 'resolved' || rawStatus === 'พบแล้ว') normalizedStatus = 'resolved';
        else if (rawStatus === 'closed' || rawStatus === 'ปิด') normalizedStatus = 'closed';
        let lat = parseFloat(raw.lat);
        let lng = parseFloat(raw.lng);
        if (isNaN(lat)) lat = 0;
        if (isNaN(lng)) lng = 0;
        const createdAt = raw.createdAt instanceof Timestamp
          ? raw.createdAt.toDate().toISOString()
          : raw.createdAt || new Date().toISOString();
        return { id: docSnap.id, ...raw, lat, lng, type: normalizedType, status: normalizedStatus, createdAt } as Report;
      })
      // ✅ ฟิลเตอร์พื้นฐาน: รับเฉพาะสัตว์เลี้ยงที่มีพิกัดและประเภทถูกต้อง
      .filter((r) => {
        if (!r.lat || !r.lng || r.lat === 0 || r.lng === 0) return false;
        if (r.type !== 'lost' && r.type !== 'found') return false;
        return true;
      });
      setReports(data);
      setLoading(false);
    }, (error) => {
      console.error('Firestore snapshot error:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ─── Filtered Reports (แยก 3 สถานะชัดเจน) ─────────────────
  const filteredReports = useMemo(() => {
    let data = reports;
    
    // ✅ ฟิลเตอร์ตามแท็บ 3 สถานะ
    if (tab === 'lost-active') {
      // 🐕 สัตว์หายที่ยังติดตามอยู่ (type: lost + status: active)
      data = data.filter((r) => r.type === 'lost' && r.status === 'active');
    } else if (tab === 'found') {
  data = data.filter((r) => r.type === 'found' && r.status === 'active');
    } else if (tab === 'resolved') {
      // ✅ ปิดเคสแล้ว (ทุกประเภทที่สถานะเป็น resolved/closed)
      data = data.filter((r) => r.status === 'resolved' || r.status === 'closed');
    }
    
    // ✅ ฟิลเตอร์ตามจังหวัด/อำเภอ
    if (locationFilter.province) {
      data = data.filter((r) => (r.province || '').toLowerCase().includes(locationFilter.province.toLowerCase()));
    }
    if (locationFilter.district) {
      data = data.filter((r) => (r.district || '').toLowerCase().includes(locationFilter.district.toLowerCase()));
    }
    
    // ✅ ฟิลเตอร์ตามระยะทาง
    if (rangeFilter === 'near' && myCoords) {
      data = data.filter((r) => r.lat && r.lng && haversineKm(myCoords.lat, myCoords.lng, r.lat, r.lng) <= NEAR_RADIUS_KM);
    }
    
    return data;
  }, [reports, tab, rangeFilter, myCoords, locationFilter]);

  // ─── Counts (นับแยกตามแท็บ) ──────────────────────────────
  const lostActiveCount = reports.filter((r) => r.type === 'lost' && r.status === 'active').length;
  const foundCount = reports.filter((r) => r.type === 'found' && r.status === 'active').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved' || r.status === 'closed').length;
  
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (locationFilter.province) count++;
    if (locationFilter.district) count++;
    if (rangeFilter === 'near') count++;
    return count;
  }, [locationFilter, rangeFilter]);

  // ─── Handlers ───────────────────────────────────────────
  const handleViewDetail = useCallback((id: string) => { window.location.href = `/detail/${id}`; }, []);
  const handleCall = useCallback((phone?: string) => {
    if (!phone) return;
    window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
  }, []);
  const handleShare = useCallback(async (report: Report) => {
    const url = `${window.location.origin}/detail/${report.id}`;
    try {
      if (navigator.share) await navigator.share({ title: report.title, text: report.description, url });
      else { await navigator.clipboard.writeText(url); alert('คัดลอกลิงก์แล้ว'); }
    } catch { /* silent */ }
  }, []);
  const handleMarkerClick = useCallback((report: Report) => { setSelectedReport(report); }, []);
  const handleClearFilters = useCallback(() => {
    setLocationFilter({ province: '', district: '' });
    setRangeFilter('all');
    setMapView({ center: { lat: 13.0, lng: 101.5 }, zoom: 6 });
  }, []);

  // ─── ESC ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedReport(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ✅ Helper: ได้สีหมุดตามสถานะ
  const getMarkerColor = (report: Report) => {
    const isResolved = report.status === 'resolved' || report.status === 'closed';
    if (isResolved) return '#94a3b8'; // เทา
    if (report.type === 'lost') return '#f97316'; // ส้ม
    return '#10b981'; // เขียว
  };

  return (
    <main className="relative h-[calc(100vh-56px)] overflow-hidden bg-slate-100">

      {/* ─── Map ─────────────────────────────────────── */}
      <div className="absolute inset-0">
        <MapComponent
          reports={filteredReports}
          height="h-full"
          center={mapView.center}
          zoom={mapView.zoom}
          selectedReport={selectedReport}
          userCoords={myCoords}
          onMarkerClick={handleMarkerClick}
          getMarkerColor={getMarkerColor}
        />
      </div>

      {/* ─── Top Control Card ─────────────────────────── */}
      <div className="absolute left-1/2 top-4 z-40 w-full max-w-md -translate-x-1/2 px-4">
        <div className="rounded-3xl border border-white/60 bg-white/95 shadow-2xl backdrop-blur-xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-500 text-white">
                <PawPrint size={16} />
              </div>
              <div>
                <h1 className="text-sm font-black text-slate-800 leading-tight">แผนที่สัตว์เลี้ยง</h1>
                <p className="text-[11px] text-slate-400">ติดตามสัตว์หายทั่วไทย</p>
              </div>
            </div>
            {loading
              ? <Loader2 size={16} className="animate-spin text-orange-400" />
              : <span className="text-[11px] font-semibold text-slate-400">{filteredReports.length} รายการ</span>
            }
          </div>

          <div className="h-px bg-slate-100 mx-4" />

          {/* ✅ Tabs 3 สถานะชัดเจน */}
          <div className="flex items-center gap-1.5 px-4 py-2">
            <button
              onClick={() => setTab('lost-active')}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-all flex items-center justify-center gap-1 ${
                tab === 'lost-active' 
                  ? 'bg-red-500 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              🐕 หาย ({lostActiveCount})
            </button>
            <button
              onClick={() => setTab('found')}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-all flex items-center justify-center gap-1 ${
                tab === 'found' 
                  ? 'bg-emerald-500 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              🐾 พบ ({foundCount})
            </button>
            <button
              onClick={() => setTab('resolved')}
              className={`flex-1 rounded-xl py-2 text-xs font-black transition-all flex items-center justify-center gap-1 ${
                tab === 'resolved' 
                  ? 'bg-slate-500 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              ✅ ปิดเคส ({resolvedCount})
            </button>
          </div>

          <div className="h-px bg-slate-100 mx-4" />

          {/* Near Me + Location Filter */}
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              onClick={() => setRangeFilter(rangeFilter === 'near' ? 'all' : 'near')}
              disabled={geoTracking}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black transition-all ${
                rangeFilter === 'near' 
                  ? 'bg-orange-500 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {geoTracking ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />}
              ใกล้ฉัน
            </button>
            
            <div className="flex-1 relative">
              <select
                value={locationFilter.province}
                onChange={(e) => setLocationFilter({ province: e.target.value, district: '' })}
                className={`w-full appearance-none rounded-xl border px-3 py-2 pr-8 text-xs font-medium outline-none transition-all ${
                  locationFilter.province
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                } focus:border-orange-500 focus:ring-2 focus:ring-orange-100`}
              >
                <option value="">ทุกจังหวัด</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* District Input */}
          <div className="px-4 pb-3">
            <div className="relative">
              <input
                type="text"
                value={locationFilter.district}
                onChange={(e) => setLocationFilter((prev) => ({ ...prev, district: e.target.value }))}
                placeholder="อำเภอ / เขต (เลือกจังหวัดก่อน)"
                disabled={!locationFilter.province}
                className={`w-full rounded-xl border px-3 py-2.5 text-xs font-medium outline-none transition-all ${
                  locationFilter.district
                    ? 'border-orange-400 bg-orange-50 text-orange-700 placeholder-orange-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 placeholder-slate-400'
                } focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {locationFilter.district && (
                <button
                  onClick={() => setLocationFilter((prev) => ({ ...prev, district: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Active filter tags */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
              {locationFilter.province && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  <MapPin size={10} />{locationFilter.province}
                  <button onClick={() => setLocationFilter({ province: '', district: '' })} className="hover:text-orange-900 transition"><X size={11} /></button>
                </span>
              )}
              {locationFilter.district && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {locationFilter.district}
                  <button onClick={() => setLocationFilter((p) => ({ ...p, district: '' }))} className="hover:text-orange-900 transition"><X size={11} /></button>
                </span>
              )}
              {rangeFilter === 'near' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  <LocateFixed size={10} />ใกล้ฉัน
                  <button onClick={() => setRangeFilter('all')} className="hover:text-orange-900 transition"><X size={11} /></button>
                </span>
              )}
              <button onClick={handleClearFilters} className="ml-auto text-[11px] font-medium text-slate-400 hover:text-orange-500 transition">
                ล้างทั้งหมด
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Bottom Sheet ─────────────────────────────── */}
      {selectedReport && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 sm:hidden" onClick={() => setSelectedReport(null)} />
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

      {/* ─── Empty State ─────────────────────────────── */}
      {!loading && filteredReports.length === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="text-center px-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg">
              <PawPrint size={28} className="text-slate-300" />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-700">ไม่พบข้อมูล</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-xs">
              {tab === 'lost-active' && 'ยังไม่มีรายงานสัตว์หายที่ยังติดตามอยู่ในพื้นที่นี้'}
              {tab === 'found' && 'ยังไม่มีผู้แจ้งพบสัตว์ในพื้นที่นี้'}
              {tab === 'resolved' && 'ยังไม่มีเคสที่ปิดแล้วในพื้นที่นี้'}
            </p>
            {activeFiltersCount > 0 && (
              <button onClick={handleClearFilters} className="mt-4 rounded-xl bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-500 hover:bg-orange-100 transition">
                ล้างตัวกรองเพื่อแสดงทั้งหมด
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Geo Error Toast ──────────────────────────── */}
      {geoError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-medium text-white shadow-xl">
            <AlertCircle size={15} />{geoError}
            <button onClick={() => setGeoError(null)} className="rounded p-0.5 hover:bg-white/20 transition"><X size={13} /></button>
          </div>
        </div>
      )}

      {/* ─── Floating Near Me (Mobile) ───────────────── */}
      {!selectedReport && (
        <button
          onClick={() => setRangeFilter('near')}
          className="fixed bottom-6 right-4 z-30 flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-orange-600 transition sm:hidden"
        >
          <Navigation size={15} />ใกล้ฉัน
        </button>
      )}
    </main>
  );
}