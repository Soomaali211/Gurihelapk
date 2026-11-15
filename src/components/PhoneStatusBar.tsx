import React from 'react';
import { Wifi, BatteryCharging, SignalHigh, AlarmClock, BellOff } from 'lucide-react';

interface PhoneStatusBarProps {
  time?: string;
  batteryPercentage?: number;
  variant?: 'light' | 'transparent';
}

export const PhoneStatusBar: React.FC<PhoneStatusBarProps> = ({
  time = '10:36',
  batteryPercentage = 51,
  variant = 'light',
}) => {
  return (
    <div
      className={`w-full px-5 pt-2.5 pb-1.5 flex items-center justify-between text-[11px] font-bold tracking-tight select-none ${
        variant === 'light'
          ? 'bg-white text-slate-900'
          : 'bg-white/85 backdrop-blur-xs text-slate-900'
      }`}
    >
      {/* Left: Time + Active Green Status Pill matching Screenshots 1-6 */}
      <div className="flex items-center gap-1.5 tabular-nums">
        <span className="text-[12px] font-bold text-slate-900">{time}</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16A34A] text-white text-[10px] font-extrabold leading-none">
          <span className="w-1.5 h-1.5 rounded-full bg-white/90"></span>
          1
        </span>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold">
          12
        </span>
      </div>

      {/* Right: System icons + 4G + Battery 51% matching Screenshots 1-6 */}
      <div className="flex items-center gap-1.5 text-slate-800">
        <AlarmClock className="w-3 h-3 text-slate-700" />
        <BellOff className="w-3 h-3 text-slate-700" />
        <SignalHigh className="w-3.5 h-3.5 text-slate-900" />
        <span className="text-[9px] font-black leading-none tracking-tighter">4G</span>
        <Wifi className="w-3.5 h-3.5 text-slate-900" />
        <div className="flex items-center gap-0.5 tabular-nums font-bold text-slate-900">
          <BatteryCharging className="w-3.5 h-3.5 text-amber-500" />
          <span>{batteryPercentage}%</span>
        </div>
      </div>
    </div>
  );
};
