import React, { useState } from 'react';
import { 
  Plus, 
  Layers, 
  Crosshair, 
  Check, 
  Search,
  KeyRound,
  DoorOpen,
  Star,
  List as ListIcon,
  User
} from 'lucide-react';
import { Listing, ListingPurpose, PropertyType } from '../types';

interface InteractiveMapProps {
  listings: Listing[];
  selectedListing: Listing | null;
  onSelectListing: (listing: Listing) => void;
  purposeFilter: 'all' | ListingPurpose;
  onPurposeChange: (purpose: 'all' | ListingPurpose) => void;
  typeFilter: 'all' | PropertyType;
  onTypeChange: (type: 'all' | PropertyType) => void;
  onOpenAddModal: () => void;
  onOpenFilterModal: () => void;
  onOpenChatWithBroker: (listing: Listing) => void;
  onNavigateToProjects: () => void;
  onSwitchToList?: () => void;
}

interface MapPinItem {
  id: string;
  label: string;
  price: number;
  lat: number;
  lng: number;
  badge?: 'star' | 'check';
  isFeatured?: boolean;
  district: string;
  type: PropertyType;
  title: string;
}

// Price pins matching Screenshot 1 visual language & density, localized to Hargeisa
const MAP_PINS: MapPinItem[] = [
  { id: 'wf-56k', label: '56 K', price: 56000, lat: 9.5695, lng: 44.0600, district: 'Jigjiga Yar', type: 'apartment', title: 'Apartment 3 Qol · Jigjiga Yar' },
  { id: 'wf-75k', label: '75 K', price: 75000, lat: 9.5670, lng: 44.0645, badge: 'star', district: 'Jigjiga Yar', type: 'villa', title: 'Villa Cusub ★ · Jigjiga Yar' },
  { id: 'wf-50k-n', label: '50 K', price: 50000, lat: 9.5705, lng: 44.0800, district: 'Masalaha', type: 'land', title: 'Boos Dhul ah · Masalaha Waqooyi' },
  { id: 'wf-125k', label: '125 K', price: 125000, lat: 9.5640, lng: 44.0620, badge: 'check', district: 'Ibraahim Koodbuur', type: 'villa', title: 'Villa Sharciyaysan ✔ · Ibraahim Koodbuur' },
  { id: 'wf-55k', label: '55 K', price: 55000, lat: 9.5650, lng: 44.0815, district: 'Masalaha', type: 'apartment', title: 'Apartment Casri ah · Masalaha' },
  { id: 'wf-400k', label: '400 K', price: 400000, lat: 9.5630, lng: 44.0840, district: '26 June', type: 'building', title: 'Dabaq Ganacsi 400 K · 26 June' },
  { id: 'wf-50k-w', label: '50 K', price: 50000, lat: 9.5605, lng: 44.0580, badge: 'star', district: 'Ibraahim Koodbuur', type: 'apartment', title: 'Big Flat ★ · Ibraahim Koodbuur' },
  { id: 'wf-1.6m', label: '1.6 M', price: 1600000, lat: 9.5615, lng: 44.0695, district: '26 June', type: 'building', title: 'Dhisme Ganacsi 1.6 M · Bartamaha' },
  { id: 'wf-70k', label: '70 K', price: 70000, lat: 9.5620, lng: 44.0750, district: '26 June', type: 'apartment', title: 'Apartment Dabaq 3aad · 26 June' },
  { id: 'wf-110k', label: '110 K', price: 110000, lat: 9.5565, lng: 44.0610, district: 'Shacabka', type: 'villa', title: 'Villa Qoys · Shacabka' },
  { id: 'wf-120k', label: '120 K', price: 120000, lat: 9.5545, lng: 44.0630, district: 'Shacabka', type: 'villa', title: 'Villa Barxad Weyn · Shacabka' },
  { id: 'wf-4m', label: '4 M', price: 4000000, lat: 9.5560, lng: 44.0725, isFeatured: true, district: '26 June', type: 'building', title: 'Mashruuc Weyn (4 M USD) · 26 June' },
  { id: 'wf-1.5k', label: '1.5 K', price: 1500, lat: 9.5535, lng: 44.0785, badge: 'star', district: 'Ahmed Dhagax', type: 'villa', title: 'Kiro Villa Bishii ★ · Ahmed Dhagax' },
  { id: 'wf-220k', label: '220 K', price: 220000, lat: 9.5505, lng: 44.0675, district: 'Ahmed Dhagax', type: 'villa', title: 'Villa 5 Qol · Ahmed Dhagax' },
  { id: 'wf-80k', label: '80 K', price: 80000, lat: 9.5490, lng: 44.0740, district: 'Ahmed Dhagax', type: 'apartment', title: 'Apartment Cusub · Ahmed Dhagax' },
  { id: 'wf-30k-g', label: '30 K', price: 30000, lat: 9.5465, lng: 44.0750, isFeatured: true, district: 'Masalaha', type: 'land', title: 'Boos Featured 30 K · Masalaha' },
];

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  listings,
  selectedListing,
  onSelectListing,
  purposeFilter,
  onPurposeChange,
  typeFilter,
  onTypeChange,
  onOpenAddModal,
  onOpenFilterModal,
  onOpenChatWithBroker,
  onNavigateToProjects,
  onSwitchToList,
}) => {
  const [isSatellite, setIsSatellite] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const centerLat = 9.5580;
  const centerLng = 44.0680;
  const scale = 7800;

  const projectToCoords = (lat: number, lng: number) => {
    const x = 200 + (lng - centerLng) * scale + panOffset.x;
    const y = 300 - (lat - centerLat) * scale + panOffset.y;
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleLocateMe = () => {
    setPanOffset({ x: 0, y: 0 });
  };

  const districts = [
    { name: 'Jigjiga Yar', ar: 'جيجيغا يار', lat: 9.566, lng: 44.051 },
    { name: 'Ibraahim Koodbuur', ar: 'إبراهيم كودبور', lat: 9.560, lng: 44.048 },
    { name: 'Shacabka', ar: 'شعبكا', lat: 9.552, lng: 44.052 },
    { name: 'Hargeysa', ar: 'هرجيسا', lat: 9.547, lng: 44.066 },
  ];

  const visiblePins = MAP_PINS.filter((pin) => {
    if (purposeFilter === 'rent' && pin.price > 5000) return false;
    if (typeFilter !== 'all' && pin.type !== typeFilter) return false;
    return true;
  });

  // Fallback: if Rent filter hides everything, show all or rental pins
  const displayPins = visiblePins.length > 0 ? visiblePins : MAP_PINS;

  return (
    <div className="relative w-full h-[610px] bg-[#F5F3EC] overflow-hidden select-none flex flex-col font-sans">
      {/* Top White Rounded-Bottom Header Wrapper (Matching Screenshot 1) */}
      <div className="relative z-20 bg-white rounded-b-3xl shadow-md px-3 pt-1.5 pb-3 space-y-2.5 border-b border-slate-200/70">
        {/* Row 1: [ Rent | Sale ] + [ 🔍 Filters ] */}
        <div className="flex items-center gap-2">
          {/* Segmented Rent / Sale White Card with Divider */}
          <div className="flex-1 bg-white rounded-xl border border-slate-200 flex items-center h-10 overflow-hidden shadow-2xs">
            <button
              onClick={() => onPurposeChange(purposeFilter === 'rent' ? 'all' : 'rent')}
              className={`flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                purposeFilter === 'rent'
                  ? 'bg-emerald-50/70 text-[#0B7A3E]'
                  : 'text-[#0B7A3E] hover:bg-slate-50'
              }`}
            >
              <DoorOpen className="w-4 h-4 text-[#0B7A3E]" />
              <span>Rent</span>
            </button>
            <div className="w-[1px] h-5 bg-slate-200"></div>
            <button
              onClick={() => onPurposeChange(purposeFilter === 'sale' ? 'all' : 'sale')}
              className={`flex-1 h-full flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                purposeFilter === 'sale'
                  ? 'bg-emerald-50/70 text-[#0B7A3E]'
                  : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>Sale</span>
            </button>
          </div>

          {/* Sky-Blue Outlined Filters Button matching Screenshot 1 */}
          <button
            onClick={onOpenFilterModal}
            className="h-10 px-3.5 bg-white hover:bg-sky-50/50 border-[1.5px] border-[#0095D9] text-[#0095D9] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
            <span>Filters</span>
          </button>
        </div>

        {/* Row 2: Horizontal Scrollable Type Chips (All has green outline, others white) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'apartment', label: 'Apartment' },
            { id: 'villa', label: 'Villa' },
            { id: 'big_flat', label: 'Big flat' },
            { id: 'building', label: 'Building' },
          ].map((chip) => {
            const isSelected =
              chip.id === 'all'
                ? typeFilter === 'all'
                : chip.id === 'big_flat'
                ? typeFilter === 'land'
                : typeFilter === chip.id;

            return (
              <button
                key={chip.id}
                onClick={() => {
                  if (chip.id === 'big_flat') onTypeChange('land');
                  else onTypeChange(chip.id as any);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl shrink-0 transition-all border ${
                  isSelected
                    ? 'bg-emerald-50/40 text-[#0B7A3E] border-[#0B7A3E] font-bold'
                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div
        className={`flex-1 relative cursor-grab active:cursor-grabbing ${
          isSatellite ? 'bg-[#1a2433]' : 'bg-[#F5F2EB]'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Top-Left Floating Cards matching Screenshot 1 */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 w-[205px] pointer-events-auto">
          {/* Card 1: White Company Card with Terracotta Square Icon */}
          <div
            onClick={onNavigateToProjects}
            className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-md cursor-pointer hover:border-[#0B7A3E] transition-all flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-[#8D4B3E] text-white flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <path d="M3 18L9 7L14 14L17 10L21 18H3Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900 truncate">
                Dahabshiil Real Estate
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                5 projects available
              </div>
            </div>
          </div>

          {/* Card 2: White District Broker Card with Gray Square Avatar & Red Dot */}
          <div
            onClick={() => {
              if (listings[0]) onOpenChatWithBroker(listings[0]);
            }}
            className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-md cursor-pointer hover:border-[#0B7A3E] transition-all flex items-center gap-2.5 w-[195px]"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-900 truncate">
                  District Broker
                </span>
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate">
                Jigjiga Yar District
              </div>
            </div>
          </div>
        </div>

        {/* Google Maps Style SVG Vector Base */}
        <svg className="w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
          {/* Park & Airport Green/Blue Blocks */}
          <polygon points="210,120 235,115 250,155 225,160" fill={isSatellite ? '#1e3a5f' : '#DCE7F5'} />
          <polygon points="145,115 160,115 165,130 150,130" fill={isSatellite ? '#14532d' : '#CBEAD6'} />
          <polygon points="255,235 280,225 290,245 265,255" fill={isSatellite ? '#1e3a5f' : '#DCE7F5'} />

          {/* Google Maps Soft Lavender/Gray Major Highways */}
          <g stroke={isSatellite ? '#475569' : '#B8C4D9'} strokeWidth="2.2" fill="none">
            <path d="M 40 420 Q 170 290 360 110" />
            <path d="M 190 40 L 245 480" />
            <path d="M 110 80 Q 180 220 215 470" />
            <path d="M 30 220 Q 210 210 380 260" />
            <path d="M 120 180 C 170 150, 270 160, 320 220" />
            <path d="M 160 330 Q 260 320 380 350" />
            <path d="M 270 60 L 340 390" />
          </g>

          {/* Secondary Light Roads */}
          <g stroke={isSatellite ? '#334155' : '#FFFFFF'} strokeWidth="1.2" fill="none" opacity="0.85">
            <path d="M 120 100 L 350 200" />
            <path d="M 80 310 L 320 180" />
            <path d="M 150 260 L 290 420" />
          </g>

          {/* Bilingual District Labels matching Screenshot 1 */}
          {districts.map((d, idx) => {
            const pt = projectToCoords(d.lat, d.lng);
            return (
              <g key={idx} transform={`translate(${pt.x}, ${pt.y})`} className="pointer-events-none">
                <text
                  x="0"
                  y="0"
                  textAnchor="middle"
                  fill={isSatellite ? '#94a3b8' : '#334155'}
                  fontSize={d.name === 'Hargeysa' ? '14' : '10'}
                  fontWeight={d.name === 'Hargeysa' ? '700' : '600'}
                >
                  {d.name}
                </text>
                <text
                  x="0"
                  y="11"
                  textAnchor="middle"
                  fill={isSatellite ? '#64748b' : '#475569'}
                  fontSize="9"
                  fontWeight="500"
                >
                  {d.ar}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Price Pins matching Screenshot 1 */}
        {displayPins.map((pin) => {
          const pos = projectToCoords(pin.lat, pin.lng);
          const isSelected = selectedListing?.id === pin.id;

          return (
            <div
              key={pin.id}
              onClick={(e) => {
                e.stopPropagation();
                const match = listings.find((l) => l.id === pin.id) || {
                  id: pin.id,
                  title: pin.title,
                  description: `${pin.title} ee degmada ${pin.district}, Hargeysa. Sharci diyaar ah.`,
                  purpose: 'sale' as const,
                  property_type: pin.type,
                  price: pin.price,
                  currency: 'USD' as const,
                  price_unit: 'total' as const,
                  area_m2: pin.type === 'building' ? 4500 : pin.type === 'villa' ? 300 : 120,
                  bedrooms: pin.type === 'villa' ? 4 : pin.type === 'apartment' ? 3 : 0,
                  living_rooms: pin.type === 'villa' ? 2 : 1,
                  bathrooms: pin.type === 'villa' ? 3 : 2,
                  city: 'Hargeisa',
                  district: pin.district,
                  address: `${pin.district} Main Road`,
                  lat: pin.lat,
                  lng: pin.lng,
                  verified: pin.badge === 'check',
                  featured: !!pin.isFeatured,
                  status: 'live' as const,
                  images: [
                    pin.type === 'building'
                      ? 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80'
                      : pin.type === 'villa'
                      ? 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80'
                      : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
                  ],
                  amenities: ['Water Tank', 'Parking', 'Generator'],
                  broker: listings[0]?.broker,
                  createdAt: '2026-11-15T10:00:00Z',
                  views: 420,
                };
                onSelectListing(match);
              }}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className={`absolute cursor-pointer transition-transform duration-150 z-10 ${
                isSelected ? 'scale-120 z-30' : 'hover:scale-110 z-10'
              }`}
            >
              <div
                className={`px-2 py-0.5 rounded-md font-bold text-[11px] shadow-md flex items-center gap-1 tabular-nums whitespace-nowrap ${
                  pin.isFeatured
                    ? 'bg-[#F5B800] text-white border border-amber-500/40'
                    : isSelected
                    ? 'bg-[#0F3D2A] text-white ring-2 ring-emerald-400'
                    : 'bg-[#0B7A3E] text-white'
                }`}
              >
                {pin.badge === 'star' && (
                  <span className="w-3.5 h-3.5 rounded-xs bg-white text-[#0B7A3E] flex items-center justify-center">
                    <Star className="w-2.5 h-2.5 fill-current" />
                  </span>
                )}
                {pin.badge === 'check' && (
                  <span className="w-3.5 h-3.5 rounded-full bg-white text-[#0B7A3E] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-3" />
                  </span>
                )}
                <span>{pin.label}</span>
              </div>
              <div
                className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent mx-auto ${
                  pin.isFeatured
                    ? 'border-t-[5px] border-t-[#F5B800]'
                    : isSelected
                    ? 'border-t-[5px] border-t-[#0F3D2A]'
                    : 'border-t-[5px] border-t-[#0B7A3E]'
                }`}
              />
            </div>
          );
        })}

        {/* Bottom-Left Circular White Map Tools (Satellite + Locate-me GPS) matching Screenshot 1 */}
        <div className="absolute left-3 bottom-4 z-20 flex flex-col gap-2.5">
          <button
            onClick={() => setIsSatellite(!isSatellite)}
            className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition-colors border ${
              isSatellite
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Satellite View"
          >
            <Layers className="w-5 h-5" />
          </button>
          <button
            onClick={handleLocateMe}
            className="w-10 h-10 rounded-full bg-white text-slate-600 hover:text-[#0B7A3E] shadow-md border border-slate-200 flex items-center justify-center transition-colors"
            title="Locate Me (GPS)"
          >
            <Crosshair className="w-5 h-5" />
          </button>
        </div>

        {/* Google Watermark Bottom-Right matching Screenshot 1 */}
        <div className="absolute right-3 bottom-3 pointer-events-none select-none z-10">
          <span className="text-sm font-black tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
            Google
          </span>
        </div>
      </div>

      {/* Full-Width Bottom White Action Bar (List | 54 from 28,089 listings | + Add) matching Screenshot 1 */}
      <div className="relative z-20 bg-white border-t border-slate-200 grid grid-cols-3 items-center h-13 shrink-0">
        {/* Left: List */}
        <button
          onClick={onSwitchToList}
          className="h-full flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-100"
        >
          <ListIcon className="w-4 h-4 text-slate-500" />
          <span>List</span>
        </button>

        {/* Center: Count */}
        <div className="h-full flex flex-col items-center justify-center text-center leading-tight px-1 border-r border-slate-100">
          <span className="text-[11px] font-bold text-slate-800 tabular-nums">54 from 28,089</span>
          <span className="text-[11px] font-medium text-slate-600">listings</span>
        </div>

        {/* Right: + Add with Green Circle */}
        <button
          onClick={onOpenAddModal}
          className="h-full flex items-center justify-center gap-2 text-xs font-extrabold text-[#0B7A3E] hover:bg-emerald-50/40 transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center shadow-2xs">
            <Plus className="w-3.5 h-3.5 stroke-3" />
          </span>
          <span>Add</span>
        </button>
      </div>
    </div>
  );
};
