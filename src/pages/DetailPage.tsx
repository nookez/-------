import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin, Share2, CheckCircle2, Loader2, ChevronLeft,
  AlertTriangle, Phone, Facebook, MessageSquare, Calendar,
  Palette, Tag, Ruler, Image as ImageIcon, Eye, Heart,
  MessageCircle, Link2, Clock, Copy
} from 'lucide-react';
import { doc, getDoc, db } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import type { Report } from '../types';
import CommentsSection from './CommentsSection';

interface DetailPageProps {
  user: FirebaseUser | null;
}

function timeAgo(dateString: string): string {
  try {
    const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return new Date(dateString).toLocaleDateString('th-TH', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  } catch {
    return '—';
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('th-TH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

const ImageGallery = ({ images, title }: { images?: string[]; title: string }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center py-16">
        <ImageIcon className="h-12 w-12 text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center min-h-[200px]">
        <img
          src={images[activeIndex]}
          alt={title}
          className="max-h-[480px] w-full object-contain"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`shrink-0 h-16 w-16 rounded-xl border-2 overflow-hidden transition-all bg-slate-100 flex items-center justify-center ${
                activeIndex === idx
                  ? 'border-orange-500 ring-2 ring-orange-100'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <img src={img} alt="" className="max-h-full max-w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DetailRow = ({
  icon: Icon,
  label,
  value,
  tooltip,
  highlight = false
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  highlight?: boolean;
}) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`shrink-0 mt-0.5 ${highlight ? 'text-orange-500' : 'text-slate-400'}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500" title={tooltip}>{label}</p>
        <p className={`mt-1 text-sm ${highlight ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
          {value}
        </p>
      </div>
    </div>
  );
};

const AttributeCard = ({
  icon: Icon,
  label,
  value,
  tooltip
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tooltip?: string;
}) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4" title={tooltip}>
    <div className="flex items-center gap-2 text-slate-500">
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="mt-2 text-sm font-semibold text-slate-800 break-words">{value}</p>
  </div>
);

const ContactLink = ({
  icon: Icon,
  label,
  href,
  value,
  color = 'slate'
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
  value: string;
  color?: 'slate' | 'blue' | 'green';
}) => {
  const colorClasses = {
    slate: 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200',
    green: 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200',
  };
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
      </div>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${colorClasses[color]}`}
      >
        {content}
      </a>
    );
  }
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${colorClasses.slate}`}>
      {content}
    </div>
  );
};

const StatBadge = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) => (
  <div className="flex items-center gap-1.5 text-xs text-slate-500" title={label}>
    <Icon className="h-3.5 w-3.5" />
    <span>{value}</span>
  </div>
);

export default function DetailPage({ user }: DetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

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
          } as Report);
        } else {
          setReport(null);
        }
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: report?.title, text: report?.description, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        <span className="text-sm text-slate-500">กำลังโหลดข้อมูล...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-slate-300" />
        </div>
        <div className="text-center">
          <h3 className="text-base font-semibold text-slate-700">ไม่พบข้อมูล</h3>
          <p className="mt-1 text-sm text-slate-400">รายงานนี้ไม่อยู่ในระบบหรือถูกลบแล้ว</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับหน้าก่อนหน้า
          </button>
        </div>
      </div>
    );
  }

  const isLost = report.type === 'lost';
  const hasAttributes = report.color || report.brand || report.model || report.breed || report.size;
  const hasContact = report.contactPhone || report.contactFacebook || report.contactLine;

  return (
    <div className="space-y-6">

      {/* ── Header Section ── */}
      <header className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
              >
                <ChevronLeft className="h-4 w-4" />
                ย้อนกลับ
              </button>
              {report.urgent && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 text-white px-3 py-1.5 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ด่วน
                </span>
              )}
              <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold border ${
                isLost ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {isLost ? 'สัตว์หาย' : 'พบสัตว์'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
              {report.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-orange-500" />
                {[report.district, report.province].filter(Boolean).join(', ') || 'ไม่ระบุ'}
              </span>
              <span className="hidden sm:inline text-slate-200">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-4 w-4" />
                {report.category || 'ไม่ระบุ'}
              </span>
              <span className="hidden sm:inline text-slate-200">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {timeAgo(report.createdAt)}
              </span>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <StatBadge icon={Eye} label="จำนวนการดู" value={report.viewsCount || 0} />
              <StatBadge icon={Heart} label="จำนวนถูกใจ" value={report.likesCount || 0} />
              <StatBadge icon={MessageCircle} label="ความคิดเห็น" value={report.commentsCount || 0} />
              <StatBadge icon={Share2} label="แชร์" value={report.sharesCount || 0} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {report.contactPhone && (
              <a
                href={`tel:${report.contactPhone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
              >
                <Phone className="h-4 w-4" />
                ติดต่อ
              </a>
            )}
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-600 transition"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
              {copied ? 'คัดลอกแล้ว' : 'แชร์'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

        {/* Left Column */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">รูปภาพ</h2>
            <ImageGallery images={report.images} title={report.title} />
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">รายละเอียด</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {report.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
            </p>
          </section>

          {hasAttributes && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">ลักษณะสัตว์เลี้ยง</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {report.color && <AttributeCard icon={Palette} label="สี" value={report.color} tooltip="สีหลักของสัตว์เลี้ยง" />}
                {(report.brand || report.model) && <AttributeCard icon={Tag} label="ยี่ห้อ / รุ่น" value={[report.brand, report.model].filter(Boolean).join(' / ')} tooltip="ยี่ห้อหรือรุ่นของปลอกคอ/อุปกรณ์" />}
                {report.breed && <AttributeCard icon={MapPin} label="สายพันธุ์" value={report.breed} tooltip="สายพันธุ์ของสัตว์เลี้ยง" />}
                {report.size && <AttributeCard icon={Ruler} label="ขนาด" value={report.size} tooltip="ขนาดโดยประมาณของสัตว์เลี้ยง" />}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">เวลาและสถานที่</h2>
            <div className="space-y-1">
              <DetailRow icon={Calendar} label="วันที่" value={formatDate(report.date)} tooltip="วันที่ที่สัตว์เลี้ยงหายหรือถูกพบ" />
              <DetailRow icon={Clock} label="เวลา" value={report.time} tooltip="เวลาโดยประมาณของเหตุการณ์" />
              <DetailRow icon={MapPin} label="สถานที่" value={[report.address, report.district, report.province].filter(Boolean).join(', ') || 'ไม่ระบุ'} tooltip="สถานที่ที่สัตว์เลี้ยงหายหรือถูกพบ" highlight />
              {report.lat && report.lng && (
                <DetailRow icon={MapPin} label="พิกัด" value={`${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`} tooltip="พิกัดละติจูดและลองจิจูด" />
              )}
            </div>
          </section>

          {report.tags && report.tags.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">แท็ก</h2>
              <div className="flex flex-wrap gap-2">
                {report.tags.map((tag, idx) => (
                  <span key={idx} className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {hasContact && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">ช่องทางการติดต่อ</h2>
              <div className="space-y-3">
                {report.contactPhone && <ContactLink icon={Phone} label="เบอร์โทรศัพท์" href={`tel:${report.contactPhone.replace(/[^\d+]/g, '')}`} value={report.contactPhone} color="blue" />}
                {report.contactLine && <ContactLink icon={MessageSquare} label="LINE" href={`https://line.me/ti/p/${report.contactLine.replace('@', '')}`} value={report.contactLine} color="green" />}
                {report.contactFacebook && <ContactLink icon={Facebook} label="Facebook" href={report.contactFacebook.startsWith('http') ? report.contactFacebook : `https://facebook.com/${report.contactFacebook}`} value={report.contactFacebook.replace('https://facebook.com/', '').replace('www.facebook.com/', '')} color="blue" />}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white border border-slate-200 p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">ตำแหน่งบนแผนที่</h2>
            <div className="aspect-video rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
              {report.lat && report.lng ? (
                <div className="text-center p-4">
                  <MapPin className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">{[report.district, report.province].filter(Boolean).join(', ') || 'ไม่ระบุตำแหน่ง'}</p>
                  <p className="mt-1 text-xs text-slate-400 font-mono">{report.lat.toFixed(5)}, {report.lng.toFixed(5)}</p>
                </div>
              ) : (
                <div className="text-center p-4 text-slate-400">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ไม่ระบุตำแหน่งบนแผนที่</p>
                </div>
              )}
            </div>
            {report.lat && report.lng && (
              <a href={`https://www.google.com/maps?q=${report.lat},${report.lng}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-orange-600 hover:text-orange-700">
                <Link2 className="h-3.5 w-3.5" />
                เปิดใน Google Maps
              </a>
            )}
          </section>

          {report.reward && (
            <section className="rounded-2xl bg-orange-50 border border-orange-200 p-5">
              <div className="flex items-center gap-2 text-orange-700 mb-3">
                <CheckCircle2 className="h-4.5 w-4.5" />
                <h2 className="text-sm font-semibold uppercase tracking-wide">รางวัลนำจับ</h2>
              </div>
              <p className="text-2xl font-bold text-orange-900">{report.reward}</p>
              <p className="mt-2 text-xs text-orange-600/80">* รางวัลสำหรับผู้ที่มีข้อมูลหรือช่วยเหลือในการตามหา</p>
            </section>
          )}

          {report.user && (
            <section className="rounded-2xl bg-white border border-slate-200 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">ผู้แจ้งรายงาน</h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                  {report.user.avatar ? (
                    <img src={report.user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MessageCircle className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{report.user.name || 'ไม่ระบุชื่อ'}</p>
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">คำแนะนำ</h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <span>ติดต่อผู้แจ้งผ่านช่องทางที่ให้ไว้เท่านั้น เพื่อความปลอดภัย</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <span>ตรวจสอบข้อมูลให้ตรงกันก่อนนัดพบสถานที่</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <span>หากพบสัตว์เลี้ยง กรุณาถ่ายภาพและแจ้งตำแหน่งกลับ</span>
              </li>
            </ul>
          </section>
        </div>
      </div>

      {/* ── Comments Section ── */}
      <CommentsSection reportId={report.id} user={user} />

      {/* ── Fixed Bottom Bar (Mobile) ── */}
      {report.contactPhone && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 sm:hidden">
          <div className="mx-auto flex max-w-6xl gap-3">
            <a
              href={`tel:${report.contactPhone.replace(/[^\d+]/g, '')}`}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              <Phone className="h-4.5 w-4.5" />
              โทรติดต่อ
            </a>
            <button
              onClick={handleShare}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600 transition"
              aria-label="แชร์"
            >
              {copied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}