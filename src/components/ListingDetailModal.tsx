import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Check, 
  MapPin, 
  MessageSquare, 
  Phone, 
  ShieldCheck,
  School,
  Building
} from 'lucide-react';
import { Listing } from '../types';

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

  if (!listing) return null;

  // Use values matching Wireframe 7.5:
  // "250,000 USD ✔ Verified"
  // "Villa for sale · District, City"
  // Chips: "300 m²", "4 bed", "3 bath", "2 floors"
  // "Mini map + nearby (school, mosque, market)"
  // "Broker / Owner name · License no. · 24 listings"
  // Bottom: [ Chat ] and [ Call / WhatsApp ]

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text: `${listing.title} - $${listing.price.toLocaleString()} ee Hargeysa`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    }
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Asc ${listing.broker.name}, waxaan ka helay gurigan GuriHel: "${listing.title}" ($${listing.price.toLocaleString()}) ee ${listing.district}. Fadlan wax badan iiga sheeg.`
    );
    window.open(`https://wa.me/${listing.broker.whatsapp}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans select-none">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#C9D2CD] my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Item 1: Top Bar: [ ← ] (Back) on left, [ ♡ ] and [ ➦ ] (Share) on right */}
        <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-700 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            {copiedLink && (
              <span className="text-[11px] font-bold text-[#0B7A3E] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                Link copied!
              </span>
            )}
            <button
              onClick={(e) => onToggleFavorite(listing.id, e)}
              className={`p-2 rounded-full transition-colors ${
                isFavorite ? 'text-red-500 bg-red-50' : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Favorite"
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Gallery Slider with pagination dots */}
          <div className="relative aspect-16/10 w-full bg-slate-900 overflow-hidden">
            <img
              src={listing.images[activeImageIndex] || listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {listing.images.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                {listing.images.map((_, i) => (
                  <button
                    key={i}
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
            {/* Price & Verified Badge: "250,000 USD ✔ Verified" */}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xl sm:text-2xl font-black text-[#0B7A3E] tabular-nums">
                  ${listing.price.toLocaleString()} USD
                </div>
                <div className="bg-[#0B7A3E] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-3" />
                  <span>Verified</span>
                </div>
              </div>

              {/* Title & Location: "Villa for sale · District, City" */}
              <div className="text-xs font-bold text-slate-500 mt-1">
                Villa for sale · {listing.district}, {listing.city}
              </div>
            </div>

            {/* Chips: 300 m² | 4 bed | 3 bath | 2 floors */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#EEF2F0] p-2 rounded-xl">
                <div className="text-xs font-bold text-[#0F3D2A]">{listing.area_m2} m²</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl">
                <div className="text-xs font-bold text-[#0F3D2A]">{listing.bedrooms || 4} bed</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl">
                <div className="text-xs font-bold text-[#0F3D2A]">{listing.bathrooms || 3} bath</div>
              </div>
              <div className="bg-[#EEF2F0] p-2 rounded-xl">
                <div className="text-xs font-bold text-[#0F3D2A]">2 floors</div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 mb-1">
                Description
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {listing.description}
              </p>
            </div>

            {/* Mini Map + Nearby (school, mosque, market) */}
            <div>
              <div className="relative h-28 w-full bg-slate-100 rounded-2xl overflow-hidden border border-[#C9D2CD]">
                <div className="absolute inset-0 bg-[#e2e8f0] flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-6 h-6 text-[#0B7A3E] mx-auto animate-bounce" />
                    <span className="text-[10px] font-bold text-slate-600">
                      Mini map + nearby (school, mosque, market)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-around text-[10px] text-slate-500 font-semibold mt-1.5 px-2">
                <span className="flex items-center gap-1">🏫 Dugsi: 350m</span>
                <span className="flex items-center gap-1">🕌 Masaajid: 150m</span>
                <span className="flex items-center gap-1">🛒 Suuqa: 500m</span>
              </div>
            </div>

            {/* Broker / Owner Card: "Broker / Owner name · License no. · 24 listings" */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-[#C9D2CD] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={listing.broker.avatar}
                  alt={listing.broker.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#0B7A3E]"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <h5 className="text-xs font-bold text-slate-900">{listing.broker.name}</h5>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A3E]" />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Shati: {listing.broker.license} · <span className="font-bold text-[#0B7A3E]">24 listings</span>
                  </div>
                </div>
              </div>

              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="Online"></span>
            </div>
          </div>
        </div>

        {/* Sticky Bottom CTAs: [ Chat ] (green) and [ Call / WhatsApp ] */}
        <div className="p-3 bg-white border-t border-[#C9D2CD] grid grid-cols-2 gap-2 sticky bottom-0">
          <button
            onClick={() => onOpenChat(listing)}
            className="py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat</span>
          </button>
          <button
            onClick={openWhatsApp}
            className="py-2.5 bg-[#EEF2F0] hover:bg-slate-200 text-[#0F3D2A] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-[#C9D2CD] active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4 text-[#0B7A3E]" />
            <span>Call / WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
