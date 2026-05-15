import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  db,
} from '../firebase';

import MapComponent from '../components/MapComponent';
import type { User } from 'firebase/auth';
import { sampleReports } from '../data';
import type { Report } from '../types';

import {
  Heart,
  MessageCircle,
  Share2,
  MapPin,
  Search,
  Bell,
  Plus,
  Flame,
  Grid2X2,
} from 'lucide-react';

interface HomeMapPageProps {
  user: User | null;
}

export default function HomeMapPage({ user }: HomeMapPageProps) {
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [filter, setFilter] = useState('ทั้งหมด');
  const [search, setSearch] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));

      if (data.length) {
        setReports(data);
      } else {
        setReports(sampleReports);
      }
    });

    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    let data = reports;

    if (filter !== 'ทั้งหมด') {
      const typeMap: Record<string, string> = {
        ของหาย: 'lost',
        ของพบ: 'found',
      };

      data = data.filter(
        (r) =>
          r.type === typeMap[filter] ||
          r.category === filter
      );
    }

    if (search.trim()) {
      data = data.filter((r) =>
        `${r.title} ${r.description} ${r.province} ${r.district}`
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }

    return data;
  }, [reports, filter, search]);

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const updated = new Set(prev);

      if (updated.has(id)) {
        updated.delete(id);
      } else {
        updated.add(id);
      }

      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-gray-900">
      {/* BACKGROUND */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-100px] top-[-100px] h-[300px] w-[300px] rounded-full bg-orange-200 blur-3xl opacity-30" />
        <div className="absolute bottom-[-100px] right-[-100px] h-[300px] w-[300px] rounded-full bg-orange-300 blur-3xl opacity-20" />
      </div>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 border-b border-white/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1500px] items-center justify-between px-4">
          {/* LEFT */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-lg font-black text-white shadow-xl shadow-orange-200">
              ช
            </div>

            <div>
              <h1 className="text-xl font-black tracking-tight text-orange-500">
                ช่วยกันหา
              </h1>

              <p className="text-xs text-gray-500">
                ตามหาของหายทั่วประเทศไทย
              </p>
            </div>
          </div>

          {/* SEARCH */}
          <div className="hidden w-full max-w-[520px] items-center rounded-2xl border border-gray-200 bg-white px-4 shadow-sm md:flex">
            <Search size={18} className="text-gray-400" />

            <input
              type="text"
              placeholder="ค้นหาของหาย สัตว์เลี้ยง เอกสาร..."
              className="h-12 w-full bg-transparent px-3 text-sm outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            <button className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm transition hover:scale-105">
              <Bell size={18} />

              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <button className="hidden items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white shadow-xl shadow-orange-200 transition hover:scale-[1.02] hover:bg-orange-600 md:flex">
              <Plus size={18} />
              แจ้งของหาย
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE SEARCH */}
      <div className="sticky top-[74px] z-40 border-b border-white/50 bg-white/90 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center rounded-2xl bg-[#f3f4f8] px-4">
          <Search size={18} className="text-gray-400" />

          <input
            type="text"
            placeholder="ค้นหา..."
            className="h-11 w-full bg-transparent px-3 text-sm outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* MAIN */}
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        {/* FILTER */}
        <div className="mb-5 flex gap-3 overflow-x-auto pb-1">
          {['ทั้งหมด', 'ของหาย', 'ของพบ'].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                filter === item
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                  : 'bg-white text-gray-600 shadow-sm hover:bg-orange-50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* MAP */}
        <div className="mb-6 overflow-hidden rounded-[30px] border border-white/50 bg-white shadow-2xl shadow-gray-100">
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <div>
              <h2 className="text-xl font-black">
                แผนที่การแจ้งล่าสุด
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                ดูตำแหน่งของหายและของที่พบล่าสุดแบบเรียลไทม์
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-bold text-orange-600 md:flex">
              <Flame size={16} />
              อัปเดตสด
            </div>
          </div>

          <div className="h-[350px] overflow-hidden">
            <MapComponent
              reports={filtered}
              height="h-full"
              zoom={6}
              selectedReport={selectedReport}
              onMarkerClick={(report) =>
                setSelectedReport(report)
              }
            />
          </div>
        </div>

        {/* TITLE */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">
              รายงานล่าสุด
            </h2>

            <p className="text-sm text-gray-500">
              พบเห็นช่วยแจ้งเจ้าของได้ทันที
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-sm md:flex">
            <Grid2X2 size={16} className="text-orange-500" />

            <span className="text-sm font-semibold text-gray-600">
              มุมมองกริด
            </span>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((report) => (
            <div
              key={report.id}
              className="group overflow-hidden rounded-[28px] border border-white bg-white shadow-lg shadow-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              {/* IMAGE */}
              <div
                className="relative cursor-pointer overflow-hidden"
                onClick={() => setSelectedReport(report)}
              >
                <img
                  src={report.images?.[0]}
                  alt=""
                  className="h-[190px] w-full object-cover transition duration-500 group-hover:scale-105"
                />

                {/* TYPE */}
                <div
                  className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-black backdrop-blur-xl ${
                    report.type === 'lost'
                      ? 'bg-red-500 text-white'
                      : 'bg-green-500 text-white'
                  }`}
                >
                  {report.type === 'lost'
                    ? 'ของหาย'
                    : 'ของพบ'}
                </div>

                {/* URGENT */}
                {report.urgent && (
                  <div className="absolute right-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-[10px] font-black text-black">
                    ด่วน
                  </div>
                )}

                {/* GRADIENT */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />

                {/* TITLE OVER IMAGE */}
                <div className="absolute bottom-0 left-0 w-full p-4">
                  <h2 className="line-clamp-2 text-sm font-black leading-tight text-white">
                    {report.title}
                  </h2>
                </div>
              </div>

              {/* CONTENT */}
              <div className="space-y-3 p-4">
                {/* LOCATION */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin size={13} />

                  <span className="truncate">
                    {report.district}, {report.province}
                  </span>
                </div>

                {/* DESC */}
                <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">
                  {report.description}
                </p>

                {/* TAGS */}
                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-bold text-orange-600">
                    {report.category}
                  </div>

                  {report.reward && (
                    <div className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-bold text-yellow-700">
                      รางวัล
                    </div>
                  )}
                </div>

                {/* ACTIONS */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        toggleLike(report.id)
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                        likedIds.has(report.id)
                          ? 'bg-red-50 text-red-500'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <Heart
                        size={18}
                        fill={
                          likedIds.has(report.id)
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    </button>

                    <button className="flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-gray-100">
                      <MessageCircle size={18} />
                    </button>

                    <button className="flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-gray-100">
                      <Share2 size={18} />
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      setSelectedReport(report)
                    }
                    className="rounded-2xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600"
                  >
                    ดูเพิ่ม
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE FLOAT BUTTON */}
      <button className="fixed bottom-24 right-5 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white shadow-2xl shadow-orange-300 transition hover:scale-110 md:hidden">
        <Plus size={28} />
      </button>
    </div>
  );
}