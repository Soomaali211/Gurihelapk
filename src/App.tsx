import React, { useState } from 'react';
import { 
  Listing, 
  Project, 
  ChatThread, 
  SearchRequest, 
  LeaseContract, 
  UserRole, 
  ListingPurpose, 
  PropertyType, 
  FilterState 
} from './types';
import { 
  INITIAL_LISTINGS, 
  INITIAL_PROJECTS, 
  INITIAL_CHAT_THREADS, 
  INITIAL_SEARCH_REQUESTS, 
  INITIAL_LEASE_CONTRACTS 
} from './data/mockData';
import { TopBar } from './components/TopBar';
import { MobileAppShell } from './components/MobileAppShell';
import { AdminDashboard } from './components/AdminDashboard';
import { ListingDetailModal } from './components/ListingDetailModal';
import { TechStackModal } from './components/TechStackModal';

export default function App() {
  // Main view: Mobile App (with 6 tabs) vs Admin Management Dashboard
  const [currentView, setCurrentView] = useState<'mobile' | 'admin'>('mobile');
  const [userRole, setUserRole] = useState<UserRole>('seeker');
  const [showTechStack, setShowTechStack] = useState(false);

  // Core Data Stores
  const [listings, setListings] = useState<Listing[]>(INITIAL_LISTINGS);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(INITIAL_CHAT_THREADS);
  const [searchRequests, setSearchRequests] = useState<SearchRequest[]>(INITIAL_SEARCH_REQUESTS);
  const [leaseContracts, setLeaseContracts] = useState<LeaseContract[]>(INITIAL_LEASE_CONTRACTS);

  // Filters State
  const [purposeFilter, setPurposeFilter] = useState<'all' | ListingPurpose>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PropertyType>('all');
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    purpose: 'all',
    property_type: 'all',
    district: '',
    minPrice: 0,
    maxPrice: 400000,
    minBedrooms: 0,
    onlyVerified: false,
    onlyFeatured: false,
  });

  // AI Search state
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [aiCriteria, setAiCriteria] = useState<{
    purpose?: string;
    property_type?: string;
    district?: string;
    maxPrice?: number | null;
    minBedrooms?: number | null;
  } | null>(null);

  // Admin Modal Inspector
  const [inspectListing, setInspectListing] = useState<Listing | null>(null);

  // AI Search Handler
  const handleAiSearch = async (query: string) => {
    setIsSearchingAi(true);
    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();

      if (data?.result) {
        const res = data.result;
        setAiCriteria(res);
        setAiExplanation(res.explanation || `Natiijada baadhitaanka AI: "${query}"`);
        setAiFilterActive(true);

        // Synchronize top filters if detected
        if (res.purpose && res.purpose !== 'any') {
          setPurposeFilter(res.purpose as ListingPurpose);
        } else {
          setPurposeFilter('all');
        }

        if (res.property_type && res.property_type !== 'all') {
          setTypeFilter(res.property_type as PropertyType);
        } else {
          setTypeFilter('all');
        }
      }
    } catch (err) {
      console.warn('AI search request failed, keeping manual filters:', err);
    } finally {
      setIsSearchingAi(false);
    }
  };

  const handleClearAiFilter = () => {
    setAiFilterActive(false);
    setAiExplanation('');
    setAiCriteria(null);
    setPurposeFilter('all');
    setTypeFilter('all');
  };

  // Add Listing (starts in 'pending' status for admin approval)
  const handleAddListing = (newListing: Listing) => {
    setListings((prev) => [newListing, ...prev]);
  };

  // Admin Approval
  const handleApproveListing = (id: string) => {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'live', verified: true } : l))
    );
  };

  // Admin Rejection
  const handleRejectListing = (id: string, reason: string) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: 'rejected', rejectionReason: reason } : l
      )
    );
  };

  // Chat message sending with automatic simulated broker reply
  const handleSendMessage = (threadId: string, text: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user' as const,
      body: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              lastMessage: text,
              lastTime: 'Hadda',
              messages: [...t.messages, newMessage],
            }
          : t
      )
    );

    // Automated broker response after 1 second
    setTimeout(() => {
      const brokerReplies = [
        'Waa hagaag walaal, waan helay fariintaada. Goorma ayaad doonaysaa inaan guriga kugu tuso?',
        'Haa, sharciga dawladda hoose ee Hargeysa iyo warqadaha lahaanshaha waa diyaar.',
        'Waan ku soo celinayaa faahfaahinta oo dhammaystiran, sidoo kale WhatsApp ayaad igala soo xiriiri kartaa.',
      ];
      const randomReply = brokerReplies[Math.floor(Math.random() * brokerReplies.length)];

      const brokerMsg = {
        id: `msg-b-${Date.now()}`,
        sender: 'broker' as const,
        body: randomReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                lastMessage: randomReply,
                lastTime: 'Hadda',
                messages: [...t.messages, brokerMsg],
              }
            : t
        )
      );
    }, 1000);
  };

  // Filter listings based on current active filters
  const filteredListings = listings.filter((listing) => {
    // Purpose filter
    if (purposeFilter !== 'all' && listing.purpose !== purposeFilter) return false;

    // Property type filter
    if (typeFilter !== 'all' && listing.property_type !== typeFilter) return false;

    // Advanced filters
    if (advancedFilters.district && !listing.district.toLowerCase().includes(advancedFilters.district.toLowerCase())) {
      return false;
    }

    if (listing.price > advancedFilters.maxPrice) return false;
    if (advancedFilters.minBedrooms > 0 && listing.bedrooms < advancedFilters.minBedrooms) return false;
    if (advancedFilters.onlyVerified && !listing.verified) return false;
    if (advancedFilters.onlyFeatured && !listing.featured) return false;

    // AI Semantic criteria matching if active
    if (aiFilterActive && aiCriteria) {
      if (aiCriteria.district && !listing.district.toLowerCase().includes(aiCriteria.district.toLowerCase())) {
        return false;
      }
      if (aiCriteria.maxPrice && listing.price > aiCriteria.maxPrice) {
        return false;
      }
      if (aiCriteria.minBedrooms && listing.bedrooms < aiCriteria.minBedrooms) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#18211C] flex flex-col font-sans">
      {/* Top Bar with AI Search and Dual Viewport controls */}
      <TopBar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        userRole={userRole}
        onRoleChange={(role) => setUserRole(role)}
        onAiSearch={handleAiSearch}
        aiFilterActive={aiFilterActive}
        aiExplanation={aiExplanation}
        onClearAiFilter={handleClearAiFilter}
        isSearchingAi={isSearchingAi}
        onOpenTechStack={() => setShowTechStack(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1">
        {currentView === 'mobile' ? (
          <MobileAppShell
            listings={listings}
            projects={projects}
            chatThreads={chatThreads}
            searchRequests={searchRequests}
            leaseContracts={leaseContracts}
            userRole={userRole}
            onRoleChange={setUserRole}
            onAddListing={handleAddListing}
            onAddSearchRequest={(req) => setSearchRequests((prev) => [req, ...prev])}
            onAddLeaseContract={(contract) => setLeaseContracts((prev) => [contract, ...prev])}
            onSendMessage={handleSendMessage}
            filteredListings={filteredListings}
            purposeFilter={purposeFilter}
            onPurposeChange={setPurposeFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            advancedFilters={advancedFilters}
            onUpdateAdvancedFilters={setAdvancedFilters}
            onResetAdvancedFilters={() =>
              setAdvancedFilters({
                purpose: 'all',
                property_type: 'all',
                district: '',
                minPrice: 0,
                maxPrice: 400000,
                minBedrooms: 0,
                onlyVerified: false,
                onlyFeatured: false,
              })
            }
          />
        ) : (
          <AdminDashboard
            listings={listings}
            onApproveListing={handleApproveListing}
            onRejectListing={handleRejectListing}
            onViewListingDetail={(listing) => setInspectListing(listing)}
          />
        )}
      </div>

      {/* Admin Inspector Detail Modal */}
      {inspectListing && (
        <ListingDetailModal
          listing={inspectListing}
          onClose={() => setInspectListing(null)}
          onOpenChat={() => {
            setInspectListing(null);
            setCurrentView('mobile');
          }}
          onBookNow={() => {
            setInspectListing(null);
            setCurrentView('mobile');
          }}
          isFavorite={false}
          onToggleFavorite={() => {}}
        />
      )}

      {/* Tech Stack & Blueprint Verbatim Modal */}
      <TechStackModal
        isOpen={showTechStack}
        onClose={() => setShowTechStack(false)}
      />
    </div>
  );
}
