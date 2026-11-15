import React, { useState } from 'react';
import { Calendar, MapPin, SlidersHorizontal, Plus, List as ListIcon, Map } from 'lucide-react';
import { Listing } from '../types';

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
  const [selectedCity, setSelectedCity] = useState('Hargeisa');
  const [currencyUnit, setCurrencyUnit] = useState<'USD' | 'SAR'>('USD');
  const [activeSlide, setActiveSlide] = useState(0);
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  // Interactive Booking Date range state (Screenshot 4: 15 - 16 November)
  const [startDay, setStartDay] = useState<number>(15);
  const [endDay, setEndDay] = useState<number>(16);
  const [selectingMonth, setSelectingMonth] = useState<'nov' | 'dec'>('nov');

  const dateRangeLabel = `${startDay} - ${endDay} ${selectingMonth === 'nov' ? 'November' : 'December'}`;

  const handleDayClick = (day: number, month: 'nov' | 'dec') => {
    if (month === 'nov' && day < 15) return; // past dates disabled like Screenshot 4
    setSelectingMonth(month);
    if (day <= startDay || startDay !== endDay) {
      setStartDay(day);
      setEndDay(day + 1 <= (month === 'nov' ? 30 : 31) ? day + 1 : day);
    } else {
      setEndDay(day);
    }
  };

  // November 2026 starts on Sunday (index 0), 30 days
  const novDays = Array.from({ length: 30 }, (_, i) => i + 1);
  // December 2026 starts on Tuesday (index 2: Sun, Mon empty), 31 days
  const decBlanks = [0, 1];
  const decDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col bg-[#F6F8F9] min-h-[610px] font-sans select-none relative">
      {/* Top 3 Pill Bar matching Screenshot 4 backdrop */}
      <div className="bg-white px-3 py-2.5 border-b border-slate-200/80 sticky top-0 z-20">
        <div className="grid grid-cols-3 gap-2">
          {/* Date Picker Pill -> opens Booking Date Bottom Sheet */}
          <button
            onClick={() => setShowCalendarSheet(true)}
            className="px-2.5 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors truncate"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">{dateRangeLabel}</span>
          </button>

          {/* City Selector Pill */}
          <button
            onClick={() => setSelectedCity(selectedCity === 'Hargeisa' ? 'Berbera' : 'Hargeisa')}
            className="px-2.5 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors truncate"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="truncate">{selectedCity === 'Hargeisa' ? 'City' : selectedCity}</span>
          </button>

          {/* Filters Pill */}
          <button
            onClick={() => setShowCalendarSheet(true)}
            className="px-2.5 py-2 bg-[#EEF2F0] hover:bg-slate-200 text-slate-900 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors truncate"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Scrollable Units Feed */}
      <div className="p-3.5 space-y-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-0.5">
          <div className="text-sm font-extrabold text-slate-900 tracking-tight">
            1,718 Units match your search
          </div>
          <button
            onClick={() => setCurrencyUnit(currencyUnit === 'USD' ? 'SAR' : 'USD')}
            className="text-[10px] font-bold text-[#0B7A3E] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
          >
            {currencyUnit} / Night
          </button>
        </div>

        <div className="space-y-4">
          {[
            {
              id: 'bk-1',
              title: 'Apartment in Jigjiga Yar, Hargeysa',
              priceUSD: '$85.00',
              priceSAR: '338.40 SAR',
              specs: '50 m² · 1 bed · 1 living · 1 bath',
              images: [
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
              ],
            },
            {
              id: 'bk-2',
              title: 'Executive Suite in Masalaha, Hargeysa',
              priceUSD: '$65.00',
              priceSAR: '245.00 SAR',
              specs: '42 m² · 1 bed · 1 living · 1 bath',
              images: [
                'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
              ],
            },
          ].map((unit) => (
            <div
              key={unit.id}
              onClick={() => {
                if (listings[0]) onListingClick(listings[0]);
              }}
              className="bg-white rounded-2xl border border-slate-200/90 hover:border-[#0B7A3E] overflow-hidden shadow-2xs transition-all cursor-pointer"
            >
              <div className="relative aspect-16/9 w-full bg-slate-900 overflow-hidden">
                <img
                  src={unit.images[activeSlide % unit.images.length]}
                  alt={unit.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                  {unit.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSlide(i);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        activeSlide % unit.images.length === i ? 'w-4 bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
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
          ))}
        </div>
      </div>

      {/* Full-Width White Bottom Action Bar matching Screenshot 1 */}
      <div className="relative z-20 bg-white border-t border-slate-200 grid grid-cols-3 items-center h-13 shrink-0">
        <button
          onClick={onSwitchToMap}
          className="h-full flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-100"
        >
          <Map className="w-4 h-4 text-slate-500" />
          <span>Map</span>
        </button>

        <div className="h-full flex items-center justify-center text-xs font-bold text-slate-700 border-r border-slate-100 tabular-nums">
          1,718 listings
        </div>

        <button
          onClick={onOpenAddModal}
          className="h-full flex items-center justify-center gap-2 text-xs font-extrabold text-[#0B7A3E] hover:bg-emerald-50/40 transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-[#0B7A3E] text-white flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 stroke-3" />
          </span>
          <span>Add</span>
        </button>
      </div>

      {/* Multi-Month Booking Date Bottom Sheet Modal (Screenshot 4 Exact Match) */}
      {showCalendarSheet && (
        <div
          onClick={() => setShowCalendarSheet(false)}
          className="absolute inset-0 z-40 bg-black/50 flex flex-col justify-end animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85%] overflow-hidden animate-in slide-in-from-bottom-6 duration-200"
          >
            {/* Sheet Title */}
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Booking Date</h3>
              <button
                onClick={() => setShowCalendarSheet(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Vertical Multi-Month Calendar Body */}
            <div className="px-5 py-3 overflow-y-auto space-y-5 flex-1">
              {/* Month 1: November 2026 */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">November 2026</h4>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 mb-2 tracking-wider">
                  <span>SUN</span>
                  <span>MON</span>
                  <span>TUE</span>
                  <span>WED</span>
                  <span>THU</span>
                  <span>FRI</span>
                  <span>SAT</span>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-semibold">
                  {novDays.map((day) => {
                    const isPast = day < 15;
                    const isStart = selectingMonth === 'nov' && day === startDay;
                    const isEnd = selectingMonth === 'nov' && day === endDay;
                    const isInRange = selectingMonth === 'nov' && day > startDay && day < endDay;

                    return (
                      <div
                        key={day}
                        className={`relative flex items-center justify-center h-9 ${
                          isInRange ? 'bg-slate-200/80' : ''
                        } ${isStart && endDay > startDay ? 'bg-gradient-to-r from-transparent via-slate-200/80 to-slate-200/80' : ''} ${
                          isEnd && endDay > startDay ? 'bg-gradient-to-l from-transparent via-slate-200/80 to-slate-200/80' : ''
                        }`}
                      >
                        <button
                          disabled={isPast}
                          onClick={() => handleDayClick(day, 'nov')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all tabular-nums ${
                            isStart || isEnd
                              ? 'bg-[#1E293B] text-white font-bold shadow-sm'
                              : isPast
                              ? 'text-slate-300 cursor-not-allowed'
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

              {/* Month 2: December 2026 */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">December 2026</h4>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-500 mb-2 tracking-wider">
                  <span>SUN</span>
                  <span>MON</span>
                  <span>TUE</span>
                  <span>WED</span>
                  <span>THU</span>
                  <span>FRI</span>
                  <span>SAT</span>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-semibold">
                  {decBlanks.map((b) => (
                    <div key={`blank-${b}`} className="h-9" />
                  ))}
                  {decDays.slice(0, 12).map((day) => {
                    const isStart = selectingMonth === 'dec' && day === startDay;
                    const isEnd = selectingMonth === 'dec' && day === endDay;
                    return (
                      <div key={day} className="flex items-center justify-center h-9">
                        <button
                          onClick={() => handleDayClick(day, 'dec')}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all tabular-nums ${
                            isStart || isEnd
                              ? 'bg-[#1E293B] text-white font-bold shadow-sm'
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

            {/* Bottom Sticky Footer with Sky-Blue Search CTA matching Screenshot 4 */}
            <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500">
                {dateRangeLabel}
              </div>
              <button
                onClick={() => setShowCalendarSheet(false)}
                className="px-8 py-2.5 bg-[#0095D9] hover:bg-sky-600 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
