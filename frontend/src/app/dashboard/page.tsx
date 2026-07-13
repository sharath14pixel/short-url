'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../lib/api';
import { 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  BarChart3, 
  Search, 
  Calendar, 
  X, 
  Link2,
  Lock,
  Download,
  AlertCircle,
  Eye
} from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();

  const [links, setLinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // General States
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const fetchLinks = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/api/links');
      setLinks(res.data);
    } catch (err: any) {
      setError('Failed to load links. Please try logging in again.');
      if (err.response?.status === 401) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchLinks();
    }
  }, [isAuthenticated]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setModalError('');

    if (!originalUrl) {
      setModalError('Original URL is required.');
      setIsCreating(false);
      return;
    }

    try {
      const payload: any = { original_url: originalUrl };
      if (customAlias) payload.custom_alias = customAlias;
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString();
      if (password) payload.password = password;

      await api.post('/api/links', payload);
      
      // Reset Modal & Fetch
      setOriginalUrl('');
      setCustomAlias('');
      setExpiresAt('');
      setPassword('');
      setIsModalOpen(false);
      fetchLinks();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setModalError(
        typeof detail === 'string'
          ? detail
          : 'Failed to create link. Verify long URL format or alias uniqueness.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await api.put(`/api/links/${id}`, {
        is_active: !currentStatus,
      });
      // Update local state list
      setLinks(links.map((link) => (link.id === id ? { ...link, is_active: res.data.is_active } : link)));
    } catch (err) {
      // Ignore or log toggle failure
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm('Are you sure you want to delete this link permanently? All click history will be erased.')) return;
    try {
      await api.delete(`/api/links/${id}`);
      setLinks(links.filter((link) => link.id !== id));
    } catch (err) {
      alert('Failed to delete the link. Please try again.');
    }
  };

  const handleCopyLink = (id: string, shortUrl: string) => {
    navigator.clipboard.writeText(shortUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadQr = (qrBase64: string, shortCode: string) => {
    if (!qrBase64) return;
    const link = document.createElement('a');
    link.href = qrBase64;
    link.download = `qr-code-${shortCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter links
  const filteredLinks = links.filter(
    (link) =>
      link.original_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.short_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (link.custom_alias && link.custom_alias.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full relative z-10">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">Your Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Manage, analyze, and optimize your active shortcuts.</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs tracking-wider transition-all duration-300 shadow-lg shadow-indigo-500/20 hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" />
          <span>CREATE LINK</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls & Search */}
      <div className="flex items-center w-full max-w-md relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by custom alias, code, or target URL..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
        />
      </div>

      {/* Main List Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="loader mb-4" />
          <p className="text-xs text-slate-400">Loading your optimized links...</p>
        </div>
      ) : filteredLinks.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center border border-white/5 shadow-2xl flex flex-col items-center">
          <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 w-fit mb-4">
            <Link2 className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="font-display font-bold text-lg text-white mb-2">No links found</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            {searchQuery 
              ? 'No links match your current search criteria. Try a different query.' 
              : 'You haven\'t shortened any URLs under this account yet. Click create above to start.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 font-semibold text-xs tracking-wider transition-all"
            >
              Shorten your first link
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {/* Card for each link */}
          {filteredLinks.map((link) => (
            <div 
              key={link.id} 
              className="glass-panel glass-panel-hover rounded-2xl p-5 border border-white/5 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              {/* Left Column: Link Metadata */}
              <div className="space-y-3 flex-grow min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white truncate max-w-[260px] sm:max-w-xs md:max-w-md">
                    {link.short_url}
                  </span>
                  
                  {link.custom_alias && (
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-semibold text-purple-300">
                      Alias
                    </span>
                  )}

                  {link.expires_at && new Date(link.expires_at) < new Date() && (
                    <span className="px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-semibold text-red-400">
                      Expired
                    </span>
                  )}

                  {link.is_password_protected && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[9px] font-semibold text-amber-300 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Protected
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wide">Destination URL</span>
                  <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md lg:max-w-xl">
                    {link.original_url}
                  </p>
                </div>

                {/* Subdetails row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-slate-400">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-500" />
                    <span>Created: {new Date(link.created_at).toLocaleDateString()}</span>
                  </div>

                  {link.expires_at && (
                    <div className="flex items-center space-x-1">
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <span>Expires: {new Date(link.expires_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Column: Click Statistics badge */}
              <div className="flex items-center space-x-3 bg-white/3 border border-white/5 px-4 py-2.5 rounded-xl flex-shrink-0">
                <BarChart3 className="h-4.5 w-4.5 text-cyan-400" />
                <div className="text-left">
                  <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Clicks</span>
                  <span className="text-sm font-extrabold text-white">{link.click_count}</span>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center justify-end gap-2 w-full md:w-auto flex-shrink-0 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                {/* Active Toggle Switch */}
                <button
                  onClick={() => handleToggleActive(link.id, link.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    link.is_active ? 'bg-indigo-600' : 'bg-slate-800 border border-white/5'
                  }`}
                  title={link.is_active ? 'Deactivate Link' : 'Activate Link'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      link.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>

                {/* Copy */}
                <button
                  onClick={() => handleCopyLink(link.id, link.short_url)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                  title="Copy Short URL"
                >
                  {copiedId === link.id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>

                {/* Download QR */}
                {link.qr_code_base64 && (
                  <button
                    onClick={() => handleDownloadQr(link.qr_code_base64, link.short_code)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                    title="Download QR Code"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}

                {/* Open */}
                <a
                  href={link.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                  title="Visit Short Link"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>

                {/* Analytics Detail Page */}
                <Link
                  href={`/dashboard/links/${link.id}`}
                  className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex items-center justify-center"
                  title="View Analytics Portal"
                >
                  <Eye className="h-4 w-4" />
                </Link>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all"
                  title="Delete Shortcut"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Link Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <h3 className="font-display font-extrabold text-xl text-white">Create New Short Code</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateLink} className="space-y-4">
              {/* Destination URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Original Destination URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Link2 className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="https://example.com/very/long/target/path"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Custom Alias */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Custom Alias (Optional)</label>
                  <input
                    type="text"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                    placeholder="e.g. signup"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">Link Expiry Date (Optional)</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Password Protection */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Password Protection (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4.5 w-4.5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to restrict access"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Modal Error */}
              {modalError && (
                <div className="flex items-start space-x-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs tracking-wider transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20"
                >
                  {isCreating ? (
                    <>
                      <div className="loader mr-1" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>CREATE LINK</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
