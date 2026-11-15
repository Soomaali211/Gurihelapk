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
  ChevronLeft
} from 'lucide-react';
import { Listing, Project, ChatThread, SearchRequest, LeaseContract, UserRole, ListingPurpose, PropertyType, FilterState } from '../types';
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

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(id);
  };

  const handleOpenChatWithBroker = (listing: Listing) => {
    setSelectedListing(null);
    setActiveTab('chat');
  };

  const handleBookNowFromDetail = (listing: Listing) => {
    setSelectedListing(null);
    setActiveTab('bookings');
  };

  const favoriteListings = listings.filter((l) => favorites.includes(l.id));
  const myListings = listings.filter((l) => l.broker.id === 'b-01');

  return (
    <div className={isNativeApk ? 'bg-white min-h-screen flex flex-col' : 'py-4 px-2 sm:px-4 bg-[#EEF2F0] min-h-[calc(100vh-4.5rem)] flex flex-col items-center justify-start'}>
      {/* Top Device Frame Toggle Bar (Browser preview only) */}
      {!isNativeApk && (
      <div className="w-full max-w-md sm:max-w-xl flex items-center justify-between pb-3 px-2">
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

      {/* APK Mobile Phone Chassis Frame */}
      <div
        className={`w-full transition-all duration-300 relative ${
          isNativeApk
            ? 'bg-white overflow-hidden'
            : useDeviceFrame
            ? 'max-w-[410px] rounded-[40px] border-[8px] border-slate-900 shadow-2xl bg-white overflow-hidden ring-2 ring-slate-800/20'
            : 'max-w-5xl rounded-3xl border border-[#C9D2CD] shadow-lg bg-white overflow-hidden'
        }`}
      >
        {/* Clean Light Status Bar matching Screenshots 1-6 */}
        <PhoneStatusBar time="10:36" batteryPercentage={51} />

        {/* Dynamic Screen View */}
        <div className="relative min-h-[610px] bg-[#F6F8F9]">
          {/* Tab 1: Listings */}
          {activeTab === 'listings' && (
            <div>
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
                />
              ) : (
                <div className="p-3 space-y-3 bg-[#F6F8F9] min-h-[610px]">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <button
                      onClick={() => setListingsSubView('map')}
                      className="text-xs font-bold text-[#0B7A3E] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200"
                    >
                      ← Back to Map
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      {filteredListings.length} listings
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[530px] overflow-y-auto">
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
            <ProjectsView
              projects={projects}
              onOpenProjectDetail={() => {}}
              onBack={() => setActiveTab('listings')}
            />
          )}

          {/* Tab 3: Bookings */}
          {activeTab === 'bookings' && (
            <BookingsView
              listings={listings}
              onListingClick={(l) => setSelectedListing(l)}
              onSwitchToMap={() => setActiveTab('listings')}
              onOpenAddModal={() => setShowAddModal(true)}
            />
          )}

          {/* Tab 4: Chat */}
          {activeTab === 'chat' && (
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
          )}

          {/* Tab 5: Services */}
          {activeTab === 'services' && (
            <ServicesView
              searchRequests={searchRequests}
              onAddSearchRequest={onAddSearchRequest}
              leaseContracts={leaseContracts}
              onAddLeaseContract={onAddLeaseContract}
              onOpenCustomerSupport={() => setShowSupportModal(true)}
              onBack={() => setActiveTab('listings')}
            />
          )}

          {/* Tab 6: Profile / Login */}
          {activeTab === 'profile' && (
            <div className="max-h-[610px] overflow-y-auto">
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

          {/* Peeking Right-Edge Support Chat Tab matching Screenshots 1-6 */}
          {activeTab !== 'chat' && (
            <button
              onClick={() => setShowSupportModal(true)}
              className="absolute right-0 top-[48%] -translate-y-1/2 z-30 bg-white/95 hover:bg-white border border-r-0 border-slate-200 rounded-l-full py-1.5 pl-2 pr-1 shadow-md flex items-center justify-center transition-all hover:pr-2"
              title="Customer Support"
            >
              <span className="w-7 h-7 rounded-full bg-emerald-100 text-[#0B7A3E] flex items-center justify-center text-[10px] font-black">
                •••
              </span>
            </button>
          )}
        </div>

        {/* Clean White 6-Tab Bottom Navigation matching Screenshots 1-6 */}
        <nav className="bg-white border-t border-slate-200 grid grid-cols-6 h-14 items-center px-0.5 select-none z-30 relative">
          {/* 1. Profile */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'profile' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Profile</span>
          </button>

          {/* 2. Listings */}
          <button
            onClick={() => setActiveTab('listings')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'listings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Listings</span>
          </button>

          {/* 3. Projects */}
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'projects' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Projects</span>
          </button>

          {/* 4. Bookings */}
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'bookings' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Bookings</span>
          </button>

          {/* 5. Chat */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center h-full transition-colors relative ${
              activeTab === 'chat' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </div>
            <span className="text-[10px] mt-0.5">Chat</span>
          </button>

          {/* 6. Services */}
          <button
            onClick={() => setActiveTab('services')}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'services' ? 'text-[#0B7A3E] font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Services</span>
          </button>
        </nav>

        {/* Android Bottom Navigation Strip inside Device Frame matching Screenshots */}
        {useDeviceFrame && (
          <div className="bg-white h-8 flex items-center justify-around px-10 text-slate-400 border-t border-slate-100/70">
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

      {/* Customer Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                  window.open('https://wa.me/252634421980?text=Asc%20GuriHel%20Customer%20Support', '_blank');
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
