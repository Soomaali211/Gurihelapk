import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Plus,
  Layers,
  Crosshair,
  Search,
  KeyRound,
  DoorOpen,
  List as ListIcon,
  User,
  Sparkles,
  Minus,
} from 'lucide-react';
import { Listing, ListingPurpose, PropertyType } from '../types';
import { INITIAL_BROKERS } from '../data/mockData';

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
  onOpenAiSearch?: () => void;
  aiFilterActive?: boolean;
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
  purpose: ListingPurpose;
  title: string;
  listingRef?: Listing;
}

const HARGEISA_CENTER: [number, number] = [9.558, 44.068];

const BROKER_AND_PROJECT_MARKERS = [
  { id: 'marker-project-1', label: 'Dahabshiil', kind: 'project' as const, lat: 9.5665, lng: 44.0735 },
  { id: 'marker-broker-1', label: 'Broker', kind: 'broker' as const, lat: 9.5625, lng: 44.0545 },
];

function formatCompactPrice(price: number): string {
  if (price >= 1_000_000) {
    const val = price / 1_000_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)} M`;
  }
  if (price >= 1_000) {
    const val = price / 1_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)} K`;
  }
  return `$${price}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  onOpenAiSearch,
  aiFilterActive,
}) => {
  const [isSatellite, setIsSatellite] = useState(false);
  const [locating, setLocating] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationMarkerRef = useRef<L.CircleMarker | null>(null);

  const callbacksRef = useRef({
    onSelectListing,
    onNavigateToProjects,
    onOpenChatWithBroker,
  });
  callbacksRef.current = {
    onSelectListing,
    onNavigateToProjects,
    onOpenChatWithBroker,
  };

  const displayPins = useMemo<MapPinItem[]>(() => {
    return listings
      .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number' && !Number.isNaN(l.lat) && !Number.isNaN(l.lng))
      .map((l) => ({
        id: l.id,
        label: formatCompactPrice(l.price),
        price: l.price,
        lat: l.lat,
        lng: l.lng,
        badge: l.verified ? 'check' : l.featured ? 'star' : undefined,
        isFeatured: l.featured,
        district: l.district,
        type: l.property_type,
        purpose: l.purpose,
        title: l.title,
        listingRef: l,
      }));
  }, [listings]);

  // Initialize Leaflet Map once with OpenStreetMap Basemap
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: HARGEISA_CENTER,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
    });

    map.attributionControl.setPrefix(false);

    // Official OpenStreetMap Basemap (strictly follows OSM Tile Usage Policy: standard viewport tiles, no bulk prefetch)
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
    osmLayer.addTo(map);
    tileLayerRef.current = osmLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      invalidate();
    });
    resizeObserver.observe(container);

    const timer = window.setTimeout(invalidate, 120);

    return () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      userLocationMarkerRef.current = null;
    };
  }, []);

  // Swap OpenStreetMap / Satellite basemap layer when toggled
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const nextLayer = isSatellite
      ? L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: 'Tiles &copy; Esri &middot; &copy; OpenStreetMap contributors',
            maxZoom: 19,
          }
        )
      : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          maxZoom: 19,
        });

    nextLayer.addTo(map);
    tileLayerRef.current = nextLayer;
  }, [isSatellite]);

  // Render listing price markers, broker markers, and real estate project markers onto Leaflet
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    // 1. Real Estate Project & Broker Markers
    BROKER_AND_PROJECT_MARKERS.forEach((bm) => {
      const bg = bm.kind === 'project' ? '#8D4B3E' : '#1E293B';
      const iconHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
          <div style="background:${bg};color:#fff;padding:3px 7px;border-radius:8px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.28);border:1.5px solid #fff;">
            ${bm.kind === 'project' ? '🏢 ' : '👤 '}${escapeHtml(bm.label)}
          </div>
        </div>
      `;
      const marker = L.marker([bm.lat, bm.lng], {
        icon: L.divIcon({
          className: 'gurihel-leaflet-pin',
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: 50,
      });

      marker.on('click', () => {
        if (bm.kind === 'project') {
          callbacksRef.current.onNavigateToProjects();
        } else if (listings[0]) {
          callbacksRef.current.onOpenChatWithBroker(listings[0]);
        }
      });

      marker.addTo(markersGroup);
    });

    // 2. Listing Price Markers (Firebase + Marketplace Coordinates)
    displayPins.forEach((pin) => {
      const isSelected = selectedListing?.id === pin.id;
      const bgColor = pin.isFeatured
        ? '#F5B800'
        : isSelected
        ? '#0F3D2A'
        : '#0B7A3E';
      const ringStyle = isSelected
        ? 'box-shadow:0 0 0 2px #34d399,0 4px 10px rgba(0,0,0,0.35);transform:scale(1.12);'
        : 'box-shadow:0 2px 6px rgba(0,0,0,0.28);';

      let badgeHtml = '';
      if (pin.badge === 'star') {
        badgeHtml =
          '<span style="width:13px;height:13px;border-radius:3px;background:#fff;color:#0B7A3E;display:inline-flex;align-items:center;justify-content:center;font-size:9px;line-height:1;">★</span>';
      } else if (pin.badge === 'check') {
        badgeHtml =
          '<span style="width:13px;height:13px;border-radius:9999px;background:#fff;color:#0B7A3E;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;line-height:1;">✓</span>';
      }

      const pinHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;">
          <div style="background:${bgColor};color:#fff;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-variant-numeric:tabular-nums;${ringStyle}">
            ${badgeHtml}
            <span>${escapeHtml(pin.label)}</span>
          </div>
          <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid ${bgColor};margin:0 auto;"></div>
        </div>
      `;

      const marker = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({
          className: 'gurihel-leaflet-pin',
          html: pinHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        zIndexOffset: isSelected ? 400 : pin.isFeatured ? 200 : 100,
      });

      marker.on('click', () => {
        const resolvedListing: Listing = pin.listingRef || {
          id: pin.id,
          title: pin.title,
          description: `${pin.title} ee degmada ${pin.district}, Hargeysa. Sharci diyaar ah.`,
          purpose: pin.purpose,
          property_type: pin.type,
          price: pin.price,
          currency: 'USD',
          price_unit: pin.purpose === 'rent' ? 'month' : 'total',
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
          featured: Boolean(pin.isFeatured),
          status: 'live',
          images: [
            pin.type === 'building'
              ? 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80'
              : pin.type === 'villa'
              ? 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80'
              : 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
          ],
          amenities: ['Water Tank', 'Parking', 'Generator'],
          broker: listings[0]?.broker || INITIAL_BROKERS[0],
          createdAt: '2026-11-15T10:00:00Z',
          views: 420,
        };
        callbacksRef.current.onSelectListing(resolvedListing);
      });

      marker.addTo(markersGroup);
    });
  }, [displayPins, selectedListing, listings]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleLocateMe = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          map.flyTo(coords, 15, { duration: 0.7 });
          if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.setLatLng(coords);
          } else {
            userLocationMarkerRef.current = L.circleMarker(coords, {
              radius: 7,
              color: '#ffffff',
              weight: 2.5,
              fillColor: '#0095D9',
              fillOpacity: 1,
            }).addTo(map);
          }
        },
        () => {
          setLocating(false);
          map.flyTo(HARGEISA_CENTER, 14, { duration: 0.6 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      map.flyTo(HARGEISA_CENTER, 14, { duration: 0.6 });
    }
  };

  return (
    <div className="relative w-full h-full flex-1 min-h-0 bg-[#F5F2EB] overflow-hidden select-none flex flex-col font-sans">
      {/* Top White Rounded-Bottom Header Wrapper */}
      <div className="relative z-[460] bg-white rounded-b-3xl shadow-md px-2.5 sm:px-3 pt-1.5 pb-2.5 space-y-2 border-b border-slate-200/70 shrink-0">
        {/* Row 1: [ Rent | Sale ] + [ Filters ] (+ AI quick icon on mobile APK) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {/* Segmented Rent / Sale White Card with Divider */}
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 flex items-center h-10 overflow-hidden shadow-2xs">
            <button
              onClick={() => onPurposeChange(purposeFilter === 'rent' ? 'all' : 'rent')}
              className={`flex-1 min-w-0 h-full px-1 flex items-center justify-center gap-1 text-xs font-bold transition-colors ${
                purposeFilter === 'rent'
                  ? 'bg-emerald-50/70 text-[#0B7A3E]'
                  : 'text-[#0B7A3E] hover:bg-slate-50'
              }`}
            >
              <DoorOpen className="w-4 h-4 text-[#0B7A3E] shrink-0" />
              <span className="truncate">Rent</span>
            </button>
            <div className="w-[1px] h-5 bg-slate-200 shrink-0"></div>
            <button
              onClick={() => onPurposeChange(purposeFilter === 'sale' ? 'all' : 'sale')}
              className={`flex-1 min-w-0 h-full px-1 flex items-center justify-center gap-1 text-xs font-bold transition-colors ${
                purposeFilter === 'sale'
                  ? 'bg-emerald-50/70 text-[#0B7A3E]'
                  : 'text-slate-800 hover:bg-slate-50'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">Sale</span>
            </button>
          </div>

          {onOpenAiSearch && (
            <button
              type="button"
              onClick={onOpenAiSearch}
              className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                aiFilterActive
                  ? 'bg-[#0B7A3E] border-[#0B7A3E] text-white'
                  : 'bg-emerald-50 border-emerald-200 text-[#0B7A3E] hover:bg-emerald-100'
              }`}
              title="AI Smart Search"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          {/* Sky-Blue Outlined Filters Button */}
          <button
            onClick={onOpenFilterModal}
            className="h-10 px-2.5 sm:px-3.5 bg-white hover:bg-sky-50/50 border-[1.5px] border-[#0095D9] text-[#0095D9] rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
          >
            <Search className="w-4 h-4 stroke-[2.2] shrink-0" />
            <span>Filters</span>
          </button>
        </div>

        {/* Row 2: Horizontal Scrollable Type Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
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
                  else onTypeChange(chip.id as 'all' | PropertyType);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 whitespace-nowrap transition-all border ${
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

      {/* Real OpenStreetMap Interactive Leaflet Map Canvas */}
      <div className="flex-1 min-h-0 relative w-full overflow-hidden">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

        {/* Top-Left Floating Real Estate & Broker Cards */}
        <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-[450] flex flex-col gap-1.5 sm:gap-2 w-[184px] sm:w-[205px] max-w-[calc(100%-64px)] pointer-events-auto">
          {/* Card 1: White Company Card */}
          <div
            onClick={onNavigateToProjects}
            className="bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-slate-200/90 shadow-md cursor-pointer hover:border-[#0B7A3E] transition-all flex items-center gap-2"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#8D4B3E] text-white flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
              <svg viewBox="0 0 24 24" className="w-4 h-4 sm:w-5 sm:h-5 fill-none stroke-current" strokeWidth="2">
                <path d="M3 18L9 7L14 14L17 10L21 18H3Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-extrabold text-slate-900 truncate">
                Dahabshiil Real Estate
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                5 projects available
              </div>
            </div>
          </div>

          {/* Card 2: White District Broker Card */}
          <div
            onClick={() => {
              if (listings[0]) onOpenChatWithBroker(listings[0]);
            }}
            className="bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-slate-200/90 shadow-md cursor-pointer hover:border-[#0B7A3E] transition-all flex items-center gap-2 w-[174px] sm:w-[195px] max-w-full"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-extrabold text-slate-900 truncate">
                  District Broker
                </span>
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                Jigjiga Yar District
              </div>
            </div>
          </div>
        </div>

        {/* Bottom-Left Circular White Map Controls (Zoom +, Zoom -, Layers, GPS) */}
        <div className="absolute left-2.5 sm:left-3 bottom-3 sm:bottom-4 z-[450] flex flex-col gap-2">
          <div className="flex flex-col bg-white rounded-full shadow-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-[#0B7A3E] border-b border-slate-100 transition-colors"
              title="Zoom In"
            >
              <Plus className="w-4 h-4 stroke-[2.4]" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 hover:text-[#0B7A3E] transition-colors"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4 stroke-[2.4]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSatellite((prev) => !prev)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-md flex items-center justify-center transition-colors border ${
              isSatellite
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={isSatellite ? 'OpenStreetMap View' : 'Satellite View'}
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center transition-colors ${
              locating ? 'text-[#0095D9] animate-pulse' : 'text-slate-600 hover:text-[#0B7A3E]'
            }`}
            title="Locate Me (GPS)"
          >
            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Full-Width Bottom White Action Bar (List | count | + Add) */}
      <div className="relative z-[460] bg-white border-t border-slate-200 grid grid-cols-3 items-center h-12 sm:h-13 shrink-0">
        {/* Left: List */}
        <button
          onClick={onSwitchToList}
          className="h-full min-w-0 px-1 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-100"
        >
          <ListIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">List</span>
        </button>

        {/* Center: Count */}
        <div className="h-full min-w-0 flex flex-col items-center justify-center text-center leading-tight px-1 border-r border-slate-100">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tabular-nums truncate max-w-full">
            {listings.length === 0 ? 'Weli guryo lama diiwaangelin' : `${listings.length} guryo`}
          </span>
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-600">listings</span>
        </div>

        {/* Right: + Add */}
        <button
          onClick={onOpenAddModal}
          className="h-full min-w-0 px-1 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#0B7A3E] hover:bg-emerald-50/40 transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center shadow-2xs shrink-0">
            <Plus className="w-3.5 h-3.5 stroke-3" />
          </span>
          <span className="truncate">Add</span>
        </button>
      </div>
    </div>
  );
};
