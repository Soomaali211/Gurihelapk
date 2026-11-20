import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Heart,
  LogIn,
  LogOut,
  ShieldCheck,
  Laptop,
  AlertCircle,
} from 'lucide-react';
import { AuthUser, Listing, isAdminRole } from '../types';
import { resolveApiUrl, updateMyProfile } from '../lib/apiClient';

interface ProfileViewProps {
  currentUser: AuthUser | null;
  favorites: Listing[];
  myListings: Listing[];
  onSelectListing: (listing: Listing) => void;
  onOpenAddModal: () => void;
  onOpenLogin: () => void;
  onProfileUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  onLogoutAll: () => void;
  onOpenAdminPortal?: () => void;
  onBack?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  favorites,
  myListings,
  onSelectListing,
  onOpenAddModal,
  onOpenLogin,
  onProfileUpdated,
  onLogout,
  onLogoutAll,
  onOpenAdminPortal,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'favorites' | 'listings'>('info');
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phoneE164, setPhoneE164] = useState(currentUser?.phoneE164 || '');
  const [city, setCity] = useState(currentUser?.city || 'Hargeisa');
  const [language, setLanguage] = useState<'SO' | 'EN' | 'AR'>(currentUser?.language || 'SO');

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) {
    return (
      <div className="bg-white min-h-full w-full flex flex-col px-5 pt-4 pb-8 font-sans">
        <div className="flex items-center justify-between">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-full text-[#0B7A3E] hover:bg-emerald-50"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <img
            src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
            alt="GuriHel"
            className="h-8 w-auto object-contain"
          />
          <div className="w-6" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 max-w-xs mx-auto">
          <img
            src="/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png"
            alt="GuriHel Icon"
            className="w-16 h-16 rounded-2xl shadow-sm"
          />
          <h2 className="text-lg font-extrabold text-slate-900">Sign In to GuriHel</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sign in with your email address to save favorites, add properties, and manage bookings.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full py-3 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In or Create Account</span>
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = isAdminRole(currentUser.role);
  const displayName = currentUser.fullName || currentUser.email || 'GuriHel Member';
  const initials = displayName
    .replace(/[^a-zA-Z ]/g, '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await updateMyProfile({
        fullName: fullName.trim(),
        phoneE164: phoneE164.trim(),
        city,
        language,
      });
      onProfileUpdated(res.user);
      setNotice('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-5 bg-[#F6F8F9] min-h-full w-full overflow-x-hidden pb-10 font-sans">
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center text-base font-black">
              {initials || 'GH'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-white rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A3E]" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900 truncate">{displayName}</h3>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-[#0B7A3E] shrink-0">
                  {currentUser.isPrimaryAdmin ? 'Primary Admin' : 'Admin'}
                </span>
              )}
            </div>
            {currentUser.email && (
              <div className="text-[11px] text-slate-500 truncate">{currentUser.email}</div>
            )}
            <div className="text-[11px] text-slate-500 truncate">{currentUser.city}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl flex items-center gap-1 shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>

      {/* Admin-only shortcut inside APK (strictly hidden for Regular Users) */}
      {isAdmin && onOpenAdminPortal && (
        <button
          type="button"
          onClick={onOpenAdminPortal}
          className="w-full py-3 px-4 bg-[#0F3D2A] hover:bg-[#0B7A3E] text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
        >
          <Laptop className="w-4 h-4" />
          <span>Open Admin Dashboard</span>
        </button>
      )}

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-[#0B7A3E] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'info', label: 'Account' },
          { id: 'favorites', label: `Saved (${favorites.length})` },
          { id: 'listings', label: `My Properties (${myListings.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as 'info' | 'favorites' | 'listings')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl shrink-0 transition-colors ${
              activeTab === t.id
                ? 'bg-[#0B7A3E] text-white'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="space-y-4">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 text-xs"
          >
            <h4 className="font-bold text-slate-900">Profile Details</h4>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Verified Email
              </label>
              <input
                type="email"
                readOnly
                value={currentUser.email}
                className="w-full h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-600"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phoneE164}
                onChange={(e) => setPhoneE164(e.target.value)}
                placeholder="+252..."
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                >
                  <option value="Hargeisa">Hargeisa</option>
                  <option value="Berbera">Berbera</option>
                  <option value="Burco">Burco</option>
                  <option value="Borama">Borama</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'SO' | 'EN' | 'AR')}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                >
                  <option value="SO">Af-Soomaali</option>
                  <option value="EN">English</option>
                  <option value="AR">العربية</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white font-bold rounded-xl disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <button
            type="button"
            onClick={onLogoutAll}
            className="w-full py-2.5 bg-white border border-red-200 text-red-700 text-xs font-bold rounded-xl hover:bg-red-50"
          >
            Log Out From All Devices
          </button>
        </div>
      )}

      {activeTab === 'favorites' && (
        <div className="space-y-2.5">
          {favorites.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-xs text-slate-400">
              <Heart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              No saved properties yet.
            </div>
          ) : (
            favorites.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectListing(l)}
                className="bg-white p-3 rounded-2xl border border-slate-200 flex gap-3 cursor-pointer hover:border-[#0B7A3E]"
              >
                <img
                  src={
                    l.images[0]
                      ? resolveApiUrl(l.images[0])
                      : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'
                  }
                  alt={l.title}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100"
                />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{l.title}</h4>
                  <div className="text-[11px] text-slate-500">
                    {l.district}, {l.city}
                  </div>
                  <div className="text-xs font-black text-[#0B7A3E] mt-1 tabular-nums">
                    ${l.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-900">Your Submitted Properties</h4>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
            >
              + Add Property
            </button>
          </div>
          {myListings.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-xs text-slate-400">
              You have not added any properties yet.
            </div>
          ) : (
            myListings.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectListing(l)}
                className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3 cursor-pointer"
              >
                <img
                  src={
                    l.images[0]
                      ? resolveApiUrl(l.images[0])
                      : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'
                  }
                  alt={l.title}
                  className="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{l.title}</div>
                  <div className="text-[11px] text-slate-500">
                    ${l.price.toLocaleString()} · {l.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
