import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, Heart, Loader2, MessageCircle, Share2,
  Search, AlertCircle, Plus, TrendingUp,
  Bookmark, ChevronDown, AlertTriangle
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
    if (diff < 3600) return `${Math.floor(diff / 60)}นาที`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}ชม`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}วัน`;
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

// ─── component ──────────────────────────────────────────────────────────────

export default function HomeFeedPage({ user }: HomeFeedPageProps) {
  const [reports, setReports] = useState<(Report & { likedBy?: string[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'ล่าสุด' | 'ด่วน' | 'ยอดนิยม'>('ล่าสุด');
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('ทั้งหมด');

  const PAGE_SIZE = 12;

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

  // ── load more (pagination) ───────────────────────────────────────────────
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

  // ── toggle like ──────────────────────────────────────────────────────────
  const handleLike = async (reportId: string) => {
    if (!user) return;
    if (likingIds.has(reportId)) return;

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    const uid = user.uid;
    const liked = (report.likedBy ?? []).includes(uid);

    setLikingIds((s) => new Set(s).add(reportId));
    setReports((prev) =>
      prev.map((r) =>
        r.id !== reportId
          ? r
          : {
              ...r,
              likesCount: (r.likesCount ?? 0) + (liked ? -1 : 1),
              likedBy: liked
                ? (r.likedBy ?? []).filter((id) => id !== uid)
                : [...(r.likedBy ?? []), uid],
            },
      ),
    );

    try {
      await updateDoc(doc(db, 'reports', reportId), {
        likesCount: increment(liked ? -1 : 1),
        likedBy: liked ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch (err) {
      console.warn('like error', err);
      setReports((prev) =>
        prev.map((r) =>
          r.id !== reportId
            ? r
            : {
                ...r,
                likesCount: (r.likesCount ?? 0) + (liked ? 1 : -1),
                likedBy: liked
                  ? [...(r.likedBy ?? []), uid]
                  : (r.likedBy ?? []).filter((id) => id !== uid),
              },
        ),
      );
    } finally {
      setLikingIds((s) => { const n = new Set(s); n.delete(reportId); return n; });
    }
  };

  // ── share ────────────────────────────────────────────────────────────────
  const handleShare = (reportId: string, title: string) => {
    const url = `${window.location.origin}/detail/${reportId}`;
    if (navigator.share) {
      navigator.share({ title, url });
    } else {
      navigator.clipboard.writeText(url);
      alert('คัดลอกลิงก์แล้ว');
    }
  };

  // ── categories for filter ────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(reports.map((r) => r.category)));
    return ['ทั้งหมด', ...cats.sort()];
  }, [reports]);

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
        const matchCat = categoryFilter === 'ทั้งหมด' || r.category === categoryFilter;
        return matchSearch && matchCat;
      })
      .sort((a, b) => {
        if (sort === 'ด่วน') return Number(b.urgent) - Number(a.urgent) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === 'ยอดนิยม') return (b.likesCount ?? 0) - (a.likesCount ?? 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [reports, search, sort, categoryFilter]);

  // ─── render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">🏘️ ฟีดชุมชน</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
              ของหาย · ของที่พบ
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {loading ? 'กำลังโหลด...' : `${filtered.length} รายการ`}
            </p>
          </div>

          {/* CTA */}
          {!user ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/auth/register"
                className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm"
              >
                สมัครสมาชิก
              </Link>
              <Link
                to="/auth/login"
                className="rounded-2xl border border-orange-300 bg-white px-5 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50 transition"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/report/lost"
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                แจ้งของหาย
              </Link>
              <Link
                to="/report/found"
                className="inline-flex items-center gap-2 rounded-2xl border border-orange-300 bg-white px-5 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50 transition"
              >
                <Plus className="h-4 w-4" />
                แจ้งพบของ
              </Link>
            </div>
          )}
        </div>

        {/* Search + Sort */}
        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา: สัตว์, เอกสาร, จังหวัด..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-slate-900 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none transition"
            />
          </div>

          {/* Sort buttons */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['ล่าสุด', 'ด่วน', 'ยอดนิยม'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  sort === s
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
              >
                {s === 'ด่วน' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                {s === 'ยอดนิยม' && <TrendingUp className="h-3.5 w-3.5 text-orange-500" />}
                {s}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/60 text-slate-600 hover:bg-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feed content ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white p-16 shadow-sm border border-slate-100">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
          <span className="text-slate-500">กำลังโหลด...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-16 text-center shadow-sm border border-slate-100">
          <p className="text-slate-500 mb-4">ไม่พบรายการที่ตรงกัน</p>
          <button
            onClick={() => { setSearch(''); setCategoryFilter('ทั้งหมด'); }}
            className="text-sm font-semibold text-orange-600 hover:text-orange-700 underline"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cards grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((report) => {
              const isLiked = user ? (report.likedBy ?? []).includes(user.uid) : false;
              const isLiking = likingIds.has(report.id);
              const hasImage = report.images && report.images.length > 0;

              return (
                <article
                  key={report.id}
                  className="group rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition hover:-translate-y-0.5"
                >
                  {/* Image + badges */}
                  <div className="relative h-48 bg-slate-100 overflow-hidden">
                    {hasImage && (
                      <img
                        src={report.images![0]}
                        alt=""
                        className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    )}

                    {/* Badges overlay */}
                    <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                      <div className="flex gap-1.5">
                        {report.urgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500 text-white px-2.5 py-1 text-[11px] font-bold">
                            <AlertTriangle className="h-3 w-3" />
                            ด่วน
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${
                            report.type === 'lost'
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                        >
                          {report.type === 'lost' ? '🔍 หาย' : '✓ พบ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Title */}
                    <h3 className="font-bold text-slate-900 line-clamp-2 leading-snug text-sm">
                      {report.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
                      {report.description}
                    </p>

                    {/* Location + Time */}
                    <div className="mt-3 space-y-1.5">
                      {report.province && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                          <span className="truncate">{report.province}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="truncate">{timeAgo(report.createdAt)}</span>
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleLike(report.id)}
                          disabled={!user || isLiking}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
                            isLiked
                              ? 'text-red-600 bg-red-50'
                              : 'text-slate-500 hover:text-red-500 hover:bg-red-50'
                          } disabled:opacity-50`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-red-600' : ''}`} />
                          <span>{report.likesCount ?? 0}</span>
                        </button>

                        <Link
                          to={`/detail/${report.id}`}
                          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          {report.commentsCount ?? 0}
                        </Link>
                      </div>

                      <Link
                        to={`/detail/${report.id}`}
                        className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-200 transition"
                      >
                        ดูเพิ่มเติม
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
              >
                {loadingMore ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> โหลด...</>
                ) : (
                  <><ChevronDown className="h-4 w-4" /> โหลดเพิ่มเติม</>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}