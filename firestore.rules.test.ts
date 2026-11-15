/**
 * GuriHel Security Rules Verification Matrix (Phase 0 TDD)
 * Maps each of the 12 "Dirty Dozen" adversarial payloads to expected PERMISSION_DENIED outcomes.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list';
  payload: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow field injection on listing create',
    collectionPath: '/listings/test-shadow-1',
    operation: 'create',
    payload: { id: 'test-shadow-1', isVerifiedHack: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidListingCreate: data.keys().hasOnly(...)',
  },
  {
    id: 2,
    name: 'Non-admin creating pre-verified live listing',
    collectionPath: '/listings/test-bypass-2',
    operation: 'create',
    payload: { id: 'test-bypass-2', status: 'live', verified: true, featured: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() || (data.status == "pending" && data.verified == false && data.featured == false)',
  },
  {
    id: 3,
    name: 'Owner UID spoofing on listing create',
    collectionPath: '/listings/test-spoof-3',
    operation: 'create',
    payload: { id: 'test-spoof-3', ownerUid: 'another-user-uid' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().ownerUid == request.auth.uid',
  },
  {
    id: 4,
    name: 'Unverified admin email spoofing',
    collectionPath: '/listings/test-spoof-4',
    operation: 'update',
    payload: { status: 'live', verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'request.auth.token.email_verified == true',
  },
  {
    id: 5,
    name: 'Cross-user PII read on users/{uid}/private/info',
    collectionPath: '/users/victim-uid/private/info',
    operation: 'get',
    payload: {},
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isOwner(userId) || isAdmin()',
  },
  {
    id: 6,
    name: 'Self-assigned admin role escalation',
    collectionPath: '/users/attacker-uid',
    operation: 'create',
    payload: { uid: 'attacker-uid', role: 'admin' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() || incoming().role == "seeker"',
  },
  {
    id: 7,
    name: 'Invalid document ID / resource exhaustion',
    collectionPath: '/listings/' + 'A'.repeat(200),
    operation: 'create',
    payload: { id: 'A'.repeat(200) },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(listingId): id.size() <= 128 && id.matches("^[a-zA-Z0-9_\\\\-]+$")',
  },
  {
    id: 8,
    name: 'Orphaned booking referencing missing listing',
    collectionPath: '/bookings/book-orphan-8',
    operation: 'create',
    payload: { id: 'book-orphan-8', listingId: 'non-existent-listing' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/listings/$(incoming().listingId))',
  },
  {
    id: 9,
    name: 'Mutation of terminal sold listing',
    collectionPath: '/listings/sold-listing-9',
    operation: 'update',
    payload: { price: 1 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'existing().status != "sold" || isAdmin()',
  },
  {
    id: 10,
    name: 'Cross-tenant message injection in chatThreads',
    collectionPath: '/chatThreads/victim-thread/messages/msg-10',
    operation: 'create',
    payload: { senderUid: 'attacker-uid', body: 'phishing link' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate get(chatThreads/$(threadId)).data.participantUid == request.auth.uid',
  },
  {
    id: 11,
    name: 'Client-forged createdAt timestamp',
    collectionPath: '/searchRequests/req-11',
    operation: 'create',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 12,
    name: 'Unauthorized listing query scraping pending docs',
    collectionPath: '/listings',
    operation: 'list',
    payload: { status: 'pending' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: resource.data.status == "live" || (isSignedIn() && resource.data.ownerUid == request.auth.uid) || isEmailAdmin()',
  },
];
