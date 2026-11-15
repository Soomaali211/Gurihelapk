import React, { useState } from 'react';
import { 
  ArrowLeft,
  ShieldCheck, 
  Heart, 
  Upload, 
  LogOut
} from 'lucide-react';
import { Listing, UserRole } from '../types';

interface ProfileViewProps {
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  favorites: Listing[];
  onSelectListing: (listing: Listing) => void;
  myListings: Listing[];
  onOpenAddModal: () => void;
  onBack?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userRole,
  onRoleChange,
  favorites,
  onSelectListing,
  myListings,
  onOpenAddModal,
  onBack,
}) => {
  const [authStep, setAuthStep] = useState<'login' | 'otp' | 'authenticated'>('login');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'favorites' | 'listings' | 'kyc'>('info');
  const [kycUploaded, setKycUploaded] = useState(false);
  const [language, setLanguage] = useState<'SO' | 'EN' | 'AR'>('SO');

  const isPhoneValid = phoneInput.replace(/\D/g, '').length >= 7;

  const handleContinueLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPhoneValid) return;
    setAuthStep('otp');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStep('authenticated');
  };

  // Screenshot 5: Dedicated Clean White Phone Login Screen
  if (authStep === 'login') {
    return (
      <div className="bg-white min-h-[610px] flex flex-col px-5 pt-3 pb-8 font-sans select-none">
        {/* Top Green Back Arrow */}
        <div>
          <button
            onClick={onBack}
            className="p-1 -ml-1 hover:bg-slate-100 rounded-full text-[#0B7A3E] transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>

        {/* Heading & Subtitle matching Screenshot 5 */}
        <div className="mt-12 space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Login
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Enter your mobile number to log in to GuriHel
          </p>
        </div>

        {/* Phone Number Form */}
        <form onSubmit={handleContinueLogin} className="mt-8 space-y-3">
          <label className="block text-sm font-bold text-slate-800">
            Mobile number
          </label>

          {/* Unified Rounded Country Code Input (+252 | 63 xxx xxxx) */}
          <div className="flex items-center h-12 rounded-xl border border-slate-300 bg-[#F4F6F8] px-3.5 focus-within:border-[#0B7A3E] focus-within:bg-white transition-colors">
            <span className="text-sm font-bold text-slate-500 pr-3 border-r border-slate-300 tabular-nums">
              +252
            </span>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="63 xxx xxxx"
              className="flex-1 pl-3 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none tabular-nums"
            />
          </div>

          <p className="text-xs text-slate-400 leading-relaxed pt-0.5">
            Your mobile number is hidden and will only appear if you add an ad
          </p>

          {/* Full-width Continue Button (Muted sage green until valid, vivid green when ready) */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!isPhoneValid}
              className={`w-full h-12 rounded-xl text-sm font-bold text-white transition-colors ${
                isPhoneValid
                  ? 'bg-[#0B7A3E] hover:bg-[#0F3D2A] shadow-sm cursor-pointer'
                  : 'bg-[#8CC2A3] cursor-not-allowed'
              }`}
            >
              Continue
            </button>
          </div>
        </form>

        {/* Quick Demo Profile Skip for testing */}
        <div className="mt-auto pt-6 text-center">
          <button
            type="button"
            onClick={() => setAuthStep('authenticated')}
            className="text-xs font-bold text-[#0B7A3E] hover:underline"
          >
            Fur Profile-ka Demo ah (Skip OTP) →
          </button>
        </div>
      </div>
    );
  }

  // Step 2: OTP Verification
  if (authStep === 'otp') {
    return (
      <div className="bg-white min-h-[610px] flex flex-col px-5 pt-3 pb-8 font-sans select-none">
        <div>
          <button
            onClick={() => setAuthStep('login')}
            className="p-1 -ml-1 hover:bg-slate-100 rounded-full text-[#0B7A3E] transition-colors"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.2]" />
          </button>
        </div>

        <div className="mt-12 space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900">Verify OTP</h1>
          <p className="text-sm text-slate-600">
            Waxaan kood 4-god ah u dirnay <span className="font-bold text-slate-900">+252 {phoneInput}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyOtp} className="mt-8 space-y-4">
          <input
            type="text"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="Geli 1234"
            className="w-full h-12 px-4 text-center tracking-[0.5em] text-lg font-extrabold rounded-xl border border-slate-300 bg-[#F4F6F8] focus:bg-white focus:border-[#0B7A3E] outline-none"
          />
          <button
            type="submit"
            className="w-full h-12 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            Xaqiiji & Gal
          </button>
        </form>
      </div>
    );
  }

  // Step 3: Authenticated Profile Dashboard
  return (
    <div className="p-4 space-y-5 bg-[#F6F8F9] min-h-[610px] pb-16">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center text-base font-black">
              {userRole === 'admin' ? 'AD' : userRole === 'broker' ? 'AX' : 'MC'}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-white rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A3E]" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold text-slate-900">
                {userRole === 'admin'
                  ? 'Admin Maamule'
                  : userRole === 'broker'
                  ? 'Axmed Xasan Rooble'
                  : 'Macaamiil GuriHel'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-[#0B7A3E]">
                {userRole}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">+252 {phoneInput || '63 4421980'} · Hargeysa</div>
          </div>
        </div>

        <button
          onClick={() => setAuthStep('login')}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl flex items-center gap-1"
          title="Back to Login screen"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Ka Bax</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'info', label: 'Akoonka' },
          { id: 'favorites', label: `La Kaydiyay (${favorites.length})` },
          { id: 'listings', label: `Hantidayda (${myListings.length})` },
          { id: 'kyc', label: 'Hubinta KYC' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
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

      {/* Account Info Tab */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900">Doorkaaga Nidaamka (RBAC Role)</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'seeker', label: 'Macaamiil', desc: 'Raadi & kaydi' },
                { id: 'broker', label: 'Dilaal', desc: 'Soo geli hanti' },
                { id: 'admin', label: 'Admin', desc: 'Ansixi liisaska' },
              ].map((r) => (
                <div
                  key={r.id}
                  onClick={() => onRoleChange(r.id as UserRole)}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                    userRole === r.id
                      ? 'bg-emerald-50 border-[#0B7A3E]'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{r.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-3 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900">Luqadda App-ka</h4>
            <div className="flex gap-2">
              {[
                { code: 'SO', name: 'Af-Soomaali' },
                { code: 'EN', name: 'English' },
                { code: 'AR', name: 'العربية' },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                    language === l.code
                      ? 'bg-[#0B7A3E] text-white border-[#0B7A3E]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && (
        <div className="space-y-2.5">
          {favorites.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center text-xs text-slate-400">
              <Heart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              Weli ma jiro guri aad kaydsatay.
            </div>
          ) : (
            favorites.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectListing(l)}
                className="bg-white p-3 rounded-2xl border border-slate-200 flex gap-3 cursor-pointer hover:border-[#0B7A3E] transition-all"
              >
                <img src={l.images[0]} alt={l.title} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{l.title}</h4>
                  <div className="text-[11px] text-slate-500">{l.district}, Hargeysa</div>
                  <div className="text-xs font-black text-[#0B7A3E] mt-1 tabular-nums">
                    ${l.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Listings Tab */}
      {activeTab === 'listings' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-900">Guryaha Aad Soo Gelisay</h4>
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
            >
              + Soo Geli
            </button>
          </div>
          {myListings.map((l) => (
            <div key={l.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center gap-3">
              <img src={l.images[0]} alt={l.title} className="w-12 h-12 rounded-xl object-cover shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">{l.title}</div>
                <div className="text-[11px] text-slate-500">${l.price.toLocaleString()} · {l.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KYC Tab */}
      {activeTab === 'kyc' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h4 className="text-xs font-bold text-slate-900">Xaqiijinta Sharciga (KYC)</h4>
          {kycUploaded ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold">
              ✓ Dukumentiyadaada waa la gudbiyay!
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center bg-slate-50">
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-700">Soo geli Shatiga Dilaalka / National ID</div>
              </div>
              <button
                onClick={() => setKycUploaded(true)}
                className="w-full py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
              >
                Gudbi Dukumentiyada
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
