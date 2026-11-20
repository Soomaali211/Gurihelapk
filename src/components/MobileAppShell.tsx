import React, { useState } from 'react';
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
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  AuthUser,
  Listing,
  Project,
  ChatThread,
  SearchRequest,
  LeaseContract,
  ListingPurpose,
  PropertyType,
  FilterState,
  isAdminRole,
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
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onLogoutAll: () => void;
  onProfileUpdated: (user: AuthUser) => void;
  onOpenAdminPortal?: () => void;
  onAddListing: (listing: Listing) => Promise<void>;
  onBookListing: (payload: {
    listingId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    paymentMethod: string;
  }) => Promise<void>;
  onAddSearchRequest: (req: Partial<SearchRequest>) => Promise<void>;
  onAddLeaseContract: (contract: Partial<LeaseContract>) => Promise<void>;
  onStartChatThread: (listing?: Listing) => Promise<string | null>;
  onSendMessage: (threadId: string, text: string) => Promise<void>;
  onRegisterProjectInterest: (projectId: string) => Promise<void>;
  filteredListings: Listing[];
  purposeFilter: 'all' | ListingPurpose;
  onPurposeChange: (p: 'all' | ListingPurpose) => void;
  typeFilter: 'all' | PropertyType;
  onTypeChange: (t: 'all' | PropertyType) => void;
  advancedFilters: FilterState;
  onUpdateAdvancedFilters: (filters: FilterState) => void;
  onResetAdvancedFilters: () => void;
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
  currentUser,
  onOpenLogin,
  onLogout,
  onLogoutAll,
  onProfileUpdated,
  onOpenAdminPortal,
  onAddListing,
  onBookListing,
  onAddSearchRequest,
  onAddLeaseContract,
  onStartChatThread,
  onSendMessage,
  onRegisterProjectInterest,
  filteredListings,
  purposeFilter,
  onPurposeChange,
  typeFilter,
  onTypeChange,
  advancedFilters,
  onUpdateAdvancedFilters,
  onResetAdvancedFilters,
  favorites,
  onToggleFavorite,
  onAiSearch,
  aiFilterActive,
  aiExplanation,
  onClearAiFilter,
  isSearchingAi,
}) => {
  const isNativeApk = Capacitor.isNativePlatform();
  const [activeTab, setActiveTab] = useState<
    'listings' | 'projects' | 'bookings' | 'chat' | 'services' | 'profile'
  >('listings');
  const [listingsSubView, setListingsSubView] = useState<'map' | 'list'>('map');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string>('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [useDeviceFrame, setUseDeviceFrame] = useState(!isNativeApk);
  const [showMobileAiModal, setShowMobileAiModal] = useState(false);
  const [mobileAiQuery, setMobileAiQuery] = useState('');

  // Quick Booking Modal State
  const [bookingTarget, setBookingTarget] = useState<Listing | null>(null);
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOut, setCheckOut] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState('Zaad Service');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const requireAuthThen = (action: () => void) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    action();
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuthThen(() => onToggleFavorite(id));
  };

  const handleOpenAddModal = () => {
    requireAuthThen(() => setShowAddModal(true));
  };

  const handleOpenChatWithListing = async (listing?: Listing) => {
    if (!currentUser) {
      setSelectedListing(null);
      onOpenLogin();
      return;
    }
    setSelectedListing(null);
    const threadId = await onStartChatThread(listing);
    if (threadId) {
      setActiveChatThreadId(threadId);
    }
    setActiveTab('chat');
  };

  const handleBookNowFromDetail = (listing: Listing) => {
    if (!currentUser) {
      setSelectedListing(null);
      onOpenLogin();
      return;
    }
    setSelectedListing(null);
    setBookingError(null);
    setBookingSuccess(null);
    setBookingTarget(listing);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTarget || bookingBusy) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      const startMs = new Date(checkIn).getTime();
      const endMs = new Date(checkOut).getTime();
      const nights = Math.max(1, Math.round((endMs - startMs) / 86400000) || 1);
      await onBookListing({
        listingId: bookingTarget.id,
        checkIn,
        checkOut,
        nights,
        paymentMethod,
      });
      setBookingSuccess(`Booking submitted for ${nights} night(s).`);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleMobileAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileAiQuery.trim() || !onAiSearch) return;
    await onAiSearch(mobileAiQuery.trim());
    setShowMobileAiModal(false);
  };

  const favoriteListings = listings.filter((l) => favorites.includes(l.id));
  const myListings = listings.filter((l) => currentUser && l.ownerUid === currentUser.id);
  const hasUnreadChats = chatThreads.some((t) => t.unread);

  return (
    <div
      className={
        isNativeApk
          ? 'bg-white flex-1 min-h-0 w-full max-w-full flex flex-col overflow-hidden'
          : 'flex-1 flex flex-col items-center justify-start bg-white sm:bg-[#EEF2F0] sm:py-4 sm:px-4 w-full max-w-full overflow-x-hidden'
      }
    >
      {/* Top Device Frame Toggle Bar (Desktop web preview only) */}
      {!isNativeApk && (
        <div className="hidden sm:flex w-full max-w-md sm:max-w-xl items-center justify-between pb-3 px-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F3D2A]">
            <img
              src="/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png"
              alt="GuriHel"
              className="w-5 h-5 rounded-md"
            />
            <span>GuriHel Mobile APK UI</span>
          </div>

          <button
            type="button"
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

      {/* Mobile App Container */}
      <div
        className={`w-full transition-all duration-300 relative flex flex-col overflow-hidden bg-white ${
          isNativeApk
            ? 'flex-1 min-h-0'
            : useDeviceFrame
            ? 'flex-1 min-h-0 sm:flex-initial sm:h-[680px] sm:max-w-[410px] sm:rounded-[40px] sm:border-[8px] sm:border-slate-900 sm:shadow-2xl sm:ring-2 sm:ring-slate-800/20'
            : 'flex-1 min-h-0 sm:min-h-[680px] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-[#C9D2CD] sm:shadow-lg'
        }`}
      >
        {isNativeApk && <div className="bg-white safe-top shrink-0" />}

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
                Reset
              </button>
            )}
          </div>
        )}

        {/* Dynamic Screen View */}
        <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#F6F8F9]">
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
                  onOpenAddModal={handleOpenAddModal}
                  onOpenFilterModal={() => setShowFilterModal(true)}
                  onNavigateToProjects={() => setActiveTab('projects')}
                  projectsCount={projects.length}
                  onSwitchToList={() => setListingsSubView('list')}
                  onOpenAiSearch={
                    isNativeApk && onAiSearch ? () => setShowMobileAiModal(true) : undefined
                  }
                  aiFilterActive={aiFilterActive}
                />
              ) : (
                <div className="p-3 space-y-3 bg-[#F6F8F9] flex-1 min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 shrink-0">
                    <button
                      type="button"
                      onClick={() => setListingsSubView('map')}
                      className="text-xs font-bold text-[#0B7A3E] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                    >
                      ← Back to Map
                    </button>
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {filteredListings.length} listings
                    </span>
                  </div>

                  {filteredListings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                      <img
                        src="/assets/aistudio/GuriHel-mark_d2d21036.png"
                        alt="GuriHel"
                        className="w-12 h-12 object-contain opacity-80"
                      />
                      <h4 className="text-sm font-extrabold text-slate-800">
                        No Properties Available Yet
                      </h4>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Add a property or adjust your active filters to view available real estate.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="px-4 py-2 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
                      >
                        + Add Property
                      </button>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              <ProjectsView
                projects={projects}
                onRegisterInterest={async (projectId) => {
                  if (!currentUser) {
                    onOpenLogin();
                    return;
                  }
                  await onRegisterProjectInterest(projectId);
                }}
                onBack={() => setActiveTab('listings')}
              />
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <BookingsView
                listings={listings}
                onListingClick={(l) => setSelectedListing(l)}
                onSwitchToMap={() => setActiveTab('listings')}
                onOpenAddModal={handleOpenAddModal}
              />
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ChatView
                threads={chatThreads}
                activeThreadId={activeChatThreadId}
                onSelectThread={(id) => setActiveChatThreadId(id)}
                onSendMessage={onSendMessage}
                onStartSupportThread={() => handleOpenChatWithListing()}
                onBack={() => setActiveTab('listings')}
                onOpenListingDetail={(id) => {
                  const l = listings.find((x) => x.id === id);
                  if (l) setSelectedListing(l);
                }}
              />
            </div>
          )}

          {activeTab === 'services' && (
            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              <ServicesView
                searchRequests={searchRequests}
                onAddSearchRequest={async (req) => {
                  if (!currentUser) {
                    onOpenLogin();
                    return;
                  }
                  await onAddSearchRequest(req);
                }}
                leaseContracts={leaseContracts}
                onAddLeaseContract={async (contract) => {
                  if (!currentUser) {
                    onOpenLogin();
                    return;
                  }
                  await onAddLeaseContract(contract);
                }}
                onOpenCustomerSupport={() => setShowSupportModal(true)}
                onBack={() => setActiveTab('listings')}
              />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ProfileView
                currentUser={currentUser}
                favorites={favoriteListings}
                myListings={myListings}
                onSelectListing={(l) => setSelectedListing(l)}
                onOpenAddModal={handleOpenAddModal}
                onOpenLogin={onOpenLogin}
                onProfileUpdated={onProfileUpdated}
                onLogout={onLogout}
                onLogoutAll={onLogoutAll}
                onOpenAdminPortal={isAdminRole(currentUser?.role) ? onOpenAdminPortal : undefined}
                onBack={() => setActiveTab('listings')}
              />
            </div>
          )}

          {/* Peeking Right-Edge Support Chat Tab */}
          {activeTab !== 'chat' && (
            <button
              type="button"
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

        {/* Clean White 6-Tab Bottom Navigation */}
        <nav className="bg-white border-t border-slate-200 shrink-0 select-none z-[475] relative safe-bottom">
          <div className="grid grid-cols-6 h-14 items-center px-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'profile' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'listings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Listings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'projects' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Projects</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors ${
                activeTab === 'bookings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="w-5 h-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Bookings</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`min-w-0 flex flex-col items-center justify-center h-full transition-colors relative ${
                activeTab === 'chat' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5 shrink-0" />
                {hasUnreadChats && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-full px-0.5">Chat</span>
            </button>

            <button
              type="button"
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

        {/* Simulated Android Bottom Strip (Desktop Chassis Preview Only) */}
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
        onOpenChat={(l) => handleOpenChatWithListing(l)}
        onBookNow={(l) => handleBookNowFromDetail(l)}
        isFavorite={selectedListing ? favorites.includes(selectedListing.id) : false}
        onToggleFavorite={toggleFavorite}
      />

      {/* Add Listing Modal */}
      <AddListingModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmitListing={onAddListing}
        isAdmin={isAdminRole(currentUser?.role)}
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

      {/* Confirm Booking Modal */}
      {bookingTarget && (
        <div className="fixed inset-0 z-[560] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-[#0F3D2A]">Confirm Booking</h4>
              <button
                type="button"
                onClick={() => setBookingTarget(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              <div className="font-bold text-slate-900">{bookingTarget.title}</div>
              <div>
                ${bookingTarget.price.toLocaleString()} / {bookingTarget.price_unit}
              </div>
            </div>

            {bookingSuccess ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-[#0B7A3E] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{bookingSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingTarget(null)}
                  className="w-full py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} className="space-y-3 text-xs">
                {bookingError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Check-out</label>
                    <input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                  >
                    <option value="Zaad Service">Zaad Service</option>
                    <option value="eDahab">eDahab</option>
                    <option value="Cash on Hand">Cash on Hand</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={bookingBusy}
                  className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {bookingBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Booking</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Mobile AI Search Modal */}
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
                {isSearchingAi ? 'Searching...' : 'Search with AI'}
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
                <h4 className="text-sm font-bold text-slate-900">GuriHel Customer Support</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Need help with rentals, verified listings, or lease contracts in Somaliland? Start an official support conversation below.
            </p>

            <div className="space-y-2">
              <a
                href="https://wa.me/252636786709?text=Asc%20GuriHel%20Customer%20Support"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSupportModal(false)}
                className="w-full py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                WhatsApp Support
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowSupportModal(false);
                  handleOpenChatWithListing();
                }}
                className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white rounded-xl text-xs font-bold transition-colors"
              >
                Open In-App Support Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
