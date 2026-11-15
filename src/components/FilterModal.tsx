import React from 'react';
import { X, Check, Filter } from 'lucide-react';
import { FilterState, ListingPurpose, PropertyType } from '../types';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onUpdateFilters: (newFilters: FilterState) => void;
  onResetFilters: () => void;
  matchingCount: number;
}

export const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  filters,
  onUpdateFilters,
  onResetFilters,
  matchingCount,
}) => {
  if (!isOpen) return null;

  const DISTRICTS = [
    'Dhammaan (All)',
    'Jigjiga Yar',
    'Ibraahim Koodbuur',
    '26 June',
    'Ahmed Dhagax',
    'Shacabka',
    'Masalaha',
    'Berbera',
    'Burco',
  ];

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#C9D2CD] my-auto animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#0B7A3E]" />
            <h3 className="text-sm font-bold text-[#0F3D2A]">Shaandhooyinka Sare (Filters)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Degmada */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Degmada Hargeysa:</label>
            <select
              value={filters.district || 'Dhammaan (All)'}
              onChange={(e) =>
                onUpdateFilters({
                  ...filters,
                  district: e.target.value === 'Dhammaan (All)' ? '' : e.target.value,
                })
              }
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Qiimaha Max */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
              <span>Qiimaha Ugu Sarreeya (Max USD):</span>
              <span className="text-[#0B7A3E] tabular-nums font-black">
                ${filters.maxPrice.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={100}
              max={400000}
              step={100}
              value={filters.maxPrice}
              onChange={(e) =>
                onUpdateFilters({ ...filters, maxPrice: Number(e.target.value) })
              }
              className="w-full accent-[#0B7A3E]"
            />
          </div>

          {/* Qolalka Jiifka */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Qolalka Jiifka (Bedrooms):
            </label>
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {[0, 1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onUpdateFilters({ ...filters, minBedrooms: num })}
                  className={`min-w-0 py-2 text-xs font-bold rounded-xl border transition-all ${
                    filters.minBedrooms === num
                      ? 'bg-[#0B7A3E] text-white border-[#0B7A3E]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num === 0 ? 'All' : `${num}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Badges Toggles */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyVerified}
                onChange={(e) =>
                  onUpdateFilters({ ...filters, onlyVerified: e.target.checked })
                }
                className="rounded accent-[#0B7A3E] w-4 h-4"
              />
              <span>Kaliya hantida la xaqiijiyay (✔ Verified Only)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyFeatured}
                onChange={(e) =>
                  onUpdateFilters({ ...filters, onlyFeatured: e.target.checked })
                }
                className="rounded accent-[#0B7A3E] w-4 h-4"
              />
              <span>Kaliya mashaariicda gaarka ah (Featured Only)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
          >
            Dib u celi (Reset)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            Muuji {matchingCount} Hanti
          </button>
        </div>
      </div>
    </div>
  );
};
