// ─── src/data.ts ─────────────────────────────────────────────
import type { Report } from './types';

export const categories = [
  { label: 'สุนัข', value: 'สุนัข', icon: 'paw' },
  { label: 'แมว', value: 'แมว', icon: 'paw' },
  { label: 'นก', value: 'นก', icon: 'feather' },
  { label: 'กระต่าย', value: 'กระต่าย', icon: 'paw' },
  { label: 'สัตว์อื่นๆ', value: 'สัตว์อื่นๆ', icon: 'more-horizontal' },
];

export const faqs = [
  {
    question: 'ฉันจะแจ้งสัตว์หายได้อย่างไร?',
    answer: 'กดปุ่ม "สัตว์ของฉันหาย" แล้วกรอกข้อมูลให้ครบถ้วนพร้อมรูปภาพเพื่อเพิ่มโอกาสตามหาน้องเจอเร็วขึ้น',
  },
  {
    question: 'ต้องลงทะเบียนก่อนใช้งานหรือไม่?',
    answer: 'ใช่ ระบบต้องใช้บัญชีเพื่อจัดการโพสต์ บันทึก และติดตามสถานะได้อย่างปลอดภัย',
  },
  {
    question: 'ถ้าพบสัตว์แล้วจะติดต่อเจ้าของยังไง?',
    answer: 'ดูข้อมูลติดต่อในโพสต์ แล้วกดปุ่ม "ติดต่อเจ้าของ" เพื่อติดต่อผู้แจ้งได้ทันที',
  },
];

export const popularTags = ['ด่วน', 'สุนัข', 'แมว', 'นก', 'กระต่าย', 'ใกล้ฉัน'];

// ✅ แก้ไข: ใช้ค่าที่ตรงกับ Report interface ใน types.ts
export const sampleReports: Report[] = [
  {
    id: 'r1',
    type: 'lost',
    category: 'สัตว์เลี้ยง',  // ✅ ต้องเป็น 'สัตว์เลี้ยง' เพื่อผ่านฟิลเตอร์ในแผนที่
    title: 'แมวหายจากหมู่บ้านเชียงใหม่',
    description: 'แมวสีส้มอ้วน ขนยาว ใส่ปลอกคอสีฟ้า หายออกจากบ้านช่วงเย็น',
    images: ['https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80'],
    
    // Location
    province: 'เชียงใหม่',
    district: 'เมือง',
    address: 'หมู่บ้านสวนดอก',
    lat: 18.7877,
    lng: 98.9931,
    
    // Date & Time
    date: '2026-05-12',
    time: '18:30',
    
    // Pet Details
    color: 'ส้ม',
    brand: '',
    model: '',
    breed: 'แมวไทย',
    size: 'กลาง',
    gender: 'ไม่ทราบ',
    age: '2 ปี',
    hasCollar: 'มี',
    collarDetail: 'ปลอกคอสีฟ้า',
    sterilized: 'ไม่ทราบ',
    microchip: '',
    note: 'ชอบกินขนมแมวเลีย',
    
    // Metadata
    tags: ['ด่วน', 'แมว'],
    reward: '500 บาท',
    urgent: true,
    
    // ✅ Status - ใช้ค่าที่ตรงกับ union type
    status: 'active',  // 'active' | 'resolved' | 'closed'
    
    // Contact
    contactPhone: '0987654321',
    contactFacebook: 'เฟซบุ๊กแมวหาย',
    contactLine: 'catlover',
    
    // Timestamps
    createdAt: '2026-05-12T18:30:00.000Z',
    updatedAt: '2026-05-12T18:30:00.000Z',
    
    // Counts
    likesCount: 72,
    commentsCount: 18,
    sharesCount: 4,
    viewsCount: 1180,
    likedBy: [],
    
    // Compensation
    compensationAmount: 500,
    compensationType: 'เงินสด',
    
    // User
    user: {
      name: 'ปุ๊กกี้',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    },
  },
  {
    id: 'r2',
    type: 'found',
    category: 'สัตว์เลี้ยง',  // ✅ ต้องเป็น 'สัตว์เลี้ยง' เพื่อผ่านฟิลเตอร์ในแผนที่
    title: 'พบสุนัขสีขาวไม่มีปลอกคอ แถวลาดพร้าว',
    description: 'เจอสุนัขพันธุ์ผสมสีขาว-น้ำตาล ตัวเล็ก แวะเวียนอยู่หน้าร้านสะดวกซื้อ ดูเหมือนหลงทาง',
    images: ['https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80'],
    
    // Location
    province: 'กรุงเทพมหานคร',
    district: 'ลาดพร้าว',
    address: 'ซอยลาดพร้าว 41',
    lat: 13.8100,
    lng: 100.5800,
    
    // Date & Time
    date: '2026-05-14',
    time: '09:20',
    
    // Pet Details
    color: 'ขาว-น้ำตาล',
    brand: '',
    model: '',
    breed: 'พันธุ์ผสม',
    size: 'เล็ก',
    gender: 'ไม่ทราบ',
    age: 'ไม่ทราบ',
    hasCollar: 'ไม่มี',
    collarDetail: '',
    sterilized: 'ไม่ทราบ',
    microchip: '',
    note: 'เป็นมิตร ชอบคนลูบ',
    
    // Metadata
    tags: ['สุนัข', 'ไม่มีปลอกคอ'],
    reward: '',
    urgent: false,
    
    // ✅ Status - ใช้ค่าที่ตรงกับ union type
    status: 'resolved',  // 'active' | 'resolved' | 'closed'
    
    // Contact
    contactPhone: '0812345678',
    contactFacebook: 'เจอน้องหมา',
    contactLine: 'founddogbkk',
    
    // Timestamps
    createdAt: '2026-05-14T09:20:00.000Z',
    updatedAt: '2026-05-14T09:20:00.000Z',
    
    // Counts
    likesCount: 45,
    commentsCount: 10,
    sharesCount: 1,
    viewsCount: 920,
    likedBy: [],
    
    // Compensation
    compensationAmount: 0,
    compensationType: 'ไม่มี',
    
    // User
    user: {
      name: 'นัท',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    },
  },
];