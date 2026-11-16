export type ListingPurpose = 'rent' | 'sale' | 'booking';
export type PropertyType = 'villa' | 'apartment' | 'land' | 'commercial' | 'building';
export type ListingStatus = 'live' | 'pending' | 'rejected' | 'sold';
export type UserRole = 'seeker' | 'owner' | 'broker' | 'developer' | 'admin';
export type AdminSubRole = 'super' | 'moderator' | 'finance' | 'support';

export interface AdminRecord {
  uid: string;
  email: string;
  subRole: AdminSubRole;
  status: 'active' | 'suspended';
  mfaEnabled: boolean;
  totpSecretEnc?: string;
  recoveryCodeHashes?: string[];
  sessionEpoch: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDevice {
  id: string;
  adminUid: string;
  fingerprint: string;
  label: string;
  trusted: boolean;
  approvedBy: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  subRole: AdminSubRole;
  action: string;
  target: string;
  details: string;
  deviceLabel: string;
  stepUpUsed: boolean;
  createdAt: string;
}

export interface AdminSessionState {
  token: string;
  expiresAt: number;
  stepUpUntil: number;
  sessionEpoch: number;
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
