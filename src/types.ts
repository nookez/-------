// ─── Report Types ─────────────────────────────────────────────
export type ReportType = 'lost' | 'found';
export type ReportStatus = 'active' | 'resolved' | 'closed';
export type PetGender = 'ผู้' | 'เมีย' | 'ไม่ทราบ';
export type CollarStatus = 'มี' | 'ไม่มี' | 'ไม่ทราบ';
export type SterilizedStatus = 'ใช่' | 'ไม่' | 'ไม่ทราบ';
export type CompensationType = 'เงินสด' | 'โอนพร้อมเพย์' | 'ของรางวัล' | 'ไม่มี';

export interface Report {
  id: string;
  type: ReportType;
  category: string;
  title: string;
  description: string;
  images: string[];
  
  // Location
  province: string;
  district?: string;
  address?: string;
  lat: number;
  lng: number;
  
  // Date & Time
  date: string;          // YYYY-MM-DD
  time?: string;         // HH:mm
  
  // Pet Details
  color?: string;
  brand?: string;
  model?: string;
  breed?: string;
  size?: string;
  gender?: PetGender;
  age?: string;
  hasCollar?: CollarStatus;
  collarDetail?: string;
  sterilized?: SterilizedStatus;
  microchip?: string;
  note?: string;
  
  // Tags & Metadata
  tags: string[];
  reward?: string;
  urgent: boolean;
  
  // ✅ Status - ใช้ union type ชัดเจน
  status: ReportStatus;  // 'active' | 'resolved' | 'closed'
  
  // Contact
  contactPhone?: string;
  contactFacebook?: string;
  contactLine?: string;
  
  // Timestamps
  createdAt: string;     // ISO string
  updatedAt?: string;    // ISO string
  
  // Counts (denormalized for performance)
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  
  // User info (denormalized)
  user: {
    name: string;
    avatar: string;
  };
  
  // Compensation
  compensationAmount?: number;
  compensationType?: CompensationType;
  
  // Arrays for features
  likedBy?: string[];    // Array of userIds who liked
}

// ─── Comment Types ────────────────────────────────────────────
export interface Comment {
  id: string;
  reportId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;     // ISO string
  updatedAt?: string;    // ISO string
  parentId?: string;     // For replies
  likesCount?: number;
}

// ─── User Profile Types ───────────────────────────────────────
export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatar: string;
  phone?: string;
  createdAt: string;
  reportsCount: number;
  reunionsCount: number;   // Number of successful reunions
  savedPosts: string[];    // Array of saved report IDs
  bio?: string;
  location?: string;
}

// ─── Auth Types ───────────────────────────────────────────────
export interface AuthState {
  user: import('firebase/auth').User | null;
  loading: boolean;
  error: string | null;
}

// ─── Form Types ───────────────────────────────────────────────
export interface ReportFormData {
  type: ReportType;
  category: string;
  title: string;
  description: string;
  province: string;
  district?: string;
  address?: string;
  lat: number;
  lng: number;
  date: string;
  time?: string;
  images: File[];
  
  // Pet details
  petType?: string;
  breed?: string;
  color?: string;
  gender?: PetGender;
  size?: string;
  age?: string;
  hasCollar?: CollarStatus;
  collarDetail?: string;
  sterilized?: SterilizedStatus;
  microchip?: string;
  note?: string;
  
  // Compensation
  compensationAmount?: string;
  compensationType?: CompensationType;
  
  // Contact
  contactPhone?: string;
  contactLine?: string;
  contactFacebook?: string;
  
  // Options
  urgent: boolean;
}