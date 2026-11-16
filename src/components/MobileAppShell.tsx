import React, { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import {
  MapPin,
  Building2,
  Calendar,
  MessageSquare,
  LayoutGrid,
  User,
  Headphones,
  Smartphone,
  Maximize2,
  Menu,
  Square,
  ChevronLeft,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Listing,
  Project,
  ChatThread,
  SearchRequest,
  LeaseContract,
  UserRole,
  ListingPurpose,
  PropertyType,
  FilterState,
} from '../types';
import { PhoneStatusBar } from './PhoneStatusBar';
import { InteractiveMap } from './InteractiveMap';
import { ListingCard } from './ListingCard';
import { ProjectsView } from './ProjectsView';
import { BookingsView } from './BookingsView';
import { ChatView } from './ChatView';
import { ServicesView } from './ServicesView';
import { ProfileView } from './ProfileView';
import { ListingDetailModal } from './ListingDetailModal';
import { AddListingModal } from './AddListingModal';
import { FilterModal } from './FilterModal';

interface MobileAppShellProps {
  listings: Listing[];
  projects: Project[];
  chatThreads: ChatThread[];
  searchRequests: SearchRequest[];
  leaseContracts: LeaseContract[];
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onAddListing: (listing: Listing) => void;
  onAddSearchRequest: (req: SearchRequest) => void;
  onAddLeaseContract: (contract: LeaseContract) => void;
  onSendMessage: (threadId: string, text: string) => void;
  activeListingId?: string;
  onSelectListingId?: (id: string | null) => void;
  filteredListings: Listing[];
  purposeFilter: 'all' | ListingPurpose;
  onPurposeChange: (p: 'all' | ListingPurpose) => void;
  typeFilter: 'all' | PropertyType;
  onTypeChange: (t: 'all' | PropertyType) => void;
  advancedFilters: FilterState;
  onUpdateAdvancedFilters: (filters: FilterState) => void;
  onResetAdvancedFilters: () => void;
  firebaseUser?: FirebaseUser | null;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onAiSearch?: (query: string) => Promise<void>;
  aiFilterActive?: boolean;
  aiExplanation?: string;
  onClearAiFilter?: () => void;
  isSearchingAi?: boolean;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  listings,
  projects,
  chatThreads,
  searchRequests,
  leaseContracts,
  userRole,
  onRoleChange,
  onAddListing,
  onAddSearchRequest,
  onAddLeaseContract,
  onSendMessage,
  filteredListings,
  purposeFilter,
  onPurposeChange,
  typeFilter,
  onTypeChange,
  advancedFilters,
  onUpdateAdvancedFilters,
  onResetAdvancedFilters,
  firebaseUser,
  favorites,
  onToggleFavorite,
  onAiSearch,
  aiFilterActive,
  aiExplanation,
  onClearAiFilter,
  isSearchingAi,
}) => {
  const isNativeApk = Capacitor.isNativePlatform();
  const [activeTab, setActiveTab] = useState<'listings' | 'projects' | 'bookings' | 'chat' | 'services' | 'profile'>('listings');
  const [listingsSubView, setListingsSubView] = useState<'map' | 'list'>('map');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string>(chatThreads[0]?.id || '');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [useDeviceFrame, setUseDeviceFrame] = useState(!isNativeApk);
  const [showMobileAiModal, setShowMobileAiModal] = useState(false);
  const [mobileAiQuery, setMobileAiQuery] = useState('');

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(id);
  };

  const handleOpenChatWithBroker = () => {
    setSelectedListing(null);
    setActiveTab('chat');
  };

  const handleBookNowFromDetail = () => {
    setSelectedListing(null);
    setActiveTab('bookings');
  };

  const handleMobileAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileAiQuery.trim() || !onAiSearch) return;
    await onAiSearch(mobileAiQuery.trim());
    setShowMobileAiModal(false);
  };

  const favoriteListings = listings.filter((l) => favorites.includes(l.id));
  const myListings = listings.filter((l) => l.broker.id === 'b-01');

  return (
    <div
      className={
        isNativeApk
          ? 'bg-white flex-1 min-h-0 w-full max-w-full flex flex-col overflow-hidden'
          : 'flex-1 flex flex-col items-center justify-start bg-white sm:bg-[#EEF2F0] sm:py-4 sm:px-4 w-full max-w-full overflow-x-hidden'
      }
    >
      {/* Top Device Frame Toggle Bar (Desktop web preview only, hidden on <640px mobile & native APK) */}
      {!isNativeApk && (
        <div className="hidden sm:flex w-full max-w-md sm:max-w-xl items-center justify-between pb-3 px-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F3D2A]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>GuriHel Mobile APK UI</span>
          </div>

          <button
            onClick={() => setUseDeviceFrame(!useDeviceFrame)}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-[#C9D2CD] shadow-2xs flex items-center gap-1.5 transition-all"
          >
            {useDeviceFrame ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-[#0B7A3E]" />
                <span>Full Screen</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-[#0B7A3E]" />
                <span>APK Phone Chassis</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mobile App Container: Full viewport on APK & mobile screens (<640px); optional chassis on desktop web */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col overflow-hidden bg-white ${
          isNativeApk
            ? 'flex-1 min-h-0'
            : useDeviceFrame
            ? 'flex-1 min-h-0 sm:flex-initial sm:h-[680px] sm:max-w-[410px] sm:rounded-[40px] sm:border-[8px] sm:border-slate-900 sm:shadow-2xl sm:ring-2 sm:ring-slate-800/20'
            : 'flex-1 min-h-0 sm:min-h-[680px] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-[#C9D2CD] sm:shadow-lg'
        }`}
      >
        {/* Native Android Status Bar Safe-Area Top Spacer (on native APK) */}
        {isNativeApk && <div className="bg-white safe-top shrink-0" />}

        {/* Simulated Light Status Bar (Desktop chassis preview only) */}
        {!isNativeApk && (
          <div className="hidden sm:block shrink-0">
            <PhoneStatusBar time="10:36" batteryPercentage={51} />
          </div>
        )}

        {/* Active AI Search Banner inside Native APK */}
        {isNativeApk && aiFilterActive && aiExplanation && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-emerald-900 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" />
              <span className="truncate font-medium">{aiExplanation}</span>
            </div>
            {onClearAiFilter && (
              <button
                type="button"
                onClick={onClearAiFilter}
                className="font-bold text-[#0B7A3E] underline shrink-0"
              >
                Nadiifi
              </button>
            )}
          </div>
        )}

        {/* Dynamic Screen View */}
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#F6F8F9]">
          {/* Tab 1: Listings */}
          {activeTab === 'listings' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {listingsSubView === 'map' ? (
                <InteractiveMap
                  listings={filteredListings}
                  selectedListing={selectedListing}
                  onSelectListing={(l) => setSelectedListing(l)}
                  purposeFilter={purposeFilter}
                  onPurposeChange={onPurposeChange}
                  typeFilter={typeFilter}
                  onTypeChange={onTypeChange}
                  onOpenAddModal={() => setShowAddModal(true)}
                  onOpenFilterModal={() => setShowFilterModal(true)}
                  onOpenChatWithBroker={handleOpenChatWithBroker}
                  onNavigateToProjects={() => setActiveTab('projects')}
                  onSwitchToList={() => setListingsSubView('list')}
                  onOpenAiSearch={isNativeApk && onAiSearch ? () => setShowMobileAiModal(true) : undefined}
                  aiFilterActive={aiFilterActive}
                />
              ) : (
                <div className="p-3 space-y-3 bg-[#F6F8F9] flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
                    <button
                      onClick={() => setListingsSubView('map')}
                      className="text-xs font-bold text-[#0B7A3E] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                    >
                      ← Back to Map
                    </button>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {filteredListings.length} listings
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0 overflow-y-auto pb-2">
                    {filteredListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onSelect={(l) => setSelectedListing(l)}
                        isFavorite={favorites.includes(listing.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Projects */}
          {activeTab === 'projects' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              <ProjectsView
                projects={projects}
                onOpenProjectDetail={() => {}}
                onBack={() => setActiveTab('listings')}
              />
            </div>
          )}

          {/* Tab 3: Bookings */}
          {activeTab === 'bookings' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <BookingsView
                listings={listings}
                onListingClick={(l) => setSelectedListing(l)}
                onSwitchToMap={() => setActiveTab('listings')}
                onOpenAddModal={() => setShowAddModal(true)}
              />
            </div>
          )}

          {/* Tab 4: Chat */}
          {activeTab === 'chat' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ChatView
                threads={chatThreads}
                activeThreadId={activeChatThreadId}
                onSelectThread={(id) => setActiveChatThreadId(id)}
                onSendMessage={onSendMessage}
                onBack={() => setActiveTab('listings')}
                onOpenListingDetail={(id) => {
                  const l = listings.find((x) => x.id === id) || listings[0];
                  if (l) setSelectedListing(l);
                }}
              />
            </div>
          )}

          {/* Tab 5: Services */}
          {activeTab === 'services' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              <ServicesView
                searchRequests={searchRequests}
                onAddSearchRequest={onAddSearchRequest}
                leaseContracts={leaseContracts}
                onAddLeaseContract={onAddLeaseContract}
                onOpenCustomerSupport={() => setShowSupportModal(true)}
                onBack={() => setActiveTab('listings')}
              />
            </div>
          )}

          {/* Tab 6: Profile / Login */}
          {activeTab === 'profile' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProfileView
                userRole={userRole}
                onRoleChange={onRoleChange}
                favorites={favoriteListings}
                onSelectListing={(l) => setSelectedListing(l)}
                myListings={myListings}
                onOpenAddModal={() => setShowAddModal(true)}
                onBack={() => setActiveTab('listings')}
                firebaseUser={firebaseUser}
              />
            </div>
          )}

          {/* Peeking Right-Edge Support Chat Tab */}
          {activeTab !== 'chat' && (
            <button
              onClick={() => setShowSupportModal(true)}
              className="absolute right-0 top-[48%] -translate-y-1/2 z-[470] bg-white/95 hover:bg-white border border-r-0 border-slate-200 rounded-l-full py-1.5 pl-2 pr-1 shadow-md flex items-center justify-center transition-all hover:pr-2"
              title="Customer Support"
            >
              <span className="w-7 h-7 rounded-full bg-emerald-100 text-[#0B7A3E] flex items-center justify-center text-[10px] font-black">
                •••
              </span>
            </button>
          )}
        </div>

        {/* Clean White 6-Tab Bottom Navigation with Safe Area Bottom Padding */}
        <nav className="bg-white border-t border-slate-200 shrink-0 select-none z-[475] relative safe-bottom">
          <div className="grid grid-cols-6 h-14 items-center px-0.5">
            <button
              onClick={() => setActiveTab('profile')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'profile' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Profile</span>
            </button>

            <button
              onClick={() => setActiveTab('listings')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'listings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Listings</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'projects' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Projects</span>
            </button>

            <button
              onClick={() => setActiveTab('bookings')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'bookings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Bookings</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors relative ${
                activeTab === 'chat' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5 shrink-0" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'services' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Services</span>
            </button>
          </div>
        </nav>

        {/* Simulated Android Bottom Navigation Strip (Desktop Phone Chassis Preview only) */}
        {!isNativeApk && useDeviceFrame && (
          <div className="hidden sm:flex bg-white h-8 items-center justify-around px-10 text-slate-400 border-t border-slate-100/70 shrink-0">
            <Menu className="w-4 h-4 rotate-90" />
            <Square className="w-3.5 h-3.5" />
            <ChevronLeft className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Listing Detail Modal */}
      <ListingDetailModal
        listing={selectedListing}
        onClose={() => setSelectedListing(null)}
        onOpenChat={handleOpenChatWithBroker}
        onBookNow={handleBookNowFromDetail}
        isFavorite={selectedListing ? favorites.includes(selectedListing.id) : false}
        onToggleFavorite={toggleFavorite}
      />

      {/* Add Listing Modal */}
      <AddListingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmitListing={onAddListing}
      />

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={advancedFilters}
        onUpdateFilters={onUpdateAdvancedFilters}
        onResetFilters={onResetAdvancedFilters}
        matchingCount={filteredListings.length}
      />

      {/* Mobile AI Search Modal (for Native Android APK) */}
      {showMobileAiModal && onAiSearch && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0B7A3E]" />
                <h4 className="text-sm font-bold text-[#0F3D2A]">AI Smart Search</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileAiModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMobileAiSubmit} className="space-y-3">
              <textarea
                rows={3}
                value={mobileAiQuery}
                onChange={(e) => setMobileAiQuery(e.target.value)}
                placeholder="t.g. Villa 4 qol Jigjiga Yar < $600..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#0B7A3E]"
              />
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Villa Jigjiga Yar < $600',
                  'Dhul Masalaha iib ah',
                  'Apartment Ibraahim Koodbuur',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={async () => {
                      setMobileAiQuery(q);
                      await onAiSearch(q);
                      setShowMobileAiModal(false);
                    }}
                    className="text-[11px] px-2.5 py-1 bg-[#EEF2F0] text-slate-700 rounded-lg font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={isSearchingAi || !mobileAiQuery.trim()}
                className="w-full py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {isSearchingAi ? 'AI ayaa Baaraysa...' : 'Ku Baar AI'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-[#0B7A3E] rounded-xl">
                  <Headphones className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Customer Service</h4>
              </div>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Waxaan diyaar u nahay inaan kaa caawinno su'aalaha kireysiga, qiimeynta dhulka, iyo hubinta shatiyada dilaaliinta Hargeysa.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  window.open('https://wa.me/252672041985?text=Asc%20GuriHel%20Customer%20Support', '_blank');
                  setShowSupportModal(false);
                }}
                className="w-full py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                La Hadal WhatsApp Taageerada
              </button>
              <button
                onClick={() => {
                  setActiveTab('chat');
                  setShowSupportModal(false);
                }}
                className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white rounded-xl text-xs font-bold transition-colors"
              >
                Fur Wada-Hadalka App-ka
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
