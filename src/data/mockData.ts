import { Listing, Project, BookingReservation, ChatThread, SearchRequest, LeaseContract } from '../types';

export const INITIAL_BROKERS = [
  {
    id: 'b-01',
    name: 'District Broker',
    agency: 'An Nada District Specialists',
    phone: '+252 63 4421980',
    whatsapp: '252634421980',
    license: 'SL-MOP-2024-089',
    district: 'An Nada / Jigjiga Yar',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    rating: 4.9,
    activeListingsCount: 8,
    verified: true,
  },
  {
    id: 'b-02',
    name: 'Saynab Cali Jaamac',
    agency: 'Hodan Real Estate Bureau',
    phone: '+252 63 4118833',
    whatsapp: '252634118833',
    license: 'SL-MOP-2023-412',
    district: 'Ibraahim Koodbuur',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80',
    rating: 4.8,
    activeListingsCount: 12,
    verified: true,
  },
  {
    id: 'b-03',
    name: 'Mustafe Cabdi Daahir',
    agency: 'Gollis Homes & Land',
    phone: '+252 63 4889922',
    whatsapp: '252634889922',
    license: 'SL-MOP-2025-104',
    district: '26 June',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    rating: 4.7,
    activeListingsCount: 9,
    verified: true,
  },
];

// The listings matching the exact Wireframe 7.1 price pins:
// 65K, 39K, 80K, 100K, 125K (verified), 70K, 110K, 4M (featured yellow), 40K, 65K, 238K, 50K
// plus #A1042: Villa 250,000 USD (from Wireframe 7.5 & 7.6)
export const INITIAL_LISTINGS: Listing[] = [];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'prj-01',
    name: 'Project name',
    developerName: 'Real estate Projects / Dahabshiil',
    developerLogo: '🏢',
    city: 'Hargeysa',
    district: 'District, near airport...',
    address: 'Street, District, near airport...',
    stage: 'off_plan',
    startingPrice: 1200000,
    currency: 'USD',
    types: ['Apartment', 'Off Plan'],
    heroImage: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    featured: true,
    handoverDate: 'Q4 2027',
    progressPercent: 35,
    leadsCount: 42,
    description: 'Dhismaha casriga ah ee mashaariicda off-plan ee Hargeysa.',
    units: [
      { code: 'A-201', type: '2 Bed Apt', area_m2: 95, bedrooms: 2, price: 85000, floor: 2, status: 'available' },
      { code: 'A-404', type: '3 Bed Apt', area_m2: 140, bedrooms: 3, price: 120000, floor: 4, status: 'available' },
      { code: 'PH-12', type: 'Penthouse', area_m2: 240, bedrooms: 4, price: 210000, floor: 12, status: 'reserved' },
    ],
  },
  {
    id: 'prj-02',
    name: 'Villas for sale',
    developerName: 'Horn Builders',
    developerLogo: '🏗️',
    city: 'Hargeysa',
    district: 'Jigjiga Yar',
    address: 'Near Mansoor Extension',
    stage: 'building',
    startingPrice: 185000,
    currency: 'USD',
    types: ['Villa', 'Off Plan'],
    heroImage: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    featured: true,
    handoverDate: 'Q2 2027',
    progressPercent: 60,
    leadsCount: 68,
    description: 'Xaafad deegaan oo qorsheysan oo ka kooban villas heersare ah.',
    units: [
      { code: 'V-08', type: '4 Bed Villa', area_m2: 260, bedrooms: 4, price: 185000, floor: 2, status: 'available' },
    ],
  },
];

export const INITIAL_CHAT_THREADS: ChatThread[] = [
  {
    id: 'thr-01',
    broker: INITIAL_BROKERS[0],
    listingId: 'A1042',
    listingTitle: 'Villa · 250,000 USD',
    listingPrice: 250000,
    listingImage: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=400&q=80',
    lastMessage: 'Waa hagaag. Waan ku sugayaa.',
    lastTime: '10:45 AM',
    unread: true,
    messages: [
      {
        id: 'm1',
        sender: 'user',
        body: 'Salaan, guriga weli waa banaan yahay?',
        time: '10:30 AM',
      },
      {
        id: 'm2',
        sender: 'broker',
        body: 'Haa, waa banaan yahay. Ma rabtaa inaad timaaddo?',
        time: '10:35 AM',
      },
      {
        id: 'm3',
        sender: 'user',
        body: 'Haa, berri 4PM.',
        time: '10:40 AM',
      },
      {
        id: 'm4',
        sender: 'broker',
        body: 'Waa hagaag. Waan ku sugayaa.',
        time: '10:45 AM',
      },
    ],
  },
];

export const INITIAL_SEARCH_REQUESTS: SearchRequest[] = [
  {
    id: 'sr-01',
    seekerName: 'Jaamac Cumar Cali',
    seekerPhone: '+252 63 4490112',
    purpose: 'rent',
    propertyType: 'villa',
    district: 'Jigjiga Yar',
    budgetMin: 350,
    budgetMax: 500,
    bedrooms: 3,
    notes: 'Qoys 5 qof ah, waxaan rabnaa meel amnigeedu sugan yahay oo barkad biyo leh.',
    status: 'open',
    createdAt: '2026-11-04T08:00:00Z',
    responsesCount: 3,
  },
];

export const INITIAL_LEASE_CONTRACTS: LeaseContract[] = [
  {
    id: 'lc-901',
    listingId: 'A1042',
    propertyTitle: 'Villa for sale · District, City',
    district: 'Jigjiga Yar, Hargeisa',
    landlordName: 'Xasan Cabdilaahi Xirsi',
    landlordPhone: '+252 63 4409988',
    tenantName: 'Khadar Maxamuud Nuur',
    tenantPhone: '+252 63 4552211',
    tenantIdNumber: 'SL-NID-8849201',
    monthlyRent: 650,
    securityDeposit: 650,
    startDate: '2026-12-01',
    durationMonths: 12,
    terms: [
      'Kirada waxaa lagu bixinayaa bil kasta 1-da ilaa 5-ta adoo adeegsanaya Zaad ama eDahab.',
      'Deposit-ka dib ayaa loogu celinayaa kiraystaha haddii gurigu badqabo.',
    ],
    landlordSigned: true,
    tenantSigned: true,
    status: 'active',
    createdAt: '2026-11-01T15:00:00Z',
  },
];

export const DISTRICT_PRICE_TRENDS = [
  { district: 'Jigjiga Yar', avgRentM2: 5.2, avgSaleM2: 520, growth: '+6.4%' },
  { district: 'Ibraahim Koodbuur', avgRentM2: 4.8, avgSaleM2: 460, growth: '+5.1%' },
  { district: '26 June', avgRentM2: 4.5, avgSaleM2: 490, growth: '+3.8%' },
  { district: 'Shacabka', avgRentM2: 5.0, avgSaleM2: 550, growth: '+4.2%' },
  { district: 'Ahmed Dhagax', avgRentM2: 3.2, avgSaleM2: 310, growth: '+7.9%' },
  { district: 'Masalaha', avgRentM2: 2.9, avgSaleM2: 240, growth: '+12.5%' },
];
