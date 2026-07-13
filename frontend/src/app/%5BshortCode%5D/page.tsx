'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Link2, HelpCircle, Lock, Unlock, Eye, EyeOff } from 'lucide-react';

export default function RedirectHandler({ params }: { params: Promise<{ shortCode: string }> }) {
  const resolvedParams = use(params);
  const shortCode = resolvedParams.shortCode;
  
  const [status, setStatus] = useState<'loading' | 'error' | 'not_found' | 'expired' | 'password_required'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Password prompt state
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!shortCode) return;

    const performRedirect = async () => {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const redirectUrl = `${apiBaseUrl}/${shortCode}`;

      try {
        // Fetch with 'manual' redirect handling to inspect response status before redirecting
        const response = await fetch(redirectUrl, {
          method: 'GET',
          redirect: 'manual',
        });

        // inspect status codes returned from backend
        if (response.status === 404) {
          setStatus('not_found');
          setErrorMessage('This short link does not exist. Verify the URL or contact the owner.');
        } else if (response.status === 410) {
          setStatus('expired');
          setErrorMessage('This link has expired or has been deactivated by the owner.');
        } else if (response.status === 401) {
          try {
            const data = await response.json();
            if (data.detail === 'password_required') {
              setStatus('password_required');
            } else {
              setStatus('error');
              setErrorMessage(data.detail || 'Access denied.');
            }
          } catch {
            setStatus('password_required'); // Fallback to prompt
          }
        } else {
          // If response is successful or a redirect (0, 200, 302), forward the user
          window.location.replace(redirectUrl);
        }
      } catch (error) {
        // Network errors or fallback redirect directly
        window.location.replace(redirectUrl);
      }
    };

    performRedirect();
  }, [shortCode]);

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setPasswordError('Password is required.');
      return;
    }

    setPasswordError('');
    setIsVerifying(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBaseUrl}/${shortCode}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to the resolved original destination URL
        window.location.replace(data.destination_url);
      } else {
        const errorData = await response.json();
        setPasswordError(errorData.detail || 'Incorrect password. Access denied.');
      }
    } catch (err) {
      setPasswordError('Network error. Failed to verify password.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center flex-grow py-24 relative z-10">
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center border border-white/5 flex flex-col items-center">
          <div className="loader mb-6" />
          <h2 className="font-display font-bold text-lg text-white">Resolving Shortcut...</h2>
          <p className="text-xs text-slate-400 mt-2">Connecting to SmartLink secure analytics engine.</p>
        </div>
      </div>
    );
  }

  if (status === 'password_required') {
    return (
      <div className="flex flex-col items-center justify-center flex-grow px-4 py-16 sm:px-6 relative z-10">
        <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
          {/* Glow accent */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 w-fit mb-6">
            <Lock className="h-8 w-8 text-amber-400 animate-pulse" />
          </div>

          <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
            Password Protected Link
          </h2>
          
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            This link is secure. Enter the password to unlock and proceed to the destination.
          </p>

          <form onSubmit={handleVerifyPassword} className="mt-8 space-y-4 w-full text-left">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Enter Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-xs pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="flex items-center space-x-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="flex items-center justify-center space-x-1.5 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-semibold text-xs tracking-wider transition-all duration-300 shadow-lg shadow-amber-500/20"
            >
              {isVerifying ? (
                <>
                  <div className="loader mr-1.5" />
                  <span>UNLOCKING...</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>UNLOCK & REDIRECT</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/5 pt-4 w-full">
            <Link
              href="/login"
              className="text-[10px] text-slate-400 hover:text-white transition-colors"
            >
              Are you the owner? Go to Cockpit Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-grow px-4 py-16 sm:px-6 relative z-10">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 w-fit mb-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>

        <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
          {status === 'not_found' ? 'Link Not Found' : 'Link Deactivated / Expired'}
        </h2>
        
        <p className="text-xs text-slate-400 mt-3 leading-relaxed">
          {errorMessage}
        </p>

        <div className="mt-8 space-y-3 w-full">
          <Link
            href="/"
            className="flex items-center justify-center space-x-1.5 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs tracking-wider transition-all duration-300 shadow-lg shadow-indigo-500/20"
          >
            <Link2 className="h-4 w-4" />
            <span>CREATE YOUR OWN LINK</span>
          </Link>
          
          <Link
            href="/login"
            className="flex items-center justify-center space-x-1.5 w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
          >
            <HelpCircle className="h-4 w-4" />
            <span>GO TO COCKPIT LOGIN</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
