import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Khalad farsamo ayaa dhacay.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('GuriHel ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8F9] flex items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold text-slate-900">
              GuriHel — Dib u Soo Kicin
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cilad ku-meel-gaar ah ayaa dhacday. Xogtaada iyo favorites-kaagu way badbaadsan yihiin.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#0B7A3E] hover:bg-[#0F3D2A] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Dib u Fur App-ka</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
