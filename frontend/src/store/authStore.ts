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
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe extraction on client side
  const getInitialState = () => {
    if (typeof window === 'undefined') {
      return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
    }
    try {
      const user = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      return {
        user: user ? JSON.parse(user) : null,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        isAuthenticated: !!accessToken,
      };
    } catch {
      return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
    }
  };

  return {
    ...getInitialState(),
    setAuth: (user, accessToken, refreshToken) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
      }
      set({ user, accessToken, refreshToken, isAuthenticated: true });
    },
    setAccessToken: (accessToken) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', accessToken);
      }
      set({ accessToken, isAuthenticated: true });
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
    },
  };
});
