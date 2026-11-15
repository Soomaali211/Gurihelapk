# GuriHel Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny:** Every unspecified Firestore path is rejected (`allow read, write: if false`).
2. **PII Isolation:** Phone numbers, emails, and KYC references live exclusively under `users/{userId}/private/info` and are only readable/writable by `request.auth.uid == userId` or verified admin (`ccasafari40@gmail.com`).
3. **Self-Role Escalation Prevention:** A user registering `users/{userId}` can only create `role: 'seeker'` (unless verified admin) and cannot elevate `role` on update.
4. **Listing Moderation Gate:** User-created listings must start with `status: 'pending'`, `verified: false`, `featured: false`, and `ownerUid == request.auth.uid`. Only admins can flip `status` to `'live'` / `'rejected'` or set `verified: true` / `featured: true`.
5. **Booking Integrity:** A booking can only be created with `guestUid == request.auth.uid`, `status: 'held'`, and an existing `listings/{listingId}` document.
6. **Master Gate Chat Security:** Reading or writing `chatThreads/{threadId}/messages/{messageId}` requires `get(/databases/$(database)/documents/chatThreads/$(threadId)).data.participantUid == request.auth.uid` or admin.
7. **Temporal Integrity:** All `createdAt` on create and `updatedAt` on create/update must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Listing Create:** Payload adds `"isAdminOverride": true` to `/listings/{id}` -> blocked by `keys().hasOnly(...)`.
2. **Self-Verification Bypass on Listing Create:** User creates `/listings/{id}` with `"status": "live", "verified": true` -> blocked because non-admin creates require `status == 'pending' && verified == false`.
3. **Identity Spoofing on Listing Create:** User creates `/listings/{id}` with `"ownerUid": "victim-uid"` -> blocked by `ownerUid == request.auth.uid`.
4. **Email Spoofing Admin Bypass:** Attacker sets custom unverified auth token email `"ccasafari40@gmail.com"` with `email_verified: false` -> blocked by `request.auth.token.email_verified == true`.
5. **PII Blanket Read:** Authenticated non-owner calls `get(/users/otherUser/private/info)` -> blocked by `isOwner(userId) || isAdmin()`.
6. **Self-Role Escalation on Profile Create/Update:** User sets `"role": "admin"` on `/users/{uid}` -> blocked by `role == 'seeker'` on create and immutable `role` on non-admin update.
7. **ID Poisoning Attack:** Attacker writes to `/listings/..%2F..%2Fadmins` or a 1,500-char document ID -> blocked by `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, `size <= 128`).
8. **Orphaned Booking Creation:** User creates `/bookings/{id}` referencing nonexistent `listingId: "ghost-listing"` -> blocked by `exists(/databases/$(database)/documents/listings/$(incoming().listingId))`.
9. **Terminal State Tampering:** User updates a listing whose status is already `'sold'` -> blocked by terminal status lock.
10. **Cross-Tenant Chat Message Injection:** Attacker writes to `/chatThreads/victimThread/messages/m1` -> blocked by parent `get()` Master Gate.
11. **Timestamp Backdating:** Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of server timestamp -> blocked by `incoming().createdAt == request.time`.
12. **Query Scraping Non-Live Listings:** Non-admin queries `/listings` expecting `pending` or `rejected` docs -> blocked by `allow list` checking `resource.data.status == 'live' || (isSignedIn() && resource.data.ownerUid == request.auth.uid) || isEmailAdmin()`.
