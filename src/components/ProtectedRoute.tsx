import { Navigate } from 'react-router-dom';
import type { User } from 'firebase/auth';

interface ProtectedRouteProps {
  user: User | null;
  children: React.ReactNode;
}

export default function ProtectedRoute({ user, children }: ProtectedRouteProps) {
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }
  return <>{children}</>;
}
