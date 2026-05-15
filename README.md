# ช่วยกันหา

เว็บแอปชุมชนไทยสำหรับแจ้งของหาย และของที่พบ

## เทคโนโลยี

- React.js + TypeScript
- Tailwind CSS
- Framer Motion
- React Router
- Firebase Authentication, Firestore, Storage
- Google Maps API

## เริ่มต้น

1. คัดลอก `.env.example` เป็น `.env`
2. ใส่ค่า Firebase และ Google Maps API key ของคุณ
3. ติดตั้ง dependencies:

```bash
npm install
```

4. เรียกใช้งาน

```bash
npm run dev
```

5. เปิดเบราว์เซอร์ที่ `http://localhost:4173`

> หมายเหตุ: สำหรับ Firebase ให้ใช้ค่า Web SDK จาก Project settings ใน Firebase console
> และเก็บ `service account` JSON เฉพาะใน Server/Admin เท่านั้น ไม่ควรฝังในโค้ดหน้าเว็บ
>
> ตรวจสอบด้วยว่า Authentication > Sign-in method ใน Firebase console เปิดใช้งาน Email/Password แล้ว

## เส้นทางหลัก

- `/` หน้า Landing
- `/feed` ฟีด
- `/auth/login` เข้าสู่ระบบ
- `/auth/register` สมัครสมาชิก
- `/report/lost` แจ้งของหาย
- `/report/found` แจ้งพบของ
- `/profile` โปรไฟล์
- `/detail/:id` รายละเอียดโพสต์
