'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../../store/authStore';
import { api } from '../../../../lib/api';
import { 
  ArrowLeft,
  Calendar,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Download,
  Trash2,
  AlertCircle,
  Clock,
  Globe,
  Monitor,
  CalendarDays,
  Settings
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';

export default function LinkDetails({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();
  const resolvedParams = use(params);
  const linkId = resolvedParams.id;

  const [linkData, setLinkData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [clicks, setClicks] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Edit Link Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editAlias, setEditAlias] = useState('');
  const [editExpires, setEditExpires] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // General States
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Run API fetches in parallel for high performance
      const [linkRes, statsRes, clicksRes] = await Promise.all([
        api.get(`/api/links/${linkId}`),
        api.get(`/api/links/${linkId}/stats`),
        api.get(`/api/links/${linkId}/clicks`),
      ]);

      setLinkData(linkRes.data);
      setStats(statsRes.data);
      setClicks(clicksRes.data);
      
      // Initialize edit fields
      setEditAlias(linkRes.data.custom_alias || '');
      setEditActive(linkRes.data.is_active);
      if (linkRes.data.expires_at) {
        // Format to YYYY-MM-DDThh:mm
        const dateObj = new Date(linkRes.data.expires_at);
        const tzOffset = dateObj.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
        setEditExpires(localISOTime);
      } else {
        setEditExpires('');
      }
      setEditPassword('');
      setClearPassword(false);
    } catch (err: any) {
      setError('Failed to load link data or analytics. It might have been deleted.');
      if (err.response?.status === 401) {
        logout();
        router.push('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && linkId) {
      fetchData();
    }
  }, [isAuthenticated, linkId]);

  const handleCopy = () => {
    if (!linkData) return;
    navigator.clipboard.writeText(linkData.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!linkData?.qr_code_base64) return;
    const link = document.createElement('a');
    link.href = linkData.qr_code_base64;
    link.download = `qr-code-${linkData.short_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setEditError('');

    try {
      const payload: any = {
        custom_alias: editAlias || null,
        is_active: editActive,
        expires_at: editExpires ? new Date(editExpires).toISOString() : null,
      };
      if (clearPassword) {
        payload.password = "";
      } else if (editPassword) {
        payload.password = editPassword;
      }

      const res = await api.put(`/api/links/${linkId}`, payload);
      setLinkData(res.data);
      setIsEditing(false);
      fetchData(); // Refetch stats and info
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setEditError(
        typeof detail === 'string'
          ? detail
          : 'Failed to update link details. Verify alias availability.'
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this link permanently? All analytics data will be lost.')) return;
    try {
      await api.delete(`/api/links/${linkId}`);
      router.push('/dashboard');
    } catch (err) {
      alert('Failed to delete shortcut. Please try again.');
    }
  };

  if (!isAuthenticated) return null;

  // Curated color scheme for Recharts Bar Chart bars
  const BAR_COLORS = ['#818cf8', '#06b6d4', '#a855f7', '#3b82f6', '#ec4899'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full relative z-10">
      {/* Return button */}
      <Link 
        href="/dashboard" 
        className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Dashboard</span>
      </Link>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="loader mb-4" />
          <p className="text-xs text-slate-400">Loading analytic engines...</p>
        </div>
      ) : !linkData ? null : (
        <div className="space-y-8">
          {/* Top Panel: Link Details Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Info Card */}
            <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-8 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Optimized Link</span>
                    <h2 className="font-display font-extrabold text-2xl text-white tracking-tight break-all">
                      {linkData.short_url}
                    </h2>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 transition-all"
                      title="Edit Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                      title="Delete Shortcut"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Destination</span>
                  <p className="text-xs text-slate-300 break-all bg-black/20 p-3 rounded-xl border border-white/3">
                    {linkData.original_url}
                  </p>
                </div>

                {/* Subdetails Grid */}
                <div className="grid grid-cols-3 gap-4 text-xs text-slate-400">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <div>
                      <span className="block text-[8px] uppercase font-bold text-slate-500">Created Date</span>
                      <span className="text-white font-medium">{new Date(linkData.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <div>
                      <span className="block text-[8px] uppercase font-bold text-slate-500">Expiration</span>
                      <span className="text-white font-medium">
                        {linkData.expires_at ? new Date(linkData.expires_at).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Lock className="h-4 w-4 text-slate-500" />
                    <div>
                      <span className="block text-[8px] uppercase font-bold text-slate-500">Security</span>
                      <span className="text-white font-medium">
                        {linkData.is_password_protected ? 'Passworded' : 'Public'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* URL Action Box */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mt-6">
                <span className="text-xs text-indigo-300 font-semibold truncate max-w-[200px] sm:max-w-xs">
                  {linkData.short_url}
                </span>
                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={linkData.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* QR Card */}
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/5 shadow-2xl flex flex-col items-center justify-center text-center">
              {linkData.qr_code_base64 && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-2xl inline-block border border-white/5">
                    <img 
                      src={linkData.qr_code_base64} 
                      alt="QR Code" 
                      className="w-36 h-36 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">Smart QR Code</h3>
                    <p className="text-[10px] text-slate-400">Offline-ready vector matrix. Scan to visit.</p>
                  </div>
                  <button
                    onClick={handleDownloadQr}
                    className="flex items-center justify-center space-x-1.5 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold text-white transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download PNG</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Edit settings collapse */}
          {isEditing && (
            <div className="glass-panel rounded-3xl p-6 border border-indigo-500/20 bg-indigo-500/2 animate-slideDown max-w-2xl">
              <h3 className="font-display font-bold text-lg text-white mb-4">Edit Shortcut Settings</h3>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Custom Alias</label>
                    <input
                      type="text"
                      value={editAlias}
                      onChange={(e) => setEditAlias(e.target.value)}
                      placeholder="e.g. bio"
                      className="w-full px-4 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Expiry Date</label>
                    <input
                      type="datetime-local"
                      value={editExpires}
                      onChange={(e) => setEditExpires(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Password Protection</label>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      placeholder="Enter new password (optional)"
                      disabled={clearPassword}
                      className="w-full px-4 py-2 rounded-xl glass-input text-xs disabled:opacity-50"
                    />
                  </div>

                  {linkData.is_password_protected && (
                    <div className="flex items-center space-x-2 pt-4">
                      <input
                        type="checkbox"
                        id="clearPassword"
                        checked={clearPassword}
                        onChange={(e) => setClearPassword(e.target.checked)}
                        className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <label htmlFor="clearPassword" className="text-xs text-red-400 font-medium cursor-pointer">
                        Remove Password Protection
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="editActive"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <label htmlFor="editActive" className="text-xs text-slate-300 font-medium cursor-pointer">
                    Link Status is Active (allowing visitors to redirect)
                  </label>
                </div>

                {editError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {editError}
                  </div>
                )}

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all"
                  >
                    {isUpdating ? 'Saving...' : 'Save Settings'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Analytics Dashboard section */}
          {stats && (
            <div className="space-y-6">
              {/* Stats Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Total Hits</span>
                    <span className="text-2xl font-extrabold text-white mt-1 block">{stats.total_clicks}</span>
                  </div>
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                    <Clock className="h-5 w-5 text-indigo-400" />
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Top Browser</span>
                    <span className="text-lg font-bold text-white mt-1.5 block truncate max-w-[150px]">
                      {stats.top_browsers?.[0]?.label || 'None'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                    <Monitor className="h-5 w-5 text-cyan-400" />
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Top Country</span>
                    <span className="text-lg font-bold text-white mt-1.5 block truncate max-w-[150px]">
                      {stats.top_countries?.[0]?.label || stats.top_browsers?.[0] ? 'Localhost' : 'None'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                    <Globe className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
              </div>

              {/* Charts section */}
              {mounted && stats.total_clicks > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Line Chart: Clicks over Time */}
                  <div className="glass-panel rounded-3xl p-6 border border-white/5 shadow-2xl">
                    <div className="flex items-center space-x-1.5 mb-6">
                      <CalendarDays className="h-4.5 w-4.5 text-indigo-400" />
                      <h3 className="font-display font-bold text-sm text-white">Clicks Timeline</h3>
                    </div>
                    
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.clicks_by_day} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                          <YAxis stroke="#475569" fontSize={10} tickLine={false} allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                            labelStyle={{ color: '#fff', fontSize: '10px' }}
                            itemStyle={{ color: '#a5b4fc', fontSize: '12px' }}
                          />
                          <Area type="monotone" dataKey="count" name="Clicks" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Bar Chart: Devices / Browsers */}
                  <div className="glass-panel rounded-3xl p-6 border border-white/5 shadow-2xl">
                    <div className="flex items-center space-x-1.5 mb-6">
                      <Monitor className="h-4.5 w-4.5 text-cyan-400" />
                      <h3 className="font-display font-bold text-sm text-white">Device Breakdown</h3>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.top_devices} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} />
                          <YAxis stroke="#475569" fontSize={10} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                            contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }}
                            labelStyle={{ color: '#fff', fontSize: '10px' }}
                            itemStyle={{ color: '#22d3ee', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" name="Sessions" radius={[6, 6, 0, 0]}>
                            {stats.top_devices?.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw Clicks Log Table */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/5 shadow-2xl">
            <h3 className="font-display font-bold text-base text-white mb-6">Visitor Connection Log</h3>
            
            {clicks.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-500">No visitor sessions registered yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="pb-3 font-semibold">Timestamp</th>
                      <th className="pb-3 font-semibold">IP Address</th>
                      <th className="pb-3 font-semibold">Device / Agent</th>
                      <th className="pb-3 font-semibold">Country</th>
                      <th className="pb-3 font-semibold">Referrer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/2">
                    {clicks.slice(0, 10).map((click, idx) => (
                      <tr key={click.id || idx} className="hover:bg-white/1">
                        <td className="py-3.5 text-slate-400 whitespace-nowrap">
                          {new Date(click.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3.5 font-mono text-slate-400">
                          {click.ip_address || 'Hidden'}
                        </td>
                        <td className="py-3.5 max-w-[200px] truncate" title={click.user_agent}>
                          {click.user_agent || 'Unknown Agent'}
                        </td>
                        <td className="py-3.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-medium text-white">
                            {click.country || 'Localhost'}
                          </span>
                        </td>
                        <td className="py-3.5 max-w-[150px] truncate text-slate-400" title={click.referrer}>
                          {click.referrer || 'Direct / None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
