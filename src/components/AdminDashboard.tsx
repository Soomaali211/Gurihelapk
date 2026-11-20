import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AccountStatus,
  AdminOverview,
  AdminReports,
  AdminSessionRecord,
  AuditLogEntry,
  AuthUser,
  Listing,
  MediaAssetItem,
  PasswordResetRequestItem,
  Project,
  SystemSettings,
  UserRole,
  WatermarkPosition,
  WatermarkVariant,
  isAdminRole,
} from '../types';
import {
  createAdminListing,
  createAdminProject,
  deleteAdminListing,
  deleteAdminMedia,
  deleteAdminProject,
  deleteAdminUser,
  downloadAdminExport,
  fetchAdminAuditLogs,
  fetchAdminBookings,
  fetchAdminLeases,
  fetchAdminListings,
  fetchAdminMedia,
  fetchAdminOverview,
  fetchAdminPasswordResets,
  fetchAdminProjects,
  fetchAdminReports,
  fetchAdminRequests,
  fetchAdminSessions,
  fetchAdminUsers,
  issueAdminPasswordReset,
  rejectAdminPasswordReset,
  resolveApiUrl,
  revokeAdminSession,
  rewatermarkAdminMedia,
  updateAdminBookingStatus,
  updateAdminListing,
  updateAdminRequestStatus,
  updateAdminSettings,
  updateAdminUser,
} from '../lib/apiClient';
import { AddListingModal } from './AddListingModal';

interface AdminDashboardProps {
  currentUser: AuthUser;
  onViewListingDetail: (listing: Listing) => void;
  onMarketplaceMutated: () => void;
  onBackToApp: () => void;
  onLogout: () => void;
}

type AdminSection =
  | 'overview'
  | 'properties'
  | 'media'
  | 'projects'
  | 'users'
  | 'operations'
  | 'reports'
  | 'settings'
  | 'security';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onViewListingDetail,
  onMarketplaceMutated,
  onBackToApp,
  onLogout,
}) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingStatusFilter, setListingStatusFilter] = useState('all');
  const [listingQuery, setListingQuery] = useState('');
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | AccountStatus>('all');
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequestItem[]>([]);
  const [issuedResetModal, setIssuedResetModal] = useState<{
    username: string;
    resetCode: string;
    expiresAt: string;
  } | null>(null);

  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([]);
  const [leases, setLeases] = useState<Array<Record<string, unknown>>>([]);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [sessions, setSessions] = useState<AdminSessionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [settingsForm, setSettingsForm] = useState<SystemSettings | null>(null);
  const [reapplyWatermark, setReapplyWatermark] = useState(true);

  const [showAddListing, setShowAddListing] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);

  // Add Project modal state
  const [showAddProject, setShowAddProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDev, setProjDev] = useState('');
  const [projDistrict, setProjDistrict] = useState('Jigjiga Yar');
  const [projCity, setProjCity] = useState('Hargeisa');
  const [projPrice, setProjPrice] = useState(120000);
  const [projStage, setProjStage] = useState<'off_plan' | 'building' | 'ready'>('off_plan');
  const [projDesc, setProjDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, ls, md, pr, us, prq, bk, rq, lc, rp, ss, lg] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminListings(listingStatusFilter, listingQuery),
        fetchAdminMedia(),
        fetchAdminProjects(),
        fetchAdminUsers({ q: userQuery, role: userRoleFilter, status: userStatusFilter }),
        fetchAdminPasswordResets(),
        fetchAdminBookings(),
        fetchAdminRequests(),
        fetchAdminLeases(),
        fetchAdminReports(),
        fetchAdminSessions(),
        fetchAdminAuditLogs(),
      ]);
      setOverview(ov);
      setSettingsForm(ov.settings);
      setListings(ls);
      setMediaAssets(md);
      setProjects(pr);
      setUsers(us);
      setPasswordResets(prq);
      setBookings(bk);
      setRequests(rq);
      setLeases(lc);
      setReports(rp);
      setSessions(ss);
      setAuditLogs(lg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [listingStatusFilter, listingQuery, userQuery, userRoleFilter, userStatusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((prev) => (prev === msg ? null : prev)), 4000);
  };

  const handleCreateProperty = async (listing: Listing) => {
    setError(null);
    try {
      await createAdminListing({
        title: listing.title,
        description: listing.description,
        purpose: listing.purpose,
        property_type: listing.property_type,
        price: listing.price,
        currency: listing.currency,
        price_unit: listing.price_unit,
        area_m2: listing.area_m2,
        bedrooms: listing.bedrooms,
        living_rooms: listing.living_rooms,
        bathrooms: listing.bathrooms,
        city: listing.city,
        district: listing.district,
        address: listing.address,
        lat: listing.lat,
        lng: listing.lng,
        verified: true,
        featured: listing.featured,
        status: 'live',
        images: listing.images,
        amenities: listing.amenities,
      });
      showToast('Property published live with official GuriHel watermark.');
      await loadAll();
      onMarketplaceMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish property.');
    }
  };

  const handleListingPatch = async (id: string, patch: Partial<Listing>, message: string) => {
    setError(null);
    try {
      await updateAdminListing(id, patch);
      showToast(message);
      await loadAll();
      onMarketplaceMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update listing.');
    }
  };

  const handleDeleteListing = async (id: string) => {
    setError(null);
    try {
      await deleteAdminListing(id);
      showToast('Listing removed.');
      await loadAll();
      onMarketplaceMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete listing.');
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!settingsForm) return;
    setError(null);
    setLoading(true);
    try {
      const res = await updateAdminSettings({
        platformName: settingsForm.platformName,
        supportPhone: settingsForm.supportPhone,
        defaultCity: settingsForm.defaultCity,
        requireListingModeration: settingsForm.requireListingModeration,
        watermark: settingsForm.watermark,
        reapplyExistingMedia: reapplyWatermark,
      });
      setSettingsForm(res.settings);
      showToast(
        `Settings saved.${
          reapplyWatermark ? ` Re-watermarked ${res.reprocessedCount} media asset(s).` : ''
        }`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createAdminProject({
        name: projName.trim(),
        developerName: projDev.trim(),
        city: projCity,
        district: projDistrict,
        stage: projStage,
        startingPrice: Number(projPrice) || 0,
        description: projDesc.trim(),
        featured: true,
      });
      setShowAddProject(false);
      setProjName('');
      setProjDev('');
      setProjDesc('');
      showToast('Real estate project created.');
      await loadAll();
      onMarketplaceMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    }
  };

  const handleExport = async (
    resource: 'listings' | 'users' | 'bookings' | 'requests' | 'leases' | 'projects' | 'audit_logs',
    format: 'csv' | 'json'
  ) => {
    try {
      await downloadAdminExport(resource, format);
      showToast(`Exported ${resource}.${format}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const NAV_ITEMS: Array<{ id: AdminSection; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'properties',
      label: 'Properties',
      icon: <Building2 className="w-4 h-4" />,
      badge: overview?.listingsPending || undefined,
    },
    { id: 'media', label: 'Media & Watermark', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
    {
      id: 'users',
      label: 'Users & Access',
      icon: <Users className="w-4 h-4" />,
      badge: overview?.pendingResetsCount || undefined,
    },
    { id: 'operations', label: 'Bookings & Leases', icon: <CalendarCheck className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports & Exports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'security', label: 'Audit Logs', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const kpiCards = [
    { label: 'Total Users', value: overview?.usersTotal ?? 0, sub: `${overview?.usersCompleted ?? 0} completed` },
    { label: 'Live Properties', value: overview?.listingsLive ?? 0, sub: `${overview?.listingsTotal ?? 0} total` },
    { label: 'Pending Review', value: overview?.listingsPending ?? 0, sub: `${overview?.listingsRejected ?? 0} rejected` },
    { label: 'Projects', value: overview?.projectsTotal ?? 0, sub: `${overview?.bookingsTotal ?? 0} bookings` },
    { label: 'Bookings Revenue', value: `$${(overview?.bookingsRevenue ?? 0).toLocaleString()}`, sub: `${overview?.leasesTotal ?? 0} leases` },
    { label: 'Active Sessions', value: overview?.activeSessionsCount ?? 0, sub: `${overview?.mediaTotal ?? 0} watermarked media` },
  ];

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0F3D2A] text-white">
      <div className="p-4 border-b border-emerald-800/70 flex items-center justify-between gap-2">
        <img
          src="/assets/aistudio/GuriHel-logo-reversed_bc2c4e29.png"
          alt="GuriHel"
          className="h-8 w-auto object-contain"
        />
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-900/90 text-emerald-200 rounded">
          Admin
        </span>
      </div>

      <div className="px-4 py-3 border-b border-emerald-800/50 text-xs space-y-0.5">
        <div className="font-bold text-emerald-100 truncate">
          {currentUser.isPrimaryAdmin ? 'Primary Admin' : 'Administrator'}
        </div>
        <div className="text-[11px] text-emerald-200/90 truncate">{currentUser.email}</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              setMobileMenuOpen(false);
            }}
            className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
              section === item.id
                ? 'bg-[#0B7A3E] text-white shadow-xs'
                : 'text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              {item.icon}
              <span>{item.label}</span>
            </span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-amber-400 text-slate-950">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-emerald-800/70 space-y-2">
        <button
          type="button"
          onClick={onBackToApp}
          className="w-full py-2 px-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-xs font-bold flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          <span>Customer APK View</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-2 px-3 rounded-xl bg-red-900/60 hover:bg-red-800 text-xs font-bold flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex bg-[#F6F8F9] text-slate-900 font-sans overflow-hidden">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 h-full">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[500] bg-black/50 lg:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div className="w-72 max-w-[85vw] h-full" onClick={(e) => e.stopPropagation()}>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-[#0F3D2A] truncate capitalize">
                {NAV_ITEMS.find((n) => n.id === section)?.label || 'Admin Portal'}
              </h1>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                <span>
                  {currentUser.isPrimaryAdmin ? 'Primary Admin' : 'Admin'}: {currentUser.email}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddListing(true)}
              className="px-3.5 py-2 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Property</span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {notice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-[#0B7A3E] flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {notice}
              </span>
              <button type="button" onClick={() => setNotice(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {error}
              </span>
              <button type="button" onClick={() => setError(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {kpiCards.map((k) => (
                  <div
                    key={k.label}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-1"
                  >
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {k.label}
                    </div>
                    <div className="text-2xl font-black text-[#0F3D2A] tabular-nums">{k.value}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">{k.sub}</div>
                  </div>
                ))}
              </div>

              {(overview?.listingsTotal ?? 0) === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                  <img
                    src="/assets/aistudio/GuriHel-mark_d2d21036.png"
                    alt="GuriHel Mark"
                    className="w-12 h-12 mx-auto object-contain"
                  />
                  <h2 className="text-base font-extrabold text-[#0F3D2A]">
                    Clean Marketplace Database (0 Properties)
                  </h2>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    All legacy demo records have been removed. Publish your first verified property now with automatic GuriHel logo watermarking.
                  </p>
                  <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddListing(true)}
                      className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Property</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddProject(true)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <FolderKanban className="w-4 h-4" />
                      <span>Add Project</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                        Pending Moderation ({overview?.listingsPending ?? 0})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSection('properties')}
                        className="text-xs font-bold text-[#0B7A3E] hover:underline"
                      >
                        View All
                      </button>
                    </div>
                    {listings.filter((l) => l.status === 'pending').length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">
                        No pending properties waiting for review.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {listings
                          .filter((l) => l.status === 'pending')
                          .slice(0, 4)
                          .map((l) => (
                            <div
                              key={l.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">{l.title}</div>
                                <div className="text-[11px] text-slate-500">
                                  {l.district} · ${l.price.toLocaleString()}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleListingPatch(l.id, { status: 'live', verified: true }, 'Approved')
                                  }
                                  className="px-2.5 py-1 bg-[#0B7A3E] text-white text-[11px] font-bold rounded-lg"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRejectModal({ id: l.id, reason: 'Incomplete verification details' })
                                  }
                                  className="px-2.5 py-1 bg-red-100 text-red-700 text-[11px] font-bold rounded-lg"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-[#0F3D2A]">Recent Security Events</h3>
                      <button
                        type="button"
                        onClick={() => setSection('security')}
                        className="text-xs font-bold text-[#0B7A3E] hover:underline"
                      >
                        Full Audit Log
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {auditLogs.slice(0, 6).map((log) => (
                        <div key={log.id} className="p-2.5 rounded-xl bg-slate-50 text-xs flex justify-between gap-2">
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-[#0F3D2A]">{log.action}</span>
                            <div className="text-[11px] text-slate-600 truncate">{log.details}</div>
                          </div>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROPERTIES */}
          {section === 'properties' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={listingQuery}
                    onChange={(e) => setListingQuery(e.target.value)}
                    placeholder="Search title, district, address..."
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#0B7A3E]"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['all', 'live', 'pending', 'rejected', 'sold'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setListingStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize shrink-0 ${
                        listingStatusFilter === st
                          ? 'bg-[#0B7A3E] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {listings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                  <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-800">No properties match this view</div>
                  <button
                    type="button"
                    onClick={() => setShowAddListing(true)}
                    className="px-4 py-2 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
                  >
                    + Add Property
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((l) => (
                    <div
                      key={l.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={
                            l.images[0]
                              ? resolveApiUrl(l.images[0])
                              : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'
                          }
                          alt={l.title}
                          className="w-20 h-20 rounded-xl object-cover shrink-0 bg-slate-100 border border-slate-200"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                l.status === 'live'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : l.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {l.status}
                            </span>
                            {l.verified && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0B7A3E] text-white">
                                Verified
                              </span>
                            )}
                            {l.featured && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5B800] text-slate-900">
                                Featured
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 truncate">{l.title}</h4>
                          <div className="text-xs text-slate-500">
                            {l.district}, {l.city} · <strong className="text-[#0B7A3E] tabular-nums">${l.price.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onViewListingDetail(l)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                        >
                          Preview
                        </button>
                        {l.status !== 'live' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleListingPatch(l.id, { status: 'live', verified: true }, 'Approved & Live')
                            }
                            className="px-3 py-1.5 rounded-xl bg-[#0B7A3E] text-white text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleListingPatch(
                              l.id,
                              { featured: !l.featured },
                              l.featured ? 'Removed featured flag' : 'Marked featured'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{l.featured ? 'Unfeature' : 'Feature'}</span>
                        </button>
                        {l.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() =>
                              setRejectModal({ id: l.id, reason: 'Verification documents required' })
                            }
                            className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteListing(l.id)}
                          className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MEDIA & WATERMARK */}
          {section === 'media' && settingsForm && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                      Official GuriHel Logo Watermark Configuration
                    </h3>
                    <p className="text-xs text-slate-500">
                      Originals are stored untouched; watermarks are applied once cleanly onto served property photos.
                    </p>
                  </div>
                  <img
                    src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
                    alt="Official Watermark Asset"
                    className="h-8 w-auto object-contain"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settingsForm.watermark.enabled}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          watermark: { ...settingsForm.watermark, enabled: e.target.checked },
                        })
                      }
                      className="w-4 h-4 accent-[#0B7A3E]"
                    />
                    <span>Enable Watermarking</span>
                  </label>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Logo Variant</label>
                    <select
                      value={settingsForm.watermark.variant}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          watermark: {
                            ...settingsForm.watermark,
                            variant: e.target.value as WatermarkVariant,
                          },
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                    >
                      <option value="primary">Primary Full Wordmark</option>
                      <option value="mark">Compact GuriHel Mark</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Position</label>
                    <select
                      value={settingsForm.watermark.position}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          watermark: {
                            ...settingsForm.watermark,
                            position: e.target.value as WatermarkPosition,
                          },
                        })
                      }
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="center">Center Subtle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Opacity ({Math.round(settingsForm.watermark.opacity * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={70}
                      value={Math.round(settingsForm.watermark.opacity * 100)}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          watermark: {
                            ...settingsForm.watermark,
                            opacity: Number(e.target.value) / 100,
                          },
                        })
                      }
                      className="w-full accent-[#0B7A3E]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reapplyWatermark}
                      onChange={(e) => setReapplyWatermark(e.target.checked)}
                      className="w-4 h-4 accent-[#0B7A3E]"
                    />
                    <span>Re-apply single watermark from untouched originals to all existing media</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSaveSettings()}
                    className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl"
                  >
                    Save Watermark Settings
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                  Uploaded Property Media ({mediaAssets.length})
                </h3>
                {mediaAssets.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No uploaded property photos yet. Add a property with photos to manage watermarked assets here.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mediaAssets.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                      >
                        <img
                          src={`${resolveApiUrl(m.url)}?t=${encodeURIComponent(m.createdAt)}`}
                          alt={m.id}
                          className="aspect-16/10 w-full object-cover bg-slate-200"
                        />
                        <div className="p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] text-slate-500">{m.id}</span>
                            <span className="font-bold text-[#0B7A3E]">
                              {m.watermarked ? `${m.watermarkPosition} (${Math.round(m.watermarkOpacity * 100)}%)` : 'Original'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await rewatermarkAdminMedia(m.id);
                                showToast(`Re-applied watermark cleanly on ${m.id}`);
                                await loadAll();
                              }}
                              className="flex-1 py-1.5 rounded-lg bg-[#0B7A3E] text-white font-bold text-[11px]"
                            >
                              Re-watermark
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteAdminMedia(m.id);
                                showToast(`Deleted media ${m.id}`);
                                await loadAll();
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 font-bold text-[11px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PROJECTS */}
          {section === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                  Real Estate Projects ({projects.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddProject(true)}
                  className="px-4 py-2 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>
              {projects.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  No development projects published yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs text-slate-500">
                          {p.developerName} · {p.district}, {p.city} · From ${p.startingPrice.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-[#0B7A3E] font-bold mt-1">
                          Stage: {p.stage} · {p.leadsCount} leads
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteAdminProject(p.id);
                          showToast('Project deleted');
                          await loadAll();
                          onMarketplaceMutated();
                        }}
                        className="p-2 rounded-xl bg-red-50 text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* USERS, ACCESS & PASSWORD RECOVERY */}
          {section === 'users' && (
            <div className="space-y-5">
              {/* Filter Bar */}
              <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Search username, full name, or email..."
                    className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#0B7A3E]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as 'all' | UserRole)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                  >
                    <option value="all">All Roles</option>
                    <option value="super_admin">Primary Admin</option>
                    <option value="admin">Admins</option>
                    <option value="user">Users</option>
                  </select>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value as 'all' | AccountStatus)}
                    className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleExport('users', 'csv')}
                    className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                    Registered Accounts ({users.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Username</th>
                        <th className="p-3">Full Name</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Registered / Last Login</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => {
                        const isSelf = u.id === currentUser.id;
                        const protectedAdmin = u.isPrimaryAdmin;
                        return (
                          <tr key={u.id}>
                            <td className="p-3 font-mono font-bold text-slate-900">
                              {u.username ? `@${u.username}` : u.email || '—'}
                            </td>
                            <td className="p-3 font-semibold">{u.fullName || '—'}</td>
                            <td className="p-3 text-slate-600">{u.email || '—'}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isAdminRole(u.role)
                                      ? 'bg-[#0F3D2A] text-white'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {u.role}
                                </span>
                                {u.isPrimaryAdmin && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                                    Primary
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                  u.status === 'active'
                                    ? 'bg-emerald-50 text-[#0B7A3E]'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {u.status}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                              <div>Reg: {new Date(u.createdAt).toLocaleDateString()}</div>
                              <div>
                                Login:{' '}
                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                              </div>
                            </td>
                            <td className="p-3">
                              {protectedAdmin ? (
                                <span className="text-[11px] font-bold text-slate-400">
                                  Protected Root
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={async () => {
                                      try {
                                        const nextRole: UserRole =
                                          isAdminRole(u.role) ? 'user' : 'admin';
                                        await updateAdminUser(u.id, { role: nextRole });
                                        showToast(`${u.email || u.username} role set to ${nextRole}`);
                                        await loadAll();
                                      } catch (err) {
                                        setError(
                                          err instanceof Error ? err.message : 'Role update failed.'
                                        );
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-[11px] font-bold"
                                  >
                                    {isAdminRole(u.role) ? 'Demote' : 'Make Admin'}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={async () => {
                                      try {
                                        const next: AccountStatus =
                                          u.status === 'active' ? 'blocked' : 'active';
                                        await updateAdminUser(u.id, { status: next });
                                        showToast(`${u.email || u.username} status set to ${next}`);
                                        await loadAll();
                                      } catch (err) {
                                        setError(
                                          err instanceof Error ? err.message : 'Status update failed.'
                                        );
                                      }
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold disabled:opacity-40 ${
                                      u.status === 'active'
                                        ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        : 'bg-emerald-50 text-[#0B7A3E] hover:bg-emerald-100'
                                    }`}
                                  >
                                    {u.status === 'active' ? 'Block' : 'Activate'}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isSelf}
                                    onClick={async () => {
                                      try {
                                        await deleteAdminUser(u.id);
                                        showToast(`Deleted user ${u.email || u.username}`);
                                        await loadAll();
                                      } catch (err) {
                                        setError(
                                          err instanceof Error ? err.message : 'Could not delete user.'
                                        );
                                      }
                                    }}
                                    className="p-1 rounded-lg bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-700"
                                    title="Delete user"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Password Recovery Requests */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                    Password Recovery Requests ({passwordResets.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Issue a single-use 30-minute recovery code after verifying the user&apos;s identity.
                  </p>
                </div>
                {passwordResets.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500">No password reset requests recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">User</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Requested</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {passwordResets.map((pr) => (
                          <tr key={pr.id}>
                            <td className="p-3 font-mono font-bold">@{pr.username}</td>
                            <td className="p-3 text-slate-600">{pr.email}</td>
                            <td className="p-3 capitalize font-bold">{pr.status}</td>
                            <td className="p-3 text-slate-500 tabular-nums">
                              {new Date(pr.createdAt).toLocaleString()}
                            </td>
                            <td className="p-3">
                              {(pr.status === 'pending' || pr.status === 'issued') && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await issueAdminPasswordReset(pr.id);
                                        setIssuedResetModal({
                                          username: res.username,
                                          resetCode: res.resetCode,
                                          expiresAt: res.expiresAt,
                                        });
                                        await loadAll();
                                      } catch (err) {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Could not issue recovery code.'
                                        );
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[#0B7A3E] text-white font-bold text-[11px]"
                                  >
                                    Issue Code
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await rejectAdminPasswordReset(pr.id);
                                      showToast(`Rejected reset for @${pr.username}`);
                                      await loadAll();
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-[11px]"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Active Sessions & Revocation */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                    Sessions & Revocation ({sessions.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Username</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Device</th>
                        <th className="p-3">IP</th>
                        <th className="p-3">State</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="p-3 font-mono font-bold">
                            {s.username ? `@${s.username}` : s.phoneE164 || s.userId}
                          </td>
                          <td className="p-3 uppercase font-bold">{s.role}</td>
                          <td className="p-3 max-w-xs truncate">{s.deviceLabel}</td>
                          <td className="p-3 font-mono">{s.ipAddress}</td>
                          <td className="p-3">
                            {s.revokedAt ? (
                              <span className="text-red-600 font-bold">Revoked</span>
                            ) : (
                              <span className="text-[#0B7A3E] font-bold">Active</span>
                            )}
                          </td>
                          <td className="p-3">
                            {!s.revokedAt && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await revokeAdminSession(s.id);
                                  showToast(`Revoked session ${s.id}`);
                                  await loadAll();
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold text-[11px]"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS, REQUESTS & LEASES */}
          {section === 'operations' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">Bookings ({bookings.length})</h3>
                {bookings.length === 0 ? (
                  <p className="text-xs text-slate-500">No bookings recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.map((b) => (
                      <div
                        key={String(b.id)}
                        className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold">{String(b.listing_title)}</div>
                          <div className="text-slate-500">
                            {String(b.guest_phone)} · {String(b.nights)} nights · ${Number(b.total).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['held', 'confirmed', 'cancelled'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={async () => {
                                await updateAdminBookingStatus(String(b.id), st);
                                showToast(`Booking ${st}`);
                                await loadAll();
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize ${
                                b.status === st
                                  ? 'bg-[#0B7A3E] text-white'
                                  : 'bg-white border border-slate-200 text-slate-600'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                  Search Requests ({requests.length})
                </h3>
                {requests.length === 0 ? (
                  <p className="text-xs text-slate-500">No customer search requests yet.</p>
                ) : (
                  <div className="space-y-2">
                    {requests.map((r) => (
                      <div
                        key={String(r.id)}
                        className="p-3 bg-slate-50 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold">
                            {String(r.seeker_name)} ({String(r.seeker_phone)})
                          </div>
                          <div className="text-slate-500">
                            {String(r.purpose)} · {String(r.property_type)} · {String(r.district)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(['open', 'matched', 'closed'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={async () => {
                                await updateAdminRequestStatus(String(r.id), st);
                                showToast(`Request ${st}`);
                                await loadAll();
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize ${
                                r.status === st
                                  ? 'bg-[#0B7A3E] text-white'
                                  : 'bg-white border border-slate-200 text-slate-600'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                  Lease Contracts ({leases.length})
                </h3>
                {leases.length === 0 ? (
                  <p className="text-xs text-slate-500">No lease contracts generated yet.</p>
                ) : (
                  leases.map((lc) => (
                    <div key={String(lc.id)} className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between">
                      <span className="font-bold">{String(lc.property_title)}</span>
                      <span className="text-[#0B7A3E] font-bold">${Number(lc.monthly_rent)}/mo</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* REPORTS & EXPORTS */}
          {section === 'reports' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <h3 className="text-sm font-extrabold text-[#0F3D2A]">Export Platform Data</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {(
                    [
                      'listings',
                      'users',
                      'bookings',
                      'requests',
                      'leases',
                      'projects',
                      'audit_logs',
                    ] as const
                  ).map((resName) => (
                    <div
                      key={resName}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-bold capitalize">{resName.replace('_', ' ')}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleExport(resName, 'csv')}
                          className="px-2 py-1 rounded bg-[#0B7A3E] text-white text-[10px] font-bold"
                        >
                          CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(resName, 'json')}
                          className="px-2 py-1 rounded bg-slate-800 text-white text-[10px] font-bold"
                        >
                          JSON
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">Listings by District</h3>
                  {!reports || reports.byDistrict.length === 0 ? (
                    <p className="text-xs text-slate-500">0 properties recorded across districts.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {reports.byDistrict.map((d) => (
                        <div key={d.district} className="flex justify-between p-2 bg-slate-50 rounded-lg">
                          <span className="font-bold">{d.district}</span>
                          <span className="tabular-nums">
                            {d.count} listings · avg ${Math.round(d.avgPrice).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                    Hargeisa District Benchmarks (Reference)
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {(reports?.districtBenchmarks || []).map((b) => (
                      <div key={b.district} className="flex justify-between p-2 bg-slate-50 rounded-lg">
                        <span className="font-bold">{b.district}</span>
                        <span className="tabular-nums text-slate-600">
                          Rent ${b.avgRentM2}/m² · Sale ${b.avgSaleM2}/m²
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM SETTINGS */}
          {section === 'settings' && settingsForm && (
            <form
              onSubmit={handleSaveSettings}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-w-2xl"
            >
              <h3 className="text-sm font-extrabold text-[#0F3D2A]">Platform Configuration</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Platform Name</label>
                  <input
                    type="text"
                    value={settingsForm.platformName}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, platformName: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Support Phone</label>
                  <input
                    type="text"
                    value={settingsForm.supportPhone}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, supportPhone: e.target.value })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-mono font-semibold"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsForm.requireListingModeration}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      requireListingModeration: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#0B7A3E]"
                />
                <span>Require Admin Moderation before Regular User listings go live</span>
              </label>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl"
              >
                Save System Settings
              </button>
            </form>
          )}

          {/* SECURITY AUDIT LOGS */}
          {section === 'security' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#0B7A3E]" />
                  <h3 className="text-sm font-extrabold text-[#0F3D2A]">
                    Security & Activity Audit Log ({auditLogs.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleExport('audit_logs', 'csv')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Details</th>
                      <th className="p-3">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="p-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold">
                          {log.actorUsername ? `@${log.actorUsername}` : log.actorPhone || 'system'}
                        </td>
                        <td className="p-3 font-mono text-[#0B7A3E] font-bold">{log.action}</td>
                        <td className="p-3 text-slate-700">{log.details}</td>
                        <td className="p-3 font-mono text-slate-400">{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add First Property Modal (Admin Mode) */}
      <AddListingModal
        isOpen={showAddListing}
        onClose={() => setShowAddListing(false)}
        onSubmitListing={handleCreateProperty}
        isAdmin
      />

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[520] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 border border-slate-200 shadow-2xl">
            <h4 className="text-sm font-bold text-red-700">Rejection Reason</h4>
            <input
              type="text"
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl bg-slate-50"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { id, reason } = rejectModal;
                  setRejectModal(null);
                  await handleListingPatch(id, { status: 'rejected', rejectionReason: reason }, 'Rejected');
                }}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProject && (
        <div className="fixed inset-0 z-[520] bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateProject}
            className="bg-white rounded-2xl p-5 max-w-md w-full space-y-3 border border-slate-200 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-[#0F3D2A]">Create Real Estate Project</h4>
              <button type="button" onClick={() => setShowAddProject(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              required
              type="text"
              placeholder="Project Name (e.g. Barwaaqo Towers)"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
            />
            <input
              required
              type="text"
              placeholder="Developer Name"
              value={projDev}
              onChange={(e) => setProjDev(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="City"
                value={projCity}
                onChange={(e) => setProjCity(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
              />
              <input
                type="text"
                placeholder="District"
                value={projDistrict}
                onChange={(e) => setProjDistrict(e.target.value)}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Starting Price USD"
                value={projPrice}
                onChange={(e) => setProjPrice(Number(e.target.value))}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
              />
              <select
                value={projStage}
                onChange={(e) => setProjStage(e.target.value as 'off_plan' | 'building' | 'ready')}
                className="h-10 px-3 rounded-xl bg-slate-50 border border-slate-200"
              >
                <option value="off_plan">Off Plan</option>
                <option value="building">Under Construction</option>
                <option value="ready">Ready</option>
              </select>
            </div>
            <textarea
              rows={2}
              placeholder="Description..."
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[#0B7A3E] text-white font-bold rounded-xl"
            >
              Publish Project
            </button>
          </form>
        </div>
      )}

      {/* Issued One-Time Recovery Code Modal */}
      {issuedResetModal && (
        <div className="fixed inset-0 z-[530] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-3 border border-slate-200 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-[#0F3D2A]">One-Time Recovery Code Issued</h4>
              <button type="button" onClick={() => setIssuedResetModal(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Share this single-use code with <strong>@{issuedResetModal.username}</strong>. It expires on{' '}
              {new Date(issuedResetModal.expiresAt).toLocaleTimeString()}.
            </p>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-center text-base font-black text-[#0F3D2A] select-all">
              {issuedResetModal.resetCode}
            </div>
            <button
              type="button"
              onClick={() => setIssuedResetModal(null)}
              className="w-full py-2.5 bg-[#0B7A3E] text-white font-bold rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
