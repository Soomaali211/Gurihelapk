import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
} from './types';
import { TopBar } from './components/TopBar';
import { MobileAppShell } from './components/MobileAppShell';
import { ListingDetailModal } from './components/ListingDetailModal';
import { UnifiedLoginScreen } from './components/UnifiedLoginScreen';
import { SplashScreen } from './components/SplashScreen';
import { executeAiSearch } from './lib/aiSearch';
import { APP_VERSION, loadPersistedState } from './lib/localStore';
import {
  clearSessionTokens,
  createBookingApi,
  createChatThreadApi,
  createLeaseContractApi,
  createListingApi,
  createSearchRequestApi,
  fetchBookingsApi,
  fetchChatThreadsApi,
  fetchFavoritesApi,
  fetchLeaseContractsApi,
  fetchListings,
  fetchProjectsApi,
  fetchSearchRequestsApi,
  getAccessToken,
  logoutAllSessions,
  logoutSession,
  registerProjectInterestApi,
  restoreSessionOnBoot,
  sendChatMessageApi,
  toggleFavoriteApi,
  uploadPropertyMedia,
} from './lib/apiClient';

const LazyAdminPortal = lazy(() =>
  import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal }))
);

export default function App() {
  const isNativeApk = Capacitor.isNativePlatform();
  const bootRef = useRef(loadPersistedState());

  const [currentView, setCurrentView] = useState<'mobile' | 'admin'>(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname === '/admin' || window.location.hash === '#/admin')
    ) {
      return 'admin';
    }
    return 'mobile';
  });

  const [upgradeBanner, setUpgradeBanner] = useState<string | null>(
    bootRef.current.upgradedFromVersion
      ? `Updated v${bootRef.current.upgradedFromVersion} → v${APP_VERSION}`
      : null
  );

  // Unified Username + Password Auth State
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [guestBrowsing, setGuestBrowsing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Real Backend Marketplace & User Stores
  const [listings, setListings] = useState<Listing[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [searchRequests, setSearchRequests] = useState<SearchRequest[]>([]);
  const [leaseContracts, setLeaseContracts] = useState<LeaseContract[]>([]);

  // Filters State
  const [purposeFilter, setPurposeFilter] = useState<'all' | ListingPurpose>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | PropertyType>('all');
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    purpose: 'all',
    property_type: 'all',
    district: '',
    minPrice: 0,
    maxPrice: 1000000,
    minBedrooms: 0,
    onlyVerified: false,
    onlyFeatured: false,
  });

  // AI Search state
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiFilterActive, setAiFilterActive] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiCriteria, setAiCriteria] = useState<{
    purpose?: string;
    property_type?: string;
    district?: string;
    maxPrice?: number | null;
    minBedrooms?: number | null;
  } | null>(null);

  // Admin Detail Inspector
  const [inspectListing, setInspectListing] = useState<Listing | null>(null);

  const loadPublicMarketplace = useCallback(async () => {
    try {
      const [lData, pData] = await Promise.all([fetchListings(), fetchProjectsApi()]);
      setListings(lData);
      setProjects(pData);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not load marketplace data.');
    }
  }, []);

  const loadPrivateUserData = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const [favIds, reqs, leases, threads] = await Promise.all([
        fetchFavoritesApi(),
        fetchSearchRequestsApi(),
        fetchLeaseContractsApi(),
        fetchChatThreadsApi(),
      ]);
      setFavorites(favIds);
      setSearchRequests(reqs);
      setLeaseContracts(leases);
      setChatThreads(threads);
      void fetchBookingsApi().catch(() => {});
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        clearSessionTokens();
        setCurrentUser(null);
        setCurrentView('mobile');
      }
    }
  }, []);

  // 1. Restore active session on boot via HttpOnly refresh cookie (or native refresh token)
  useEffect(() => {
    let active = true;
    const init = async () => {
      try {
        const session = await restoreSessionOnBoot();
        if (!active) return;
        if (session?.user) {
          setCurrentUser(session.user);
          setCurrentView(isAdminRole(session.user.role) ? 'admin' : 'mobile');
        } else {
          setCurrentUser(null);
          setCurrentView('mobile');
        }
      } catch {
        if (!active) return;
        clearSessionTokens();
        setCurrentUser(null);
        setCurrentView('mobile');
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  // 2. Sync marketplace & user data when auth ready or user changes
  useEffect(() => {
    if (!authReady) return;
    void loadPublicMarketplace();
    if (currentUser) {
      void loadPrivateUserData();
    } else {
      setFavorites([]);
      setSearchRequests([]);
      setLeaseContracts([]);
      setChatThreads([]);
    }
  }, [authReady, currentUser, loadPublicMarketplace, loadPrivateUserData]);

  // Auth lifecycle handlers
  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setShowAuthScreen(false);
    setGuestBrowsing(false);
    setApiError(null);
    if (isAdminRole(user.role)) {
      setCurrentView('admin');
    } else {
      setCurrentView('mobile');
    }
  };

  const handleLogout = async () => {
    await logoutSession();
    setCurrentUser(null);
    setFavorites([]);
    setChatThreads([]);
    setSearchRequests([]);
    setLeaseContracts([]);
    setCurrentView('mobile');
    setGuestBrowsing(false);
    setShowAuthScreen(true);
  };

  const handleLogoutAll = async () => {
    await logoutAllSessions();
    setCurrentUser(null);
    setFavorites([]);
    setChatThreads([]);
    setSearchRequests([]);
    setLeaseContracts([]);
    setCurrentView('mobile');
    setGuestBrowsing(false);
    setShowAuthScreen(true);
  };

  // AI Search
  const handleAiSearch = async (queryText: string) => {
    setIsSearchingAi(true);
    try {
      const res = await executeAiSearch(queryText);
      setAiCriteria(res);
      setAiExplanation(res.explanation || `AI Search: "${queryText}"`);
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
      setApiError(err instanceof Error ? err.message : 'AI search failed.');
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

  // Create listing with automatic server-side non-destructive GuriHel watermarking for uploaded photos
  const handleAddListing = async (newListing: Listing) => {
    const processedImages: string[] = [];
    for (const img of newListing.images) {
      if (img.startsWith('data:image/')) {
        const uploaded = await uploadPropertyMedia(img);
        processedImages.push(uploaded.url);
      } else if (img) {
        processedImages.push(img);
      }
    }

    const saved = await createListingApi({
      ...newListing,
      images: processedImages,
    });

    setListings((prev) => [saved, ...prev.filter((x) => x.id !== saved.id)]);
    void loadPublicMarketplace();
  };

  const handleToggleFavorite = async (id: string) => {
    if (!currentUser) {
      setShowAuthScreen(true);
      return;
    }
    const exists = favorites.includes(id);
    setFavorites((prev) => (exists ? prev.filter((x) => x !== id) : [...prev, id]));
    try {
      await toggleFavoriteApi(id, !exists);
    } catch (err) {
      setFavorites((prev) => (exists ? [...prev, id] : prev.filter((x) => x !== id)));
      setApiError(err instanceof Error ? err.message : 'Failed to update favorite.');
    }
  };

  const handleBookListing = async (payload: {
    listingId: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    paymentMethod: string;
  }) => {
    await createBookingApi(payload);
  };

  const handleAddSearchRequest = async (req: Partial<SearchRequest>) => {
    const created = await createSearchRequestApi(req);
    setSearchRequests((prev) => [created, ...prev]);
  };

  const handleAddLeaseContract = async (contract: Partial<LeaseContract>) => {
    const created = await createLeaseContractApi(contract);
    setLeaseContracts((prev) => [created, ...prev]);
  };

  const handleStartChatThread = async (listing?: Listing): Promise<string | null> => {
    try {
      const thread = await createChatThreadApi(
        listing
          ? {
              listingId: listing.id,
              listingTitle: listing.title,
              listingPrice: listing.price,
              listingImage: listing.images[0] || '',
              contactName: listing.broker.name,
              contactPhone: listing.broker.phone,
            }
          : {
              contactName: 'GuriHel Support',
              contactPhone: '+252636786709',
            }
      );
      setChatThreads((prev) => [thread, ...prev.filter((t) => t.id !== thread.id)]);
      return thread.id;
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not start chat.');
      return null;
    }
  };

  const handleSendMessage = async (threadId: string, text: string) => {
    try {
      const msg = await sendChatMessageApi(threadId, text);
      setChatThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                lastMessage: msg.body,
                lastTime: msg.time,
                messages: [...t.messages, msg],
              }
            : t
        )
      );
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not send message.');
    }
  };

  const handleRegisterProjectInterest = async (projectId: string) => {
    await registerProjectInterestApi(projectId);
    await loadPublicMarketplace();
  };

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
    if (advancedFilters.minBedrooms > 0 && listing.bedrooms < advancedFilters.minBedrooms) {
      return false;
    }
    if (advancedFilters.onlyVerified && !listing.verified) return false;
    if (advancedFilters.onlyFeatured && !listing.featured) return false;

    if (aiFilterActive && aiCriteria) {
      if (
        aiCriteria.district &&
        !listing.district.toLowerCase().includes(aiCriteria.district.toLowerCase())
      ) {
        return false;
      }
      if (aiCriteria.maxPrice && listing.price > aiCriteria.maxPrice) return false;
      if (aiCriteria.minBedrooms && listing.bedrooms < aiCriteria.minBedrooms) return false;
    }
    return true;
  });

  // Strict RBAC enforcement: Regular Users and Guests can NEVER reach Admin Portal
  const effectiveView: 'mobile' | 'admin' =
    isAdminRole(currentUser?.role) ? currentView : 'mobile';

  // Enforce Unified Login screen when unauthenticated (unless user chose public browsing)
  const mustShowLoginScreen =
    authReady && (showAuthScreen || (currentUser === null && !guestBrowsing));

  if (!authReady) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <SplashScreen />
        <img
          src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
          alt="GuriHel"
          className="h-10 w-auto object-contain mb-4"
        />
        <div className="w-6 h-6 border-2 border-[#0B7A3E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mustShowLoginScreen) {
    return (
      <div
        className={`${
          isNativeApk ? 'h-[100dvh] min-h-0' : 'min-h-screen'
        } bg-white flex flex-col w-full`}
      >
        <SplashScreen />
        <UnifiedLoginScreen
          onAuthenticated={handleAuthenticated}
          onBrowsePublic={
            !currentUser
              ? () => {
                  setGuestBrowsing(true);
                  setShowAuthScreen(false);
                }
              : undefined
          }
          onBack={
            showAuthScreen && (currentUser || guestBrowsing)
              ? () => setShowAuthScreen(false)
              : undefined
          }
        />
      </div>
    );
  }

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
          currentView={effectiveView}
          onViewChange={(view) => {
            if (view === 'admin' && !isAdminRole(currentUser?.role)) return;
            setCurrentView(view);
          }}
          currentUser={currentUser}
          onOpenLogin={() => setShowAuthScreen(true)}
          onLogout={handleLogout}
          onAiSearch={handleAiSearch}
          aiFilterActive={aiFilterActive}
          aiExplanation={aiExplanation}
          onClearAiFilter={handleClearAiFilter}
          isSearchingAi={isSearchingAi}
        />
      )}

      {upgradeBanner && (
        <div
          className={`bg-emerald-50 border-b border-emerald-200 px-3 sm:px-4 py-2 text-[11px] font-bold text-[#0B7A3E] flex items-center justify-between gap-2 shrink-0 ${
            isNativeApk ? 'safe-top' : ''
          }`}
        >
          <span className="min-w-0 break-words">✓ {upgradeBanner}</span>
          <button type="button" onClick={() => setUpgradeBanner(null)} className="shrink-0 p-1">
            ✕
          </button>
        </div>
      )}

      {apiError && (
        <div className="bg-red-50 border-b border-red-200 px-3 sm:px-4 py-1.5 text-[11px] text-red-700 flex items-center justify-between gap-2 shrink-0">
          <span className="truncate min-w-0">{apiError}</span>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="font-bold text-red-700 shrink-0 p-1"
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
            currentUser={currentUser}
            onOpenLogin={() => setShowAuthScreen(true)}
            onLogout={handleLogout}
            onLogoutAll={handleLogoutAll}
            onProfileUpdated={(user) => {
              setCurrentUser(user);
            }}
            onOpenAdminPortal={
              isAdminRole(currentUser?.role) ? () => setCurrentView('admin') : undefined
            }
            onAddListing={handleAddListing}
            onBookListing={handleBookListing}
            onAddSearchRequest={handleAddSearchRequest}
            onAddLeaseContract={handleAddLeaseContract}
            onStartChatThread={handleStartChatThread}
            onSendMessage={handleSendMessage}
            onRegisterProjectInterest={handleRegisterProjectInterest}
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
                maxPrice: 1000000,
                minBedrooms: 0,
                onlyVerified: false,
                onlyFeatured: false,
              })
            }
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onAiSearch={handleAiSearch}
            aiFilterActive={aiFilterActive}
            aiExplanation={aiExplanation}
            onClearAiFilter={handleClearAiFilter}
            isSearchingAi={isSearchingAi}
          />
        ) : (
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-xs font-bold text-[#0F3D2A]">
                Loading...
              </div>
            }
          >
            <LazyAdminPortal
              currentUser={currentUser}
              onViewListingDetail={(listing) => setInspectListing(listing)}
              onMarketplaceMutated={() => void loadPublicMarketplace()}
              onBackToApp={() => setCurrentView('mobile')}
              onOpenLogin={() => setShowAuthScreen(true)}
              onLogout={handleLogout}
            />
          </Suspense>
        )}
      </div>

      {inspectListing && (
        <ListingDetailModal
          listing={inspectListing}
          onClose={() => setInspectListing(null)}
          onOpenChat={(l) => {
            setInspectListing(null);
            setCurrentView('mobile');
            void handleStartChatThread(l);
          }}
          onBookNow={() => {
            setInspectListing(null);
            setCurrentView('mobile');
          }}
          isFavorite={favorites.includes(inspectListing.id)}
          onToggleFavorite={() => void handleToggleFavorite(inspectListing.id)}
        />
      )}
    </div>
  );
}
