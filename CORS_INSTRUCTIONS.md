## วิธีแก้ CORS Error บน Firebase Storage

### สรุปสั้นๆ
ไฟล์ `cors.json` ถูกเพิ่ม/อัปเดตแล้วที่ root ของโปรเจกต์ (ช่วยกัน/cors.json) โดยมีนโยบาย 2 รายการ: หนึ่งสำหรับ dev (localhost) และหนึ่งสำหรับโดเมนที่โฮสต์บน Firebase (.web.app / .firebaseapp.com)

### ถัดไปที่ต้องทำ (บนเครื่องของคุณ)
1. ติดตั้ง Google Cloud SDK (ถ้ายังไม่มี):
```bash
# macOS
brew install google-cloud-sdk

# หลังติดตั้ง
gcloud init
```

2. เข้าสู่ระบบและตั้ง project:
```bash
gcloud auth login
gcloud config set project find-b3bfe
```

3. หาชื่อ bucket ที่ถูกต้องจาก `src/firebase.ts` (ค่าของ `storageBucket`) หรือจาก Firebase Console → Storage.

4. ตั้งค่า CORS (ใช้ `gcloud storage` กับไฟล์ YAML — ตัวอย่างใช้ bucket `find-b3bfe.firebasestorage.app`):
```bash
# ตรวจสอบรายการ bucket
gcloud storage buckets list

# ถ้าพบ bucket ชื่อ gs://find-b3bfe.firebasestorage.app ให้รันคำสั่งนี้ (ใช้ไฟล์ cors.yaml)
gcloud storage buckets update gs://find-b3bfe.firebasestorage.app --cors-file=cors.yaml
```

5. ตรวจสอบการตั้งค่า:
```bash
gcloud storage buckets describe gs://find-b3bfe.firebasestorage.app --format=json | grep -A 50 cors
```

6. ถ้ามี Error ให้ล้างและตั้งค่าใหม่:
```bash
gcloud storage buckets update gs://find-b3bfe.firebasestorage.app --clear-cors
gcloud storage buckets update gs://find-b3bfe.firebasestorage.app --cors-file=cors.yaml
```

6. ล้าง cache ของ dev server / เบราว์เซอร์ แล้วทดสอบใหม่
```bash
rm -rf node_modules/.vite
# ในเบราว์เซอร์: Hard reload (Cmd/Ctrl+Shift+R)
```

### หมายเหตุ
- ถ้าเจอ `BucketNotFoundException` ให้เช็คว่าใช้ชื่อ bucket ถูกต้อง (มักจะเป็น `<project-id>.appspot.com` หรือค่าที่ปรากฎใน `src/firebase.ts`).
- ต้องมีสิทธิ์ที่เหมาะสม (Firebase/GCP project owner/editor) เพื่อเปลี่ยน CORS.
- ถ้าคุณต้องการ ผมช่วยตรวจดู `src/firebase.ts` เพื่อบอกค่าของ `storageBucket` ให้ (ผมสามารถอ่านไฟล์แล้วบอกค่าให้คุณคัดลอกใช้ได้).