import React, { useEffect, useRef, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  Users,
  Building2,
  CalendarCheck,
  DollarSign,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  TrendingUp,
  Clock,
  Database,
  Lock,
  Smartphone,
  Power,
  FileText,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  AdminDevice,
  AdminRecord,
  AdminSessionState,
  AuditLogEntry,
  Listing,
} from '../types';
import {
  isVerifiedAdmin,
  signInWithGoogleVerified,
  subscribeAdminDevices,
  subscribeAuditLogs,
  revokeAdminDevice,
  triggerSuperAdminKillSwitch,
  appendAuditLog,
} from '../lib/firestoreRepo';
import { refreshAdminSessionToken, verifyStepUp2FA } from '../lib/adminSecurity';

interface AdminDashboardProps {
  listings: Listing[];
  onApproveListing: (id: string) => void;
  onRejectListing: (id: string, reason: string) => void;
  onViewListingDetail: (listing: Listing) => void;
  firebaseUser?: FirebaseUser | null;
  hasCloudListings?: boolean;
  onSeedDatabase?: () => Promise<void>;
  adminRecord?: AdminRecord | null;
  adminSession?: AdminSessionState | null;
  currentDevice?: AdminDevice | null;
  onSessionUpdate?: (next: AdminSessionState) => void;
  onLockSession?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  listings,
  onApproveListing,
  onRejectListing,
  onViewListingDetail,
  firebaseUser,
  hasCloudListings,
  onSeedDatabase,
  adminRecord,
  adminSession,
  currentDevice,
  onSessionUpdate,
  onLockSession,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'approvals' | 'all_listings' | 'brokers' | 'financials' | 'security'
  >('approvals');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Dukumenti lahaansho oo aan caddayn');
  const [seeding, setSeeding] = useState(false);

  // Super Admin Live Security State
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Step-Up 2FA Gate Modal State
  const [stepUpAction, setStepUpAction] = useState<{
    title: string;
    run: () => Promise<void>;
  } | null>(null);
  const [stepUpCode, setStepUpCode] = useState('');
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const pendingListings = listings.filter((l) => l.status === 'pending');
  const liveListings = listings.filter((l) => l.status === 'live');
  const adminAuthenticated = isVerifiedAdmin(firebaseUser || null);

  // Subscribe to Trusted Devices & Immutable Audit Logs
  useEffect(() => {
    if (!firebaseUser || !isVerifiedAdmin(firebaseUser)) return;
    const unsubDevices = subscribeAdminDevices(firebaseUser, setDevices);
    const unsubLogs = subscribeAuditLogs(firebaseUser, setAuditLogs);
    return () => {
      unsubDevices();
      unsubLogs();
    };
  }, [firebaseUser]);

  // 30-min Inactivity Auto-Lock + Silent 15-min Session Refresh
  useEffect(() => {
    if (!firebaseUser || !adminSession || !adminRecord || !onLockSession || !onSessionUpdate) {
      return;
    }

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('pointerdown', markActive);
    window.addEventListener('keydown', markActive);

    const timer = window.setInterval(async () => {
      const now = Date.now();
      // 30 min idle -> force full 2FA re-login
      if (now - lastActivityRef.current > 30 * 60 * 1000) {
        onLockSession();
        return;
      }
      // Refresh 15-min token cleanly if < 2 min remaining
      if (adminSession.expiresAt - now < 2 * 60 * 1000) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const refreshed = await refreshAdminSessionToken({
            idToken,
            adminSessionToken: adminSession.token,
            sessionEpoch: adminRecord.sessionEpoch,
          });
          onSessionUpdate(refreshed);
        } catch {
          onLockSession();
        }
      }
    }, 30_000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
    };
  }, [firebaseUser, adminSession, adminRecord, onLockSession, onSessionUpdate]);

  const executeWithStepUp = async (title: string, actionFn: () => Promise<void>) => {
    const now = Date.now();
    if (adminSession && adminSession.stepUpUntil > now) {
      await actionFn();
      return;
    }
    setStepUpCode('');
    setStepUpError(null);
    setStepUpAction({ title, run: actionFn });
  };

  const handleStepUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !firebaseUser ||
      !adminSession ||
      !adminRecord?.totpSecretEnc ||
      !stepUpAction ||
      !onSessionUpdate
    ) {
      return;
    }

    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const refreshed = await verifyStepUp2FA({
        idToken,
        adminSessionToken: adminSession.token,
        encryptedSecret: adminRecord.totpSecretEnc,
        code: stepUpCode.trim(),
        sessionEpoch: adminRecord.sessionEpoch,
      });
      onSessionUpdate(refreshed);
      const pendingRun = stepUpAction.run;
      setStepUpAction(null);
      setStepUpCode('');
      await pendingRun();
    } catch (err) {
      setStepUpError(err instanceof Error ? err.message : 'Koodhka Step-Up waa khalad.');
    } finally {
      setStepUpBusy(false);
    }
  };

  const handleApproveWithAudit = async (id: string) => {
    onApproveListing(id);
    if (firebaseUser && isVerifiedAdmin(firebaseUser)) {
      await appendAuditLog(firebaseUser, {
        action: 'listing.approved',
        target: id,
        details: `Guriga #${id} waa la ansixiyay loona gudbiyay Live.`,
        deviceLabel: currentDevice?.label || 'Admin Web',
        stepUpUsed: Boolean(adminSession && adminSession.stepUpUntil > Date.now()),
      });
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectId) {
      const targetId = rejectId;
      onRejectListing(targetId, rejectReason);
      setRejectId(null);
      if (firebaseUser && isVerifiedAdmin(firebaseUser)) {
        await appendAuditLog(firebaseUser, {
          action: 'listing.rejected',
          target: targetId,
          details: `Waa la diiday sababta: ${rejectReason}`,
          deviceLabel: currentDevice?.label || 'Admin Web',
          stepUpUsed: Boolean(adminSession && adminSession.stepUpUntil > Date.now()),
        });
      }
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Admin Title & Subtitle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-xl sm:text-2xl font-black text-[#0F3D2A]">
              GuriHel Admin Management Console
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Xarunta Maamulka & Kormeerka Guud ee Suuqa Somaliland (Hargeysa)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {adminAuthenticated ? (
            <>
              <span className="text-xs font-bold px-3 py-1.5 bg-emerald-100 text-[#0B7A3E] rounded-xl flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Super Admin · 2FA ✓ ({firebaseUser?.email})</span>
              </span>
              {currentDevice && (
                <span className="text-[11px] font-bold px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-xl flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#0B7A3E]" />
                  <span>{currentDevice.label}</span>
                </span>
              )}
              {!hasCloudListings && onSeedDatabase && (
                <button
                  onClick={async () => {
                    setSeeding(true);
                    try {
                      await onSeedDatabase();
                    } finally {
                      setSeeding(false);
                    }
                  }}
                  disabled={seeding}
                  className="text-xs font-bold px-3 py-1.5 bg-[#0B7A3E] text-white rounded-xl flex items-center gap-1.5 hover:bg-[#0F3D2A]"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{seeding ? 'Waa la kaydinayaa...' : 'Ku Shub Xogta Firestore'}</span>
                </button>
              )}
              {onLockSession && (
                <button
                  type="button"
                  onClick={onLockSession}
                  className="text-xs font-bold px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center gap-1.5"
                  title="Xidh Session-ka (Lock)"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Xidh Session</span>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => signInWithGoogleVerified()}
              className="text-xs font-bold px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Ku Gal Google Admin (Firestore Sync)</span>
            </button>
          )}
        </div>
      </div>

      {securityNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-[#0B7A3E] flex items-center justify-between gap-2">
          <span>✓ {securityNotice}</span>
          <button onClick={() => setSecurityNotice(null)} className="px-2">✕</button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-[#C9D2CD] shadow-xs space-y-2 min-w-0">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Macaamiisha (Users)</span>
            <Users className="w-4 h-4 text-[#0B7A3E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F3D2A] tabular-nums">48,210</div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+4.1% bishan</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-3xl border border-[#C9D2CD] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Guryaha Live-ka ah</span>
            <Building2 className="w-4 h-4 text-[#0B7A3E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F3D2A] tabular-nums">
            {liveListings.length + 23530}
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+2.3% cusub</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-3xl border border-[#C9D2CD] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Ballamaha (Bookings 30d)</span>
            <CalendarCheck className="w-4 h-4 text-[#0B7A3E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F3D2A] tabular-nums">1,284</div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+9.6% kobac</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-3xl border border-[#C9D2CD] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Dakhliga (Revenue 30d)</span>
            <DollarSign className="w-4 h-4 text-[#0B7A3E]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0B7A3E] tabular-nums">$38,900</div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+6.0% Zaad / eDahab</span>
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveAdminTab('approvals')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeAdminTab === 'approvals'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Safka Ansixinta (Approvals Queue)</span>
          {pendingListings.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900">
              {pendingListings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('all_listings')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'all_listings'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Dhammaan Hantida ({listings.length})
        </button>

        <button
          onClick={() => setActiveAdminTab('brokers')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'brokers'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Dilaaliinta & KYC
        </button>

        <button
          onClick={() => setActiveAdminTab('financials')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shrink-0 ${
            activeAdminTab === 'financials'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Lacag-Bixinta & Xisaabaadka
        </button>

        <button
          onClick={() => setActiveAdminTab('security')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
            activeAdminTab === 'security'
              ? 'bg-[#0F3D2A] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Ammaanka, Devices & Audit Log</span>
        </button>
      </div>

      {/* Tab 1: Approvals Queue */}
      {activeAdminTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F3D2A]">
              Xayeysiisyada Sugaya Ansixinta (Listings Awaiting Moderation)
            </h3>
            <span className="text-xs text-slate-500">
              SLA: Hubin lagu sameeyo 4 saacadood gudahood
            </span>
          </div>

          {pendingListings.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 border border-[#C9D2CD] text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-[#0B7A3E] mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-slate-800">Safka Ansixintu Waa Maran Yahay!</h4>
              <p className="text-xs text-slate-500">
                Dhammaan xayeysiisyada waa la ansixiyay. Marka guri cusub la soo geliyo halkan ayuu toos uga soo muuqanayaa.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white rounded-3xl border-2 border-amber-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Pending Approval
                        </span>
                        <span className="text-xs font-bold text-[#0B7A3E] capitalize">
                          {listing.purpose} · {listing.property_type}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1 truncate">{listing.title}</h4>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {listing.district}, Hargeysa · {listing.address}
                      </div>
                      <div className="text-xs font-black text-[#0B7A3E] mt-1 tabular-nums">
                        ${listing.price.toLocaleString()} {listing.price_unit === 'month' ? '/bil' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      onClick={() => onViewListingDetail(listing)}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-colors"
                    >
                      Eeg Sawirrada
                    </button>
                    <button
                      onClick={() => setRejectId(listing.id)}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-600 rounded-xl transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Diid (Reject)</span>
                    </button>
                    <button
                      onClick={() => handleApproveWithAudit(listing.id)}
                      className="px-4 py-2 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ansixi (Approve)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: All Listings */}
      {activeAdminTab === 'all_listings' && (
        <div className="bg-white rounded-3xl border border-[#C9D2CD] overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-sm font-bold text-[#0F3D2A]">Diiwaanka Hantida Hargeysa ({listings.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">ID</th>
                  <th className="p-3">Guriga</th>
                  <th className="p-3">Degmada</th>
                  <th className="p-3">Qiimaha</th>
                  <th className="p-3">Dilaalka</th>
                  <th className="p-3">Xaaladda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listings.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-400">#{l.id}</td>
                    <td className="p-3 font-bold text-slate-800">{l.title}</td>
                    <td className="p-3 text-slate-600">{l.district}</td>
                    <td className="p-3 font-bold text-[#0B7A3E] tabular-nums">${l.price.toLocaleString()}</td>
                    <td className="p-3 text-slate-600">{l.broker.name}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'live'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Brokers */}
      {activeAdminTab === 'brokers' && (
        <div className="bg-white rounded-3xl border border-[#C9D2CD] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#0F3D2A]">Dilaaliinta La Diiwaangeliyay (Verified Brokers)</h3>
          <div className="space-y-3">
            {[
              { name: 'Axmed Xasan Rooble', license: 'SL-MOP-2024-089', district: 'Jigjiga Yar', status: 'Approved' },
              { name: 'Saynab Cali Jaamac', license: 'SL-MOP-2023-412', district: 'Ibraahim Koodbuur', status: 'Approved' },
              { name: 'Mustafe Cabdi Daahir', license: 'SL-MOP-2025-104', district: '26 June', status: 'Approved' },
            ].map((b, i) => (
              <div key={i} className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">{b.name}</div>
                  <div className="text-[11px] text-slate-500">Shati: {b.license} · {b.district}</div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Financial Transactions */}
      {activeAdminTab === 'financials' && (
        <div className="bg-white rounded-3xl border border-[#C9D2CD] p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#0F3D2A]">Diiwaanka Lacag-Bixinta (Telesom Zaad / Somtel eDahab)</h3>
          <div className="space-y-2">
            {[
              { id: 'TX-8801', user: 'Cali Maxamuud', service: 'Booking Deposit', amount: '$90', status: 'Paid (Zaad)' },
              { id: 'TX-8802', user: 'Hodan Real Estate', service: 'Pro Subscription', amount: '$40', status: 'Paid (eDahab)' },
              { id: 'TX-8803', user: 'Dahabshiil Group', service: 'Featured Placement', amount: '$150', status: 'Paid (Zaad)' },
            ].map((tx, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-mono font-bold text-slate-500 mr-2">{tx.id}</span>
                  <span className="font-bold text-slate-800">{tx.user}</span>
                  <span className="text-slate-400 mx-1">·</span>
                  <span className="text-slate-500">{tx.service}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-[#0B7A3E] tabular-nums">{tx.amount}</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Super Admin Security, Trusted Devices, Kill Switch & Audit Log */}
      {activeAdminTab === 'security' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Trusted Devices Card */}
            <div className="bg-white rounded-3xl border border-[#C9D2CD] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#0B7A3E]" />
                  <h3 className="text-sm font-bold text-[#0F3D2A]">
                    Trusted Devices (Device Binding)
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  {devices.filter((d) => d.trusted).length} firfircoon
                </span>
              </div>

              {devices.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Weli qalab diiwaangashan ma jiro.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {devices.map((dev) => (
                    <div
                      key={dev.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {dev.label}
                          </span>
                          {currentDevice?.id === dev.id && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#0B7A3E]">
                              Qalabkan
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          FP: {dev.fingerprint} · Last: {new Date(dev.lastSeenAt || dev.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      {dev.trusted ? (
                        <button
                          type="button"
                          onClick={() =>
                            executeWithStepUp(
                              `Ka saar qalabka (${dev.label})`,
                              async () => {
                                if (!firebaseUser) return;
                                await revokeAdminDevice(firebaseUser, dev.id);
                                await appendAuditLog(firebaseUser, {
                                  action: 'device.revoked',
                                  target: dev.id,
                                  details: `Qalabka ${dev.label} waa laga qaaday kalsoonida (Revoked).`,
                                  deviceLabel: currentDevice?.label || 'Admin Web',
                                  stepUpUsed: true,
                                });
                                setSecurityNotice(`Qalabka ${dev.label} waa la joojiyay.`);
                              }
                            )
                          }
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold rounded-xl shrink-0"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-xl shrink-0">
                          Revoked
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Emergency Kill Switch & Future Expansion Card */}
            <div className="space-y-4">
              <div className="bg-red-50/70 rounded-3xl border border-red-200 p-5 space-y-3">
                <div className="flex items-center gap-2 text-red-800">
                  <Power className="w-5 h-5" />
                  <h3 className="text-sm font-black">Kill Switch (Xaalad Degdeg ah)</h3>
                </div>
                <p className="text-xs text-red-900/80 leading-relaxed">
                  Haddii aad ka shakido in qalab lumay ama session la xaday, riix badhankan si loo xidho dhammaan sessions-ka, loo joojiyo dhammaan trusted devices, loona kordhiyo Session Epoch ({adminRecord?.sessionEpoch || 1}).
                </p>
                <button
                  type="button"
                  onClick={() =>
                    executeWithStepUp('Fulinta Kill Switch (Xidh Dhammaan Sessions)', async () => {
                      if (!firebaseUser || !adminRecord) return;
                      await triggerSuperAdminKillSwitch(
                        firebaseUser,
                        adminRecord.sessionEpoch,
                        devices,
                        currentDevice?.label || 'Admin Web'
                      );
                      onLockSession?.();
                    })
                  }
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  <span>Xidh Dhammaan Sessions (Kill Switch)</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl border border-[#C9D2CD] p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-[#0F3D2A]">
                    Heerka Maamulka Hadda & Mustaqbalka
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0B7A3E] text-[10px] font-bold">
                    Super Admin Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Hadda nidaamku wuxuu u shaqaynayaa <strong>Super Admin keliya</strong> ({firebaseUser?.email}) isagoo leh 2FA TOTP, Device Binding, Step-Up Auth, iyo Audit Log. Qaab-dhismeedka database-ka (`admin_invitations`, `subRole`) wuxuu diyaar u yahay marka mustaqbalka lagu daro Moderator, Finance, iyo Support.
                </p>
              </div>
            </div>
          </div>

          {/* Immutable Audit Log Table */}
          <div className="bg-white rounded-3xl border border-[#C9D2CD] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0B7A3E]" />
                <h3 className="text-sm font-bold text-[#0F3D2A]">
                  Audit Log (Diiwaan Aan La Tirtiri Karin)
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">{auditLogs.length} dhacdo</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Weli wax dhacdo ah laguma qorin Audit Log-ga.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Waqtiga</th>
                      <th className="p-3">Ficilka (Action)</th>
                      <th className="p-3">Faahfaahin</th>
                      <th className="p-3">Qalabka</th>
                      <th className="p-3">Step-Up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500 whitespace-nowrap tabular-nums">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold text-[#0F3D2A]">{log.action}</td>
                        <td className="p-3 text-slate-700 max-w-md">{log.details}</td>
                        <td className="p-3 text-slate-500 whitespace-nowrap">{log.deviceLabel}</td>
                        <td className="p-3">
                          {log.stepUpUsed ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0B7A3E] text-[10px] font-bold">
                              2FA ✓
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">—</span>
                          )}
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

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-3">
            <h4 className="text-sm font-bold text-red-600">Sababta loo Diiday Xayeysiiska:</h4>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
            >
              <option value="Dukumenti lahaansho oo aan caddayn">Dukumenti lahaansho oo aan caddayn</option>
              <option value="Sawirro tayo xun ama been abuur ah">Sawirro tayo xun ama been abuur ah</option>
              <option value="Qiimo aan waafaqsanayn suuqa Hargeysa">Qiimo aan waafaqsanayn suuqa Hargeysa</option>
              <option value="Cinwaan khaldan">Cinwaan khaldan</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectId(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Ka noqo
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Xaqiiji Diidmada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step-Up 2FA Modal for High-Risk Super Admin Actions */}
      {stepUpAction && (
        <div className="fixed inset-0 z-[520] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleStepUpSubmit}
            className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#0F3D2A]">Step-Up 2FA Xaqiijin</h4>
                <p className="text-[11px] text-slate-500">{stepUpAction.title}</p>
              </div>
            </div>

            {stepUpError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{stepUpError}</span>
              </div>
            )}

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={stepUpCode}
              onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full h-12 text-center tracking-[0.35em] font-mono text-lg font-black bg-slate-50 border border-slate-300 rounded-2xl focus:bg-white focus:border-[#0B7A3E] outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStepUpAction(null)}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                Ka noqo
              </button>
              <button
                type="submit"
                disabled={stepUpBusy || stepUpCode.length !== 6}
                className="px-4 py-2 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
              >
                {stepUpBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xaqiiji & Fuli</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
