import React, { useState } from 'react';
import { ArrowLeft, Crown, Building2 } from 'lucide-react';
import { Project } from '../types';

interface ProjectsViewProps {
  projects: Project[];
  onOpenProjectDetail: (project: Project) => void;
  onBack?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onOpenProjectDetail,
  onBack,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('Hargeysa');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [interestSubmitted, setInterestSubmitted] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');

  // Explore cities portrait cards matching Screenshot 6
  const CITIES = [
    {
      name: 'Hargeysa',
      count: '94+ Projects',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Berbera',
      count: '20+ Projects',
      image: 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=500&q=80',
    },
    {
      name: 'Burco',
      count: '16+ Projects',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=500&q=80',
    },
  ];

  // Villas for sale horizontal large cards matching Screenshot 6
  const VILLAS_FOR_SALE = [
    {
      id: 'villa-1',
      title: 'Al-Noor Luxury Villas',
      price: 'Start from 280 K',
      address: 'Jigjiga Yar, Mansoor Rd, Hargeysa...',
      image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
      tags: ['Villa', 'Off Plan'],
    },
    {
      id: 'villa-2',
      title: 'Hodan Executive Residence',
      price: 'Start from 195 K',
      address: 'Ibraahim Koodbuur, Hargeysa...',
      image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
      tags: ['Villa', 'Ready'],
    },
  ];

  const handleRegisterInterest = (e: React.FormEvent) => {
    e.preventDefault();
    setInterestSubmitted(true);
    setTimeout(() => {
      setInterestSubmitted(false);
      setActiveProject(null);
      setLeadName('');
      setLeadPhone('');
    }, 2200);
  };

  return (
    <div className="flex flex-col bg-[#F6F8F9] flex-1 min-h-full w-full max-w-full overflow-x-hidden font-sans pb-6 select-none">
      {/* Clean White Header: Green Back Arrow + Real estate Projects */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20">
        <button
          onClick={onBack}
          className="p-1 hover:bg-slate-100 rounded-full text-[#0B7A3E] transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
          Real estate Projects
        </h2>
      </div>

      <div className="py-4 space-y-5">
        {/* Section 1: Featured projects */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Featured projects
            </h3>
            <button className="text-xs font-bold text-[#0095D9] hover:underline">
              View all
            </button>
          </div>

          {/* Horizontal Carousel with next card peeking on right (Screenshot 6) */}
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar snap-x snap-mandatory">
            {projects.map((project, idx) => (
              <div
                key={project.id}
                onClick={() => setActiveProject(project)}
                className="w-[82%] sm:w-[310px] shrink-0 snap-start cursor-pointer group"
              >
                {/* Hero Image */}
                <div className="relative aspect-16/10 w-full rounded-2xl bg-slate-900 overflow-hidden shadow-xs">
                  <img
                    src={project.heroImage}
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Top-Left Gold Featured Badge with Crown */}
                  <div className="absolute top-2.5 left-2.5 bg-[#D99B26] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                    <Crown className="w-3 h-3 fill-current" />
                    <span>Featured</span>
                  </div>

                  {/* Top-Right White Clean Pills */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <span className="bg-white/95 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-xs">
                      Apartment
                    </span>
                    <span className="bg-white/95 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-xs">
                      {project.stage === 'ready' ? 'Ready' : 'Off Plan'}
                    </span>
                  </div>
                </div>

                {/* Metadata Row Directly Under Image (Square Black Logo + Title + Price on Right + Truncated Address) */}
                <div className="pt-2.5 flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Building2 className="w-5 h-5 text-white/90" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900 truncate">
                        {project.name}
                      </h4>
                      <span className="text-xs font-extrabold text-slate-900 shrink-0 tabular-nums">
                        Start from {idx === 0 ? '400 K' : `${Math.round(project.startingPrice / 1000)} K`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {project.address}, {project.district}, {project.city}...
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Explore cities (Tall Portrait Cards with right peek) */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Explore cities
            </h3>
          </div>

          <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar snap-x">
            {CITIES.map((city, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedCity(city.name)}
                className={`relative w-[42%] sm:w-[155px] h-[185px] shrink-0 snap-start rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-end p-3 shadow-xs transition-all ${
                  selectedCity === city.name ? 'ring-2 ring-[#0B7A3E]' : ''
                }`}
              >
                <img
                  src={city.image}
                  alt={city.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="relative z-10 text-white">
                  <div className="text-sm font-extrabold leading-tight">{city.name}</div>
                  <div className="text-[11px] font-medium text-white/90 mt-0.5">{city.count}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Villas for sale (Photo-first large horizontal carousel matching Screenshot 6) */}
        <div>
          <div className="flex items-center justify-between mb-2.5 px-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Villas for sale
            </h3>
            <button className="text-xs font-bold text-[#0095D9] hover:underline">
              View all
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar snap-x">
            {VILLAS_FOR_SALE.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  if (projects[0]) setActiveProject(projects[0]);
                }}
                className="w-[82%] sm:w-[310px] shrink-0 snap-start cursor-pointer group"
              >
                <div className="relative aspect-16/9 w-full rounded-2xl bg-slate-900 overflow-hidden shadow-xs">
                  <img
                    src={v.image}
                    alt={v.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Top-Left Gold Featured Badge */}
                  <div className="absolute top-2.5 left-2.5 bg-[#D99B26] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                    <Crown className="w-3 h-3 fill-current" />
                    <span>Featured</span>
                  </div>
                  {/* Top-Right White Pills */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {v.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="bg-white/95 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate min-w-0">{v.title}</div>
                  <div className="text-xs font-extrabold text-[#0B7A3E] tabular-nums shrink-0">{v.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Project Detail & Register Interest Modal */}
      {activeProject && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-auto animate-in zoom-in-95 duration-150">
            <div className="relative aspect-16/9 w-full bg-slate-900">
              <img
                src={activeProject.heroImage}
                alt={activeProject.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setActiveProject(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold text-[#0B7A3E] bg-emerald-50 px-2 py-0.5 rounded-md">
                  Off-Plan Project
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">{activeProject.name}</h3>
                <div className="text-xs text-slate-500">{activeProject.developerName} · {activeProject.address}</div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-900 mb-1">
                  Ma Xiisaynaysaa Mashruucan? (Register Interest)
                </h4>
                {interestSubmitted ? (
                  <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold text-center">
                    ✓ Mahadsanid! Codsigaaga waxaa loo diray shirkadda horumarinta.
                  </div>
                ) : (
                  <form onSubmit={handleRegisterInterest} className="space-y-2">
                    <input
                      type="text"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Magacaaga oo buuxa"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                      required
                    />
                    <input
                      type="tel"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="Telefoonkaaga (+252 63 ...)"
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none"
                      required
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                    >
                      Diiwaangeli Xiisahaaga
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
