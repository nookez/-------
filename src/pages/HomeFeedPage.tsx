import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Loader2, Search, Plus, TrendingUp,
  ChevronDown, AlertTriangle, PawPrint, Eye, X,
  SlidersHorizontal, ArrowUpRight, Filter, Info
} from 'lucide-react';
import {
  collection, query, orderBy, db, Timestamp, onSnapshot,
  limit, getDocs, startAfter,
} from '../firebase';
import type { User } from 'firebase/auth';
import { sampleReports } from '../data';
import type { Report } from '../types';

interface HomeFeedPageProps {
  user: User | null;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateString: string): string {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return new Date(dateString).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

function mapDoc(d: any): Report & { likedBy?: string[] } {
  const data = d.data() as any;
  return {
    id: d.id, ...data,
    createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data?.createdAt || new Date().toISOString(),
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
  };
}

// ─── Color constants (Minimal Orange/White palette) ─────────────────────────
const ORANGE = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
};

const SLATE = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
};

// ─── Sub-Components ─────────────────────────────────────────────────────────

// 🎴 Minimalist Card Component
const AnimalCard = ({ report }: { report: Report & { likedBy?: string[] } }) => {
  const hasImage = report.images?.[0];
  const isLost = report.type === 'lost';
  
  return (
    <Link 
      to={`/detail/${report.id}`}
      className="group relative flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
    >
      {/* Image Section */}
      <div className="relative h-40 bg-slate-50 overflow-hidden">
        {hasImage ? (
          <img
            src={report.images![0]}
            alt={report.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <PawPrint className="h-10 w-10 text-slate-300" />
          </div>
        )}

        {/* Status Badge - Top Left */}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm ${
            isLost 
              ? 'bg-white text-slate-700 border border-slate-200' 
              : 'bg-white text-slate-700 border border-slate-200'
          }`}>
            <span className={`h-2 w-2 rounded-full ${isLost ? 'bg-orange-500' : 'bg-slate-400'}`} />
            {isLost ? 'สัตว์หาย' : 'พบสัตว์'}
          </span>
        </div>

        {/* Urgent Badge */}
        {report.urgent && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 text-white px-2.5 py-1 text-[10px] font-semibold shadow-sm" title="รายงานด่วน ต้องการความช่วยเหลือเร่งด่วน">
              <AlertTriangle className="h-2.5 w-2.5" />
              ด่วน
            </span>
          </div>
        )}

        {/* Species Badge - Bottom Left */}
        {report.category && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center rounded-full bg-white/95 text-slate-600 border border-slate-200 px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm">
              {report.category}
            </span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-4 gap-3">
        {/* Title */}
        <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-orange-600 transition-colors">
          {report.title}
        </h3>

        {/* Location */}
        {(report as any).province && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {[(report as any).district, (report as any).province].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="my-auto border-t border-slate-100" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400" title="เวลาที่รายงานถูกสร้างขึ้น">
            {timeAgo(report.createdAt)}
          </span>
          
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1" title="จำนวนครั้งที่เปิดดู">
              <Eye className="h-3 w-3" />
              {report.viewsCount || 0}
            </span>
            <span className="flex items-center gap-1" title="จำนวนการกดถูกใจ">
              <TrendingUp className="h-3 w-3" />
              {report.likesCount || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Hover Indicator */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
        <div className="rounded-full bg-white p-1.5 shadow-md border border-slate-100">
          <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 -rotate-45" />
        </div>
      </div>
    </Link>
  );
};

// 🔍 Minimalist Search Bar
const SearchBar = ({ 
  value, 
  onChange, 
  onClear,
  placeholder 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onClear: () => void;
  placeholder?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className={`h-4.5 w-4.5 transition-colors ${value ? 'text-orange-500' : 'text-slate-400'}`} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "ค้นหา สายพันธุ์ สี จังหวัด..."}
        className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          aria-label="ล้างการค้นหา"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// 🎛️ Filter Chip - Minimalist
const FilterChip = ({ 
  active, 
  onClick, 
  children,
  title 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`shrink-0 inline-flex items-center rounded-full px-4 py-2 text-xs font-medium transition-all duration-200 ${
      active
        ? 'bg-orange-500 text-white shadow-sm'
        : 'bg-white text-slate-600 border border-slate-200 hover:border-orange-300 hover:text-orange-600'
    }`}
  >
    {children}
  </button>
);

// ─── Section Header Component ──────────────────────────────────────────────
const SectionHeader = ({ 
  title, 
  subtitle, 
  count, 
  isLost,
  onViewAll 
}: { 
  title: string; 
  subtitle?: string;
  count: number;
  isLost: boolean;
  onViewAll?: () => void;
}) => (
  <div className="mb-5 pb-4 border-b border-slate-100">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {/* Section Icon */}
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          isLost ? 'bg-orange-50' : 'bg-slate-50'
        }`}>
          {isLost ? (
            <Search className="h-4.5 w-4.5 text-orange-500" />
          ) : (
            <Eye className="h-4.5 w-4.5 text-slate-400" />
          )}
        </div>
        
        {/* Text */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {subtitle && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400" title={subtitle}>
                <Info className="h-3 w-3" />
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {count} รายการ {isLost ? 'ที่ต้องการความช่วยเหลือ' : 'ที่รอเจ้าของมารับ'}
          </p>
        </div>
      </div>
      
      {onViewAll && count > 5 && (
        <button 
          onClick={onViewAll} 
          className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
        >
          ดูทั้งหมด
        </button>
      )}
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────

export default function HomeFeedPage({ user }: HomeFeedPageProps) {
  const [reports, setReports] = useState<(Report & { likedBy?: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'ล่าสุด' | 'ด่วน' | 'ยอดนิยม'>('ล่าสุด');
  const [typeFilter, setTypeFilter] = useState<'ทั้งหมด' | 'lost' | 'found'>('ทั้งหมด');
  const [speciesFilter, setSpeciesFilter] = useState('ทั้งหมด');
  const [showFilters, setShowFilters] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 20;

  // ── realtime first page ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(mapDoc);
      setReports(data.length > 0 ? data : (sampleReports as any));
      setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length >= PAGE_SIZE);
      setLoading(false);
    }, (err) => {
      console.warn('feed error', err);
      setReports(sampleReports as any);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── load more ────────────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const more = snap.docs.map(mapDoc);
      if (more.length > 0) {
        setReports((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          return [...prev, ...more.filter((r) => !ids.has(r.id))];
        });
        setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(more.length >= PAGE_SIZE);
      } else setHasMore(false);
    } catch (err) { console.warn('loadMore error', err); }
    setLoadingMore(false);
  };

  // ── species list ─────────────────────────────────────────────────────────
  const speciesList = useMemo(() => {
    const s = Array.from(new Set(reports.map((r) => r.category)));
    return ['ทั้งหมด', ...s.filter(Boolean).sort()];
  }, [reports]);

  // ── counts ───────────────────────────────────────────────────────────────
  const lostCount = useMemo(() => reports.filter(r => r.type === 'lost').length, [reports]);
  const foundCount = useMemo(() => reports.filter(r => r.type === 'found').length, [reports]);

  // ── active filter count ──────────────────────────────────────────────────
  const activeFilterCount = [typeFilter !== 'ทั้งหมด', speciesFilter !== 'ทั้งหมด', sort !== 'ล่าสุด'].filter(Boolean).length;
  const clearAll = useCallback(() => { setSearch(''); setSpeciesFilter('ทั้งหมด'); setTypeFilter('ทั้งหมด'); setSort('ล่าสุด'); }, []);

  // ── filtered + sorted list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...reports]
      .filter((r) => {
        const matchSearch = !q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || (r as any).province?.toLowerCase().includes(q);
        const matchType = typeFilter === 'ทั้งหมด' || r.type === typeFilter;
        const matchSpecies = speciesFilter === 'ทั้งหมด' || r.category === speciesFilter;
        return matchSearch && matchType && matchSpecies;
      })
      .sort((a, b) => {
        if (sort === 'ด่วน') return Number(b.urgent) - Number(a.urgent) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === 'ยอดนิยม') return (b.likesCount ?? 0) - (a.likesCount ?? 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [reports, search, sort, typeFilter, speciesFilter]);

  const lostFiltered = filtered.filter(r => r.type === 'lost');
  const foundFiltered = filtered.filter(r => r.type === 'found');

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      
      {/* ── Header Section ───────────────────────────────────────────────── */}
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
                <PawPrint className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pet Rescue</p>
                <h1 className="text-lg font-semibold text-slate-800">ช่วยกันตามหาน้องกลับบ้าน</h1>
              </div>
            </div>
            
            {/* Quick Stats */}
            {!loading && (
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-700">{lostCount}</span> รายการสัตว์หาย
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">
                  <span className="font-semibold text-slate-700">{foundCount}</span> รายการพบสัตว์
                </span>
              </div>
            )}
          </div>

          {/* Search & Actions Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1">
              <SearchBar value={search} onChange={setSearch} onClear={() => setSearch('')} />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeFilterCount > 0 
                    ? 'bg-orange-50 text-orange-600 border border-orange-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <Filter className="h-4 w-4" />
                ตัวกรอง
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              
              {/* Report Button */}
              {user ? (
                <Link 
                  to="/report/lost" 
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  แจ้งเหตุ
                </Link>
              ) : (
                <Link 
                  to="/auth/login" 
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </div>

          {/* Expandable Filters Panel */}
          {showFilters && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              
              {/* Type Filter */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">ประเภทรายงาน</p>
                <div className="flex gap-2">
                  {(['ทั้งหมด', 'lost', 'found'] as const).map((t) => (
                    <FilterChip 
                      key={t} 
                      active={typeFilter === t} 
                      onClick={() => setTypeFilter(t)}
                      title={t === 'ทั้งหมด' ? 'แสดงทุกประเภท' : t === 'lost' ? 'เฉพาะสัตว์ที่หาย' : 'เฉพาะสัตว์ที่พบ'}
                    >
                      {t === 'ทั้งหมด' ? 'ทั้งหมด' : t === 'lost' ? 'สัตว์หาย' : 'พบสัตว์'}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">เรียงลำดับตาม</p>
                <div className="flex gap-2">
                  {(['ล่าสุด', 'ด่วน', 'ยอดนิยม'] as const).map((s) => (
                    <FilterChip 
                      key={s} 
                      active={sort === s} 
                      onClick={() => setSort(s)}
                      title={s === 'ล่าสุด' ? 'รายงานใหม่สุดก่อน' : s === 'ด่วน' ? 'รายงานที่ต้องการความช่วยเหลือเร่งด่วน' : 'รายงานที่ได้รับการตอบรับมากที่สุด'}
                    >
                      {s}
                    </FilterChip>
                  ))}
                </div>
              </div>

              {/* Species Filter */}
              {speciesList.length > 1 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">สายพันธุ์</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {speciesList.map((sp) => (
                      <FilterChip 
                        key={sp} 
                        active={speciesFilter === sp} 
                        onClick={() => setSpeciesFilter(sp)}
                      >
                        {sp}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <button 
                    onClick={clearAll} 
                    className="text-xs font-medium text-slate-400 hover:text-orange-600 transition-colors"
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Search Results Info */}
          {search && !loading && (
            <p className="mt-3 text-sm text-slate-500">
              พบ <span className="font-semibold text-slate-700">{filtered.length}</span> รายการสำหรับ "{search}"
            </p>
          )}
        </div>
      </header>

      {/* ── Content Section ──────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        
        {loading ? (
          // Loading State
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-12">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-orange-50 animate-pulse" />
              <PawPrint className="absolute inset-0 m-auto h-6 w-6 text-orange-200" />
            </div>
            <div className="space-y-2 text-center">
              <div className="h-3 w-28 rounded-full bg-slate-100 animate-pulse" />
              <div className="h-2 w-20 rounded-full bg-slate-50 animate-pulse" />
            </div>
          </div>

        ) : filtered.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50">
              <PawPrint className="h-7 w-7 text-slate-300" />
            </div>
            <h3 className="text-base font-medium text-slate-700">ไม่พบรายการ</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-xs">
              {search 
                ? `ไม่พบผลลัพธ์ที่ตรงกับ "${search}"` 
                : 'ยังไม่มีรายงานในขณะนี้'
              }
            </p>
            {(activeFilterCount > 0 || search) && (
              <button 
                onClick={clearAll} 
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-100 transition-colors"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>

        ) : typeFilter === 'ทั้งหมด' ? (
          /* ── Two-section layout ── */
          <div className="space-y-10">
            
            {/* Lost Section */}
            {lostFiltered.length > 0 && (
              <section>
                <SectionHeader 
                  title="สัตว์หาย" 
                  subtitle="รายงานสัตว์เลี้ยงที่เจ้าของกำลังตามหา"
                  count={lostFiltered.length}
                  isLost={true}
                  onViewAll={() => setTypeFilter('lost')}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {lostFiltered.slice(0, 10).map((r) => <AnimalCard key={r.id} report={r} />)}
                </div>
              </section>
            )}

            {/* Found Section */}
            {foundFiltered.length > 0 && (
              <section>
                <SectionHeader 
                  title="พบสัตว์" 
                  subtitle="รายงานสัตว์เลี้ยงที่พบและรอเจ้าของมารับ"
                  count={foundFiltered.length}
                  isLost={false}
                  onViewAll={() => setTypeFilter('found')}
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {foundFiltered.slice(0, 10).map((r) => <AnimalCard key={r.id} report={r} />)}
                </div>
              </section>
            )}
          </div>

        ) : (
          /* ── Filtered single-type view ── */
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  typeFilter === 'lost' ? 'bg-orange-50' : 'bg-slate-50'
                }`}>
                  {typeFilter === 'lost' ? (
                    <Search className="h-4.5 w-4.5 text-orange-500" />
                  ) : (
                    <Eye className="h-4.5 w-4.5 text-slate-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-800">
                    {typeFilter === 'lost' ? 'สัตว์หาย' : 'พบสัตว์'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {filtered.length} รายการ
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setTypeFilter('ทั้งหมด')} 
                className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                ← กลับ
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filtered.map((r) => <AnimalCard key={r.id} report={r} />)}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-orange-300 hover:text-orange-600 disabled:opacity-50 transition-colors"
                >
                  {loadingMore
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...</>
                    : <><ChevronDown className="h-4 w-4" /> โหลดเพิ่มเติม</>
                  }
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Floating Action Button (Mobile) ─────────────────────────────── */}
      {user && (
        <div className="fixed bottom-6 right-6 z-40 sm:hidden">
          <Link
            to="/report/lost"
            className="flex h-13 w-13 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 active:scale-95 transition-all"
            aria-label="แจ้งสัตว์เลี้ยงหาย"
          >
            <Plus className="h-5.5 w-5.5" />
          </Link>
        </div>
      )}

      {/* ── Scroll to Top Button ───────────────────────────────────────── */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 left-6 z-40 hidden h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 shadow-sm hover:border-orange-300 hover:text-orange-500 transition sm:flex"
        aria-label="กลับด้านบน"
      >
        <ChevronDown className="h-4.5 w-4.5 rotate-180" />
      </button>
    </div>
  );
}