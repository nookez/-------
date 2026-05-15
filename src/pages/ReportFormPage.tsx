import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { addDoc, collection, db, doc, serverTimestamp, setDoc, getDoc, updateDoc } from '../firebase';
import type { User } from 'firebase/auth';
import { Trash2, MapPin, Loader2, Navigation, Search } from 'lucide-react';

const CLOUDINARY_CLOUD = 'ds6iydtrj';
const CLOUDINARY_PRESET = 'chuayganha';

async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error('Cloudinary upload failed');
  return data.secure_url;
}

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

const CATEGORIES = ['สัตว์เลี้ยง','เอกสาร','โทรศัพท์','กระเป๋า','กุญแจ','เครื่องประดับ','กระเป๋าเงิน','รถจักรยาน','แล็ปท็อป','อื่น ๆ'];

interface CategoryFields {
  [key: string]: { color: boolean; brand: boolean; model: boolean; breed: boolean; size: boolean; reward: boolean; };
}

const CATEGORY_FIELDS: CategoryFields = {
  'สัตว์เลี้ยง': { color: true, brand: false, model: false, breed: true, size: true, reward: true },
  'เอกสาร': { color: false, brand: false, model: false, breed: false, size: false, reward: true },
  'โทรศัพท์': { color: true, brand: true, model: true, breed: false, size: false, reward: true },
  'กระเป๋า': { color: true, brand: true, model: false, breed: false, size: true, reward: true },
  'กุญแจ': { color: true, brand: false, model: false, breed: false, size: false, reward: true },
  'เครื่องประดับ': { color: true, brand: true, model: false, breed: false, size: false, reward: true },
  'กระเป๋าเงิน': { color: true, brand: true, model: false, breed: false, size: false, reward: true },
  'รถจักรยาน': { color: true, brand: true, model: true, breed: false, size: false, reward: true },
  'แล็ปท็อป': { color: false, brand: true, model: true, breed: false, size: false, reward: true },
  'อื่น ๆ': { color: true, brand: true, model: false, breed: false, size: true, reward: true },
};

interface ReportFormPageProps { user: User | null; }

function FlyToPosition({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });
  useEffect(() => {
    if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
      map.flyTo([lat, lng], 15, { duration: 1.2 });
      prevRef.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

async function geocodeAddress(text: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text + ' ประเทศไทย')}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'th' } }
    );
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── แก้ไข: reverseGeocode ที่ดีขึ้น ──────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<{ province: string; district: string; address: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`,
      { headers: { 'Accept-Language': 'th' } }
    );
    const data = await res.json();
    const addr = data.address || {};

    const rawProvince = addr.state || addr.province || addr.region || '';
    const province = rawProvince
      .replace('จังหวัด', '')
      .replace('Province', '')
      .trim();

    const district =
      addr.city_district ||
      addr.suburb ||
      addr.county ||
      addr.city ||
      addr.town ||
      '';

    return {
      province,
      district,
      address: data.display_name || '',
    };
  } catch {}
  return null;
}

// ── แก้ไข: match จังหวัดให้แม่นขึ้น ─────────────────────────────────────
function matchProvince(raw: string): string | undefined {
  if (!raw) return undefined;
  return PROVINCES.find((p) =>
    raw.includes(p) ||
    p.includes(raw) ||
    raw.replace(/\s/g, '').includes(p.replace(/\s/g, ''))
  );
}

const DEFAULT_FORM = {
  title: '', category: 'สัตว์เลี้ยง', description: '',
  date: '', time: '',
  province: 'กรุงเทพมหานคร', district: '', address: '',
  lat: 13.7563, lng: 100.5018,
  color: '', brand: '', model: '', breed: '', size: '',
  reward: '', urgent: false,
  contactPhone: '', contactFacebook: '', contactLine: '',
};

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

  const STEPS = ['พื้นฐาน', 'ตำแหน่ง', 'รายละเอียด', 'ติดต่อ'];

  useEffect(() => {
    if (!isEditMode || !id) return;

    async function loadReport() {
      try {
        const snap = await getDoc(doc(db, 'reports', id!));
        if (!snap.exists()) { alert('ไม่พบโพสต์นี้'); navigate('/profile'); return; }
        const data = snap.data() as any;

        if (user && data.userId !== user.uid) { alert('คุณไม่มีสิทธิ์แก้ไขโพสต์นี้'); navigate('/profile'); return; }

        setForm({
          title: data.title || '',
          category: data.category || 'สัตว์เลี้ยง',
          description: data.description || '',
          date: data.date || '',
          time: data.time || '',
          province: data.province || 'กรุงเทพมหานคร',
          district: data.district || '',
          address: data.address || '',
          lat: data.lat || 13.7563,
          lng: data.lng || 100.5018,
          color: data.color || '',
          brand: data.brand || '',
          model: data.model || '',
          breed: data.breed || '',
          size: data.size || '',
          reward: data.reward || '',
          urgent: data.urgent || false,
          contactPhone: data.contactPhone || '',
          contactFacebook: data.contactFacebook || '',
          contactLine: data.contactLine || '',
        });
        setExistingImages(data.images || []);
      } catch (err) {
        console.error(err);
        alert('โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoadingData(false);
      }
    }

    loadReport();
  }, [id, isEditMode, user, navigate]);

  const activeFields = useMemo(() => CATEGORY_FIELDS[form.category] || CATEGORY_FIELDS['อื่น ๆ'], [form.category]);

  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGeocode = useCallback((province: string, district: string, address: string) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      const text = [district, province].filter(Boolean).join(' ');
      if (!text) return;
      setGeocoding(true);
      const result = await geocodeAddress(text);
      if (result) setForm((f) => ({ ...f, lat: result.lat, lng: result.lng }));
      setGeocoding(false);
    }, 800);
  }, []);

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'province' || key === 'district') triggerGeocode(next.province, next.district, next.address);
      return next;
    });
  };

  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return;
    setGeocoding(true);
    const result = await geocodeAddress(addressSearch);
    if (result) setForm((f) => ({ ...f, lat: result.lat, lng: result.lng }));
    else alert('ไม่พบตำแหน่งที่ค้นหา ลองพิมพ์ใหม่');
    setGeocoding(false);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    setForm((f) => ({ ...f, lat, lng }));
    setGeocoding(true);
    const result = await reverseGeocode(lat, lng);
    if (result) {
      setForm((f) => ({
        ...f, lat, lng,
        province: matchProvince(result.province) || f.province,
        district: result.district || f.district,
      }));
    }
    setGeocoding(false);
  };

  const handleGPS = () => {
    if (!navigator.geolocation) return alert('เบราว์เซอร์ไม่รองรับ GPS');
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setForm((f) => ({ ...f, lat, lng }));
        const result = await reverseGeocode(lat, lng);
        if (result) {
          setForm((f) => ({
            ...f, lat, lng,
            province: matchProvince(result.province) || f.province,
            district: result.district || f.district,
            address: result.address || f.address,
          }));
        }
        setGpsLoading(false);
      },
      () => { alert('ไม่สามารถรับ GPS ได้'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const allFiles = [...images, ...Array.from(files)].slice(0, 5);
    setImages(allFiles);
    setPreviews(allFiles.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const removeExistingImage = (i: number) => {
    setExistingImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.title.trim()) { alert('กรุณากรอกหัวข้อโพสต์'); setStep(0); return; }
    if (!isEditMode && existingImages.length === 0 && images.length === 0) {
      alert('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
      setStep(2);
      return;
    }
    setSaving(true);
    setMessage('กำลังอัปโหลดรูปภาพ...');

    try {
      const newImageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const url = await uploadToCloudinary(images[i]);
        newImageUrls.push(url);
        setUploadProgress(Math.round(((i + 1) / images.length) * 100));
      }

      const allImages = [...existingImages, ...newImageUrls];

      setMessage('กำลังบันทึกโพสต์...');

      if (isEditMode && id) {
        await updateDoc(doc(db, 'reports', id), {
          ...form,
          images: allImages,
          tags: [form.category, form.color, form.breed, form.brand, form.model].filter(Boolean),
          updatedAt: serverTimestamp(),
        });
        setMessage('✓ แก้ไขสำเร็จ! กำลังกลับไปหน้าโปรไฟล์...');
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        const docRef = await addDoc(collection(db, 'reports'), {
          userId: user.uid,
          user: { name: user.displayName || user.email || 'ผู้ใช้', avatar: user.photoURL || '' },
          type: type === 'lost' ? 'lost' : 'found',
          ...form,
          images: allImages,
          tags: [form.category, form.color, form.breed, form.brand, form.model].filter(Boolean),
          status: type === 'lost' ? 'กำลังตาม' : 'พบแล้ว',
          resolved: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          likesCount: 0, commentsCount: 0, sharesCount: 0, viewsCount: 0,
          likedBy: [],
        });
        await setDoc(doc(db, 'users', user.uid), { lastReportId: docRef.id }, { merge: true });
        setMessage('✓ บันทึกสำเร็จ! กำลังไปยังฟีด...');
        setTimeout(() => navigate('/feed'), 1500);
      }
    } catch (err) {
      console.error(err);
      setMessage('เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSaving(false);
    }
    setUploadProgress(0);
  };

  const canNext = useMemo(() => {
    if (step === 0) return form.title.trim().length > 0 && form.date;
    return true;
  }, [step, form.title, form.date]);

  const inp = 'mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition';
  const lbl = 'block text-sm font-medium text-slate-700';

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      <div className="rounded-2xl bg-white p-6 shadow-glass sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">
              {isEditMode ? 'แก้ไขโพสต์' : (type === 'lost' ? 'แจ้งของหาย' : 'แจ้งพบของ')}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {isEditMode ? 'แก้ไขโพสต์' : 'สร้างโพสต์ใหม่'}
            </h1>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => i < step && setStep(i)}
                className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-orange-500' : i < step ? 'w-2 bg-orange-300' : 'w-2 bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>ขั้นที่ {step + 1} / {STEPS.length}: <strong className="text-slate-700">{STEPS[step]}</strong></span>
          <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {step === 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-glass sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={lbl}>หัวข้อโพสต์ <span className="text-red-400">*</span></span>
              <input value={form.title} onChange={(e) => setField('title', e.target.value)} className={inp} placeholder="เช่น หมาไทยหายแถวลาดพร้าว" />
            </label>
            <label className="block">
              <span className={lbl}>หมวดหมู่ <span className="text-red-400">*</span></span>
              <select value={form.category} onChange={(e) => setField('category', e.target.value)} className={inp}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>วันที่ <span className="text-red-400">*</span></span>
              <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className={inp} />
            </label>
            <label className="block">
              <span className={lbl}>เวลา</span>
              <input type="time" value={form.time} onChange={(e) => setField('time', e.target.value)} className={inp} />
            </label>
            <label className="block">
              <span className={lbl}>สถานะด่วน</span>
              <select value={form.urgent ? 'ใช่' : 'ไม่'} onChange={(e) => setField('urgent', e.target.value === 'ใช่')} className={inp}>
                <option>ไม่</option>
                <option>ใช่</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>รายละเอียด</span>
              <textarea value={form.description} onChange={(e) => setField('description', e.target.value)}
                rows={4} className={inp} placeholder="บอกลักษณะพิเศษหรือรายละเอียดที่ช่วยระบุได้" />
            </label>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="rounded-2xl bg-white p-6 shadow-glass sm:p-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>จังหวัด <span className="text-red-400">*</span></span>
              <select value={form.province} onChange={(e) => setField('province', e.target.value)} className={inp}>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>อำเภอ / เขต</span>
              <input value={form.district} onChange={(e) => setField('district', e.target.value)} className={inp} placeholder="เช่น สวนหลวง" />
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>ที่อยู่โดยละเอียด</span>
              <input value={form.address} onChange={(e) => setField('address', e.target.value)} className={inp} placeholder="เช่น หน้าปากซอย 12" />
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input value={addressSearch} onChange={(e) => setAddressSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                className={`${inp} mt-0 pr-10`} placeholder="ค้นหาตำแหน่งบนแผนที่..." />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button type="button" onClick={handleAddressSearch} disabled={geocoding}
              className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition">
              {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} ค้นหา
            </button>
            <button type="button" onClick={handleGPS} disabled={gpsLoading}
              className="flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition">
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />} ตำแหน่งปัจจุบัน
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-4 w-4 text-orange-400" />
              คลิกบนแผนที่หรือลากหมุดเพื่อปรับตำแหน่ง
              {geocoding && <span className="flex items-center gap-1 text-orange-500"><Loader2 className="h-3 w-3 animate-spin" /> กำลังค้นหา...</span>}
            </div>
            <div className="h-[340px] overflow-hidden rounded-2xl border border-slate-200">
              <MapContainer center={[form.lat, form.lng]} zoom={14} style={{ width: '100%', height: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                <FlyToPosition lat={form.lat} lng={form.lng} />
                <Marker position={[form.lat, form.lng]} draggable
                  eventHandlers={{ dragend: async (e: any) => { const { lat, lng } = e.target.getLatLng(); await handleMapClick(lat, lng); } }} />
                <MapClickHandler onClick={handleMapClick} />
              </MapContainer>
            </div>
            <div className="mt-2 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500 border border-slate-100">
              📍 {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              {form.district && ` · ${form.district}`}{form.province && `, ${form.province}`}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="rounded-2xl bg-white p-6 shadow-glass sm:p-8 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {activeFields.color && (
              <label className="block">
                <span className={lbl}>สี</span>
                <input value={form.color} onChange={(e) => setField('color', e.target.value)} className={inp} placeholder="เช่น ดำ / ขาว-ส้ม" />
              </label>
            )}
            {activeFields.brand && (
              <label className="block">
                <span className={lbl}>ยี่ห้อ</span>
                <input value={form.brand} onChange={(e) => setField('brand', e.target.value)} className={inp} placeholder="เช่น Apple, Samsung" />
              </label>
            )}
            {activeFields.model && (
              <label className="block">
                <span className={lbl}>รุ่น</span>
                <input value={form.model} onChange={(e) => setField('model', e.target.value)} className={inp} placeholder="เช่น iPhone 15 Pro" />
              </label>
            )}
            {activeFields.breed && (
              <label className="block">
                <span className={lbl}>สายพันธุ์ / ประเภท</span>
                <input value={form.breed} onChange={(e) => setField('breed', e.target.value)} className={inp} placeholder="เช่น แมวไทย, ชิวาวา" />
              </label>
            )}
            {activeFields.size && (
              <label className="block">
                <span className={lbl}>ขนาด</span>
                <select value={form.size} onChange={(e) => setField('size', e.target.value)} className={inp}>
                  <option value="">ไม่ระบุ</option>
                  <option>เล็กมาก</option><option>เล็ก</option><option>กลาง</option><option>ใหญ่</option><option>ใหญ่มาก</option>
                </select>
              </label>
            )}
            {activeFields.reward && (
              <label className="block">
                <span className={lbl}>รางวัลนำจับ</span>
                <input value={form.reward} onChange={(e) => setField('reward', e.target.value)} className={inp} placeholder="เช่น 500 บาท" />
              </label>
            )}
          </div>

          {isEditMode && existingImages.length > 0 && (
            <div>
              <p className={`${lbl} mb-2`}>รูปภาพปัจจุบัน</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {existingImages.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                    <img src={src} className="h-full w-full object-cover" alt="" />
                    <button onClick={() => removeExistingImage(i)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl">
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">หลัก</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className={lbl}>
              {isEditMode ? 'เพิ่มรูปภาพใหม่' : `รูปภาพ (${images.length}/5) *`}
            </p>
            <div onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className={`mt-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                !isEditMode && images.length === 0
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-orange-200 bg-orange-50/50'
              }`}>
              <p className="text-sm text-slate-500">ลากรูปวางที่นี่ หรือ</p>
              <label className="mt-2 inline-block cursor-pointer rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition">
                เลือกรูปภาพ
                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              </label>
              <p className="mt-1 text-xs text-slate-400">สูงสุด 5 รูป {!isEditMode && '(จำเป็น)'}</p>
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">อัปโหลด {uploadProgress}%</p>
              </div>
            )}

            {previews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {previews.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                    <img src={src} className="h-full w-full object-cover" alt="" />
                    <button onClick={() => removeImage(i)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl">
                      <Trash2 className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-2xl bg-white p-6 shadow-glass sm:p-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className={lbl}>เบอร์โทรศัพท์</span>
              <input type="tel" value={form.contactPhone} onChange={(e) => setField('contactPhone', e.target.value)} className={inp} placeholder="0912345678" />
            </label>
            <label className="block">
              <span className={lbl}>Line ID</span>
              <input value={form.contactLine} onChange={(e) => setField('contactLine', e.target.value)} className={inp} placeholder="@lineid" />
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>Facebook</span>
              <input value={form.contactFacebook} onChange={(e) => setField('contactFacebook', e.target.value)} className={inp} placeholder="facebook.com/yourname" />
            </label>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-5 text-sm space-y-1.5">
            <p className="font-semibold text-orange-800 mb-2">📋 สรุปโพสต์</p>
            <p><span className="text-slate-400">หัวข้อ:</span> <strong>{form.title || '(ยังไม่กรอก)'}</strong></p>
            <p><span className="text-slate-400">หมวดหมู่:</span> {form.category}</p>
            <p><span className="text-slate-400">วันที่:</span> {form.date} {form.time}</p>
            <p><span className="text-slate-400">ตำแหน่ง:</span> {[form.district, form.province].filter(Boolean).join(', ') || '(ยังไม่ระบุ)'}</p>
            <p><span className="text-slate-400">รูปภาพ:</span> {existingImages.length + images.length} รูป</p>
            {form.urgent && <p className="text-red-600 font-semibold">🔴 โพสต์ด่วน</p>}
            {activeFields.brand && form.brand && <p><span className="text-slate-400">ยี่ห้อ:</span> {form.brand}</p>}
            {activeFields.model && form.model && <p><span className="text-slate-400">รุ่น:</span> {form.model}</p>}
            {activeFields.color && form.color && <p><span className="text-slate-400">สี:</span> {form.color}</p>}
            {activeFields.breed && form.breed && <p><span className="text-slate-400">สายพันธุ์:</span> {form.breed}</p>}
            {activeFields.size && form.size && <p><span className="text-slate-400">ขนาด:</span> {form.size}</p>}
            {activeFields.reward && form.reward && <p><span className="text-slate-400">รางวัล:</span> {form.reward}</p>}
          </div>

          {message && (
            <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
              {message}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              ← ย้อนกลับ
            </button>
          )}
        </div>
        <div>
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext}
              className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-40 transition">
              ถัดไป →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-7 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition">
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