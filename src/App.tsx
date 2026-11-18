import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
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
} from './types';
import {
  INITIAL_LISTINGS,
  INITIAL_PROJECTS,
  INITIAL_CHAT_THREADS,
  INITIAL_SEARCH_REQUESTS,
  INITIAL_LEASE_CONTRACTS,
} from './data/mockData';
import { TopBar } from './components/TopBar';
import { MobileAppShell } from './components/MobileAppShell';
import { ListingDetailModal } from './components/ListingDetailModal';
import { TechStackModal } from './components/TechStackModal';
import { auth } from './lib/firebase';
import { executeAiSearch } from './lib/aiSearch';
import { SplashScreen } from './components/SplashScreen';
import {
  APP_VERSION,
  loadPersistedState,
  savePersistedPatch,
} from './lib/localStore';
import {
  isVerifiedAdmin,
  syncUserProfileDocuments,
  subscribePublicAndUserListings,
  subscribeProjects,
  subscribeFavorites,
  toggleFavoriteInFirestore,
  createListingInFirestore,
  updateListingModerationInFirestore,
  createSearchRequestInFirestore,
  createLeaseContractInFirestore,
  seedMarketplaceToFirestore,
} from './lib/firestoreRepo';

function mergeListingsUnique(primary: Listing[], secondary: Listing[]): Listing[] {
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const item of [...primary, ...secondary]) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

const LazyAdminPortal = __ENABLE_ADMIN_WEB__
  ? lazy(() => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })))
  : null;

export default function App() {
  const isNativeApk = Capacitor.isNativePlatform();
  const bootRef = useRef(loadPersistedState());
  const initialPersisted = bootRef.current.state;

  const [currentView, setCurrentView] = useState<'mobile' | 'admin'>(() => {
    if (isNativeApk || !__ENABLE_ADMIN_WEB__) return 'mobile';
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/admin' || window.location.hash === '#/admin')
    ) {
      return 'admin';
    }
    return 'mobile';
  });
  const [userRole, setUserRole] = useState<UserRole>(initialPersisted.userRole);
  const [showTechStack, setShowTechStack] = useState(false);
  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(
    bootRef.current.upgradedFromVersion
      ? `App-ka waa la cusboonaysiiyay: v${bootRef.current.upgradedFromVersion} → v${APP_VERSION}. Dhammaan xogtaadii hore way badbaadsan tahay!`
      : null
  );

  // Firebase Auth state
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [hasCloudListings, setHasCloudListings] = useState(false);

  // Core Data Stores (initialized from versioned local store + defaults, synced with Firestore)
  const [listings, setListings] = useState<Listing[]>(() =>
    mergeListingsUnique(initialPersisted.customListings, INITIAL_LISTINGS)
  );
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [favorites, setFavorites] = useState<string[]>(initialPersisted.favorites);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>(
    initialPersisted.chatThreads || INITIAL_CHAT_THREADS
  );
  const [searchRequests, setSearchRequests] = useState<SearchRequest[]>(
    initialPersisted.searchRequests || INITIAL_SEARCH_REQUESTS
  );
  const [leaseContracts, setLeaseContracts] = useState<LeaseContract[]>(
    initialPersisted.leaseContracts || INITIAL_LEASE_CONTRACTS
  );

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

  // Persist core user preferences/drafts locally so APK updates never lose offline data
  useEffect(() => {
    savePersistedPatch({
      userRole,
      favorites,
      chatThreads,
      searchRequests,
      leaseContracts,
    });
  }, [userRole, favorites, chatThreads, searchRequests, leaseContracts]);

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        try {
          const role = await syncUserProfileDocuments(user);
          setUserRole(role);
          if (isVerifiedAdmin(user)) {
            await seedMarketplaceToFirestore(user);
          }
        } catch (err) {
          console.warn('Profile sync notice:', err);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Real-time Firestore Subscriptions (gated by authReady)
  useEffect(() => {
    if (!authReady) return;

    const unsubListings = subscribePublicAndUserListings(
      firebaseUser,
      (cloudItems) => {
        const localCustom = loadPersistedState().state.customListings;
        if (cloudItems.length > 0) {
          setHasCloudListings(true);
          setListings(mergeListingsUnique(cloudItems, localCustom));
        } else {
          setHasCloudListings(false);
          setListings(mergeListingsUnique(localCustom, INITIAL_LISTINGS));
        }
      },
      (err) => setFirestoreError(err.message)
    );

    const unsubProjects = subscribeProjects((cloudProjects) => {
      if (cloudProjects.length > 0) {
        setProjects(cloudProjects);
      }
    });

    let unsubFavs: (() => void) | undefined;
    if (firebaseUser) {
      unsubFavs = subscribeFavorites(firebaseUser.uid, (ids) => {
        if (ids.length > 0) {
          setFavorites(ids);
        }
      });
    }

    return () => {
      unsubListings();
      unsubProjects();
      if (unsubFavs) unsubFavs();
    };
  }, [authReady, firebaseUser]);

  // AI Search Handler
  const handleAiSearch = async (queryText: string) => {
    setIsSearchingAi(true);
    try {
      const res = await executeAiSearch(queryText);
      setAiCriteria(res);
      setAiExplanation(res.explanation || `Natiijada baadhitaanka AI: "${queryText}"`);
      setAiFilterActive(true);

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
    } catch (err) {
      console.warn('AI search failed:', err);
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

  // Add Listing (persists both locally for offline/update safety and in Firestore)
  const handleAddListing = async (newListing: Listing) => {
    setListings((prev) => mergeListingsUnique([newListing], prev));
    const currentCustom = loadPersistedState().state.customListings;
    savePersistedPatch({ customListings: mergeListingsUnique([newListing], currentCustom) });

    if (firebaseUser) {
      try {
        await createListingInFirestore(newListing, firebaseUser);
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Failed to save listing');
      }
    }
  };

  // Admin Approval
  const handleApproveListing = async (id: string) => {
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'live', verified: true } : l))
    );
    const updatedCustom = loadPersistedState().state.customListings.map((l) =>
      l.id === id ? { ...l, status: 'live' as const, verified: true } : l
    );
    savePersistedPatch({ customListings: updatedCustom });

    if (firebaseUser && isVerifiedAdmin(firebaseUser)) {
      try {
        await updateListingModerationInFirestore(id, { status: 'live' });
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Approval error');
      }
    }
  };

  // Admin Rejection
  const handleRejectListing = async (id: string, reason: string) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: 'rejected', rejectionReason: reason } : l
      )
    );
    const updatedCustom = loadPersistedState().state.customListings.map((l) =>
      l.id === id ? { ...l, status: 'rejected' as const, rejectionReason: reason } : l
    );
    savePersistedPatch({ customListings: updatedCustom });

    if (firebaseUser && isVerifiedAdmin(firebaseUser)) {
      try {
        await updateListingModerationInFirestore(id, {
          status: 'rejected',
          rejectionReason: reason,
        });
      } catch (err) {
        setFirestoreError(err instanceof Error ? err.message : 'Reject error');
      }
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const exists = favorites.includes(id);
    setFavorites((prev) => (exists ? prev.filter((x) => x !== id) : [...prev, id]));
    if (firebaseUser) {
      try {
        await toggleFavoriteInFirestore(firebaseUser.uid, id, !exists);
      } catch (err) {
        console.warn('Favorite sync error:', err);
      }
    }
  };

  const handleAddSearchRequest = async (req: SearchRequest) => {
    setSearchRequests((prev) => [req, ...prev]);
    if (firebaseUser) {
      try {
        await createSearchRequestInFirestore(req, firebaseUser);
      } catch (err) {
        console.warn('Search request sync error:', err);
      }
    }
  };

  const handleAddLeaseContract = async (contract: LeaseContract) => {
    setLeaseContracts((prev) => [contract, ...prev]);
    if (firebaseUser) {
      try {
        await createLeaseContractInFirestore(contract, firebaseUser);
      } catch (err) {
        console.warn('Lease contract sync error:', err);
      }
    }
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
    if (purposeFilter !== 'all' && listing.purpose !== purposeFilter) return false;
    if (typeFilter !== 'all' && listing.property_type !== typeFilter) return false;

    if (
      advancedFilters.district &&
      !listing.district.toLowerCase().includes(advancedFilters.district.toLowerCase())
    ) {
      return false;
    }

    if (listing.price > advancedFilters.maxPrice) return false;
    if (advancedFilters.minBedrooms > 0 && listing.bedrooms < advancedFilters.minBedrooms) return false;
    if (advancedFilters.onlyVerified && !listing.verified) return false;
    if (advancedFilters.onlyFeatured && !listing.featured) return false;

    if (aiFilterActive && aiCriteria) {
      if (
        aiCriteria.district &&
        !listing.district.toLowerCase().includes(aiCriteria.district.toLowerCase())
      ) {
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

  // In native Android APK or VITE_APP_MODE=mobile builds, always render strict Mobile Layout
  const effectiveView = isNativeApk || !__ENABLE_ADMIN_WEB__ ? 'mobile' : currentView;

  return (
    <div
      className={`${
        isNativeApk
          ? 'h-[100dvh] min-h-0 overflow-hidden bg-white'
          : 'min-h-screen bg-[#F8FAFC]'
      } text-[#18211C] flex flex-col font-sans w-full min-w-0 max-w-full overflow-hidden`}
    >
      <SplashScreen />
      {!isNativeApk && (
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
      )}

      {upgradeBanner && (
        <div
          className={`bg-emerald-50 border-b border-emerald-200 px-3 sm:px-4 py-2 text-[11px] font-bold text-[#0B7A3E] flex items-center justify-between gap-2 shrink-0 ${
            isNativeApk ? 'safe-top' : ''
          }`}
        >
          <span className="min-w-0 break-words">✓ {upgradeBanner}</span>
          <button onClick={() => setUpgradeBanner(null)} className="shrink-0 p-1">
            ✕
          </button>
        </div>
      )}

      {firestoreError && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-1.5 text-[11px] text-amber-900 flex items-center justify-between gap-2 shrink-0">
          <span className="truncate min-w-0">Firebase Notice: {firestoreError}</span>
          <button
            onClick={() => setFirestoreError(null)}
            className="font-bold text-amber-700 shrink-0 p-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        {effectiveView === 'mobile' ? (
          <MobileAppShell
            listings={listings}
            projects={projects}
            chatThreads={chatThreads}
            searchRequests={searchRequests}
            leaseContracts={leaseContracts}
            userRole={userRole}
            onRoleChange={setUserRole}
            onAddListing={handleAddListing}
            onAddSearchRequest={handleAddSearchRequest}
            onAddLeaseContract={handleAddLeaseContract}
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
            firebaseUser={firebaseUser}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onAiSearch={handleAiSearch}
            aiFilterActive={aiFilterActive}
            aiExplanation={aiExplanation}
            onClearAiFilter={handleClearAiFilter}
            isSearchingAi={isSearchingAi}
          />
        ) : LazyAdminPortal ? (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-xs font-bold text-[#0F3D2A]">
                Waa la furayaa Admin Web Portal...
              </div>
            }
          >
            <LazyAdminPortal
              listings={listings}
              onApproveListing={handleApproveListing}
              onRejectListing={handleRejectListing}
              onViewListingDetail={(listing) => setInspectListing(listing)}
              firebaseUser={firebaseUser}
              hasCloudListings={hasCloudListings}
              onSeedDatabase={async () => {
                if (firebaseUser && isVerifiedAdmin(firebaseUser)) {
                  await seedMarketplaceToFirestore(firebaseUser);
                }
              }}
              onBackToApp={() => setCurrentView('mobile')}
            />
          </Suspense>
        ) : null}
      </div>

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
          isFavorite={favorites.includes(inspectListing.id)}
          onToggleFavorite={() => handleToggleFavorite(inspectListing.id)}
        />
      )}

      <TechStackModal
        isOpen={showTechStack}
        onClose={() => setShowTechStack(false)}
      />
    </div>
  );
}
