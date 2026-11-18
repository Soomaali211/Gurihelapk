import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinished?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onFinished) onFinished();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onFinished]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0A5C33] via-[#0F3D2A] to-[#062c18] flex items-center justify-center p-4 sm:p-6 font-sans select-none animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-center space-y-6 sm:space-y-8 max-w-md w-full mx-auto px-4 py-8 sm:py-10 bg-black/15 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-2xl">
        <svg viewBox="0 0 837 320" role="img" aria-label="GuriHel" className="w-full max-w-[320px] sm:max-w-[380px] h-auto overflow-visible block drop-shadow-xl">
          <defs>
            <linearGradient id="gr" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#86EFAC" />
              <stop offset="1" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>
          <g transform="translate(24 24) scale(2.72)">
            <path d="M28 42 43 29 58 42" fill="none" stroke="#4ADE80" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M32 44H54V57A3 3 0 0 1 51 60H47V51A2 2 0 0 0 45 49H41A2 2 0 0 0 39 51V60H35A3 3 0 0 1 32 57Z" fill="#FFFFFF" />
          </g>
          <text x="350" y="155" fill="#FFFFFF" fontSize="96" fontWeight="900" fontFamily="system-ui, sans-serif" letterSpacing="-1">
            GuriHel
          </text>
          <g transform="translate(690, 110) scale(1.4)">
            <circle cx="43" cy="43" r="29" fill="none" stroke="url(#gr)" strokeWidth="10" />
            <path d="M65 65 87 87" fill="none" stroke="url(#gr)" strokeWidth="13" strokeLinecap="round" />
          </g>
        </svg>

        <div className="text-center space-y-1.5">
          <div className="text-sm sm:text-base font-extrabold text-emerald-100 tracking-wide">
            Somaliland Real Estate Marketplace
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-emerald-300/80">
            Hargeysa · v2.4.0 Pro
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            if (onFinished) onFinished();
          }}
          className="mt-2 w-full sm:w-auto px-8 py-3 rounded-full bg-[#0B7A3E] hover:bg-[#096332] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg hover:shadow-emerald-900/40 active:scale-95"
        >
          Gali App-ka →
        </button>
      </div>
    </div>
  );
};
