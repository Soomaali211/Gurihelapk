import React, { useState } from 'react';
import { Calendar, MapPin, SlidersHorizontal, Plus, Map, Building2 } from 'lucide-react';
import { Listing } from '../types';
import { resolveApiUrl } from '../lib/apiClient';

interface BookingsViewProps {
  listings: Listing[];
  onListingClick: (listing: Listing) => void;
  onSwitchToMap?: () => void;
  onOpenAddModal?: () => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  listings,
  onListingClick,
  onSwitchToMap,
  onOpenAddModal,
}) => {
  const [selectedCity, setSelectedCity] = useState('All');
  const [currencyUnit, setCurrencyUnit] = useState<'USD' | 'SAR'>('USD');
  const [slideByUnit, setSlideByUnit] = useState<Record<string, number>>({});
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  const [startDay, setStartDay] = useState<number>(15);
  const [endDay, setEndDay] = useState<number>(16);
  const [selectingMonth, setSelectingMonth] = useState<'nov' | 'dec'>('nov');

  const dateRangeLabel = `${startDay} - ${endDay} ${selectingMonth === 'nov' ? 'Nov' : 'Dec'}`;

  const handleDayClick = (day: number, month: 'nov' | 'dec') => {
    setSelectingMonth(month);
    if (day <= startDay || startDay !== endDay) {
      setStartDay(day);
      setEndDay(day + 1 <= (month === 'nov' ? 30 : 31) ? day + 1 : day);
    } else {
      setEndDay(day);
    }
  };

  const novDays = Array.from({ length: 30 }, (_, i) => i + 1);
  const decBlanks = [0, 1];
  const decDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const bookingUnits = listings
    .filter(
      (l) =>
        l.purpose === 'booking' &&
        (selectedCity === 'All' || l.city.toLowerCase() === selectedCity.toLowerCase())
    )
    .map((l) => ({
      id: l.id,
      title: `${l.title}, ${l.district}`,
      priceUSD: `$${l.price.toFixed(2)}`,
      priceSAR: `${(l.price * 3.75).toFixed(2)} SAR`,
      specs: `${l.area_m2} m² · ${l.bedrooms} bed · ${l.living_rooms} living · ${l.bathrooms} bath`,
      images:
        l.images.length > 0
          ? l.images.map(resolveApiUrl)
          : ['/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'],
      listingObj: l,
    }));

  return (
    <div className="flex flex-col bg-[#F6F8F9] flex-1 min-h-0 h-full w-full overflow-hidden font-sans select-none relative">
      {/* Top 3 Filter Pills */}
      <div className="bg-white px-2.5 sm:px-3 py-2.5 border-b border-slate-200/80 shrink-0 z-20">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowCalendarSheet(true)}
            className="min-w-0 px-2 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">{dateRangeLabel}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedCity((prev) =>
                prev === 'All' ? 'Hargeisa' : prev === 'Hargeisa' ? 'Berbera' : 'All'
              )
            }
            className="min-w-0 px-2 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">{selectedCity === 'All' ? 'City' : selectedCity}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCalendarSheet(true)}
            className="min-w-0 px-2 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">Dates</span>
          </button>
        </div>
      </div>

      {/* Scrollable Feed or Clean Empty State */}
      <div className="p-3.5 space-y-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-0.5">
          <div className="text-sm font-extrabold text-slate-900 tracking-tight tabular-nums">
            {bookingUnits.length} Booking {bookingUnits.length === 1 ? 'Unit' : 'Units'}
          </div>
          <button
            type="button"
            onClick={() => setCurrencyUnit(currencyUnit === 'USD' ? 'SAR' : 'USD')}
            className="text-[10px] font-bold text-[#0B7A3E] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            {currencyUnit} / Night
          </button>
        </div>

        {bookingUnits.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-900">No Short-Stay Bookings Listed Yet</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Properties listed for daily or nightly stay bookings will appear here once published.
            </p>
            {onOpenAddModal && (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="px-4 py-2 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
              >
                + Add Booking Unit
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {bookingUnits.map((unit) => {
              const currentSlide = slideByUnit[unit.id] ?? 0;
              return (
                <div
                  key={unit.id}
                  onClick={() => onListingClick(unit.listingObj)}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-[#0B7A3E] overflow-hidden shadow-2xs cursor-pointer"
                >
                  <div className="relative aspect-16/9 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={unit.images[currentSlide % unit.images.length]}
                      alt={unit.title}
                      className="w-full h-full object-cover"
                    />
                    {unit.images.length > 1 && (
                      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                        {unit.images.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSlideByUnit((prev) => ({ ...prev, [unit.id]: i }));
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              currentSlide % unit.images.length === i ? 'w-4 bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-black text-[#0B7A3E] tabular-nums">
                        {currencyUnit === 'USD' ? unit.priceUSD : unit.priceSAR}
                      </span>
                      <span className="text-xs font-medium text-slate-500">/ Night</span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">{unit.specs}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#0B7A3E] shrink-0" />
                      <span>{unit.title}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="relative z-20 bg-white border-t border-slate-200 grid grid-cols-3 items-center h-13 shrink-0">
        <button
          type="button"
          onClick={onSwitchToMap}
          className="h-full flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 border-r border-slate-100"
        >
          <Map className="w-4 h-4 text-slate-500" />
          <span>Map</span>
        </button>

        <div className="h-full flex items-center justify-center text-xs font-bold text-slate-700 border-r border-slate-100 tabular-nums">
          {bookingUnits.length} listings
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="h-full flex items-center justify-center gap-2 text-xs font-extrabold text-[#0B7A3E] hover:bg-emerald-50/40"
        >
          <span className="w-5 h-5 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 stroke-3" />
          </span>
          <span>Add</span>
        </button>
      </div>

      {/* Calendar Bottom Sheet */}
      {showCalendarSheet && (
        <div
          onClick={() => setShowCalendarSheet(false)}
          className="fixed sm:absolute inset-0 z-[500] sm:z-40 bg-black/50 flex flex-col justify-end"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden safe-bottom"
          >
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Booking Date</h3>
              <button
                type="button"
                onClick={() => setShowCalendarSheet(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-3 overflow-y-auto space-y-5 flex-1">
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">November</h4>
                <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-semibold">
                  {novDays.map((day) => {
                    const isStart = selectingMonth === 'nov' && day === startDay;
                    const isEnd = selectingMonth === 'nov' && day === endDay;
                    return (
                      <div key={day} className="flex items-center justify-center h-9">
                        <button
                          type="button"
                          onClick={() => handleDayClick(day, 'nov')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center tabular-nums ${
                            isStart || isEnd
                              ? 'bg-[#1E293B] text-white font-bold'
                              : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">December</h4>
                <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-semibold">
                  {decBlanks.map((b) => (
                    <div key={`blank-${b}`} className="h-9" />
                  ))}
                  {decDays.slice(0, 14).map((day) => {
                    const isStart = selectingMonth === 'dec' && day === startDay;
                    const isEnd = selectingMonth === 'dec' && day === endDay;
                    return (
                      <div key={day} className="flex items-center justify-center h-9">
                        <button
                          type="button"
                          onClick={() => handleDayClick(day, 'dec')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center tabular-nums ${
                            isStart || isEnd
                              ? 'bg-[#1E293B] text-white font-bold'
                              : 'text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500">{dateRangeLabel}</div>
              <button
                type="button"
                onClick={() => setShowCalendarSheet(false)}
                className="px-8 py-2.5 bg-[#0095D9] text-white text-xs font-extrabold rounded-xl"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
