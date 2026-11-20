import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  ArrowLeft,
  Heart,
  Share2,
  Check,
  MessageSquare,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { Listing } from '../types';
import { resolveApiUrl } from '../lib/apiClient';

interface ListingDetailModalProps {
  listing: Listing | null;
  onClose: () => void;
  onOpenChat: (listing: Listing) => void;
  onBookNow: (listing: Listing) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const ListingDetailModal: React.FC<ListingDetailModalProps> = ({
  listing,
  onClose,
  onOpenChat,
  onBookNow,
  isFavorite,
  onToggleFavorite,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const miniMapRef = useRef<HTMLDivElement | null>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [listing?.id]);

  useEffect(() => {
    if (!listing || !miniMapRef.current) return;

    const lat = typeof listing.lat === 'number' && !Number.isNaN(listing.lat) ? listing.lat : 9.558;
    const lng = typeof listing.lng === 'number' && !Number.isNaN(listing.lng) ? listing.lng : 44.068;

    if (miniMapInstanceRef.current) {
      miniMapInstanceRef.current.remove();
      miniMapInstanceRef.current = null;
    }

    const map = L.map(miniMapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'gurihel-leaflet-pin',
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:#0B7A3E;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);transform:translate(-50%,-50%);"></div>',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }).addTo(map);

    miniMapInstanceRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize({ animate: false }), 150);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      miniMapInstanceRef.current = null;
    };
  }, [listing]);

  if (!listing) return null;

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: listing.title,
          text: `${listing.title} - $${listing.price.toLocaleString()} (${listing.district})`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const activeImg = listing.images[activeImageIndex] || listing.images[0];
  const resolvedImg = activeImg
    ? resolveApiUrl(activeImg)
    : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png';
  const brokerAvatar = listing.broker?.avatar
    ? resolveApiUrl(listing.broker.avatar)
    : '/assets/aistudio/GuriHel-app-icon-rounded_1e742137.png';

  const whatsappText = encodeURIComponent(
    `Asc ${listing.broker?.name || 'GuriHel'}, waxaan ka helay gurigan GuriHel: "${listing.title}" ($${listing.price.toLocaleString()}) ee ${listing.district}.`
  );
  const whatsappNumber = (listing.broker?.whatsapp || '252636786709').replace(/^\+/, '');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`;

  return (
    <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#C9D2CD] my-auto flex flex-col max-h-[92dvh]">
        {/* Top Bar */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-700"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {copiedLink && (
              <span className="text-[11px] font-bold text-[#0B7A3E] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Link copied
              </span>
            )}
            <button
              type="button"
              onClick={(e) => onToggleFavorite(listing.id, e)}
              className={`p-2 rounded-full transition-colors ${
                isFavorite ? 'text-red-500 bg-red-50' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden">
            <img src={resolvedImg} alt={listing.title} className="w-full h-full object-cover" />
            {listing.images.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                {listing.images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      activeImageIndex === i ? 'w-4 bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg sm:text-2xl font-black text-[#0B7A3E] tabular-nums truncate">
                  ${listing.price.toLocaleString()} USD
                </div>
                {listing.verified && (
                  <div className="bg-[#0B7A3E] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3 stroke-3" />
                    <span>Verified</span>
                  </div>
                )}
              </div>

              <div className="text-xs font-bold text-slate-500 mt-1">
                {listing.title} · {listing.district}, {listing.city}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-[#EEF2F0] p-2 rounded-xl min-w-0">
                <div className="text-xs font-bold text-[#0F3D2A] truncate">{listing.area_m2} m²</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl min-w-0">
                <div className="text-xs font-bold text-[#0F3D2A] truncate">{listing.bedrooms ?? 0} bed</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl min-w-0">
                <div className="text-xs font-bold text-[#0F3D2A] truncate">{listing.bathrooms ?? 0} bath</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl min-w-0">
                <div className="text-xs font-bold text-[#0F3D2A] truncate">{listing.living_rooms ?? 1} living</div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-extrabold text-slate-900 mb-1">Description</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{listing.description}</p>
            </div>

            <div>
              <div className="relative h-32 w-full bg-slate-100 rounded-2xl overflow-hidden border border-[#C9D2CD]">
                <div ref={miniMapRef} className="w-full h-full" />
              </div>
            </div>

            {/* Publisher Card (real metadata only) */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-[#C9D2CD] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={brokerAvatar}
                  alt={listing.broker?.name || 'GuriHel'}
                  className="w-10 h-10 rounded-full object-cover border border-[#0B7A3E] shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h5 className="text-xs font-bold text-slate-900 truncate">
                      {listing.broker?.name || 'GuriHel Verified Publisher'}
                    </h5>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {listing.broker?.agency || 'GuriHel Marketplace'} · {listing.broker?.phone}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTAs */}
        <div
          className={`p-3 bg-white border-t border-[#C9D2CD] grid gap-2 sticky bottom-0 safe-bottom ${
            listing.purpose === 'booking' ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={() => onOpenChat(listing)}
            className="py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate">Chat</span>
          </button>
          {listing.purpose === 'booking' && (
            <button
              type="button"
              onClick={() => onBookNow(listing)}
              className="py-2.5 bg-[#0095D9] hover:bg-sky-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
            >
              <span className="truncate">Book Now</span>
            </button>
          )}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 bg-[#EEF2F0] hover:bg-slate-200 text-[#0F3D2A] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-[#C9D2CD]"
          >
            <Phone className="w-4 h-4 text-[#0B7A3E] shrink-0" />
            <span className="truncate">WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
