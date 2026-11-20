import React, { useEffect, useState } from 'react';
import { APP_VERSION } from '../lib/localStore';

interface SplashScreenProps {
  onFinished?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinished }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onFinished?.();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onFinished]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0A5C33] via-[#0F3D2A] to-[#062c18] flex items-center justify-center p-4 sm:p-6 font-sans select-none animate-in fade-in duration-300">
      <div className="flex flex-col items-center justify-center space-y-6 max-w-md w-full mx-auto px-6 py-10 bg-black/15 backdrop-blur-md rounded-3xl border border-emerald-500/20 shadow-2xl">
        <img
          src="/assets/aistudio/GuriHel-logo-reversed_bc2c4e29.png"
          alt="GuriHel Official Logo"
          className="w-full max-w-[260px] sm:max-w-[300px] h-auto object-contain drop-shadow-xl"
        />

        <div className="text-center space-y-1.5">
          <div className="text-sm sm:text-base font-extrabold text-emerald-100 tracking-wide">
            Somaliland Real Estate Marketplace
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-emerald-300/80">
            Hargeisa · v{APP_VERSION}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setVisible(false);
            onFinished?.();
          }}
          className="mt-2 w-full sm:w-auto px-8 py-3 rounded-xl bg-[#0B7A3E] hover:bg-[#096332] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-lg active:scale-95"
        >
          Enter GuriHel →
        </button>
      </div>
    </div>
  );
};
