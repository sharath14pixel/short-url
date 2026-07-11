'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { AlertCircle, Link2, HelpCircle } from 'lucide-react';

export default function RedirectHandler({ params }: { params: Promise<{ shortCode: string }> }) {
  const resolvedParams = use(params);
  const shortCode = resolvedParams.shortCode;
  
  const [status, setStatus] = useState<'loading' | 'error' | 'not_found' | 'expired'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

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

        // 404 or 410 status codes returned from backend
        if (response.status === 404) {
          setStatus('not_found');
          setErrorMessage('This short link does not exist. Verify the URL or contact the owner.');
        } else if (response.status === 410) {
          setStatus('expired');
          setErrorMessage('This link has expired or has been deactivated by the owner.');
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

  return (
    <div className="flex flex-col items-center justify-center flex-grow px-4 py-16 sm:px-6 relative z-10">
      <div className="w-full max-w-md glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 w-fit mb-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>

        <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
          {status === 'not_found' ? 'Link Not Found' : 'Link Deactivated'}
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
