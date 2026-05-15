import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { addDoc, collection, db, doc, serverTimestamp, setDoc, getDoc, updateDoc } from '../firebase';
import type { User } from 'firebase/auth';
import { Trash2, MapPin, Loader2, Navigation, Search, ChevronDown } from 'lucide-react';

interface ReportFormPageProps {
  user: User | null;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD = 'ds6iydtrj';
const CLOUDINARY_PRESET = 'chuayganha';

async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST', 
    body: fd,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} - ${errorText}`);
  }
  
  const data = await res.json();
  if (!data.secure_url) {
    throw new Error('Cloudinary upload failed: No secure_url in response');
  }
  return data.secure_url;
}

// ─── Geocode helpers ──────────────────────────────────────────────────────────
async function geocodeAddress(text: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' ประเทศไทย')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'th' } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    console.error('Geocode error:', err);
  }
  return null;
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'th' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return {
      province: addr.state || addr.province || '',
      district: addr.county || addr.city_district || addr.suburb || '',
      address: data.display_name || '',
    };
  } catch (err) {
    console.error('Reverse geocode error:', err);
  }
  return null;
}

function matchProvince(raw: string): string {
  const cleaned = (raw || '').replace(/จังหวัด|province/gi, '').trim();
  return PROVINCES.find((p) => p.includes(cleaned) || cleaned.includes(p)) || '';
}

// ─── Map sub-components ───────────────────────────────────────────────────────
function FlyToPosition({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (
      !prev.current ||
      Math.abs(prev.current.lat - lat) > 0.0001 ||
      Math.abs(prev.current.lng - lng) > 0.0001
    ) {
      map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.8 });
      prev.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PROVINCES = [
  'กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร',
  'ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท',
  'ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง',
  'ตราด','ตาก','นครนายก','นครปฐม','นครพนม',
  'นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส',
  'น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์',
  'ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา',
  'พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์',
  'แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน',
  'ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง',
  'ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย',
  'ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ',
  'สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี',
  'สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย',
  'หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์',
  'อุทัยธานี','อุบลราชธานี',
];

const PET_TYPES = [
  { value: 'Dog', label: '🐕 สุนัข' },
  { value: 'Cat', label: '🐈 แมว' },
  { value: 'Bird', label: '🐦 นก' },
  { value: 'Rabbit', label: '🐇 กระต่าย' },
  { value: 'Other', label: '🐾 อื่น ๆ' },
] as const;

const COLORS = ['ขาว','ดำ','น้ำตาล','ส้ม','เหลือง','เทา','ลาย','ขาว-ดำ','ขาว-ส้ม','น้ำตาล-ขาว','อื่น ๆ'];

const DEFAULT_FORM = {
  title: '',
  description: '',
  date: '',
  time: '',
  province: 'กรุงเทพมหานคร',
  district: '',
  address: '',
  lat: 13.7563,
  lng: 100.5018,
  petType: 'Dog',
  breed: '',
  color: '',
  colorCustom: '',
  gender: 'ไม่ทราบ',
  size: '',
  age: '',
  hasCollar: 'ไม่ทราบ',
  collarDetail: '',
  sterilized: 'ไม่ทราบ',
  microchip: '',
  note: '',
  compensationAmount: '',
  compensationType: 'เงินสด',
  contactPhone: '',
  contactLine: '',
  contactFacebook: '',
};

// ─── Baht Input ───────────────────────────────────────────────────────────────
function BahtInput({ value, onChange, className }: { value: string; onChange: (v: string) => void; className: string }) {
  const formatted = value ? Number(value).toLocaleString('th-TH') : '';
  return (
    <div className="relative mt-2">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">฿</span>
      <input
        type="text"
        inputMode="numeric"
        value={formatted}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className={`${className} pl-8`}
      />
    </div>
  );
}

// ─── Toggle Button Group ──────────────────────────────────────────────────────
function ToggleGroup<T extends string>({
  options, value, onChange, cols = 3,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-2xl border py-2.5 text-sm font-bold transition ${
            value === opt.value
              ? 'border-orange-400 bg-orange-50 text-orange-700'
              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-orange-200 hover:text-orange-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportFormPage({ user }: ReportFormPageProps) {
  const { type, id } = useParams<{ type: string; id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');

  const STEPS = ['สัตว์', 'ตำแหน่ง', 'รูปภาพ', 'ติดต่อ'];
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load edit data ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditMode || !id) return;
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'reports', id!));
        if (!snap.exists()) { 
          alert('ไม่พบโพสต์'); 
          navigate('/profile'); 
          return; 
        }
        const d = snap.data() as any;
        if (user && d.userId !== user.uid) { 
          alert('ไม่มีสิทธิ์แก้ไข'); 
          navigate('/profile'); 
          return; 
        }
        setForm({
          title: d.title || '',
          description: d.description || '',
          date: d.date || '',
          time: d.time || '',
          province: d.province || 'กรุงเทพมหานคร',
          district: d.district || '',
          address: d.address || '',
          lat: d.lat || 13.7563,
          lng: d.lng || 100.5018,
          petType: d.petType || 'Dog',
          breed: d.breed || '',
          color: d.color || '',
          colorCustom: d.colorCustom || '',
          gender: d.gender || 'ไม่ทราบ',
          size: d.size || '',
          age: d.age || '',
          hasCollar: d.hasCollar || 'ไม่ทราบ',
          collarDetail: d.collarDetail || '',
          sterilized: d.sterilized || 'ไม่ทราบ',
          microchip: d.microchip || '',
          note: d.note || '',
          compensationAmount: d.compensationAmount ? String(d.compensationAmount) : '',
          compensationType: d.compensationType || 'เงินสด',
          contactPhone: d.contactPhone || '',
          contactLine: d.contactLine || '',
          contactFacebook: d.contactFacebook || '',
        });
        setExistingImages(d.images || []);
      } catch (err) { 
        console.error('Load error:', err);
        alert('โหลดข้อมูลไม่สำเร็จ'); 
      } finally { 
        setLoadingData(false); 
      }
    }
    load();
  }, [id, isEditMode, user, navigate]);

  // ── Geocode trigger ────────────────────────────────────────────────────────
  const triggerGeocode = useCallback((province: string, district: string) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      const text = [district, province].filter(Boolean).join(' ');
      if (!text) return;
      setGeocoding(true);
      const r = await geocodeAddress(text);
      if (r) setForm((f) => ({ ...f, lat: r.lat, lng: r.lng }));
      setGeocoding(false);
    }, 800);
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'province' || key === 'district') triggerGeocode(next.province, next.district);
      return next;
    });
  };

  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return;
    setGeocoding(true);
    const r = await geocodeAddress(addressSearch);
    if (r) setForm((f) => ({ ...f, lat: r.lat, lng: r.lng }));
    else alert('ไม่พบตำแหน่ง ลองพิมพ์ใหม่');
    setGeocoding(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setGeocoding(true);
    const r = await reverseGeocode(lat, lng);
    setForm((f) => ({
      ...f, lat, lng,
      ...(r ? {
        province: matchProvince(r.province) || f.province,
        district: r.district || f.district,
      } : {}),
    }));
    setGeocoding(false);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const r = await reverseGeocode(lat, lng);
        setForm((f) => ({
          ...f, lat, lng,
          ...(r ? {
            province: matchProvince(r.province) || f.province,
            district: r.district || f.district,
            address: r.address || f.address,
          } : {}),
        }));
        setGpsLoading(false);
      },
      (err) => { 
        console.error('GPS error:', err);
        alert('ไม่สามารถรับตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง'); 
        setGpsLoading(false); 
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const all = [...images, ...Array.from(files)].slice(0, 5);
    setImages(all);
    setPreviews(all.map((f) => URL.createObjectURL(f)));
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateStep = (stepNum: number): boolean => {
    if (stepNum === 0) {
      if (!form.title.trim()) { alert('กรุณากรอกหัวข้อโพสต์'); return false; }
      if (!form.date) { alert('กรุณาเลือกวันที่'); return false; }
    }
    if (stepNum === 1) {
      if (!form.province) { alert('กรุณาเลือกจังหวัด'); return false; }
      if (!form.lat || !form.lng) { alert('กรุณาระบุตำแหน่งบนแผนที่'); return false; }
    }
    if (stepNum === 2 && !isEditMode) {
      if (existingImages.length === 0 && images.length === 0) {
        alert('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
        return false;
      }
    }
    return true;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) {
      alert('กรุณาเข้าสู่ระบบก่อนสร้างโพสต์');
      return;
    }

    // Validate all steps before submit
    for (let i = 0; i < 3; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }

    setSaving(true);
    setMessage('กำลังอัปโหลดรูปภาพ...');

    try {
      // Upload new images
      const newUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const url = await uploadToCloudinary(images[i]);
          newUrls.push(url);
          setUploadProgress(Math.round(((i + 1) / images.length) * 100));
        } catch (uploadErr: any) {
          console.error(`Upload image ${i} failed:`, uploadErr);
          throw new Error(`อัปโหลดรูปภาพที่ ${i + 1} ไม่สำเร็จ: ${uploadErr.message}`);
        }
      }

      const allImages = [...existingImages, ...newUrls];
      const compensation = form.compensationAmount
        ? `${Number(form.compensationAmount).toLocaleString('th-TH')} บาท (${form.compensationType})`
        : '';
      const effectiveColor = form.color === 'อื่น ๆ' ? form.colorCustom : form.color;

      const payload = {
        ...form,
        color: effectiveColor,
        category: 'สัตว์เลี้ยง',
        reward: compensation,
        compensation,
        compensationAmount: Number(form.compensationAmount) || 0,
        images: allImages,
        tags: ['สัตว์เลี้ยง', form.petType, effectiveColor, form.breed, form.gender, form.size, form.note].filter(Boolean),
      };

      setMessage('กำลังบันทึกโพสต์...');

      if (isEditMode && id) {
        // Edit mode
        await updateDoc(doc(db, 'reports', id), { 
          ...payload, 
          updatedAt: serverTimestamp(),
        });
        setMessage('✓ แก้ไขสำเร็จ');
        setSaving(false);
        setTimeout(() => navigate('/profile'), 1200);
      } else {
        // Create mode
        const docRef = await addDoc(collection(db, 'reports'), {
          userId: user.uid,
          user: { 
            name: user.displayName || user.email?.split('@')[0] || 'ผู้ใช้', 
            avatar: user.photoURL || '' 
          },
          type: type === 'lost' ? 'lost' : 'found',
          ...payload,
          status: type === 'lost' ? 'กำลังตาม' : 'พบแล้ว',
          resolved: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          viewsCount: 0,
          likedBy: [],
        });

        await setDoc(doc(db, 'users', user.uid), { lastReportId: docRef.id }, { merge: true });
        setMessage('✓ บันทึกสำเร็จ กำลังไปหน้าฟีด...');
        setSaving(false);
        setTimeout(() => navigate('/feed'), 1200);
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      setMessage(`❌ ${err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'}`);
      setSaving(false);
    } finally {
      setUploadProgress(0);
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 3));
    }
  };

  const canNext = useMemo(() => {
    if (step === 0) return form.title.trim().length > 0 && !!form.date;
    if (step === 1) return !!form.province && form.lat !== 0 && form.lng !== 0;
    if (step === 2 && !isEditMode) return existingImages.length + images.length > 0;
    return true;
  }, [step, form.title, form.date, form.province, form.lat, form.lng, existingImages.length, images.length, isEditMode]);

  const inp = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition';
  const lbl = 'text-sm font-semibold text-slate-700';
  const sel = `${inp} appearance-none pr-10`;

  if (loadingData) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">

      {/* ── Header + progress ── */}
      <div className="rounded-3xl bg-white p-6 shadow-glass">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-500">
              {isEditMode ? 'แก้ไขโพสต์' : type === 'lost' ? '🐾 แจ้งสัตว์เลี้ยงหาย' : '🐾 แจ้งพบสัตว์'}
            </p>
            <h1 className="mt-0.5 text-2xl font-black text-slate-900">
              {isEditMode ? 'แก้ไขโพสต์' : 'สร้างโพสต์ใหม่'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => i < step && setStep(i)}
                title={s}
                className={`h-2 rounded-full transition-all ${
                  i === step ? 'w-8 bg-orange-500' :
                  i < step ? 'w-2 bg-orange-300 cursor-pointer hover:bg-orange-400' :
                  'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>ขั้นที่ {step + 1}/{STEPS.length} · <strong className="text-slate-600">{STEPS[step]}</strong></span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ══ Step 0: ข้อมูลสัตว์ ══ */}
      {step === 0 && (
        <div className="rounded-3xl bg-white p-6 shadow-glass space-y-6">

          {/* หัวข้อ */}
          <div>
            <label className={lbl}>หัวข้อโพสต์ <span className="text-red-400">*</span></label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className={`mt-2 ${inp}`}
              maxLength={80}
              placeholder="เช่น น้องหมาพันธุ์ปอมเมอเรเนียนหายแถวสยาม"
            />
            <p className="mt-1 text-right text-[11px] text-slate-300">{form.title.length}/80</p>
          </div>

          {/* วันที่ + เวลา */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={lbl}>วันที่ {type === 'lost' ? 'หาย' : 'พบ'} <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className={`mt-2 ${inp}`}
              />
            </div>
            <div>
              <label className={lbl}>เวลา (โดยประมาณ)</label>
              <input type="time" value={form.time} onChange={(e) => setField('time', e.target.value)} className={`mt-2 ${inp}`} />
            </div>
          </div>

          {/* ประเภทสัตว์ */}
          <div>
            <label className={lbl}>ประเภทสัตว์</label>
            <ToggleGroup
              options={PET_TYPES as any}
              value={form.petType}
              onChange={(v) => setField('petType', v)}
              cols={5}
            />
          </div>

          {/* เพศ + ทำหมัน */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={lbl}>เพศ</label>
              <ToggleGroup
                options={[
                  { value: 'ผู้', label: '♂ ผู้' },
                  { value: 'เมีย', label: '♀ เมีย' },
                  { value: 'ไม่ทราบ', label: '? ไม่ทราบ' },
                ]}
                value={form.gender}
                onChange={(v) => setField('gender', v)}
                cols={3}
              />
            </div>
            <div>
              <label className={lbl}>ทำหมันแล้ว?</label>
              <ToggleGroup
                options={[
                  { value: 'ใช่', label: '✓ ใช่' },
                  { value: 'ไม่', label: '✗ ไม่' },
                  { value: 'ไม่ทราบ', label: '? ไม่ทราบ' },
                ]}
                value={form.sterilized}
                onChange={(v) => setField('sterilized', v)}
                cols={3}
              />
            </div>
          </div>

          {/* สายพันธุ์ + ขนาด */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={lbl}>สายพันธุ์</label>
              <input value={form.breed} onChange={(e) => setField('breed', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น ปอมเมอเรเนียน, ชิห์สุ" />
            </div>
            <div>
              <label className={lbl}>ขนาดตัว</label>
              <div className="relative mt-2">
                <select value={form.size} onChange={(e) => setField('size', e.target.value)} className={sel}>
                  <option value="">ไม่ระบุ</option>
                  {['เล็กมาก (&lt; 5 กก.)','เล็ก (5-10 กก.)','กลาง (10-20 กก.)','ใหญ่ (20-35 กก.)','ใหญ่มาก (&gt; 35 กก.)'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* อายุ */}
          <div>
            <label className={lbl}>อายุโดยประมาณ</label>
            <div className="relative mt-2">
              <select value={form.age} onChange={(e) => setField('age', e.target.value)} className={sel}>
                <option value="">ไม่ทราบ</option>
                {['&lt; 1 ปี','1-3 ปี','3-5 ปี','5-8 ปี','&gt; 8 ปี'].map((a) => <option key={a}>{a}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* สีขน */}
          <div>
            <label className={lbl}>สีขน</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField('color', c)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    form.color === c
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-orange-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {form.color === 'อื่น ๆ' && (
              <input
                value={form.colorCustom}
                onChange={(e) => setField('colorCustom', e.target.value)}
                className={`mt-2 ${inp}`}
                placeholder="ระบุสี..."
              />
            )}
          </div>

          {/* ปลอกคอ */}
          <div>
            <label className={lbl}>ปลอกคอ</label>
            <ToggleGroup
              options={[
                { value: 'มี', label: '🔗 มี' },
                { value: 'ไม่มี', label: '✗ ไม่มี' },
                { value: 'ไม่ทราบ', label: '? ไม่ทราบ' },
              ]}
              value={form.hasCollar}
              onChange={(v) => setField('hasCollar', v)}
              cols={3}
            />
            {form.hasCollar === 'มี' && (
              <input
                value={form.collarDetail}
                onChange={(e) => setField('collarDetail', e.target.value)}
                className={`mt-2 ${inp}`}
                placeholder="เช่น สีแดง มีกระดิ่ง"
              />
            )}
          </div>

          {/* Microchip */}
          <div>
            <label className={lbl}>เลข Microchip (ถ้ามี)</label>
            <input value={form.microchip} onChange={(e) => setField('microchip', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น 982000123456789" />
          </div>

          {/* จุดสังเกต */}
          <div>
            <label className={lbl}>จุดสังเกต / ลักษณะพิเศษ</label>
            <textarea
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
              rows={3}
              className={`mt-2 ${inp} resize-none`}
              maxLength={400}
              placeholder="เช่น มีจุดดำที่หูซ้าย, เดินกะเผลก, สวมปลอกคอสีส้ม"
            />
            <p className="mt-1 text-right text-[11px] text-slate-300">{form.note.length}/400</p>
          </div>

          {/* รายละเอียดเพิ่มเติม */}
          <div>
            <label className={lbl}>รายละเอียดเพิ่มเติม</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              className={`mt-2 ${inp} resize-none`}
              maxLength={500}
              placeholder="เล่าเพิ่มเติมเกี่ยวกับสัตว์เลี้ยงหรือเหตุการณ์..."
            />
            <p className="mt-1 text-right text-[11px] text-slate-300">{form.description.length}/500</p>
          </div>

          {/* ค่าตอบแทน */}
          <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-5 space-y-4">
            <p className="font-bold text-orange-800">💰 ค่าตอบแทน</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl}>จำนวนเงิน (บาท)</label>
                <BahtInput
                  value={form.compensationAmount}
                  onChange={(v) => setField('compensationAmount', v)}
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>ประเภท</label>
                <div className="relative mt-2">
                  <select value={form.compensationType} onChange={(e) => setField('compensationType', e.target.value)} className={sel}>
                    <option>เงินสด</option>
                    <option>โอนพร้อมเพย์</option>
                    <option>ของรางวัล</option>
                    <option>ไม่มี</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
            {form.compensationAmount && (
              <p className="text-sm font-bold text-orange-700">
                ฿{Number(form.compensationAmount).toLocaleString('th-TH')} ({form.compensationType})
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ Step 1: ตำแหน่ง ══ */}
      {step === 1 && (
        <div className="rounded-3xl bg-white p-6 shadow-glass space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={lbl}>จังหวัด <span className="text-red-400">*</span></label>
              <div className="relative mt-2">
                <select value={form.province} onChange={(e) => setField('province', e.target.value)} className={sel}>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <label className={lbl}>อำเภอ / เขต</label>
              <input value={form.district} onChange={(e) => setField('district', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น ปทุมวัน, บางรัก" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>ที่อยู่โดยละเอียด</label>
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น หน้าห้างสยามพารากอน, ซอยสุขุมวิท 21" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={addressSearch}
                onChange={(e) => setAddressSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                className={`${inp} pl-10`}
                placeholder="ค้นหาสถานที่..."
              />
            </div>
            <button type="button" onClick={handleAddressSearch} disabled={geocoding}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} ค้นหา
            </button>
            <button type="button" onClick={handleGPS} disabled={gpsLoading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition">
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} GPS
            </button>
          </div>

          {geocoding && (
            <div className="flex items-center gap-1.5 text-xs text-orange-500">
              <Loader2 className="h-3 w-3 animate-spin" /> กำลังระบุพิกัด...
            </div>
          )}
          <div className="h-[320px] overflow-hidden rounded-2xl border border-slate-200">
            <MapContainer center={[form.lat, form.lng]} zoom={14} style={{ width: '100%', height: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
              <FlyToPosition lat={form.lat} lng={form.lng} />
              <Marker
                position={[form.lat, form.lng]}
                draggable
                eventHandlers={{ dragend: async (e: any) => { const { lat, lng } = e.target.getLatLng(); await handleMapClick(lat, lng); } }}
              />
              <MapClickHandler onClick={handleMapClick} />
            </MapContainer>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
            {form.district && ` · ${form.district}`}{form.province && `, ${form.province}`}
          </div>
        </div>
      )}

      {/* ══ Step 2: รูปภาพ ══ */}
      {step === 2 && (
        <div className="rounded-3xl bg-white p-6 shadow-glass space-y-5">
          {isEditMode && existingImages.length > 0 && (
            <div>
              <p className={`${lbl} mb-3`}>รูปภาพปัจจุบัน</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {existingImages.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                    <img src={src} className="h-full w-full object-cover" alt="" />
                    <button
                      onClick={() => setExistingImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100 rounded-xl"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">หลัก</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className={`${lbl} mb-2`}>
              {isEditMode ? 'เพิ่มรูปภาพ' : `รูปภาพ (${images.length}/5)`}
              {!isEditMode && <span className="text-red-400"> *</span>}
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
                !isEditMode && images.length === 0 ? 'border-red-200 bg-red-50/30' : 'border-orange-200 bg-orange-50/30'
              }`}
            >
              <p className="text-3xl mb-3">📷</p>
              <label className="cursor-pointer rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition">
                เลือกรูปภาพ
                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
              <p className="mt-3 text-xs text-slate-400">ลากรูปวางที่นี่ได้เลย · สูงสุด 5 รูป</p>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>กำลังอัปโหลด...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {previews.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                    <img src={src} className="h-full w-full object-cover" alt="" />
                    <button
                      onClick={() => {
                        setImages((p) => p.filter((_, idx) => idx !== i));
                        setPreviews((p) => p.filter((_, idx) => idx !== i));
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100 rounded-xl"
                      title="ลบรูปภาพ"
                    >
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">หลัก</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Step 3: ติดต่อ + สรุป ══ */}
      {step === 3 && (
        <div className="rounded-3xl bg-white p-6 shadow-glass space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={lbl}>เบอร์โทรศัพท์</label>
              <input type="tel" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น 0812345678" />
            </div>
            <div>
              <label className={lbl}>Line ID</label>
              <input value={form.contactLine} onChange={(e) => setField('contactLine', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น @petrescue" />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Facebook</label>
              <input value={form.contactFacebook} onChange={(e) => setField('contactFacebook', e.target.value)} className={`mt-2 ${inp}`} placeholder="เช่น https://facebook.com/username" />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 text-sm space-y-2">
            <p className="font-black text-orange-800 mb-3">📋 สรุปโพสต์</p>
            <Row label="หัวข้อ" value={form.title || '(ยังไม่กรอก)'} bold />
            <Row label="สัตว์" value={PET_TYPES.find((p) => p.value === form.petType)?.label || form.petType} />
            <Row label="เพศ" value={form.gender} />
            {form.breed && <Row label="สายพันธุ์" value={form.breed} />}
            {form.color && <Row label="สีขน" value={form.color === 'อื่น ๆ' ? form.colorCustom : form.color} />}
            {form.size && <Row label="ขนาด" value={form.size} />}
            <Row label="วันที่" value={`${form.date}${form.time ? ' · ' + form.time : ''}`} />
            <Row label="ตำแหน่ง" value={[form.district, form.province].filter(Boolean).join(', ') || '(ยังไม่ระบุ)'} />
            <Row label="รูปภาพ" value={`${existingImages.length + images.length} รูป`} />
            {form.compensationAmount && (
              <Row label="ค่าตอบแทน" value={`฿${Number(form.compensationAmount).toLocaleString('th-TH')} (${form.compensationType})`} />
            )}
          </div>

          {message && (
            <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
              {message}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition">
              ← ย้อนกลับ
            </button>
          )}
        </div>
        <div>
          {step < 3 ? (
            <button onClick={handleNext} disabled={!canNext}
              className="rounded-2xl bg-orange-500 px-7 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-40 transition">
              ถัดไป →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
                : isEditMode ? '✓ บันทึกการแก้ไข' : '✓ ส่งโพสต์'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <p>
      <span className="text-slate-400">{label}: </span>
      <span className={bold ? 'font-bold text-slate-900' : 'text-slate-700'}>{value}</span>
    </p>
  );
}