import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { Send, Trash2, Loader2, MessageCircle, User, AlertCircle } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function formatTimeAgo(dateValue: Timestamp | string | null | undefined): string {
  if (!dateValue) return '—';
  
  try {
    // แปลง Firestore Timestamp หรือ String เป็น Date Object
    const date = dateValue instanceof Timestamp 
      ? dateValue.toDate() 
      : new Date(dateValue);
    
    if (isNaN(date.getTime())) return '—';
    
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'เมื่อกี้';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    
    return date.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

// ─── Component Props ───────────────────────────────────────────────────────
interface CommentsSectionProps {
  reportId: string;
  user: FirebaseUser | null;
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function CommentsSection({ reportId, user }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Real-time Listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!reportId) return;
    
    setLoading(true);
    setError(null);
    
    const q = query(
      collection(db, 'reports', reportId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const docData = d.data();
          return {
            id: d.id,
            userId: docData.userId ?? '',
            userName: docData.userName ?? 'ผู้ใช้ไม่ระบุชื่อ',
            userAvatar: docData.userAvatar ?? '',
            text: docData.text ?? '',
            // แปลง Timestamp เป็น ISO String เพื่อให้ UI ใช้งานง่าย
            createdAt: docData.createdAt instanceof Timestamp 
              ? docData.createdAt.toDate().toISOString() 
              : (docData.createdAt ?? null),
          } as Comment;
        });
        setComments(data);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load comments:', err);
        setError('ไม่สามารถโหลดความคิดเห็นได้');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [reportId]);

  // ── Submit Comment ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedComment = newComment.trim();
    if (!user || !trimmedComment || submitting) return;

    setSubmitting(true);
    setError(null);
    
    try {
      // ใช้ Timestamp.now() ตรงกับ Firestore Rule และป้องกัน Type Mismatch
      await addDoc(collection(db, 'reports', reportId, 'comments'), {
        userId: user.uid,
        userName: user.displayName ?? 'ผู้ใช้ไม่ระบุชื่อ',
        userAvatar: user.photoURL ?? '',
        text: trimmedComment,
        createdAt: Timestamp.now(),
      });
      setNewComment('');
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to add comment:', err);
      setError('ไม่สามารถส่งความคิดเห็นได้ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }, [user, newComment, submitting, reportId]);

  // ── Delete Comment ──────────────────────────────────────────────────────
  const handleDelete = useCallback(async (commentId: string) => {
    if (!confirm('ต้องการลบความคิดเห็นนี้หรือไม่?')) return;
    
    try {
      await deleteDoc(doc(db, 'reports', reportId, 'comments', commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError('ไม่สามารถลบความคิดเห็นได้');
    }
  }, [reportId]);

  // ── Auto-resize Textarea ────────────────────────────────────────────────
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [newComment]);

  // ── UI: Error State ─────────────────────────────────────────────────────
  if (error && comments.length === 0 && !loading) {
    return (
      <section className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-red-500 mb-2">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">เกิดข้อผิดพลาด</span>
        </div>
        <p className="text-sm text-slate-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-700 transition"
        >
          ลองใหม่อีกครั้ง →
        </button>
      </section>
    );
  }

  // ── UI: Main Render ─────────────────────────────────────────────────────
  return (
    <section className="rounded-2xl bg-white border border-slate-200 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        ความคิดเห็น ({comments.length})
      </h2>

      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={user ? 'แสดงความคิดเห็น...' : 'เข้าสู่ระบบเพื่อแสดงความคิดเห็น'}
            disabled={!user || submitting}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none resize-none transition disabled:opacity-60"
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{newComment.length}/500</span>
            {user && (
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition"
                aria-label="ส่งความคิดเห็น"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>กำลังโหลดความคิดเห็น...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <MessageCircle className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">ยังไม่มีความคิดเห็น</p>
          {!user && (
            <a 
              href="/auth/login" 
              className="mt-3 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors"
            >
              เข้าสู่ระบบเพื่อแสดงความคิดเห็น →
            </a>
          )}
        </div>
      ) : (
        <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          {comments.map((c) => (
            <li 
              key={c.id} 
              className="group flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {/* Avatar */}
              <div className="shrink-0 h-8 w-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                {c.userAvatar ? (
                  <img 
                    src={c.userAvatar} 
                    alt={c.userName} 
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <User className={`h-4 w-4 text-slate-400 ${c.userAvatar ? 'hidden' : ''}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {c.userName}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatTimeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {c.text}
                </p>
              </div>

              {/* Delete Button (Owner Only) */}
              {user && c.userId === user.uid && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  aria-label="ลบความคิดเห็น"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Login Prompt for Non-users */}
      {!user && comments.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500">เข้าสู่ระบบเพื่อแสดงความคิดเห็น</p>
          <a 
            href="/auth/login" 
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
          >
            เข้าสู่ระบบ →
          </a>
        </div>
      )}
    </section>
  );
}