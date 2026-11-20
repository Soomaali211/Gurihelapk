import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  SlidersHorizontal,
  X,
  Laptop,
  Smartphone,
  ShieldCheck,
  LogOut,
  LogIn,
} from 'lucide-react';
import { AuthUser, isAdminRole } from '../types';

interface TopBarProps {
  currentView: 'mobile' | 'admin';
  onViewChange: (view: 'mobile' | 'admin') => void;
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onAiSearch: (query: string) => Promise<void>;
  aiFilterActive: boolean;
  aiExplanation?: string;
  onClearAiFilter: () => void;
  isSearchingAi: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onViewChange,
  currentUser,
  onOpenLogin,
  onLogout,
  onAiSearch,
  aiFilterActive,
  aiExplanation,
  onClearAiFilter,
  isSearchingAi,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  const isAdmin = isAdminRole(currentUser?.role);

  const QUICK_PROMPTS = [
    'Villa 4 qol Jigjiga Yar oo kiro ah < $600',
    'Dhul ku yaal Masalaha oo iib ah',
    'Apartment qalabaysan (furnished) Ibraahim Koodbuur',
    'Guri ballan maalinle ah oo 2 qol ah',
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-5">
          {/* Row 1: Official Brand + Controls */}
          <div className="flex items-center justify-between gap-2 sm:contents">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
                alt="GuriHel"
                className="h-8 sm:h-9 w-auto object-contain"
              />
              <span className="hidden lg:inline-block text-xs font-medium text-slate-500 border-l border-slate-200 pl-2.5">
                Hargeisa
              </span>
            </div>

            {/* Right Controls Zone */}
            <div className="flex items-center gap-2 shrink-0 sm:order-3">
              {/* View switcher shown ONLY for authenticated Admin accounts */}
              {isAdmin && (
                <div className="flex items-center bg-[#EEF2F0] p-0.5 rounded-xl border border-[#C9D2CD]/60">
                  <button
                    type="button"
                    onClick={() => onViewChange('mobile')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      currentView === 'mobile'
                        ? 'bg-white text-[#0B7A3E] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Mobile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onViewChange('admin')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      currentView === 'admin'
                        ? 'bg-white text-[#0B7A3E] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Admin Portal</span>
                  </button>
                </div>
              )}

              {/* Auth Status + Action */}
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#0F3D2A]">
                    {isAdmin && <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A3E]" />}
                    <span className="truncate max-w-[160px]">
                      {currentUser.fullName || currentUser.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="px-3 py-1.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>

          {/* Center AI Search Bar */}
          <div className="w-full sm:flex-1 sm:max-w-xl relative sm:order-2 min-w-0">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-1.5 min-w-0">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="AI Search: Villa Jigjiga Yar < $600..."
                  className={`w-full min-w-0 h-9 sm:h-10 pl-9 pr-14 sm:pr-24 text-xs sm:text-sm bg-[#EEF2F0] focus:bg-white text-[#18211C] placeholder:text-slate-500 rounded-xl border transition-all outline-none ${
                    aiFilterActive
                      ? 'border-[#0B7A3E] ring-2 ring-[#0B7A3E]/20 bg-emerald-50/40'
                      : 'border-transparent focus:border-[#0B7A3E]'
                  }`}
                />
                <Sparkles className="w-4 h-4 text-[#0B7A3E] absolute left-3 top-2.5 sm:top-3" />

                {aiFilterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      onClearAiFilter();
                    }}
                    className="absolute right-8 sm:right-16 top-1.5 sm:top-2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
                    title="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="absolute right-1.5 top-1 sm:top-1.5 px-2 py-1 text-[11px] font-semibold text-[#0B7A3E] hover:bg-emerald-100/70 rounded-lg flex items-center gap-1 transition-colors"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span className="hidden sm:inline">Prompts</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isSearchingAi}
                className="flex h-9 px-3 sm:px-3.5 items-center justify-center text-xs font-semibold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] rounded-xl transition-colors shrink-0 disabled:opacity-50"
              >
                {isSearchingAi ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-1">
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Search</span>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {aiFilterActive && aiExplanation && (
          <div className="bg-emerald-50 border-t border-emerald-200/80 px-3 sm:px-4 py-1.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-emerald-900 gap-2">
              <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" />
                <span className="font-semibold text-[#0B7A3E] shrink-0">AI:</span>
                <span className="truncate">{aiExplanation}</span>
              </div>
              <button
                type="button"
                onClick={onClearAiFilter}
                className="shrink-0 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </header>

      {showAiModal && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 sm:p-6 border border-[#C9D2CD]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-100 text-[#0B7A3E] shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#0F3D2A] truncate">
                    AI Smart Property Search
                  </h3>
                  <p className="text-xs text-slate-500">
                    Search naturally in Somali or English
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="mt-4">
              <textarea
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. Villa kiro ah oo Jigjiga Yar ku taal, 4 qol leh, ka hooseeya $700..."
                rows={3}
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#0B7A3E] outline-none resize-none"
              />

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500 mb-2">Quick Prompts:</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePromptClick(prompt)}
                      className="text-left text-xs px-3 py-1.5 bg-[#EEF2F0] hover:bg-emerald-50 hover:text-[#0B7A3E] rounded-lg transition-colors"
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSearchingAi || !searchInput.trim()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0B7A3E] hover:bg-[#0F3D2A] rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSearchingAi ? 'Searching...' : 'Search'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
