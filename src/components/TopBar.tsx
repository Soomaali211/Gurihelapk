import React, { useState } from 'react';
import { Sparkles, Search, SlidersHorizontal, X, Check, Laptop, Smartphone, UserCircle, Cpu } from 'lucide-react';
import { UserRole } from '../types';

interface TopBarProps {
  currentView: 'mobile' | 'admin';
  onViewChange: (view: 'mobile' | 'admin') => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAiSearch: (query: string) => Promise<void>;
  aiFilterActive: boolean;
  aiExplanation?: string;
  onClearAiFilter: () => void;
  isSearchingAi: boolean;
  onOpenTechStack: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onViewChange,
  userRole,
  onRoleChange,
  onAiSearch,
  aiFilterActive,
  aiExplanation,
  onClearAiFilter,
  isSearchingAi,
  onOpenTechStack,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [activeLang, setActiveLang] = useState<'SO' | 'EN'>('SO');

  const QUICK_PROMPTS = [
    'Villa 4 qol Jigjiga Yar oo kiro ah < $600',
    'Dhul ku yaal Masalaha oo iib ah',
    'Apartment qalabaysan (furnished) Ibraahim Koodbuur',
    'Guri ballan maalinle ah oo 2 qol ah',
    'Dabaq ganacsi oo 26 June ku yaal',
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    onAiSearch(searchInput.trim());
    setShowAiModal(false);
  };

  const handlePromptClick = (prompt: string) => {
    setSearchInput(prompt);
    onAiSearch(prompt);
    setShowAiModal(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-[#C9D2CD] shadow-xs safe-top">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
          {/* Row 1 on mobile: Brand + Controls */}
          <div className="flex items-center justify-between gap-2 sm:contents">
            {/* Brand Zone */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0B7A3E] text-white flex items-center justify-center font-black text-base sm:text-lg shadow-sm">
                G
              </div>
              <div className="leading-tight">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0F3D2A]">
                  Guri<span className="text-[#0B7A3E]">Hel</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500">
                  Hargeysa
                </span>
              </div>
            </div>

            {/* Right Controls Zone (placed in Row 1 on mobile, Row 1 right on desktop via sm:order-3) */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 sm:order-3">
              {/* Blueprint & Tech Stack 100% Inspector */}
              <button
                onClick={onOpenTechStack}
                className="px-2 sm:px-2.5 py-1.5 text-xs font-bold text-[#0B7A3E] bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-2xs transition-colors"
                title="Eeg Tech Stack-ka iyo Koodhadhka PDF Blueprint"
              >
                <Cpu className="w-3.5 h-3.5 text-[#0B7A3E]" />
                <span className="hidden sm:inline">Blueprint (100%)</span>
              </button>

              {/* View Switcher: Mobile vs Admin */}
              <div className="flex items-center bg-[#EEF2F0] p-0.5 sm:p-1 rounded-xl border border-[#C9D2CD]/60">
                <button
                  onClick={() => onViewChange('mobile')}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                    currentView === 'mobile'
                      ? 'bg-white text-[#0B7A3E] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Aragti Mobile Touch App ah"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Mobile</span>
                </button>
                <button
                  onClick={() => onViewChange('admin')}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium rounded-lg transition-all ${
                    currentView === 'admin'
                      ? 'bg-white text-[#0B7A3E] shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Aragti Admin Dashboard ah"
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Admin</span>
                </button>
              </div>

              {/* Role Switcher */}
              <div className="relative group">
                <button className="flex items-center gap-1 px-2 py-1.5 text-xs bg-[#EEF2F0] hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
                  <UserCircle className="w-3.5 h-3.5 text-[#0B7A3E]" />
                  <span className="capitalize font-medium text-[11px] hidden lg:inline">{userRole}</span>
                </button>
                <div className="absolute right-0 mt-1 w-36 bg-white border border-[#C9D2CD] rounded-xl shadow-lg py-1 hidden group-hover:block z-50">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">Dooro Doorka</div>
                  {(['seeker', 'broker', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => onRoleChange(r)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-50 capitalize ${
                        userRole === r ? 'font-bold text-[#0B7A3E]' : 'text-slate-700'
                      }`}
                    >
                      <span>{r === 'seeker' ? 'Macaamiil' : r === 'broker' ? 'Dilaal' : 'Maamul (Admin)'}</span>
                      {userRole === r && <Check className="w-3 h-3 text-[#0B7A3E]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Switcher */}
              <button
                onClick={() => setActiveLang((prev) => (prev === 'SO' ? 'EN' : 'SO'))}
                className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-[#0B7A3E] bg-[#EEF2F0] rounded-lg transition-colors"
                title="Beddel Luqadda"
              >
                {activeLang}
              </button>
            </div>
          </div>

          {/* AI Search Bar (Center Zone on desktop, Row 2 on mobile web) */}
          <div className="w-full sm:flex-1 sm:max-w-xl relative sm:order-2 min-w-0">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-1.5 min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="AI Search: Villa Jigjiga Yar < $600..."
                  className={`w-full min-w-0 h-9 sm:h-10 pl-9 pr-14 sm:pr-24 text-xs sm:text-sm bg-[#EEF2F0] focus:bg-white text-[#18211C] placeholder:text-slate-500 rounded-full border transition-all outline-none ${
                    aiFilterActive
                      ? 'border-[#0B7A3E] ring-2 ring-[#0B7A3E]/20 bg-emerald-50/40'
                      : 'border-transparent focus:border-[#0B7A3E]'
                  }`}
                />
                <Sparkles className="w-4 h-4 text-[#0B7A3E] absolute left-3 top-2.5 sm:top-3 animate-pulse" />

                {aiFilterActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      onClearAiFilter();
                    }}
                    className="absolute right-8 sm:right-16 top-1.5 sm:top-2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
                    title="Nadiifi shaandhada"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="absolute right-1.5 top-1 sm:top-1.5 px-2 py-1 text-[11px] font-semibold text-[#0B7A3E] hover:bg-emerald-100/70 rounded-full flex items-center gap-1 transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span className="hidden sm:inline">Taloyin</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSearchingAi}
                className="flex h-9 px-3 sm:px-3.5 items-center justify-center text-xs font-semibold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] rounded-full transition-colors shrink-0 disabled:opacity-50"
              >
                {isSearchingAi ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Raadi</span>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* AI Result Banner when active */}
        {aiFilterActive && aiExplanation && (
          <div className="bg-emerald-50 border-t border-emerald-200/80 px-3 sm:px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-emerald-900 gap-2">
              <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" />
                <span className="font-semibold text-[#0B7A3E] shrink-0">AI:</span>
                <span className="truncate">{aiExplanation}</span>
              </div>
              <button
                onClick={onClearAiFilter}
                className="shrink-0 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline"
              >
                Dib u celi
              </button>
            </div>
          </div>
        )}
      </header>

      {/* AI Search Drawer / Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 sm:p-6 border border-[#C9D2CD] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-100 text-[#0B7A3E] shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#0F3D2A] truncate">AI Smart Property Search</h3>
                  <p className="text-xs text-slate-500">Qor luqad caadi ah si AI-du kuugu hesho guriga saxda ah</p>
                </div>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="mt-4">
              <div className="relative">
                <textarea
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="t.g. Waxaan raadinayaa villa kiro ah oo Jigjiga Yar ku taal, 4 qol leh, oo leh baabuur dhigasho iyo generator, qiimahana ka hooseeya $700 bishii..."
                  rows={3}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0B7A3E] focus:ring-2 focus:ring-[#0B7A3E]/20 outline-none resize-none"
                />
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 mb-2">Tusaalooyin Degdeg ah (Quick Prompts):</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left text-xs px-3 py-1.5 bg-[#EEF2F0] hover:bg-emerald-50 hover:text-[#0B7A3E] hover:border-emerald-300 border border-transparent rounded-lg transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={isSearchingAi || !searchInput.trim()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] rounded-xl flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSearchingAi ? 'AI ayaa Baaraysa...' : 'Ku Baar AI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
