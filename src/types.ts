export type ReportType = 'lost' | 'found';

export interface Report {
  id: string;
  type: ReportType;
  category: string;
  title: string;
  description: string;
  images: string[];
  province: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  date: string;
  time: string;
  color: string;
  brand: string;
  model: string;
  breed: string;
  size: string;
  tags: string[];
  reward: string;
  urgent: boolean;
  status: string;
  contactPhone: string;
  contactFacebook: string;
  contactLine: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  user: {
    name: string;
    avatar: string;
  };
}
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
}
export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  avatar: string;
  phone?: string;
  createdAt: string;
  reportsCount: number;
  reunionsCount: number;
  savedPosts: string[];
}
