'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { 
  Link2, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  Settings2, 
  Clock, 
  BarChart3, 
  ShieldCheck, 
  QrCode 
} from 'lucide-react';

export default function Home() {
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResult(null);
    setCopied(false);

    if (!originalUrl) {
      setError('Please provide a valid URL.');
      setIsLoading(false);
      return;
    }

    try {
      const payload: any = { original_url: originalUrl };
      if (customAlias) payload.custom_alias = customAlias;
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();

      const res = await api.post('/api/links', payload);
      setResult(res.data);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string' 
          ? detail 
          : 'Failed to create short link. Make sure the URL is valid and alias is not taken.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!result?.qr_code_base64) return;
    const link = document.createElement('a');
    link.href = result.qr_code_base64;
    link.download = `qr-code-${result.short_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center justify-start px-4 py-16 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative z-10">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mb-12">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold tracking-wide text-indigo-300 uppercase mb-4 animate-pulse">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Next Generation Link Optimizer</span>
        </div>
        
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-white mb-6 leading-tight">
          Shorten. Brand. <br className="sm:hidden" />
          <span className="text-gradient-purple-cyan">Track in Real-Time</span>
        </h1>
        
        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Create highly optimized, branded short URLs with custom aliases. Scan, share, and track audience analytics in an elegant, glassmorphic cockpit.
        </p>
      </div>

      {/* Shortener Card */}
      <div className="w-full max-w-2xl glass-panel rounded-3xl p-6 sm:p-8 mb-16 shadow-2xl border border-white/5 relative overflow-hidden">
        {/* Subtle decorative glow internally */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events:none" />
        
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-grow w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Link2 className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="url"
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                placeholder="Paste your long destination URL..."
                required
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl glass-input text-sm"
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:scale-100 active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <div className="loader mr-1" />
                  <span>Shortening...</span>
                </>
              ) : (
                <span>Shorten URL</span>
              )}
            </button>
          </div>

          {/* Toggle Advanced Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-all"
            >
              <Settings2 className={`h-4 w-4 transform transition-transform duration-300 ${showOptions ? 'rotate-90' : ''}`} />
              <span>Advanced Customizations (Alias / Expiry)</span>
            </button>

            {showOptions && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 rounded-2xl bg-white/2 border border-white/5 animate-fadeIn">
                {/* Custom Alias */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Custom Alias (Optional)</label>
                  <input
                    type="text"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                    placeholder="e.g. portfolio"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Link Expiry Date (Optional)</label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 leading-relaxed">
              {error}
            </div>
          )}
        </form>

        {/* Result Panel */}
        {result && (
          <div className="mt-8 pt-6 border-t border-white/5 animate-slideDown">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Your Short Link</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-6 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20">
              {/* QR Code */}
              {result.qr_code_base64 && (
                <div className="flex flex-col items-center space-y-2 flex-shrink-0 bg-white/5 p-3 rounded-2xl border border-white/5">
                  <img
                    src={result.qr_code_base64}
                    alt="QR Code"
                    className="w-24 h-24 rounded-lg bg-white p-1"
                  />
                  <button
                    onClick={handleDownloadQr}
                    className="flex items-center space-x-1 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download QR</span>
                  </button>
                </div>
              )}

              {/* Link Details */}
              <div className="flex-grow w-full space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Destination</span>
                  <p className="text-xs text-slate-400 truncate max-w-[320px]">{result.original_url}</p>
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                  <span className="text-sm font-semibold text-white truncate max-w-[240px] sm:max-w-[280px]">
                    {result.short_url}
                  </span>
                  
                  <div className="flex items-center space-x-1.5 flex-shrink-0">
                    <button
                      onClick={handleCopy}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                      title="Copy Link"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                    
                    <a
                      href={result.short_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                      title="Visit Link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:bg-white/5 transition-all">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 w-fit mb-4">
            <Clock className="h-5 w-5 text-indigo-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-2">Temporary Expirations</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure links to automatically deactivate at a target date and time. Ideal for limited-time offers and marketing campaigns.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:bg-white/5 transition-all">
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 w-fit mb-4">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-2">Granular Analytics</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Record every visitor click with user-agent, device, operating system, and country metrics resolved automatically from IP addresses.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/5 hover:bg-white/5 transition-all">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 w-fit mb-4">
            <ShieldCheck className="h-5 w-5 text-purple-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-2">Built-in SSRF Safety</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Restricted link filters automatically block Server-Side Request Forgery and malicious local network IP resolutions.
          </p>
        </div>
      </div>
    </div>
  );
}
