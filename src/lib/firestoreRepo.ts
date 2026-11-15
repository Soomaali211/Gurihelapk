import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  db,
  auth,
  googleProvider,
  ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from './firebase';
import {
  Listing,
  Project,
  SearchRequest,
  LeaseContract,
  UserRole,
} from '../types';
import { INITIAL_LISTINGS, INITIAL_PROJECTS } from '../data/mockData';

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeId(raw: string, prefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  if (!cleaned || !ID_REGEX.test(cleaned)) {
    return `${prefix}-${Date.now()}`;
  }
  return cleaned;
}

export function isVerifiedAdmin(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function signInWithGoogleVerified(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = cred.user;
  await syncUserProfileDocuments(user);
  return user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export async function syncUserProfileDocuments(
  user: User,
  overrides?: { phone?: string; language?: 'SO' | 'EN' | 'AR'; kycSubmitted?: boolean }
): Promise<UserRole> {
  const uid = sanitizeId(user.uid, 'user');
  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const adminUser = isVerifiedAdmin(user);
  const resolvedRole: UserRole = adminUser ? 'admin' : 'seeker';

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: (user.displayName || 'Macaamiil GuriHel').slice(0, 100),
        role: resolvedRole,
        city: 'Hargeisa',
        language: overrides?.language || 'SO',
        avatarUrl: (user.photoURL || '').slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // On repeat logins, existing user cannot overwrite createdAt/role via merge if immutable rules reject createdAt change.
    // Fallback to updating only permitted profile fields.
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: (user.displayName || 'Macaamiil GuriHel').slice(0, 100),
        city: 'Hargeisa',
        language: overrides?.language || 'SO',
        avatarUrl: (user.photoURL || '').slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    } catch {
      handleFirestoreError(err, OperationType.WRITE, publicPath);
    }
  }

  try {
    await setDoc(
      doc(db, 'users', uid, 'private', 'info'),
      {
        uid,
        email: (user.email || '').slice(0, 160),
        phone: (overrides?.phone || user.phoneNumber || '').slice(0, 32),
        kycStatus: overrides?.kycSubmitted ? 'submitted' : 'none',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, privatePath);
  }

  return resolvedRole;
}

export function subscribePublicAndUserListings(
  user: User | null,
  onData: (listings: Listing[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'listings';
  const admin = isVerifiedAdmin(user);

  // Admin queries all listings; standard users/guests query live listings cleanly matching allow list
  const listingsQuery = admin
    ? collection(db, 'listings')
    : query(collection(db, 'listings'), where('status', '==', 'live'));

  return onSnapshot(
    listingsQuery,
    (snapshot) => {
      const items: Listing[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<Listing, 'createdAt'>),
          id: d.id,
          createdAt: timestampToIso(data.createdAt),
        } as Listing;
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeProjects(
  onData: (projects: Project[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'projects';
  const q = query(
    collection(db, 'projects'),
    where('stage', 'in', ['off_plan', 'building', 'ready'])
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: Project[] = snapshot.docs.map((d) => ({
        ...(d.data() as Project),
        id: d.id,
      }));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    }
  );
}

export function subscribeFavorites(
  uid: string,
  onData: (ids: string[]) => void
): Unsubscribe {
  const path = `users/${uid}/favorites`;
  return onSnapshot(
    collection(db, 'users', uid, 'favorites'),
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.id));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function toggleFavoriteInFirestore(
  uid: string,
  listingId: string,
  shouldFavorite: boolean
): Promise<void> {
  const cleanUid = sanitizeId(uid, 'user');
  const cleanListingId = sanitizeId(listingId, 'listing');
  const path = `users/${cleanUid}/favorites/${cleanListingId}`;

  try {
    if (shouldFavorite) {
      await setDoc(doc(db, 'users', cleanUid, 'favorites', cleanListingId), {
        ownerUid: cleanUid,
        listingId: cleanListingId,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'users', cleanUid, 'favorites', cleanListingId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createListingInFirestore(
  listing: Listing,
  user: User
): Promise<void> {
  const id = sanitizeId(listing.id, 'hga');
  const uid = sanitizeId(user.uid, 'user');
  const path = `listings/${id}`;
  const admin = isVerifiedAdmin(user);

  const payload = {
    id,
    ownerUid: uid,
    title: listing.title.slice(0, 160),
    description: listing.description.slice(0, 2000),
    purpose: listing.purpose,
    property_type: listing.property_type,
    price: Math.max(0, Number(listing.price) || 0),
    currency: listing.currency,
    price_unit: listing.price_unit,
    area_m2: Math.max(0, Number(listing.area_m2) || 0),
    bedrooms: Math.max(0, Math.min(50, Number(listing.bedrooms) || 0)),
    living_rooms: Math.max(0, Math.min(30, Number(listing.living_rooms) || 1)),
    bathrooms: Math.max(0, Math.min(50, Number(listing.bathrooms) || 1)),
    city: (listing.city || 'Hargeisa').slice(0, 60),
    district: (listing.district || 'Jigjiga Yar').slice(0, 80),
    address: (listing.address || 'Hargeysa').slice(0, 200),
    lat: Number(listing.lat) || 9.56,
    lng: Number(listing.lng) || 44.065,
    verified: admin ? Boolean(listing.verified) : false,
    featured: admin ? Boolean(listing.featured) : false,
    status: admin ? listing.status : 'pending',
    images: (listing.images.length > 0
      ? listing.images
      : ['https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80']
    )
      .slice(0, 10)
      .map((u) => u.slice(0, 500)),
    amenities: (listing.amenities || []).slice(0, 20).map((a) => a.slice(0, 60)),
    broker: listing.broker,
    views: Math.max(0, Number(listing.views) || 1),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'listings', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateListingModerationInFirestore(
  listingId: string,
  decision: { status: 'live' | 'rejected'; rejectionReason?: string }
): Promise<void> {
  const id = sanitizeId(listingId, 'hga');
  const path = `listings/${id}`;
  try {
    await updateDoc(doc(db, 'listings', id), {
      status: decision.status,
      verified: decision.status === 'live',
      ...(decision.rejectionReason
        ? { rejectionReason: decision.rejectionReason.slice(0, 300) }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createSearchRequestInFirestore(
  req: SearchRequest,
  user: User
): Promise<void> {
  const id = sanitizeId(req.id, 'req');
  const uid = sanitizeId(user.uid, 'user');
  const path = `searchRequests/${id}`;

  try {
    await setDoc(doc(db, 'searchRequests', id), {
      id,
      ownerUid: uid,
      seekerName: req.seekerName.slice(0, 100),
      seekerPhone: req.seekerPhone.slice(0, 32),
      purpose: req.purpose,
      propertyType: req.propertyType,
      district: req.district.slice(0, 80),
      budgetMin: Math.max(0, Number(req.budgetMin) || 0),
      budgetMax: Math.max(Number(req.budgetMin) || 0, Number(req.budgetMax) || 0),
      bedrooms: Math.max(0, Math.min(50, Number(req.bedrooms) || 0)),
      notes: (req.notes || '').slice(0, 1000),
      status: 'open',
      responsesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createLeaseContractInFirestore(
  contract: LeaseContract,
  user: User
): Promise<void> {
  const id = sanitizeId(contract.id, 'lease');
  const uid = sanitizeId(user.uid, 'user');
  const path = `leaseContracts/${id}`;

  try {
    await setDoc(doc(db, 'leaseContracts', id), {
      id,
      ownerUid: uid,
      listingId: sanitizeId(contract.listingId || 'A1042', 'hga'),
      propertyTitle: contract.propertyTitle.slice(0, 160),
      district: contract.district.slice(0, 80),
      landlordName: contract.landlordName.slice(0, 100),
      landlordPhone: contract.landlordPhone.slice(0, 32),
      tenantName: contract.tenantName.slice(0, 100),
      tenantPhone: contract.tenantPhone.slice(0, 32),
      tenantIdNumber: contract.tenantIdNumber.slice(0, 60),
      monthlyRent: Math.max(0, Number(contract.monthlyRent) || 0),
      securityDeposit: Math.max(0, Number(contract.securityDeposit) || 0),
      startDate: contract.startDate.slice(0, 32),
      durationMonths: Math.max(1, Math.min(120, Number(contract.durationMonths) || 12)),
      terms: (contract.terms || []).slice(0, 20).map((t) => t.slice(0, 300)),
      landlordSigned: Boolean(contract.landlordSigned),
      tenantSigned: Boolean(contract.tenantSigned),
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function seedMarketplaceToFirestore(adminUser: User): Promise<number> {
  if (!isVerifiedAdmin(adminUser)) return 0;
  let seeded = 0;

  try {
    const existingListings = await getDocs(collection(db, 'listings'));
    if (existingListings.empty) {
      for (const item of INITIAL_LISTINGS) {
        await createListingInFirestore(item, adminUser);
        seeded += 1;
      }
    }

    const existingProjects = await getDocs(collection(db, 'projects'));
    if (existingProjects.empty) {
      for (const proj of INITIAL_PROJECTS) {
        const pid = sanitizeId(proj.id, 'proj');
        await setDoc(doc(db, 'projects', pid), {
          ...proj,
          id: pid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        seeded += 1;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'listings');
  }

  return seeded;
}
