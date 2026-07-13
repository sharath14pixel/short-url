import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe extraction on client side
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return { user: null, accessToken: null, isAuthenticated: false };
    }
    try {
      const user = localStorage.getItem('user');
      // accessToken is kept in memory only; we start as authenticated if we have a user
      // and let the API interceptor silently refresh the access token on the first request
      return {
        user: user ? JSON.parse(user) : null,
        accessToken: null,
        isAuthenticated: !!user,
      };
    } catch {
      return { user: null, accessToken: null, isAuthenticated: false };
    }
  };

  return {
    ...getInitialState(),
    setAuth: (user, accessToken) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
      }
      set({ user, accessToken, isAuthenticated: true });
    },
    setAccessToken: (accessToken) => {
      set({ accessToken, isAuthenticated: true });
    },
    logout: () => {
      try {
        const API_BASE_URL = typeof window !== 'undefined'
          ? (window as any).env?.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
          : 'http://localhost:8000';
        fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        }).catch((err) => console.error('Logout API call failed:', err));
      } catch (e) {
        // ignore
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
      set({ user: null, accessToken: null, isAuthenticated: false });
    },
  };
});
