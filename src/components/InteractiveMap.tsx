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
  Sparkles,
  Minus,
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
  onNavigateToProjects: () => void;
  projectsCount?: number;
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
  listingRef: Listing;
}

const HARGEISA_CENTER: [number, number] = [9.558, 44.068];

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
  onNavigateToProjects,
  projectsCount = 0,
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

  const callbacksRef = useRef({ onSelectListing });
  callbacksRef.current = { onSelectListing };

  const displayPins = useMemo<MapPinItem[]>(() => {
    return listings
      .filter(
        (l) =>
          typeof l.lat === 'number' &&
          typeof l.lng === 'number' &&
          !Number.isNaN(l.lat) &&
          !Number.isNaN(l.lng)
      )
      .map((l) => ({
        id: l.id,
        label: formatCompactPrice(l.price),
        price: l.price,
        lat: l.lat,
        lng: l.lng,
        badge: l.verified ? 'check' : l.featured ? 'star' : undefined,
        isFeatured: l.featured,
        listingRef: l,
      }));
  }, [listings]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: HARGEISA_CENTER,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);

    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    });
    osmLayer.addTo(map);
    tileLayerRef.current = osmLayer;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    const invalidate = () => mapInstanceRef.current?.invalidateSize({ animate: false });
    const resizeObserver = new ResizeObserver(invalidate);
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

  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    displayPins.forEach((pin) => {
      const isSelected = selectedListing?.id === pin.id;
      const bgColor = pin.isFeatured ? '#F5B800' : isSelected ? '#0F3D2A' : '#0B7A3E';
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
        callbacksRef.current.onSelectListing(pin.listingRef);
      });

      marker.addTo(markersGroup);
    });
  }, [displayPins, selectedListing]);

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
      {/* Top White Filter Header */}
      <div className="relative z-[460] bg-white rounded-b-3xl shadow-md px-2.5 sm:px-3 pt-1.5 pb-2.5 space-y-2 border-b border-slate-200/70 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 flex items-center h-10 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => onPurposeChange(purposeFilter === 'rent' ? 'all' : 'rent')}
              className={`flex-1 min-w-0 h-full px-1 flex items-center justify-center gap-1 text-xs font-bold transition-colors ${
                purposeFilter === 'rent' ? 'bg-emerald-50/70 text-[#0B7A3E]' : 'text-[#0B7A3E] hover:bg-slate-50'
              }`}
            >
              <DoorOpen className="w-4 h-4 text-[#0B7A3E] shrink-0" />
              <span className="truncate">Rent</span>
            </button>
            <div className="w-[1px] h-5 bg-slate-200 shrink-0" />
            <button
              type="button"
              onClick={() => onPurposeChange(purposeFilter === 'sale' ? 'all' : 'sale')}
              className={`flex-1 min-w-0 h-full px-1 flex items-center justify-center gap-1 text-xs font-bold transition-colors ${
                purposeFilter === 'sale' ? 'bg-emerald-50/70 text-[#0B7A3E]' : 'text-slate-800 hover:bg-slate-50'
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
                  : 'bg-emerald-50 border-emerald-200 text-[#0B7A3E]'
              }`}
              title="AI Smart Search"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenFilterModal}
            className="h-10 px-2.5 sm:px-3.5 bg-white hover:bg-sky-50/50 border-[1.5px] border-[#0095D9] text-[#0095D9] rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <Search className="w-4 h-4 stroke-[2.2] shrink-0" />
            <span>Filters</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All' },
            { id: 'apartment', label: 'Apartment' },
            { id: 'villa', label: 'Villa' },
            { id: 'land', label: 'Land' },
            { id: 'building', label: 'Building' },
          ].map((chip) => {
            const isSelected = typeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onTypeChange(chip.id as 'all' | PropertyType)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl shrink-0 whitespace-nowrap border ${
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

      {/* Map Canvas */}
      <div className="flex-1 min-h-0 relative w-full overflow-hidden">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

        {/* Real Status Card (Official Logo + Genuine Counts Only) */}
        <div className="absolute top-2.5 left-2.5 z-[450] flex flex-col gap-2 max-w-[230px]">
          {projectsCount > 0 && (
            <button
              type="button"
              onClick={onNavigateToProjects}
              className="bg-white/95 backdrop-blur-xs p-2 rounded-xl border border-slate-200 shadow-md flex items-center gap-2 text-left"
            >
              <img
                src="/assets/aistudio/GuriHel-mark_d2d21036.png"
                alt="GuriHel Projects"
                className="w-7 h-7 object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-slate-900 truncate">
                  Real Estate Projects
                </div>
                <div className="text-[10px] text-[#0B7A3E] font-bold">
                  {projectsCount} live project{projectsCount === 1 ? '' : 's'}
                </div>
              </div>
            </button>
          )}

          {listings.length === 0 && (
            <div className="bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-2">
              <img
                src="/assets/aistudio/GuriHel-mark_d2d21036.png"
                alt="GuriHel"
                className="w-7 h-7 object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-slate-900">0 Properties on Map</div>
                <div className="text-[10px] text-slate-500">Tap + Add to publish the first</div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Left Map Controls */}
        <div className="absolute left-2.5 sm:left-3 bottom-3 sm:bottom-4 z-[450] flex flex-col gap-2">
          <div className="flex flex-col bg-white rounded-full shadow-md border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 border-b border-slate-100"
              title="Zoom In"
            >
              <Plus className="w-4 h-4 stroke-[2.4]" />
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4 stroke-[2.4]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsSatellite((prev) => !prev)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-md flex items-center justify-center border ${
              isSatellite
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
            title={isSatellite ? 'OpenStreetMap View' : 'Satellite View'}
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button
            type="button"
            onClick={handleLocateMe}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center ${
              locating ? 'text-[#0095D9] animate-pulse' : 'text-slate-600'
            }`}
            title="Locate Me"
          >
            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="relative z-[460] bg-white border-t border-slate-200 grid grid-cols-3 items-center h-12 sm:h-13 shrink-0">
        <button
          type="button"
          onClick={onSwitchToList}
          className="h-full min-w-0 px-1 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 border-r border-slate-100"
        >
          <ListIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">List</span>
        </button>

        <div className="h-full min-w-0 flex items-center justify-center text-xs font-bold text-slate-800 tabular-nums border-r border-slate-100 px-1">
          {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="h-full min-w-0 px-1 flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#0B7A3E] hover:bg-emerald-50/40"
        >
          <span className="w-5 h-5 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center shrink-0">
            <Plus className="w-3.5 h-3.5 stroke-3" />
          </span>
          <span className="truncate">Add</span>
        </button>
      </div>
    </div>
  );
};
