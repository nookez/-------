import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Loader2,
  Search, Plus, TrendingUp,
  ChevronDown, AlertTriangle, PawPrint, Eye, X, SlidersHorizontal,
} from 'lucide-react';
import {
  collection, query, orderBy, db, Timestamp, onSnapshot,
  limit, getDocs, startAfter, doc, updateDoc, increment,
  arrayUnion, arrayRemove,
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
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return new Date(dateString).toLocaleDateString('th-TH', {
      month: 'short', day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function mapDoc(d: any): Report & { likedBy?: string[] } {
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
    likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
  };
}

// ─── Animal species badge colors ───────────────────────────────────────────
const speciesColor: Record<string, string> = {
  'สุนัข': 'bg-amber-100 text-amber-700',
  'แมว': 'bg-purple-100 text-purple-700',
  'นก': 'bg-sky-100 text-sky-700',
  'กระต่าย': 'bg-pink-100 text-pink-700',
  'อื่นๆ': 'bg-slate-100 text-slate-600',
};

// ─── component ──────────────────────────────────────────────────────────────

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;

  // ── realtime first page ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(mapDoc);
        setReports(data.length > 0 ? data : (sampleReports as any));
        setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(snap.docs.length >= PAGE_SIZE);
        setLoading(false);
      },
      (err) => {
        console.warn('feed error', err);
        setReports(sampleReports as any);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  // ── load more ────────────────────────────────────────────────────────────
  const loadMore = async () => {
    if (!lastVisible || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const more = snap.docs.map(mapDoc);
      if (more.length > 0) {
        setReports((prev) => {
          const ids = new Set(prev.map((r) => r.id));
          return [...prev, ...more.filter((r) => !ids.has(r.id))];
        });
        setLastVisible(snap.docs[snap.docs.length - 1] ?? null);
        setHasMore(more.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('loadMore error', err);
    }
    setLoadingMore(false);
  };

  // ── species list ─────────────────────────────────────────────────────────
  const speciesList = useMemo(() => {
    const s = Array.from(new Set(reports.map((r) => r.category)));
    return ['ทั้งหมด', ...s.sort()];
  }, [reports]);

  // ── counts ───────────────────────────────────────────────────────────────
  const lostCount = useMemo(() => reports.filter(r => r.type === 'lost').length, [reports]);
  const foundCount = useMemo(() => reports.filter(r => r.type === 'found').length, [reports]);

  // ── active filter count (for badge) ─────────────────────────────────────
  const activeFilterCount = [
    typeFilter !== 'ทั้งหมด',
    speciesFilter !== 'ทั้งหมด',
    sort !== 'ล่าสุด',
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearch('');
    setSpeciesFilter('ทั้งหมด');
    setTypeFilter('ทั้งหมด');
    setSort('ล่าสุด');
  };

  // ── filtered + sorted list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...reports]
      .filter((r) => {
        const matchSearch =
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r as any).province?.toLowerCase().includes(q);
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

  // ─── Card component ──────────────────────────────────────────────────────
  const AnimalCard = ({ report }: { report: Report & { likedBy?: string[] } }) => {
    const hasImage = report.images && report.images.length > 0;
    const speciesBadge = speciesColor[report.category] ?? speciesColor['อื่นๆ'];

    return (
      <article className="group relative rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col">
        {/* Image */}
        <div className="relative h-36 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden flex-shrink-0">
          {hasImage ? (
            <img
              src={report.images![0]}
              alt=""
              className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <PawPrint className="h-10 w-10 text-slate-200" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            {report.urgent && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold shadow">
                <AlertTriangle className="h-2.5 w-2.5" />
                ด่วน
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          {/* Species badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${speciesBadge}`}>
              {report.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-800 text-xs leading-snug line-clamp-2">
            {report.title}
          </h3>

          {/* Location */}
          {(report as any).province && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin className="h-3 w-3 shrink-0 text-slate-300" />
              <span className="truncate">{(report as any).province}</span>
            </div>
          )}

          {/* Footer — time only */}
          <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-end">
            <span className="text-[10px] text-slate-300">{timeAgo(report.createdAt)}</span>
          </div>
        </div>

        {/* Full card link overlay */}
        <Link to={`/detail/${report.id}`} className="absolute inset-0" aria-label={report.title} />
      </article>
    );
  };

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10 px-3 sm:px-0">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-orange-100 p-4 sm:p-6">
        <div className="flex flex-col gap-4">

          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <PawPrint className="h-5 w-5 text-orange-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-orange-500">สัตว์หายและสัตว์พบ</p>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                ช่วยกันตามหาน้องกลับบ้าน 🐾
              </h1>
            </div>
          </div>

          {/* Stat chips */}
          {!loading && (
            <div className="flex gap-2 flex-wrap text-xs">
              <span className="rounded-full bg-orange-100 text-orange-700 px-3 py-1 font-semibold">
                🔍 หาย {lostCount} ตัว
              </span>
              <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 font-semibold">
                ✅ พบ {foundCount} ตัว
              </span>
            </div>
          )}

          {/* CTA buttons */}
          {user ? (
            <div className="flex gap-2 flex-wrap">
              <Link
                to="/report/lost"
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                สัตว์ของฉันหาย
              </Link>
              <Link
                to="/report/found"
                className="inline-flex items-center gap-1.5 rounded-xl border border-green-300 bg-white px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 transition"
              >
                <Eye className="h-4 w-4" />
                พบเจอสัตว์
              </Link>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Link
                to="/auth/register"
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm"
              >
                สมัครสมาชิก
              </Link>
              <Link
                to="/auth/login"
                className="rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 transition"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          )}

          {/* ── Search bar (modern) ───────────────────────────────────── */}
          <div className="flex gap-2">
            {/* Main search input */}
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-orange-500" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาสายพันธุ์ สี จังหวัด..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition"
              />
              {/* Clear button */}
              {search && (
                <button
                  onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition"
                  aria-label="ล้างการค้นหา"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter button with badge */}
            <div className="relative">
              <button
                className={`h-11 w-11 flex items-center justify-center rounded-xl border transition ${
                  activeFilterCount > 0
                    ? 'border-orange-300 bg-orange-50 text-orange-600 hover:bg-orange-100'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
                aria-label="ตัวกรอง"
                title="ตัวกรองและการเรียง"
                // Scroll down to show filters (no modal needed — filters are right below)
                onClick={() => document.getElementById('feed-filters')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </div>
          </div>

          {/* Search hint when typing */}
          {search && (
            <p className="text-xs text-slate-400 -mt-1">
              พบ <span className="font-semibold text-slate-600">{filtered.length}</span> รายการสำหรับ "{search}"
            </p>
          )}

          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div id="feed-filters" className="space-y-3">

            {/* Sort + Type tabs */}
            <div className="flex flex-wrap gap-2 items-center">
              {/* Type toggle */}
              <div className="flex rounded-lg bg-white/70 border border-slate-200 p-0.5 text-xs font-semibold">
                {(['ทั้งหมด', 'lost', 'found'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded-md transition ${
                      typeFilter === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {t === 'ทั้งหมด' ? 'ทั้งหมด' : t === 'lost' ? '🔍 หาย' : '✅ พบ'}
                  </button>
                ))}
              </div>

              {/* Sort pills */}
              <div className="flex gap-1">
                {(['ล่าสุด', 'ด่วน', 'ยอดนิยม'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      sort === s
                        ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
                        : 'bg-white/50 text-slate-500 hover:bg-white'
                    }`}
                  >
                    {s === 'ด่วน' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    {s === 'ยอดนิยม' && <TrendingUp className="h-3 w-3 text-orange-500" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Species chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {speciesList.map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpeciesFilter(sp)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                    speciesFilter === sp
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/60 text-slate-600 hover:bg-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>

            {/* Active filters summary + clear all */}
            {(activeFilterCount > 0 || search) && (
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {typeFilter !== 'ทั้งหมด' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-orange-200 px-2 py-0.5 text-[11px] text-orange-700 font-medium">
                      {typeFilter === 'lost' ? '🔍 หาย' : '✅ พบ'}
                      <button onClick={() => setTypeFilter('ทั้งหมด')} className="hover:text-orange-900"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  {speciesFilter !== 'ทั้งหมด' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-orange-200 px-2 py-0.5 text-[11px] text-orange-700 font-medium">
                      {speciesFilter}
                      <button onClick={() => setSpeciesFilter('ทั้งหมด')} className="hover:text-orange-900"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  {sort !== 'ล่าสุด' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-orange-200 px-2 py-0.5 text-[11px] text-orange-700 font-medium">
                      {sort}
                      <button onClick={() => setSort('ล่าสุด')} className="hover:text-orange-900"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                </div>
                <button
                  onClick={clearAll}
                  className="text-[11px] text-slate-400 hover:text-slate-600 font-medium underline shrink-0"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-16 shadow-sm border border-slate-100">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          <span className="text-slate-500 text-sm">กำลังโหลด...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-slate-100">
          <PawPrint className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-3">ไม่พบรายการที่ตรงกัน</p>
          <button
            onClick={clearAll}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : typeFilter === 'ทั้งหมด' ? (
        /* ── Two-section layout ── */
        <div className="space-y-5">
          {lostFiltered.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100">
                    <Search className="h-3.5 w-3.5 text-orange-600" />
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">🔍 สัตว์หาย</h2>
                  <span className="text-xs text-slate-400 font-medium">{lostFiltered.length} ตัว</span>
                </div>
                <button
                  onClick={() => setTypeFilter('lost')}
                  className="text-xs text-orange-500 font-semibold hover:underline"
                >
                  ดูทั้งหมด
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {lostFiltered.slice(0, 10).map((r) => <AnimalCard key={r.id} report={r} />)}
              </div>
            </section>
          )}

          {foundFiltered.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                    <Eye className="h-3.5 w-3.5 text-green-600" />
                  </span>
                  <h2 className="text-sm font-bold text-slate-800">✅ พบสัตว์</h2>
                  <span className="text-xs text-slate-400 font-medium">{foundFiltered.length} ตัว</span>
                </div>
                <button
                  onClick={() => setTypeFilter('found')}
                  className="text-xs text-green-600 font-semibold hover:underline"
                >
                  ดูทั้งหมด
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {foundFiltered.slice(0, 10).map((r) => <AnimalCard key={r.id} report={r} />)}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* ── Filtered single-type view ── */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {typeFilter === 'lost'
                ? <><Search className="h-4 w-4 text-orange-500" /><span className="text-sm font-bold text-slate-800">สัตว์หาย</span></>
                : <><Eye className="h-4 w-4 text-green-500" /><span className="text-sm font-bold text-slate-800">พบเจอสัตว์</span></>
              }
              <span className="text-xs text-slate-400">{filtered.length} รายการ</span>
            </div>
            <button
              onClick={() => setTypeFilter('ทั้งหมด')}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium underline"
            >
              ← ดูทั้งหมด
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {filtered.map((r) => <AnimalCard key={r.id} report={r} />)}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-3">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
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

    </div>
  );
}