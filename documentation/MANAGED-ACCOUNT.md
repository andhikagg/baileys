# Managed Accounts, Payments Passkey & IPLS (`src/Socket/managed-account.js`)

Covers MEX operations for parental controls, payments passkey (WebAuthn), UPI onboarding, and IPLS.

## Managed Accounts (Parental Controls / Family)

Managed accounts allow a parent or guardian (the **sponsor**) to supervise a child's WhatsApp account. The linking process goes through several steps.

### Query a managed account

```js
// Get info about a managed account by JID
const info = await sock.managedAccountQuery('491234567890@s.whatsapp.net')
```

### Linking flow (from the sponsor's side)

```js
// Step 1: Initiate linking — send a linking request to the child's phone number
const linkData = await sock.managedAccountInitiateLinking('+491234567890')
// Returns: { linking_token: "..." }

// Step 2: Validate the linking token (verify it's still valid before proceeding)
const validation = await sock.managedAccountValidateLinking(
    linkData.linking_token,
    sponsorJid
)

// Step 3: Accept the linking
await sock.managedAccountAcceptLinking(linkData.linking_token)

// Step 4: Complete the linking
await sock.managedAccountCompleteLinking(linkData.linking_token)
```

### Managing linked accounts

```js
// Revoke (remove) a managed account link
await sock.managedAccountRevokeLinking(sponsoredJid)

// Sync activity data for a managed account
const activities = await sock.managedAccountSyncActivities(
    '491234567890@s.whatsapp.net'
)

// Sync only activities after a specific time
const recentActivities = await sock.managedAccountSyncActivities(
    '491234567890@s.whatsapp.net',
    lastSyncTimestamp
)

// Update the PIN for a managed account
await sock.managedAccountUpdatePin('old-pin', 'new-pin')

// Get sponsor's age verification info (needed for the linking process)
const ageVerification = await sock.managedAccountGetSponsorAgeVerification(sponsorJid)
```

## Payments Passkey (WebAuthn for WhatsApp Pay)

These methods handle the registration and authentication of hardware security keys / biometrics for authorizing payments.

### Check and enroll

```js
// Check if a payments passkey is already registered
const hasKey = await sock.paymentsPasskeyHasCredential()

// Start enrollment (get a challenge from the server)
const challenge = await sock.paymentsPasskeyEnrollChallenge()

// Verify the enrollment (after the user authenticates with their device)
await sock.paymentsPasskeyEnrollVerify(
    credentialId,
    attestationObject,
    clientDataJson
)

// Finish registration
await sock.paymentsPasskeyRegisterFinish(
    credentialId,
    attestationObject,
    clientDataJson
)
```

### Authenticate payments

```js
// Get an authentication challenge for a payment
const authChallenge = await sock.paymentsPasskeyAuthChallenge(credentialId)
```

### Toggle and cleanup

```js
// Enable payments passkey
await sock.paymentsPasskeyToggleOn()

// Disable payments passkey
await sock.paymentsPasskeyToggleOff()

// Get a toggle challenge (server confirms the toggle intent)
await sock.paymentsPasskeyToggleChallenge(credentialId)

// Clean up after a toggle
await sock.paymentsPasskeyToggleCleanup()

// Remove the passkey entirely
await sock.paymentsPasskeyCleanup()

// Check if the payments account can be recovered
const recoverable = await sock.paymentsIsAccountRecoverable()
```

## UPI Onboarding (India Payments)

UPI (Unified Payments Interface) is India's payment system integrated into WhatsApp Pay:

```js
// Send an OTP to a phone number for UPI onboarding
await sock.upiSendOtp('+911234567890')

// Verify the OTP to complete UPI onboarding
const result = await sock.upiVerifyOtp('+911234567890', '123456')
```

## IPLS — Identity-Preserving Linked Spaces

IPLS is WhatsApp's infrastructure for linking accounts across Meta's platforms while preserving privacy (the same system used for end-to-end encrypted inter-platform messaging):

```js
// Initialize an IPLS handshake
const initResult = await sock.iplsHandshakeInit(payloadBuffer)

// Send a client hello message
const helloResult = await sock.iplsClientHello(payloadBuffer)

// IPLSD (IPLS Daemon) V2 hello
const helloV2Result = await sock.iplsdClientHelloV2(payloadBuffer)

// IPLSD V2 init
const initV2Result = await sock.iplsdClientInitV2(payloadBuffer)
```

> **Note:** IPLS payloads are binary protocol buffers. You typically only need these if building a custom Meta inter-platform integration.

## Full Method Reference

| Method | Parameters | What it does |
|--------|-----------|-------------|
| `managedAccountQuery(jid)` | JID | Get managed account info |
| `managedAccountInitiateLinking(phoneNumber)` | phone | Start linking flow |
| `managedAccountValidateLinking(token, sponsorJid)` | token, JID | Validate linking token |
| `managedAccountAcceptLinking(token)` | token | Accept linking |
| `managedAccountCompleteLinking(token)` | token | Complete linking |
| `managedAccountRevokeLinking(sponsoredJid)` | JID | Remove managed account |
| `managedAccountSyncActivities(jid, lastSyncTime?)` | JID, timestamp | Sync activities |
| `managedAccountUpdatePin(oldPin, newPin)` | old, new | Change PIN |
| `managedAccountGetSponsorAgeVerification(sponsorJid)` | JID | Get sponsor age info |
| `paymentsPasskeyHasCredential()` | — | Check passkey exists |
| `paymentsPasskeyEnrollChallenge()` | — | Start enrollment |
| `paymentsPasskeyEnrollVerify(credId, attObj, cdj)` | credential data | Verify enrollment |
| `paymentsPasskeyRegisterFinish(credId, attObj, cdj)` | credential data | Finish registration |
| `paymentsPasskeyAuthChallenge(credentialId)` | credential ID | Get auth challenge |
| `paymentsPasskeyToggleOn()` | — | Enable passkey |
| `paymentsPasskeyToggleOff()` | — | Disable passkey |
| `paymentsPasskeyToggleChallenge(credentialId)` | credential ID | Get toggle challenge |
| `paymentsPasskeyToggleCleanup()` | — | Post-toggle cleanup |
| `paymentsPasskeyCleanup()` | — | Remove passkey |
| `paymentsIsAccountRecoverable()` | — | Check recoverability |
| `upiSendOtp(phoneNumber)` | phone | Send UPI OTP |
| `upiVerifyOtp(phoneNumber, otp)` | phone, OTP | Verify UPI OTP |
| `iplsHandshakeInit(payload)` | Buffer | Init IPLS handshake |
| `iplsClientHello(payload)` | Buffer | Client hello |
| `iplsdClientHelloV2(payload)` | Buffer | IPLSD client hello v2 |
| `iplsdClientInitV2(payload)` | Buffer | IPLSD client init v2 |
