import React, { useMemo, useState } from 'react';
import { ArrowLeft, Crown, Building2 } from 'lucide-react';
import { Project } from '../types';
import { resolveApiUrl } from '../lib/apiClient';

interface ProjectsViewProps {
  projects: Project[];
  onRegisterInterest?: (projectId: string) => Promise<void>;
  onBack?: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onRegisterInterest,
  onBack,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [interestSubmitted, setInterestSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cityCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      const key = p.city || 'Hargeisa';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return ['Hargeisa', 'Berbera', 'Burco'].map((city) => ({
      name: city,
      count: map.get(city) || 0,
    }));
  }, [projects]);

  const visibleProjects = useMemo(() => {
    if (selectedCity === 'All') return projects;
    return projects.filter((p) => p.city.toLowerCase() === selectedCity.toLowerCase());
  }, [projects, selectedCity]);

  const handleRegisterInterest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || submitting) return;
    setSubmitting(true);
    try {
      await onRegisterInterest?.(activeProject.id);
      setInterestSubmitted(true);
      setTimeout(() => {
        setInterestSubmitted(false);
        setActiveProject(null);
      }, 1800);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#F6F8F9] flex-1 min-h-full w-full overflow-x-hidden font-sans pb-6 select-none">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3 sticky top-0 z-20">
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
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
          Real Estate Projects
        </h2>
      </div>

      <div className="py-4 space-y-5 px-4">
        {/* City Filter Cards (strictly real project counts) */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-extrabold text-slate-900">Explore Cities</h3>
            {selectedCity !== 'All' && (
              <button
                type="button"
                onClick={() => setSelectedCity('All')}
                className="text-xs font-bold text-[#0095D9]"
              >
                Show All
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {cityCounts.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedCity(selectedCity === c.name ? 'All' : c.name)}
                className={`p-3 rounded-2xl bg-white border text-left transition-all ${
                  selectedCity === c.name
                    ? 'border-[#0B7A3E] ring-1 ring-[#0B7A3E]'
                    : 'border-slate-200'
                }`}
              >
                <div className="text-xs font-extrabold text-slate-900">{c.name}</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5 tabular-nums">
                  {c.count} {c.count === 1 ? 'Project' : 'Projects'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Projects Feed or Empty State */}
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 mb-2.5">
            Published Projects ({visibleProjects.length})
          </h3>

          {visibleProjects.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <img
                src="/assets/aistudio/GuriHel-mark_d2d21036.png"
                alt="GuriHel"
                className="w-10 h-10 mx-auto object-contain"
              />
              <div className="text-sm font-bold text-slate-900">No Real Estate Projects Yet</div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Verified developer off-plan and ready residential projects will appear here once published from the Admin Portal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => setActiveProject(project)}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs cursor-pointer group"
                >
                  <div className="relative aspect-16/9 w-full bg-slate-900 overflow-hidden">
                    <img
                      src={
                        project.heroImage
                          ? resolveApiUrl(project.heroImage)
                          : '/assets/aistudio/GuriHel-app-icon-512-square_b480890b.png'
                      }
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {project.featured && (
                      <div className="absolute top-2.5 left-2.5 bg-[#D99B26] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Crown className="w-3 h-3 fill-current" />
                        <span>Featured</span>
                      </div>
                    )}
                    <span className="absolute top-2.5 right-2.5 bg-white/95 text-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-lg">
                      {project.stage === 'ready'
                        ? 'Ready'
                        : project.stage === 'building'
                        ? 'Under Construction'
                        : 'Off Plan'}
                    </span>
                  </div>

                  <div className="p-3.5 flex items-start gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#0F3D2A] text-white flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {project.name}
                        </h4>
                        <span className="text-xs font-extrabold text-[#0B7A3E] shrink-0 tabular-nums">
                          From ${project.startingPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {project.developerName} · {project.district}, {project.city}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Register Interest Modal */}
      {activeProject && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">{activeProject.name}</h3>
              <button
                type="button"
                onClick={() => setActiveProject(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">{activeProject.description || `${activeProject.developerName} · ${activeProject.district}`}</p>
            {interestSubmitted ? (
              <div className="p-3 bg-emerald-50 text-[#0B7A3E] rounded-xl text-xs font-bold text-center">
                ✓ Your interest has been registered.
              </div>
            ) : (
              <form onSubmit={handleRegisterInterest}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl"
                >
                  {submitting ? 'Submitting...' : 'Register Interest'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
