export type ListingPurpose = 'rent' | 'sale' | 'booking';
export type PropertyType = 'villa' | 'apartment' | 'land' | 'commercial' | 'building';
export type ListingStatus = 'live' | 'pending' | 'rejected' | 'sold';
export type UserRole = 'user' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'blocked';

export function isAdminRole(role?: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  phoneE164: string;
  role: UserRole;
  isPrimaryAdmin: boolean;
  emailVerified?: boolean;
  fullName: string;
  city: string;
  language: 'SO' | 'EN' | 'AR';
  profileCompleted: boolean;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface AuthBootstrapStatus {
  primaryAdminInitialized: boolean;
  primaryAdminEmail: string;
  setupTokenRequired: boolean;
}

export interface PasswordResetRequestItem {
  id: string;
  userId: string;
  username: string;
  email: string;
  fullName: string;
  status: 'pending' | 'issued' | 'completed' | 'rejected';
  expiresAt: string;
  requestedIp: string;
  handledByAdminId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type WatermarkPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left'
  | 'center';

export type WatermarkVariant = 'primary' | 'mark';

export interface WatermarkSettings {
  enabled: boolean;
  position: WatermarkPosition;
  opacity: number;
  variant: WatermarkVariant;
  scalePercent: number;
}

export interface SystemSettings {
  watermark: WatermarkSettings;
  platformName: string;
  supportPhone: string;
  defaultCity: string;
  requireListingModeration: boolean;
}

export interface MediaAssetItem {
  id: string;
  url: string;
  originalUrl: string;
  uploadedByUserId: string;
  mimeType: string;
  width: number;
  height: number;
  watermarked: boolean;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number;
  watermarkVariant: WatermarkVariant;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  actorUsername: string;
  actorPhone: string;
  actorRole: UserRole;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface AdminSessionRecord {
  id: string;
  userId: string;
  username: string;
  phoneE164: string;
  role: UserRole;
  deviceLabel: string;
  ipAddress: string;
  rememberMe: boolean;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface AdminOverview {
  usersTotal: number;
  usersCompleted: number;
  listingsTotal: number;
  listingsLive: number;
  listingsPending: number;
  listingsRejected: number;
  projectsTotal: number;
  bookingsTotal: number;
  bookingsRevenue: number;
  requestsOpen: number;
  leasesTotal: number;
  mediaTotal: number;
  activeSessionsCount: number;
  pendingResetsCount: number;
  primaryAdminEmail: string;
  settings: SystemSettings;
}

export interface AdminReports {
  byDistrict: Array<{ district: string; count: number; avgPrice: number }>;
  byPurpose: Array<{ purpose: string; count: number; totalValue: number }>;
  byType: Array<{ propertyType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  districtBenchmarks: Array<{
    district: string;
    avgRentM2: number;
    avgSaleM2: number;
    growth: string;
  }>;
}

export interface BrokerInfo {
  id: string;
  name: string;
  agency: string;
  phone: string;
  whatsapp: string;
  license: string;
  district: string;
  avatar: string;
  rating: number;
  activeListingsCount: number;
  verified: boolean;
}

export interface Listing {
  id: string;
  ownerUid?: string;
  title: string;
  description: string;
  purpose: ListingPurpose;
  property_type: PropertyType;
  price: number;
  currency: 'USD' | 'SLSH';
  price_unit: 'total' | 'month' | 'year' | 'night';
  area_m2: number;
  bedrooms: number;
  living_rooms: number;
  bathrooms: number;
  city: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  verified: boolean;
  featured: boolean;
  status: ListingStatus;
  images: string[];
  amenities: string[];
  broker: BrokerInfo;
  createdAt: string;
  views: number;
  rejectionReason?: string;
}

export interface UnitDetail {
  code: string;
  type: string;
  area_m2: number;
  bedrooms: number;
  price: number;
  floor: number;
  status: 'available' | 'reserved' | 'sold';
}

export interface Project {
  id: string;
  name: string;
  developerName: string;
  developerLogo: string;
  city: string;
  district: string;
  address: string;
  stage: 'off_plan' | 'building' | 'ready';
  startingPrice: number;
  currency: 'USD';
  types: string[];
  heroImage: string;
  featured: boolean;
  handoverDate: string;
  units: UnitDetail[];
  description: string;
  leadsCount: number;
  progressPercent: number;
}

export interface BookingReservation {
  id: string;
  userId?: string;
  listingId: string;
  listingTitle: string;
  district: string;
  image: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  nightlyPrice: number;
  serviceFee: number;
  total: number;
  paymentMethod: 'Zaad Service' | 'eDahab' | 'Cash on Hand' | 'Card';
  paymentPhone?: string;
  guestName: string;
  guestPhone: string;
  status: 'held' | 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'broker' | 'system';
  body: string;
  time: string;
  kind?: 'text' | 'listing_card' | 'location' | 'appointment';
  listingPreview?: {
    id: string;
    title: string;
    price: number;
    currency: string;
    image: string;
  };
}

export interface ChatThread {
  id: string;
  broker: BrokerInfo;
  listingId?: string;
  listingTitle?: string;
  listingPrice?: number;
  listingImage?: string;
  lastMessage: string;
  lastTime: string;
  unread: boolean;
  messages: ChatMessage[];
}

export interface SearchRequest {
  id: string;
  seekerName: string;
  seekerPhone: string;
  purpose: ListingPurpose;
  propertyType: PropertyType;
  district: string;
  budgetMin: number;
  budgetMax: number;
  bedrooms: number;
  notes: string;
  status: 'open' | 'matched' | 'closed';
  createdAt: string;
  responsesCount: number;
}

export interface LeaseContract {
  id: string;
  listingId: string;
  propertyTitle: string;
  district: string;
  landlordName: string;
  landlordPhone: string;
  tenantName: string;
  tenantPhone: string;
  tenantIdNumber: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  durationMonths: number;
  terms: string[];
  landlordSigned: boolean;
  tenantSigned: boolean;
  status: 'draft' | 'signed' | 'active';
  createdAt: string;
}

export interface FilterState {
  purpose: 'all' | ListingPurpose;
  property_type: 'all' | PropertyType;
  district: string;
  minPrice: number;
  maxPrice: number;
  minBedrooms: number;
  onlyVerified: boolean;
  onlyFeatured: boolean;
}
