// ============================================================================
// GURIHEL SHARED TYPES & OPENAPI 3.1 DATA CONTRACTS
// Verbatim definitions matching Section 12 of Full Stack Blueprint v1.0
// ============================================================================

export type UserRole = 'seeker' | 'owner' | 'broker' | 'developer' | 'support' | 'moderator' | 'admin';
export type ListingPurpose = 'sale' | 'rent' | 'booking';
export type PropertyType = 'apartment' | 'villa' | 'big_flat' | 'building' | 'land' | 'shop' | 'office';
export type ListingStatus = 'draft' | 'pending' | 'live' | 'rejected' | 'sold' | 'expired';

export interface UserDto {
  id: string;
  phone: string;
  email?: string;
  role: UserRole;
  lang: 'so' | 'en' | 'ar';
  status: 'active' | 'blocked' | 'deleted';
  verified_at?: string;
  created_at: string;
}

export interface ProfileDto {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  license_no?: string;
  district?: string;
  bio?: string;
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface MapPinDto {
  id: string;
  lat: number;
  lng: number;
  price: number;
  label: string;
  verified: boolean;
  featured: boolean;
}

export interface MapClusterDto {
  lat: number;
  lng: number;
  count: number;
}

export interface MapResponseDto {
  total_matching: number;
  returned: number;
  pins: MapPinDto[];
  clusters: MapClusterDto[];
  cards: {
    broker?: {
      name: string;
      district: string;
      unread: boolean;
      avatar?: string;
      phone?: string;
    };
    company?: {
      name: string;
      projects: number;
      logo?: string;
    };
  };
}

export interface WebSocketMessageEvent {
  event: 'message:send' | 'message:new' | 'message:ack' | 'typing' | 'read' | 'presence';
  payload: Record<string, unknown>;
}
