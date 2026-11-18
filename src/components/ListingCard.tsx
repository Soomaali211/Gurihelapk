import React from 'react';
import { MapPin, Check, Heart, Bed, Bath, Maximize2, Sparkles } from 'lucide-react';
import { Listing } from '../types';

interface ListingCardProps {
  listing: Listing;
  onSelect: (listing: Listing) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onSelect,
  isFavorite,
  onToggleFavorite,
}) => {
  return (
    <div
      onClick={() => onSelect(listing)}
      className="bg-white rounded-2xl border border-[#C9D2CD] hover:border-[#0B7A3E] overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col"
    >
      {/* Image container */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
        <img
          src={listing.images[0]}
          alt={listing.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
        />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {listing.verified && (
            <span className="bg-[#0B7A3E] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
              <Check className="w-3 h-3" />
              Verified
            </span>
          )}
          {listing.featured && (
            <span className="bg-[#F5B800] text-slate-900 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
              <Sparkles className="w-3 h-3" />
              Featured
            </span>
          )}
          <span className="bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md capitalize">
            {listing.purpose === 'rent' ? 'Kiro' : listing.purpose === 'sale' ? 'Iib' : 'Ballan'}
          </span>
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => onToggleFavorite(listing.id, e)}
          className={`absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-md transition-colors ${
            isFavorite
              ? 'bg-red-500 text-white'
              : 'bg-white/80 text-slate-700 hover:bg-white'
          }`}
          title="Kaydi gurigan"
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Price Tag Overlay */}
        <div className="absolute bottom-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-white px-2.5 py-1 rounded-xl text-sm font-extrabold tabular-nums flex items-baseline gap-1">
          <span>${listing.price.toLocaleString()}</span>
          <span className="text-[10px] font-normal text-slate-300">
            {listing.price_unit === 'month' ? '/bil' : listing.price_unit === 'night' ? '/habeen' : ''}
          </span>
        </div>

        {/* Subtle Watermark Badge (35% opacity) */}
        <div className="absolute bottom-2.5 right-2.5 bg-black/40 backdrop-blur-2xs text-white/90 px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase pointer-events-none flex items-center gap-1 shadow-xs z-10">
          <span>🏠 GuriHel</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#0B7A3E]">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{listing.district}, {listing.city}</span>
          </div>

          <h3 className="text-sm font-bold text-[#0F3D2A] mt-1 line-clamp-1 group-hover:text-[#0B7A3E] transition-colors">
            {listing.title}
          </h3>

          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {listing.description}
          </p>
        </div>

        {/* Specs footer */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
            {listing.bedrooms > 0 && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Bed className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{listing.bedrooms} qol</span>
              </span>
            )}
            {listing.bathrooms > 0 && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Bath className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{listing.bathrooms} musqul</span>
              </span>
            )}
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Maximize2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{listing.area_m2} m²</span>
            </span>
          </div>

          <span className="text-[11px] font-semibold capitalize text-slate-400 shrink-0">
            {listing.property_type}
          </span>
        </div>
      </div>
    </div>
  );
};
