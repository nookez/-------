import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    open: true, // เปิดเบราว์เซอร์อัตโนมัติเมื่อรัน dev
  },
  build: {
    // ✅ 1. เปิดใช้ Minify แบบ Terser (บีบอัดโค้ดได้ดีกว่า default)
    minify: 'terser',
    
    // ✅ 2. แยก Chunk ไฟล์ใหญ่ๆ ออกเป็นกลุ่ม (Code Splitting)
    // ช่วยโหลดหน้าแรกเร็วขึ้น เพราะไม่ต้องโหลด Firebase/Leaflet ทันทีถ้ายังไม่เข้าหน้านั้น
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          leaflet: ['leaflet', 'react-leaflet'],
          framer: ['framer-motion'],
          lucide: ['lucide-react'],
        },
      },
    },
    
    // ✅ 3. เพิ่มขนาด Warning Limit เพื่อไม่ให้เตือนเรื่องไฟล์ใหญ่เกิน (เราจัดการแยก chunk แล้ว)
    chunkSizeWarningLimit: 1000,
    
    // ✅ 4. สร้าง Source Map สำหรับ Production (ปิดได้ถ้าต้องการไฟล์เล็กสุด แต่เปิดไว้ดีต่อการ debug)
    sourcemap: false, 
  },
});