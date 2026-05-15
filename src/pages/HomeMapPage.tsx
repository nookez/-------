import { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, limit, db,
  doc, updateDoc, addDoc, serverTimestamp,
} from '../firebase';
import MapComponent from '../components/MapComponent';
import type { User } from 'firebase/auth';
import { sampleReports } from '../data';
import type { Report } from '../types';
import {
  Heart, MessageCircle, MapPin, Search, Plus, Flame,
  CheckCircle2, X, Loader2, ChevronDown, Send, PawPrint,
} from 'lucide-react';

const PLACEHOLDER = 'https://placehold.co/400x300/fff7ed/f97316?text=ไม่มีรูป';

// ─── Utils ─────────────────────────────────────────────────────────────────

function normalizeText(t: string) {
  return (t || '').trim().toLowerCase();
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface MatchResult {
  score: number;
  percent: number;
  reasons: string[];
  distance?: number;
}

function scoreReport(
  report: Report,
  tokens: string[],
  searchCoords: { lat: number; lng: number } | null
): MatchResult {
  if (tokens.length === 0) return { score: 0, percent: 0, reasons: [] };

  let score = 0;
  const reasons: string[] = [];
  const MAX = 100;

  const color = normalizeText(report.color || '');
  const breed = normalizeText(report.breed || '');
  const province = normalizeText(report.province || '');
  const district = normalizeText(report.district || '');
  const address = normalizeText(report.address || '');
  const title = normalizeText(report.title || '');
  const description = normalizeText(report.description || '');

  const PET_ALIASES: Record<string, string[]> = {
    dog: ['หมา', 'สุนัข', 'dog'],
    cat: ['แมว', 'cat'],
    rabbit: ['กระต่าย', 'rabbit'],
    bird: ['นก', 'bird'],
    hamster: ['แฮมสเตอร์', 'hamster'],
  };

  for (const token of tokens) {
    // ชนิดสัตว์
    for (const [, aliases] of Object.entries(PET_ALIASES)) {
      if (aliases.includes(token)) {
        if (aliases.some((a) => title.includes(a) || description.includes(a) || breed.includes(a))) {
          score += 30;
          reasons.push(`ชนิดสัตว์ตรง`);
        }
        break;
      }
    }
    // สี
    if (color && (color.includes(token) || token.includes(color))) {
      score += 20; reasons.push(`สีตรง (${report.color})`);
    }
    // สายพันธุ์
    if (breed && (breed.includes(token) || token.includes(breed))) {
      score += 20; reasons.push(`สายพันธุ์ตรง (${report.breed})`);
    }
    // พื้นที่
    const loc = token.replace(/ใกล้|แถว|ย่าน/g, '').trim();
    if (loc && (province.includes(loc) || district.includes(loc) || address.includes(loc))) {
      score += 15; reasons.push(`พื้นที่ตรง (${report.province})`);
    }
    if (title.includes(token)) score += 5;
    if (description.includes(token)) score += 3;
  }

  if (report.date) {
    const diffDays = (Date.now() - new Date(report.date).getTime()) / 86400000;
    if (diffDays <= 7) { score += 10; reasons.push('โพสต์ภายใน 7 วัน'); }
  }

  let distance: number | undefined;
  if (searchCoords && report.lat && report.lng) {
    distance = distanceKm(report.lat, report.lng, searchCoords.lat, searchCoords.lng);
    if (distance < 3) { score += 20; reasons.push(`ใกล้ตำแหน่งค้นหา (${distance.toFixed(1)} กม.)`); }
    else if (distance < 10) score += 8;
  }

  return { score, percent: Math.min(100, Math.round((score / MAX) * 100)), reasons: [...new Set(reasons)], distance };
}

async function geocodeAddress(text: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' ประเทศไทย')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'th' } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ─── Match Badge ───────────────────────────────────────────────────────────

function MatchBadge({ percent, reasons }: { percent: number; reasons: string[] }) {
  if (percent === 0) return null;
  const color = percent >= 70 ? 'bg-green-500' : percent >= 40 ? 'bg-orange-500' : 'bg-slate-400';
  return (
    <div className="group relative">
      <div className={`rounded-full px-2 py-0.5 text-[9px] font-black text-white ${color}`}>
        ตรงกัน {percent}%
      </div>
      {reasons.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 hidden w-44 rounded-xl bg-slate-900 p-2.5 text-[10px] text-white shadow-xl group-hover:block z-20">
          {reasons.map((r, i) => <p key={i}>✓ {r}</p>)}
        </div>
      )}
    </div>
  );
}

// ─── Comment Panel ─────────────────────────────────────────────────────────

function CommentPanel({ report, user, onClose }: { report: Report; user: User | null; onClose: () => void }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reports', report.id, 'comments'), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, (snap) => setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() as any }))));
  }, [report.id]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    await addDoc(collection(db, 'reports', report.id, 'comments'), {
      text: text.trim(), userId: user.uid,
      userName: user.displayName || user.email || 'ผู้ใช้',
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'reports', report.id), { commentsCount: (report.commentsCount || 0) + 1 });
    setText(''); setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="font-black text-slate-900">💬 ความคิดเห็น ({report.commentsCount || 0})</p>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {comments.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-8">ยังไม่มีความคิดเห็น เป็นคนแรกเลย!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-black text-orange-600">
                {(c.userName || 'ผ')[0]}
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2 flex-1">
                <p className="text-xs font-bold text-slate-800">{c.userName}</p>
                <p className="mt-0.5 text-sm text-slate-600">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 p-3 flex gap-2">
          {user ? (
            <>
              <input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="เขียนความคิดเห็น..."
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400" />
              <button onClick={send} disabled={sending || !text.trim()}
                className="flex items-center justify-center rounded-2xl bg-orange-500 px-3 py-2 text-white disabled:opacity-40 transition hover:bg-orange-600">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <p className="w-full text-center text-sm text-slate-400 py-2">
              <a href="/auth/login" className="text-orange-500 font-bold">เข้าสู่ระบบ</a> เพื่อแสดงความคิดเห็น
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pet Card ──────────────────────────────────────────────────────────────

function PetCard({
  report, liked, onLike, onComment, onConfirm, isOwner, confirming, match,
}: {
  report: Report;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onConfirm: () => void;
  isOwner: boolean;
  confirming: boolean;
  match?: MatchResult;
}) {
  const resolved = !!(report as any).resolved;

  return (
    <div className="group overflow-hidden rounded-2xl border border-white bg-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Image */}
      <div className="relative overflow-hidden">
        <img
          src={report.images?.[0] || PLACEHOLDER}
          alt=""
          className="h-36 w-full object-cover transition duration-500 group-hover:scale-105 sm:h-40"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
        />

        {/* Type badge */}
        <div className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black backdrop-blur-sm ${
          report.type === 'lost' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
        }`}>
          {report.type === 'lost' ? '🐾 สัตว์หาย' : '🐾 พบสัตว์'}
        </div>

        {resolved && (
          <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-black text-emerald-700 flex items-center gap-0.5 shadow">
            <CheckCircle2 className="h-2.5 w-2.5" /> เจอแล้ว
          </div>
        )}
        {report.urgent && !resolved && (
          <div className="absolute right-2 top-2 animate-pulse rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-black text-black">
            ด่วน!
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full px-2.5 pb-2">
          <p className="line-clamp-1 text-[11px] font-black leading-tight text-white">{report.title}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-1.5">
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <MapPin className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{report.district ? `${report.district}, ` : ''}{report.province}</span>
        </div>

        <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-600">{report.description || '-'}</p>

        <div className="flex flex-wrap gap-1 items-center">
          {report.breed && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-600">
              {report.breed}
            </span>
          )}
          {report.color && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
              {report.color}
            </span>
          )}
          {report.reward && (
            <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[9px] font-bold text-yellow-700">🏆 รางวัล</span>
          )}
          {match && match.percent > 0 && <MatchBadge percent={match.percent} reasons={match.reasons} />}
        </div>

        {match?.distance !== undefined && (
          <p className="text-[9px] text-slate-400">📍 ห่าง {match.distance.toFixed(1)} กม.</p>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
          <div className="flex items-center gap-0.5">
            <button onClick={onLike}
              className={`flex items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] transition ${
                liked ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'
              }`}>
              <Heart className="h-3 w-3" fill={liked ? 'currentColor' : 'none'} />
              <span>{(report.likesCount || 0) + (liked ? 1 : 0)}</span>
            </button>
            <button onClick={onComment}
              className="flex items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-100 transition">
              <MessageCircle className="h-3 w-3" />
              <span>{report.commentsCount || 0}</span>
            </button>
          </div>
          {isOwner && !resolved && (
            <button onClick={onConfirm} disabled={confirming}
              className="flex items-center gap-0.5 rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50">
              {confirming ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
              เจอแล้ว!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

interface FeedPageProps { user: User | null; }

export default function FeedPage({ user }: FeedPageProps) {
  const [reports, setReports] = useState<Report[]>(sampleReports.filter((r) => r.category === 'สัตว์เลี้ยง'));
  const [tab, setTab] = useState<'lost' | 'found'>('lost');
  const [search, setSearch] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [commentReport, setCommentReport] = useState<Report | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r: any) => r.category === 'สัตว์เลี้ยง');
      setReports(data.length ? data : sampleReports.filter((r) => r.category === 'สัตว์เลี้ยง'));
    });
  }, []);

  useEffect(() => {
    const match = search.match(/(?:ใกล้|แถว|ย่าน)\s*([^\s]+)/);
    if (!match) { setSearchCoords(null); return; }
    const timer = setTimeout(async () => {
      setGeoLoading(true);
      setSearchCoords(await geocodeAddress(match[1]));
      setGeoLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleLike = async (report: Report) => {
    const liked = likedIds.has(report.id);
    setLikedIds((prev) => { const next = new Set(prev); liked ? next.delete(report.id) : next.add(report.id); return next; });
    try { await updateDoc(doc(db, 'reports', report.id), { likesCount: Math.max(0, (report.likesCount || 0) + (liked ? -1 : 1)) }); } catch {}
  };

  const confirmFound = async (report: Report) => {
    if (!user || user.uid !== (report as any).userId) return;
    setConfirmingId(report.id);
    try { await updateDoc(doc(db, 'reports', report.id), { resolved: true, status: 'พบแล้ว', updatedAt: serverTimestamp() }); } catch {}
    setConfirmingId(null);
  };

  const filtered = useMemo(() => {
    let data = reports.filter((r) => r.type === tab);
    const tokens = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return data.map((r) => ({ ...r, _match: { score: 0, percent: 0, reasons: [], distance: undefined } }));
    return data
      .map((r) => ({ ...r, _match: scoreReport(r, tokens, searchCoords) }))
      .filter((r) => r._match.score > 0)
      .sort((a, b) => {
        if (searchCoords) {
          const da = a._match.distance ?? Infinity;
          const db_ = b._match.distance ?? Infinity;
          if (Math.abs(da - db_) > 1) return da - db_;
        }
        return b._match.score - a._match.score;
      });
  }, [reports, tab, search, searchCoords]);

  const lostCount = reports.filter((r) => r.type === 'lost').length;
  const foundCount = reports.filter((r) => r.type === 'found').length;

  return (
    <div className="min-h-screen bg-[#f6f7fb]">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-md shadow-orange-200">
              <PawPrint className="h-5 w-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-black text-orange-500 leading-none">ตามหาสัตว์</p>
              <p className="text-[10px] text-slate-400">ช่วยกันตามหาสัตว์เลี้ยงทั่วไทย</p>
            </div>
          </div>

          <div className="relative flex flex-1 max-w-md items-center rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder='เช่น "แมวส้ม ใกล้เชียงใหม่"'
              className="h-9 w-full bg-transparent px-2 text-xs outline-none placeholder:text-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {geoLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400 shrink-0" />}
            {search && (
              <button onClick={() => setSearch('')} className="shrink-0 text-slate-300 hover:text-slate-500">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <a href="/report/lost"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-600">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">แจ้งสัตว์หาย</span>
          </a>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 py-4 space-y-4">

        {/* ── Tab: สัตว์หาย / พบสัตว์ ── */}
        <div className="flex gap-3">
          <button
            onClick={() => setTab('lost')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition-all ${
              tab === 'lost'
                ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                : 'bg-white text-slate-600 shadow-sm hover:bg-red-50'
            }`}
          >
            🐾 สัตว์หาย
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tab === 'lost' ? 'bg-red-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {lostCount}
            </span>
          </button>
          <button
            onClick={() => setTab('found')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition-all ${
              tab === 'found'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-600 shadow-sm hover:bg-emerald-50'
            }`}
          >
            🏠 พบสัตว์
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${tab === 'found' ? 'bg-emerald-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
              {foundCount}
            </span>
          </button>
        </div>

        {/* ── Tab description ── */}
        <div className={`rounded-2xl px-4 py-3 text-sm ${
          tab === 'lost'
            ? 'bg-red-50 border border-red-100 text-red-700'
            : 'bg-emerald-50 border border-emerald-100 text-emerald-700'
        }`}>
          {tab === 'lost'
            ? '🐾 รายการสัตว์เลี้ยงที่หายไป หากพบเห็นกรุณาติดต่อเจ้าของ'
            : '🏠 รายการสัตว์ที่พบโดยไม่รู้เจ้าของ หากเป็นสัตว์ของคุณกรุณาติดต่อ'}
        </div>

        {/* ── Map (collapsible) ── */}
        <div className="overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
          <button onClick={() => setShowMap((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">🗺️ แผนที่</span>
              <div className="flex items-center gap-1 rounded-xl bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600">
                <Flame className="h-3 w-3" /> สด
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showMap ? 'rotate-180' : ''}`} />
          </button>
          {showMap && (
            <div className="h-[260px] overflow-hidden sm:h-[300px]">
              <MapComponent reports={filtered} height="h-full" zoom={6} onMarkerClick={() => {}} />
            </div>
          )}
        </div>

        {/* ── Search result banner ── */}
        {search.trim() && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-700 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>พบ <strong>{filtered.length}</strong> ผลลัพธ์สำหรับ "<strong>{search}</strong>"{searchCoords && ' · เรียงตามระยะทาง'}</span>
          </div>
        )}

        {/* ── Grid ── */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <p className="text-4xl">🐾</p>
            <p className="mt-3 font-bold text-slate-700">ไม่พบรายการที่ตรงกัน</p>
            <p className="mt-1 text-xs text-slate-400">ลองเปลี่ยนคำค้นหา</p>
            <button onClick={() => setSearch('')}
              className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 transition">
              ล้างการค้นหา
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((report) => (
              <PetCard
                key={report.id}
                report={report}
                liked={likedIds.has(report.id)}
                onLike={() => toggleLike(report)}
                onComment={() => setCommentReport(report)}
                onConfirm={() => confirmFound(report)}
                isOwner={user?.uid === (report as any).userId}
                confirming={confirmingId === report.id}
                match={(report as any)._match}
              />
            ))}
          </div>
        )}

        {/* ── Post button (mobile float) ── */}
        <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-2 sm:hidden">
          <a href="/report/found"
            className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white shadow-xl shadow-emerald-200">
            <Plus className="h-4 w-4" /> แจ้งพบสัตว์
          </a>
          <a href="/report/lost"
            className="flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white shadow-xl shadow-red-200">
            <Plus className="h-4 w-4" /> แจ้งสัตว์หาย
          </a>
        </div>

      </div>

      {commentReport && (
        <CommentPanel report={commentReport} user={user} onClose={() => setCommentReport(null)} />
      )}
    </div>
  );
}