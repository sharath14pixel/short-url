'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { Link2, LogOut, LayoutDashboard, User, LogIn, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Sync mounting to prevent server/client hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full bg-[#090a0f]/40 border-b border-white/5 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="h-6 w-6 text-indigo-400" />
            <span className="font-display font-bold text-xl tracking-tight text-white">Smart<span className="text-indigo-400">Link</span></span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-[#090a0f]/40 border-b border-white/5 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20 transition-all duration-300">
            <Link2 className="h-5 w-5 text-indigo-400 group-hover:rotate-45 transition-transform duration-300" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            Smart<span className="text-gradient-purple-cyan">Link</span>
          </span>
        </Link>

        {/* Action Buttons */}
        <nav className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              {pathname !== '/dashboard' && (
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-1.5 text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                >
                  <LayoutDashboard className="h-4 w-4 text-indigo-400" />
                  <span>Dashboard</span>
                </Link>
              )}
              
              <div className="hidden md:flex items-center space-x-1.5 px-3 py-2 text-sm text-slate-400 bg-white/5 border border-white/5 rounded-xl">
                <User className="h-4 w-4 text-cyan-400" />
                <span className="max-w-[120px] truncate text-white">{user?.name}</span>
              </div>

              <button
                onClick={logout}
                className="flex items-center space-x-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-xl border border-transparent hover:border-red-500/20 transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              {pathname !== '/login' && (
                <Link
                  href="/login"
                  className="flex items-center space-x-1.5 text-sm font-medium text-slate-300 hover:text-white px-3 py-2 transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Link>
              )}
              
              {pathname !== '/signup' && (
                <Link
                  href="/signup"
                  className="flex items-center space-x-1.5 text-sm font-medium text-white px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border border-indigo-500/30 hover:border-indigo-400/50 shadow-lg shadow-indigo-500/20 transition-all duration-300 hover:scale-[1.02]"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Get Started</span>
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
