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
  Share2,
  ShieldCheck,
  HeartHandshake,
  Download,
  RefreshCw
} from 'lucide-react';
import { SearchRequest, LeaseContract } from '../types';
import { DISTRICT_PRICE_TRENDS } from '../data/mockData';
import { APP_VERSION, APP_BUILD, loadPersistedState, savePersistedPatch } from '../lib/localStore';

interface ServicesViewProps {
  searchRequests: SearchRequest[];
  onAddSearchRequest: (req: SearchRequest) => void;
  leaseContracts: LeaseContract[];
  onAddLeaseContract: (contract: LeaseContract) => void;
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
  const [language, setLanguage] = useState<'AR' | 'SO' | 'EN'>('AR');
  const [activeSubView, setActiveSubView] = useState<string | null>(null);
  const [githubOwner, setGithubOwner] = useState<string>(() => loadPersistedState().state.githubOwner || '');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    status: 'idle' | 'up_to_date' | 'update_available' | 'error';
    latestTag?: string;
    downloadUrl?: string;
    notes?: string;
  }>({ status: 'idle' });

  const handleCheckUpdate = async () => {
    const cleanOwner = githubOwner.trim();
    if (!cleanOwner) {
      setUpdateResult({
        status: 'error',
        notes: 'Geli magacaaga GitHub (Username) ee leh repo-ga gurihelapk.',
      });
      return;
    }
    savePersistedPatch({ githubOwner: cleanOwner });
    setCheckingUpdate(true);
    try {
      const resp = await fetch(`https://api.github.com/repos/${encodeURIComponent(cleanOwner)}/gurihelapk/releases/latest`);
      if (!resp.ok) {
        setUpdateResult({
          status: 'error',
          notes: 'Release cusub lama helin ama repo-gu waa private.',
        });
        return;
      }
      const data = await resp.json();
      const latestTag: string = data.tag_name || '';
      const cleanLatest = latestTag.replace(/^v/i, '');
      const apkAsset = Array.isArray(data.assets)
        ? data.assets.find((a: { name?: string }) => a.name?.endsWith('.apk'))
        : null;
      if (cleanLatest && cleanLatest !== APP_VERSION) {
        setUpdateResult({
          status: 'update_available',
          latestTag,
          downloadUrl: apkAsset?.browser_download_url || data.html_url,
          notes: 'Update cusub waa diyaar. Xogtaadii hore (Favorites & Login) way ku jirtaa marka aad install garayso.',
        });
      } else {
        setUpdateResult({
          status: 'up_to_date',
          latestTag: latestTag || `v${APP_VERSION}`,
          notes: `App-kaagu waa nooca ugu dambeeya (v${APP_VERSION}).`,
        });
      }
    } catch {
      setUpdateResult({
        status: 'error',
        notes: 'Khadka internet-ka hubi si aad u baadho update cusub.',
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const SERVICES_LIST = [
    { id: 'today_ads', title: 'Today Ads' },
    { id: 'lease_contracts', title: 'Lease Contracts' },
    { id: 'search_requests', title: 'Search Requests' },
    { id: 'exclusive_marketing', title: 'Exclusive marketing services' },
    { id: 'average_prices', title: 'Average prices' },
    { id: 'property_deals', title: 'Property deals' },
  ];

  const APP_LINKS = [
    { id: 'blog', title: 'GuriHel blog' },
    { id: 'rate', title: 'Rate GuriHel App' },
    { id: 'legal', title: 'Legal documents' },
  ];

  return (
    <div className="flex flex-col bg-[#F6F8F9] min-h-[610px] font-sans select-none relative">
      {/* Clean White Header: Green Back Arrow, Bold Services, Right Language Button matching Screenshot 3 */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 hover:bg-slate-100 rounded-full text-[#0B7A3E] transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
            Services
          </h2>
        </div>

        {/* Language Toggle matching Screenshot 2 & 3 ("العربية" + green A/ع translation icon) */}
        <button
          onClick={() => setLanguage(language === 'AR' ? 'SO' : language === 'SO' ? 'EN' : 'AR')}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-800 hover:opacity-80 transition-opacity"
        >
          <span>{language === 'AR' ? 'العربية' : language === 'SO' ? 'Soomaali' : 'English'}</span>
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 text-[#0B7A3E] text-[10px] font-black border border-emerald-200">
            ع/A
          </span>
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* Clean Outlined Green Customer Service CTA matching Screenshot 3 */}
        <button
          onClick={onOpenCustomerSupport}
          className="w-full py-2.5 bg-white hover:bg-emerald-50/40 border-[1.5px] border-[#0B7A3E] text-[#0B7A3E] rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-2xs transition-colors"
        >
          <Headphones className="w-5 h-5" />
          <span>Customer Service</span>
        </button>

        {/* 3 Feature Tiles Row matching Screenshot 3 (Gray Icon Box + Single Title) */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Subscriptions */}
          <div
            onClick={() => setActiveSubView('subscriptions')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 hover:border-[#0B7A3E] shadow-2xs cursor-pointer flex flex-col items-center justify-start text-center gap-2.5 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-[#0B7A3E] flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Subscriptions
            </span>
          </div>

          {/* Selling and leasing Commission */}
          <div
            onClick={() => setActiveSubView('commission')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 hover:border-[#0B7A3E] shadow-2xs cursor-pointer flex flex-col items-center justify-start text-center gap-2.5 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-[#0B7A3E] flex items-center justify-center">
              <Home className="w-5 h-5 text-[#0B7A3E]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Selling and leasing Commission
            </span>
          </div>

          {/* Developers Services (Rocket icon matching Screenshot 3) */}
          <div
            onClick={() => setActiveSubView('developers')}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 hover:border-[#0B7A3E] shadow-2xs cursor-pointer flex flex-col items-center justify-start text-center gap-2.5 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-[#0B7A3E] flex items-center justify-center">
              <Rocket className="w-5 h-5 text-[#0B7A3E]" />
            </div>
            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
              Developers Services
            </span>
          </div>
        </div>

        {/* Section 1: Services List Card matching Screenshot 3 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">Services</h3>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
            {SERVICES_LIST.map((service) => (
              <div
                key={service.id}
                onClick={() => setActiveSubView(service.id)}
                className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {service.title}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: GuriHel App Links + Social + Trust Badges + Version Footer (Screenshot 2 Match) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 px-1 text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-medium text-slate-700">GuriHel App</h3>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-2xs">
            {APP_LINKS.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveSubView(item.id)}
                className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {item.title}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* 4 Square Social / Share Buttons matching Screenshot 2 */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'GuriHel Real Estate', url: window.location.href }).catch(() => {});
              }
            }}
            className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-[#0B7A3E] flex items-center justify-center shadow-2xs hover:bg-slate-50"
            title="Share GuriHel"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            className="w-11 h-11 rounded-xl bg-[#FFFC00] text-slate-900 flex items-center justify-center shadow-2xs font-black text-sm"
            title="Snapchat"
          >
            👻
          </button>
          <button
            className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shadow-2xs font-black text-base"
            title="X"
          >
            𝕏
          </button>
          <button
            className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white flex items-center justify-center shadow-2xs font-bold text-sm"
            title="Instagram"
          >
            IG
          </button>
        </div>

        {/* Regulatory / Trust Badges Row matching Screenshot 2 */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-900 text-white text-[9px] font-black leading-tight text-center shadow-2xs">
            <div>SOMALILAND</div>
            <div className="bg-[#D99B26] text-slate-950 rounded-xs px-1 mt-0.5 text-[10px]">TAX / VAT</div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[#0077B6] text-[10px] font-extrabold shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-[#0077B6]" />
            <span>Verified Real Estate Platform</span>
          </div>
        </div>

        {/* Quick Donation Card + Version Footer matching Screenshot 2 */}
        <div className="flex flex-col items-center gap-2 pb-4">
          <div className="px-4 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center gap-2 text-xs text-slate-700 font-semibold">
            <span>Quick Donation</span>
            <HeartHandshake className="w-4 h-4 text-[#0B7A3E]" />
            <span className="font-bold text-[#0B7A3E]">Gargaar</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubView('app_update')}
            className="text-[11px] text-slate-400 hover:text-[#0B7A3E] font-medium text-center leading-tight pt-1 transition-colors"
          >
            <div>v {APP_VERSION} (Build {APP_BUILD})</div>
            <div className="text-[10px] text-[#0B7A3E] font-bold mt-0.5 flex items-center justify-center gap-1">
              <RefreshCw className="w-3 h-3" />
              <span>Hubi Update Cusub (APK)</span>
            </div>
          </button>
        </div>
      </div>

      {/* Sub-view Sheet / Modal */}
      {activeSubView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 my-auto animate-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {[...SERVICES_LIST, ...APP_LINKS].find((s) => s.id === activeSubView)?.title || activeSubView}
              </h3>
              <button
                onClick={() => setActiveSubView(null)}
                className="text-slate-400 hover:text-slate-800 font-bold"
              >
                ✕
              </button>
            </div>

            {activeSubView === 'average_prices' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">Celceliska qiimaha m² ee degmooyinka Hargeysa:</p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 font-bold text-slate-600">
                      <tr>
                        <th className="p-2">Degmada</th>
                        <th className="p-2">Kiro/m²</th>
                        <th className="p-2">Iib/m²</th>
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

            {activeSubView === 'lease_contracts' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">Qandaraasyada kirada ({leaseContracts.length}):</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leaseContracts.map((lc) => (
                    <div key={lc.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800">{lc.propertyTitle}</div>
                        <div className="text-slate-500">{lc.tenantName} · ${lc.monthlyRent}/bil</div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px]">Active</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubView === 'commission' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">Xisaabinta heshiiska caadiga ah ee Hargeysa:</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 font-bold">
                  <div className="flex justify-between">
                    <span>Iibka Guriga ($250,000):</span>
                    <span className="text-[#0B7A3E]">$7,500 (3% komishan)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kirada ($500/bil):</span>
                    <span className="text-[#0B7A3E]">$250 (50% hal bil)</span>
                  </div>
                </div>
              </div>
            )}

            {activeSubView === 'app_update' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-extrabold text-[#0F3D2A]">
                    Nooca Hadda Ku Jira: v{APP_VERSION} (Build {APP_BUILD})
                  </div>
                  <div className="text-[11px] text-emerald-900 leading-relaxed">
                    ✓ Xogtaada hore (Favorites, Akoonka, Diiwaanka) waxba kama lumayaan marka aad `.apk` cusub ku dul install-garayso (In-Place Signed Update).
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    GitHub Username (Repo: gurihelapk):
                  </label>
                  <input
                    type="text"
                    value={githubOwner}
                    onChange={(e) => setGithubOwner(e.target.value)}
                    placeholder="t.g. magacaaga-github"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0B7A3E]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white font-bold rounded-xl flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                  <span>{checkingUpdate ? 'Waa la hubinayaa...' : 'Ka Raadi Update GitHub Releases'}</span>
                </button>

                {updateResult.status !== 'idle' && (
                  <div className={`p-3 rounded-xl border text-[11px] space-y-2 ${
                    updateResult.status === 'update_available'
                      ? 'bg-sky-50 border-sky-200 text-sky-900'
                      : updateResult.status === 'up_to_date'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}>
                    <div className="font-bold">{updateResult.notes}</div>
                    {updateResult.status === 'update_available' && updateResult.downloadUrl && (
                      <a
                        href={updateResult.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 bg-[#0095D9] text-white font-bold rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Soo Dejiso {updateResult.latestTag} (.apk)</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeSubView !== 'average_prices' && activeSubView !== 'lease_contracts' && activeSubView !== 'commission' && activeSubView !== 'app_update' && (
              <div className="text-xs text-slate-600 space-y-3">
                <p>Adeegani wuxuu si toos ah ugu xiran yahay nidaamka GuriHel ({searchRequests.length} codsi oo furan).</p>
                <button
                  onClick={() => setActiveSubView(null)}
                  className="w-full py-2.5 bg-[#0B7A3E] text-white font-bold rounded-xl"
                >
                  Xidh
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
