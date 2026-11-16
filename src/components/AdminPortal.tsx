import React, { useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AdminDevice, AdminRecord, AdminSessionState, Listing } from '../types';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminDashboard } from './AdminDashboard';
import { isVerifiedAdmin } from '../lib/firestoreRepo';

interface AdminPortalProps {
  listings: Listing[];
  onApproveListing: (id: string) => void;
  onRejectListing: (id: string, reason: string) => void;
  onViewListingDetail: (listing: Listing) => void;
  firebaseUser: FirebaseUser | null;
  hasCloudListings: boolean;
  onSeedDatabase: () => Promise<void>;
  onBackToApp: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  listings,
  onApproveListing,
  onRejectListing,
  onViewListingDetail,
  firebaseUser,
  hasCloudListings,
  onSeedDatabase,
  onBackToApp,
}) => {
  const [adminRecord, setAdminRecord] = useState<AdminRecord | null>(null);
  const [session, setSession] = useState<AdminSessionState | null>(null);
  const [currentDevice, setCurrentDevice] = useState<AdminDevice | null>(null);

  // Drop in-memory Admin session immediately if Firebase user logs out or changes
  useEffect(() => {
    if (!firebaseUser || !isVerifiedAdmin(firebaseUser)) {
      setSession(null);
      setAdminRecord(null);
      setCurrentDevice(null);
    }
  }, [firebaseUser]);

  const isUnlocked = Boolean(
    firebaseUser &&
      isVerifiedAdmin(firebaseUser) &&
      session &&
      session.expiresAt > Date.now() &&
      adminRecord &&
      adminRecord.mfaEnabled
  );

  if (!isUnlocked) {
    return (
      <AdminAuthGate
        firebaseUser={firebaseUser}
        onBackToApp={onBackToApp}
        onAuthenticated={({ adminRecord: rec, session: sess, device }) => {
          setAdminRecord(rec);
          setSession(sess);
          setCurrentDevice(device);
        }}
      />
    );
  }

  return (
    <AdminDashboard
      listings={listings}
      onApproveListing={onApproveListing}
      onRejectListing={onRejectListing}
      onViewListingDetail={onViewListingDetail}
      firebaseUser={firebaseUser}
      hasCloudListings={hasCloudListings}
      onSeedDatabase={onSeedDatabase}
      adminRecord={adminRecord}
      adminSession={session}
      currentDevice={currentDevice}
      onSessionUpdate={(next) => setSession(next)}
      onLockSession={() => setSession(null)}
    />
  );
};
