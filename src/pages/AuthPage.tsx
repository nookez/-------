import { FormEvent, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, auth, db, doc, setDoc, serverTimestamp } from '../firebase';

interface FormState {
  username: string;
  email: string;
  password: string;
}

export default function AuthPage() {
  const { mode } = useParams<{ mode: string }>();
  const isRegister = mode === 'register';
  const [values, setValues] = useState<FormState>({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        if (credential.user) {
          await setDoc(doc(db, 'users', credential.user.uid), {
            uid: credential.user.uid,
            username: values.username,
            email: values.email,
            avatar: `https://avatars.dicebear.com/api/avataaars/${values.username || 'user'}.svg`,
            phone: '',
            createdAt: serverTimestamp(),
            reportsCount: 0,
            reunionsCount: 0,
            savedPosts: [],
          });
          navigate('/feed');
        }
      } else {
        await signInWithEmailAndPassword(auth, values.email, values.password);
        navigate('/feed');
      }
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] bg-white/95 p-8 shadow-glass sm:p-12">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-600">{isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</p>
        <h1 className="text-3xl font-bold text-slate-900">{isRegister ? 'สร้างบัญชี ช่วยตามของหาย' : 'เข้าสู่ระบบ เพื่อเริ่มโพสต์'}</h1>
        <p className="text-sm text-slate-500">ใช้ Email และรหัสผ่านเท่านั้น เพื่อความปลอดภัยของชุมชน</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {isRegister && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">ชื่อผู้ใช้งาน</span>
            <input
              value={values.username}
              onChange={(e) => setValues({ ...values, username: e.target.value })}
              placeholder="เช่น สมชาย"
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              required
            />
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">อีเมล</span>
          <input
            type="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            placeholder="email@example.com"
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">รหัสผ่าน</span>
          <input
            type="password"
            value={values.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
            placeholder="อย่างน้อย 8 ตัวอักษร"
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            minLength={8}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded-3xl bg-orange-500 px-6 py-3 text-white shadow-lg transition hover:bg-orange-600" disabled={loading}>
          {loading ? 'กำลังทำงาน...' : isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        {isRegister ? 'มีบัญชีแล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
        <Link to={isRegister ? '/auth/login' : '/auth/register'} className="font-semibold text-orange-600 hover:text-orange-700">
          {isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
        </Link>
      </p>
    </div>
  );
}
