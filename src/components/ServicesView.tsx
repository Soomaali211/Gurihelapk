import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Headphones,
  FileSignature,
  Home,
  Rocket,
  Users,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { SearchRequest, LeaseContract } from '../types';
import { DISTRICT_PRICE_TRENDS } from '../data/mockData';
import { APP_VERSION, APP_BUILD } from '../lib/localStore';

interface ServicesViewProps {
  searchRequests: SearchRequest[];
  onAddSearchRequest: (req: Partial<SearchRequest>) => Promise<void> | void;
  leaseContracts: LeaseContract[];
  onAddLeaseContract: (contract: Partial<LeaseContract>) => Promise<void> | void;
  onOpenCustomerSupport: () => void;
  onBack?: () => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({
  searchRequests,
  onAddSearchRequest,
  leaseContracts,
  onAddLeaseContract,
  onOpenCustomerSupport,
  onBack,
}) => {
  const [language, setLanguage] = useState<'SO' | 'EN' | 'AR'>('SO');
  const [activeSubView, setActiveSubView] = useState<string | null>(null);

  // New Search Request form state
  const [reqDistrict, setReqDistrict] = useState('Jigjiga Yar');
  const [reqBudget, setReqBudget] = useState(600);
  const [reqNotes, setReqNotes] = useState('');

  // New Lease Contract form state
  const [leaseTitle, setLeaseTitle] = useState('');
  const [leaseRent, setLeaseRent] = useState(450);

  const SERVICES_LIST = [
    { id: 'lease_contracts', title: 'Lease Contracts' },
    { id: 'search_requests', title: 'Search Requests' },
    { id: 'average_prices', title: 'Average Market Prices' },
    { id: 'commission', title: 'Commission Calculator' },
  ];

  const APP_LINKS = [
    { id: 'legal', title: 'Terms & Verification Policy' },
    { id: 'about', title: 'About GuriHel' },
  ];

  return (
    <div className="flex flex-col bg-[#F6F8F9] flex-1 min-h-full w-full overflow-x-hidden font-sans select-none relative">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-1 hover:bg-slate-100 rounded-full text-[#0B7A3E]"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Services</h2>
        </div>

        <button
          type="button"
          onClick={() => setLanguage(language === 'SO' ? 'EN' : language === 'EN' ? 'AR' : 'SO')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-800"
        >
          <span>{language === 'AR' ? 'العربية' : language === 'SO' ? 'Soomaali' : 'English'}</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 text-[#0B7A3E] text-[10px] font-black border border-emerald-200">
            ع/A
          </span>
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={onOpenCustomerSupport}
          className="w-full py-2.5 bg-white hover:bg-emerald-50/40 border-[1.5px] border-[#0B7A3E] text-[#0B7A3E] rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-2xs"
        >
          <Headphones className="w-5 h-5" />
          <span>Customer Service</span>
        </button>

        {/* Feature Tiles */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveSubView('search_requests')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-[#0B7A3E] flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-[#0B7A3E]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Property Requests
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('commission')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-[#0B7A3E] flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Home className="w-5 h-5 text-[#0B7A3E]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Commission Guide
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('lease_contracts')}
            className="bg-white p-3 rounded-2xl border border-slate-200 hover:border-[#0B7A3E] flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#0B7A3E]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Lease Contracts
            </span>
          </button>
        </div>

        {/* Services List */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">Services</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {SERVICES_LIST.map((service) => (
              <div
                key={service.id}
                onClick={() => setActiveSubView(service.id)}
                className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-900">{service.title}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* App Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">GuriHel Platform</h3>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {APP_LINKS.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveSubView(item.id)}
                className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pb-4 pt-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0B7A3E] text-[10px] font-extrabold">
            <ShieldCheck className="w-4 h-4" />
            <span>GuriHel Verified Real Estate Platform</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            v{APP_VERSION} (Build {APP_BUILD})
          </div>
        </div>
      </div>

      {/* Sub-view Modal */}
      {activeSubView && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {activeSubView.replace('_', ' ')}
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubView(null)}
                className="text-slate-400 hover:text-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            {activeSubView === 'average_prices' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">Reference m² rates across Hargeisa districts:</p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="p-2">District</th>
                        <th className="p-2">Rent/m²</th>
                        <th className="p-2">Sale/m²</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {DISTRICT_PRICE_TRENDS.map((t, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold">{t.district}</td>
                          <td className="p-2 text-[#0B7A3E] font-bold">${t.avgRentM2}</td>
                          <td className="p-2 font-bold">${t.avgSaleM2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSubView === 'search_requests' && (
              <div className="space-y-3 text-xs">
                <div className="text-slate-600">Your search requests ({searchRequests.length}):</div>
                {searchRequests.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {searchRequests.map((r) => (
                      <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="font-bold">
                          {r.district} · Max ${r.budgetMax}
                        </div>
                        <div className="text-slate-500 truncate">{r.notes || r.propertyType}</div>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await onAddSearchRequest({
                      district: reqDistrict,
                      budgetMax: reqBudget,
                      notes: reqNotes,
                      purpose: 'rent',
                      propertyType: 'villa',
                    });
                    setReqNotes('');
                    setActiveSubView(null);
                  }}
                  className="space-y-2 pt-2 border-t border-slate-100"
                >
                  <div className="font-bold text-slate-800">Submit New Request</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={reqDistrict}
                      onChange={(e) => setReqDistrict(e.target.value)}
                      placeholder="District"
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                    <input
                      type="number"
                      value={reqBudget}
                      onChange={(e) => setReqBudget(Number(e.target.value))}
                      placeholder="Max Budget USD"
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <input
                    type="text"
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    placeholder="Property requirements..."
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#0B7A3E] text-white font-bold rounded-xl"
                  >
                    Submit Search Request
                  </button>
                </form>
              </div>
            )}

            {activeSubView === 'lease_contracts' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">Lease contracts ({leaseContracts.length}):</p>
                {leaseContracts.length > 0 && (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {leaseContracts.map((lc) => (
                      <div
                        key={lc.id}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{lc.propertyTitle}</div>
                          <div className="text-slate-500">
                            {lc.tenantName} · ${lc.monthlyRent}/mo
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                          {lc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!leaseTitle.trim()) return;
                    await onAddLeaseContract({
                      propertyTitle: leaseTitle.trim(),
                      monthlyRent: leaseRent,
                    });
                    setLeaseTitle('');
                    setActiveSubView(null);
                  }}
                  className="space-y-2 pt-2 border-t border-slate-100"
                >
                  <div className="font-bold text-slate-800">Draft Lease Contract</div>
                  <input
                    required
                    type="text"
                    value={leaseTitle}
                    onChange={(e) => setLeaseTitle(e.target.value)}
                    placeholder="Property Title"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <input
                    type="number"
                    value={leaseRent}
                    onChange={(e) => setLeaseRent(Number(e.target.value))}
                    placeholder="Monthly Rent (USD)"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#0B7A3E] text-white font-bold rounded-xl"
                  >
                    Create Lease Draft
                  </button>
                </form>
              </div>
            )}

            {activeSubView === 'commission' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">Standard Hargeisa real estate brokerage schedule:</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-bold">
                  <div className="flex justify-between">
                    <span>Property Sale ($250,000):</span>
                    <span className="text-[#0B7A3E]">$7,500 (3%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Residential Lease ($500/mo):</span>
                    <span className="text-[#0B7A3E]">$250 (50% one month)</span>
                  </div>
                </div>
              </div>
            )}

            {(activeSubView === 'legal' || activeSubView === 'about') && (
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="flex justify-center pb-1">
                  <img
                    src="/assets/aistudio/GuriHel-logo-primary_c2f3e626.png"
                    alt="GuriHel"
                    className="h-8 object-contain"
                  />
                </div>
                <p>
                  GuriHel connects verified property owners and seekers across Somaliland with WhatsApp-authenticated accounts and official media watermarking.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
