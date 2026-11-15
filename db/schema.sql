-- ============================================================================
-- GURIHEL DATABASE SCHEMA (PostgreSQL 16 + PostGIS)
-- Verbatim implementation matching Section 11 of Full Stack Blueprint v1.0
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

-- 11.2 Users, Profiles, Companies
CREATE TYPE user_role AS ENUM ('seeker', 'owner', 'broker', 'developer', 'support', 'moderator', 'admin');

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email CITEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'seeker',
  lang CHAR(2) NOT NULL DEFAULT 'so',
  status VARCHAR(12) NOT NULL DEFAULT 'active', -- active|blocked|deleted
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  license_no TEXT,
  district TEXT,
  bio TEXT,
  kyc_status VARCHAR(10) DEFAULT 'none' -- none|pending|approved|rejected
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  logo_url TEXT,
  type VARCHAR(12) CHECK (type IN ('agency', 'developer')),
  verified BOOLEAN DEFAULT false
);

-- 11.3 Listings (Qalbiga Nidaamka)
CREATE TYPE listing_purpose AS ENUM ('sale', 'rent', 'booking');
CREATE TYPE listing_status AS ENUM ('draft', 'pending', 'live', 'rejected', 'sold', 'expired');

CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  project_id UUID,
  purpose listing_purpose NOT NULL,
  property_type VARCHAR(20) NOT NULL, -- apartment|villa|big_flat|building|land|shop|office
  title TEXT,
  description TEXT,
  price NUMERIC(14,2) NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  price_unit VARCHAR(10) DEFAULT 'total', -- total|month|year|night
  area_m2 NUMERIC(10,2),
  bedrooms SMALLINT,
  living_rooms SMALLINT,
  bathrooms SMALLINT,
  amenities JSONB DEFAULT '{}',
  city TEXT,
  district TEXT,
  address TEXT,
  geom GEOGRAPHY(Point,4326) NOT NULL,
  verified BOOLEAN DEFAULT false,
  featured_until TIMESTAMPTZ,
  status listing_status DEFAULT 'pending',
  views INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listings_geom_gix ON listings USING GIST (geom);
CREATE INDEX IF NOT EXISTS listings_search_ix ON listings (status, purpose, property_type, price);
CREATE INDEX IF NOT EXISTS listings_city_ix ON listings (city, district);

-- 11.4 Projects, Units, Media
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  city TEXT,
  district TEXT,
  address TEXT,
  geom GEOGRAPHY(Point,4326),
  stage VARCHAR(12) DEFAULT 'off_plan', -- off_plan|building|ready
  starting_price NUMERIC(14,2),
  currency CHAR(3) DEFAULT 'USD',
  types TEXT[],
  hero_url TEXT,
  featured_until TIMESTAMPTZ,
  handover_date DATE,
  status VARCHAR(10) DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  code TEXT,
  type TEXT,
  area_m2 NUMERIC,
  bedrooms SMALLINT,
  price NUMERIC(14,2),
  floor SMALLINT,
  status VARCHAR(10) DEFAULT 'available' -- available|reserved|sold
);

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  kind VARCHAR(8) CHECK (kind IN ('image', 'video', 'plan', 'tour360')),
  url TEXT NOT NULL,
  thumb_url TEXT,
  blurhash TEXT,
  position SMALLINT DEFAULT 0
);

-- 11.5 Bookings (Availability + Payments with Double-Booking Prevention)
CREATE TABLE IF NOT EXISTS booking_calendar (
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  day DATE,
  price NUMERIC(10,2),
  blocked BOOLEAN DEFAULT false,
  PRIMARY KEY (listing_id, day)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  guest_id UUID NOT NULL REFERENCES users(id),
  stay DATERANGE NOT NULL, -- [check_in, check_out)
  nights INT GENERATED ALWAYS AS (upper(stay) - lower(stay)) STORED,
  subtotal NUMERIC(12,2),
  fee NUMERIC(12,2),
  tax NUMERIC(12,2),
  total NUMERIC(12,2),
  status VARCHAR(12) DEFAULT 'held', -- held|paid|confirmed|cancelled|completed|refunded
  hold_expires TIMESTAMPTZ,
  policy VARCHAR(10) DEFAULT 'moderate',
  created_at TIMESTAMPTZ DEFAULT now(),
  EXCLUDE USING GIST (listing_id WITH =, stay WITH &&) WHERE (status IN ('held','paid','confirmed'))
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  user_id UUID REFERENCES users(id),
  provider VARCHAR(12), -- Zaad, eDahab, EVC Plus, Stripe
  provider_ref TEXT UNIQUE,
  amount NUMERIC(12,2),
  currency CHAR(3),
  status VARCHAR(10),
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11.6 Chat, Subscriptions, Favorites, Search Requests
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID,
  project_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES users(id),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES users(id),
  kind VARCHAR(8) DEFAULT 'text',
  body TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conv_ix ON messages (conversation_id, id DESC);

CREATE TABLE IF NOT EXISTS plans (
  code TEXT PRIMARY KEY,
  name TEXT,
  price NUMERIC,
  max_listings INT,
  features JSONB
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  plan_code TEXT REFERENCES plans(code),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID,
  listing_id UUID,
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS search_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  purpose listing_purpose,
  property_type TEXT,
  city TEXT,
  district TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  notes TEXT,
  status VARCHAR(8) DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  diff JSONB,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT now()
);
