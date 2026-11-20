import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthUser, Listing, isAdminRole } from '../types';
import { AdminDashboard } from './AdminDashboard';

interface AdminPortalProps {
  currentUser: AuthUser | null;
  onViewListingDetail: (listing: Listing) => void;
  onMarketplaceMutated: () => void;
  onBackToApp: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onViewListingDetail,
  onMarketplaceMutated,
  onBackToApp,
  onOpenLogin,
  onLogout,
}) => {
  if (!currentUser || !isAdminRole(currentUser.role)) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#F6F8F9]">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-extrabold text-slate-900">Access Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            This page is unavailable for your current session. Return to the marketplace or sign in to continue.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBackToApp}
              className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
            >
              Back to App
            </button>
            {!currentUser && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex-1 py-2.5 bg-[#0B7A3E] text-white text-xs font-bold rounded-xl"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminDashboard
      currentUser={currentUser}
      onViewListingDetail={onViewListingDetail}
      onMarketplaceMutated={onMarketplaceMutated}
      onBackToApp={onBackToApp}
      onLogout={onLogout}
    />
  );
};
