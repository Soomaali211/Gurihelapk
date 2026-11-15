import React, { useState } from 'react';
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
  Database
} from 'lucide-react';
import { Listing } from '../types';
import { isVerifiedAdmin, signInWithGoogleVerified } from '../lib/firestoreRepo';

interface AdminDashboardProps {
  listings: Listing[];
  onApproveListing: (id: string) => void;
  onRejectListing: (id: string, reason: string) => void;
  onViewListingDetail: (listing: Listing) => void;
  firebaseUser?: FirebaseUser | null;
  hasCloudListings?: boolean;
  onSeedDatabase?: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  listings,
  onApproveListing,
  onRejectListing,
  onViewListingDetail,
  firebaseUser,
  hasCloudListings,
  onSeedDatabase,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'approvals' | 'all_listings' | 'brokers' | 'financials'>('approvals');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Dukumenti lahaansho oo aan caddayn');
  const [seeding, setSeeding] = useState(false);

  const pendingListings = listings.filter((l) => l.status === 'pending');
  const liveListings = listings.filter((l) => l.status === 'live');
  const adminAuthenticated = isVerifiedAdmin(firebaseUser || null);

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectId) {
      onRejectListing(rejectId, rejectReason);
      setRejectId(null);
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
                Firestore Admin ({firebaseUser?.email})
              </span>
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
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeAdminTab === 'financials'
              ? 'bg-[#0B7A3E] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Lacag-Bixinta & Xisaabaadka
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
                      onClick={() => onApproveListing(listing.id)}
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

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
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
    </div>
  );
};
