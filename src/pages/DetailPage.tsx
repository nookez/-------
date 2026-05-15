import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, Share2, CheckCircle2, Loader2, ChevronLeft, AlertTriangle } from 'lucide-react';
import { doc, getDoc, db } from '../firebase';
import { sampleReports } from '../data';
import type { User } from 'firebase/auth';
import type { Report } from '../types';

interface DetailPageProps {
  user: User | null;
}

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

export default function DetailPage({ user }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<(Report & { user?: any; likedBy?: string[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, 'reports', id));
        if (snap.exists()) {
          const data = snap.data();
          setReport({
            id: snap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || new Date().toISOString(),
          } as any);
        } else {
          // Fallback to sample
          const sample = sampleReports.find(r => r.id === id);
          setReport(sample as any || sampleReports[0] as any);
        }
      } catch (err) {
        // Fallback to sample
        const sample = sampleReports.find(r => r.id === id);
        setReport(sample as any || sampleReports[0] as any);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        <span className="text-slate-500">กำลังโหลด...</span>
      </div>
    );
  }

  if (!report) return null;

  const isLost = report.type === 'lost';

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-white p-6 shadow-glass sm:p-8">
        
        {/* Header */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between mb-8">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                <ChevronLeft className="h-4 w-4" />
                ย้อนกลับ
              </button>
              {report.urgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500 text-white px-2.5 py-1 text-[10px] font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  ด่วน
                </span>
              )}
            </div>
            <p className="text-sm uppercase tracking-[0.24em] text-orange-600 font-bold">
              {isLost ? '🔍 ประกาศของหาย' : '✓ ประกาศของที่พบ'}
            </p>
            <h1 className="text-4xl font-bold text-slate-900">{report.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 pt-2">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4 text-orange-500" />
                {report.province}
              </span>
              <span className="text-slate-300">•</span>
              <span>{report.category}</span>
              <span className="text-slate-300">•</span>
              <span>{timeAgo(report.createdAt)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <a
              href={`tel:${report.contactPhone || 'no-phone'}`}
              className="rounded-3xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              📞 ติดต่อเจ้าของ
            </a>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('คัดลอกลิงก์แล้ว');
              }}
              className="rounded-3xl border border-orange-200 bg-white px-5 py-3 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
            >
              แชร์โพสต์
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          
          {/* Left column */}
          <div className="space-y-4">
            
            {/* Image */}
            {report.images && report.images.length > 0 && (
              <div className="rounded-[2rem] bg-slate-100 p-4 overflow-hidden">
                <img
                  src={report.images[0]}
                  alt={report.title}
                  className="h-72 w-full rounded-[1.5rem] object-cover"
                />
              </div>
            )}

            {/* Details */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">รายละเอียด</h2>
              <p className="mt-4 text-slate-600 leading-7 whitespace-pre-wrap">
                {report.description}
              </p>
              
              {/* Attributes grid */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {report.color && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">🎨 สี</p>
                    <p className="mt-2 font-semibold text-slate-900">{report.color}</p>
                  </div>
                )}
                {(report.brand || report.model) && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">🏷️ ยี่ห้อ / รุ่น</p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {[report.brand, report.model].filter(Boolean).join(' / ')}
                    </p>
                  </div>
                )}
                {report.breed && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">🐾 สายพันธุ์</p>
                    <p className="mt-2 font-semibold text-slate-900">{report.breed}</p>
                  </div>
                )}
                {report.size && (
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">📏 ขนาด</p>
                    <p className="mt-2 font-semibold text-slate-900">{report.size}</p>
                  </div>
                )}
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">📅 วันที่</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {report.date && new Date(report.date).toLocaleDateString('th-TH')}
                    {report.time && ` เวลา ${report.time}`}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">📍 สถานที่</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {[report.address, report.district, report.province].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            
            {/* Location */}
            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                ตำแหน่งบนแผนที่
              </p>
              <div className="mt-4 rounded-3xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 text-sm text-slate-700">
                <MapPin className="inline-block h-4 w-4 text-orange-500 mr-2" />
                {[report.address, report.district, report.province].filter(Boolean).join(', ') || '—'}
              </div>
              {report.lat && report.lng && (
                <p className="mt-2 text-xs text-slate-400">
                  📍 {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                ติดต่อ
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {report.contactPhone && (
                  <a 
                    href={`tel:${report.contactPhone}`}
                    className="rounded-3xl bg-blue-50 hover:bg-blue-100 p-4 font-semibold text-blue-700 transition"
                  >
                    ☎️ {report.contactPhone}
                  </a>
                )}
                {report.contactFacebook && (
                  <a 
                    href={`https://facebook.com/${report.contactFacebook.split('/').pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-3xl bg-blue-50 hover:bg-blue-100 p-4 font-semibold text-blue-700 transition block"
                  >
                    f {report.contactFacebook.split('/').pop()}
                  </a>
                )}
                {report.contactLine && (
                  <a 
                    href={`https://line.me/ti/p/${report.contactLine.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-3xl bg-green-50 hover:bg-green-100 p-4 font-semibold text-green-700 transition block"
                  >
                    LINE: {report.contactLine}
                  </a>
                )}
              </div>
            </div>

            {/* Reward */}
            {report.reward && (
              <div className="rounded-[1.75rem] bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
                  🎁 รางวัลนำจับ
                </p>
                <p className="mt-3 text-2xl font-bold text-amber-900">
                  {report.reward}
                </p>
              </div>
            )}

            {/* Recommendation */}
            <div className="rounded-[1.75rem] bg-orange-50 p-6 shadow-sm border border-orange-100">
              <div className="flex items-center gap-3 text-slate-900 mb-3">
                <CheckCircle2 className="h-5 w-5 text-orange-600 shrink-0" />
                <h3 className="text-lg font-semibold">การจับคู่ที่แนะนำ</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                โพสต์นี้อาจเป็นสิ่งที่คุณกำลังตามหา หากข้อมูลเข้ากันทั้งหมวดหมู่ สี และสถานที่
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 rounded-[2rem] bg-slate-50 p-6 border border-slate-100">
          <h3 className="text-xl font-semibold text-slate-900 mb-4">💬 ความคิดเห็น</h3>
          <div className="flex items-center justify-center py-8 text-slate-400">
            <span>ยังไม่มีความคิดเห็น</span>
          </div>
        </div>
      </div>
    </div>
  );
}