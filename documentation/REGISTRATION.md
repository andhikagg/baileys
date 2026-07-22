# Registration, Passkeys & Account Management (`src/Socket/registration.js`)

Covers MEX operations for passwords, passkeys, contacts, age verification, Imagine Me, account operations, data bundles, and companion devices.

## Password Management

WhatsApp's account protection password (different from your phone's lock screen):

```js
// Check if a password is set
const has = await sock.hasPassword()
// Returns: { has_password: true/false }

// Set a new password (first time)
await sock.setPassword('my-secure-password')

// Change existing password
await sock.setPassword('new-password', 'old-password')

// Verify a password is correct
await sock.checkPassword('my-secure-password')

// Remove the password entirely
await sock.deletePassword('my-secure-password')
```

## Passkeys (Account-Level)

Account-level passkeys for WebAuthn/FIDO2 authentication:

```js
// Check if a passkey exists
const exists = await sock.passkeyExists()

// List all existing passkeys
const list = await sock.passkeyListExists()

// Start a passkey authentication challenge
const challenge = await sock.passkeyRequestChallenge()

// Verify the passkey challenge (after user authenticates with their device)
await sock.passkeyVerifyChallenge(
    credentialId,
    authenticatorData,
    clientDataJson,
    signature
)

// Delete a specific passkey
await sock.passkeyDelete(credentialId)
```

## Passkeys (Registration Flow)

Passkeys used during the initial WhatsApp registration process:

```js
// Start registration passkey flow
const regChallenge = await sock.regPasskeyStart()

// Finish registration with the passkey credential
await sock.regPasskeyFinish(credentialId, attestationObject, clientDataJson)

// Enable/disable registration passkeys
await sock.regPasskeyEnable()
await sock.regPasskeyDisable()

// Clear all registration passkeys
await sock.regPasskeyClear()

// Update client-side encryption status
await sock.regPasskeyUpdateEncryptionStatus(true)
```

## Registration Upsells

Prompts that WhatsApp shows during registration to enable additional features:

```js
// Get available registration upsells (features WA wants you to enable)
const upsells = await sock.getRegistrationUpsells()

// Get dynamic upsells (server-generated, context-aware)
const dynamicUpsells = await sock.getDynamicRegistrationUpsells()

// Acknowledge that a upsell was shown to the user
await sock.registrationUpsellShown('passkey-upsell')
await sock.registrationDynamicUpsellShown('backup-upsell')

// Verify an account transfer token (used when migrating to a new phone)
await sock.regAccountTransferVerifyToken(transferToken)
```

## Contacts

```js
// Upload your contacts to WhatsApp (for "Contacts on WhatsApp" discovery)
// contacts: array of { phone_number, first_name?, last_name? }
await sock.contactsUpload([
    { phone_number: '+491234567890', first_name: 'Alice' },
    { phone_number: '+441234567890', first_name: 'Bob', last_name: 'Smith' }
])

// Backup your contacts to WhatsApp's servers
await sock.contactsBackup(contactsArray)

// Fetch your backed-up contacts
const backup = await sock.contactsBackupQuery()

// Fetch your own contacts (self-contacts / linked accounts)
const selfContacts = await sock.selfContactsQuery()

// Get suggested contacts (people you might know)
const suggestions = await sock.suggestedContactsV2(20) // limit

// Run a USync query (low-level batch contact lookup)
const result = await sock.usyncQuery(jids)

// Get your country code
const countryCode = await sock.userCountryCodeGet()
```

## Age Verification

```js
// Run the age collection flow (WhatsApp checks if you're old enough)
await sock.ageCollection()

// Get your current age experience settings
const ageExp = await sock.getAgeExperience()

// Set your age experience (birth year, optional country)
await sock.setAgeExperience(1990, 'DE')

// Get UNKU age collection info (underage user flow)
const unkuInfo = await sock.getUnkuAgeInfo()

// Submit your age
await sock.submitAge(1990, 'DE')
```

## Imagine Me

Imagine Me is WhatsApp's feature to create AI-generated avatars/images of yourself:

```js
// Check if you've completed Imagine Me onboarding
const onboarded = await sock.getImagineMeOnboarded()

// Delete your Imagine Me onboarding data (resets the feature)
await sock.deleteImagineMeOnboarding()
```

## Misc Account Operations

```js
// Fetch user notices by their IDs (system notices from WhatsApp)
const notices = await sock.fetchUserNoticesById(['notice-1', 'notice-2'])

// Remove an account reachout timelock (unlocks 463-locked accounts)
await sock.removeAccountReachoutTimelock()

// Set result for a Terms of Service prompt
// tosId: the TOS ID shown to user; result: 'accept' | 'decline'
await sock.tosSetResult('20240306', 'accept')

// Validate verifier confidence (for account verification flows)
await sock.validateVerifierConfidence(verifierId, confidenceScore)

// Debug: send a binary demo query
await sock.waBinaryDemoQuery()

// Run a start-chat context integrity check (verifies JIDs before opening chat)
await sock.startChatContextIntegrityQuery(['491234567890@s.whatsapp.net'])

// Message capping OTE request (for regulated accounts)
await sock.messageCappingOteRequest()

// Log mobile config consistency
await sock.mobileConfigConsistencyLogging({ key: 'value' })

// Create a reminder
await sock.reminderCreate('Call Alice', 'Weekly catch-up', scheduledUnixTimestamp)

// Delete a reminder
await sock.reminderDelete(reminderId)

// Fetch OHAI key config (end-to-end encrypted features)
const ohaiConfig = await sock.ohaiKeyConfigQuery()

// Request peer logs upload for a bug report
await sock.requestPeerLogsUpload('bug-id-123')

// Check if this account has a business intent
const hasBizIntent = await sock.hasBusinessIntent()

// Run ESCPS migration (encrypted storage migration)
await sock.escpsMigration()

// Create an enforcement appeal (account suspension appeal)
await sock.createEnforcementAppeal('false_positive', 'This was a mistake')

// Get auto-confidence challenge (for anti-automation verification)
const challenge = await sock.getAutoConfChallenge()

// Get old response (legacy compatibility)
await sock.getWaOldResponse()

// Get your wa.me link
const link = await sock.getWaMeLink()

// Fetch bot PKI certificate revocation list
await sock.fetchBotPkiCrl()

// Generate a TEE (Trusted Execution Environment) participation token
await sock.teeChatParticipationToken(chatJid, participants)
```

## Linking Data Bundles

Used during the multi-device linking process:

```js
// Generate a linking data bundle (for linking a new companion device)
const bundle = await sock.generateLinkingBundle()

// Get a cacheable unlinked data bundle
const cacheBundle = await sock.getCacheableUnlinkedBundle()

// Get an unlinked data bundle
const unlinked = await sock.getUnlinkedBundle()

// Get DSB (Device Sync Bundle) info
const dsbInfo = await sock.getDsbInfo()
```

## WWW Companion Device Operations

Used when operating as a companion/web device. These MEX calls fetch the ACS token that the HTTPS GraphQL methods then use automatically.

```js
// Get a nonce (first step of ACS token flow)
const nonceData = await sock.wwwGetNonce()
// Returns: { nonce: "..." }

// Exchange the nonce for an ACS access token
const tokenData = await sock.wwwExchangeNonce(nonceData.nonce)
// Returns: { access_token: "WA|..." }

// Create an access token (alternative flow with user ID)
await sock.wwwCreateAccessToken(nonce, userId)

// Get certificates for the web companion
const certs = await sock.wwwGetCertificates()

// Create a WWW companion user
await sock.wwwCreateUser({ phone: '491234567890', ... })

// Delete the WWW companion user
await sock.wwwDeleteUser()

// Trade multiple nonces for access tokens at once
const tokens = await sock.wwwTradeNonces([nonce1, nonce2])

// Trigger account recovery for a companion device
await sock.wwwTriggerRecovery('491234567890')

// Validate that the canonical user is still valid
await sock.wwwValidateCanonicalUser(token)
```

> **Note:** You normally don't need to call these manually. The HTTPS GraphQL methods (in `GRAPHQL.md`) call `wwwGetNonce` + `wwwExchangeNonce` automatically via `acquireAccessToken()`.

## Full Method Reference

| Method | Parameters | What it does |
|--------|-----------|-------------|
| `hasPassword()` | — | Check if password is set |
| `setPassword(password, oldPassword?)` | new, old | Set/change password |
| `checkPassword(password)` | password | Verify password |
| `deletePassword(password)` | password | Remove password |
| `passkeyExists()` | — | Check passkey existence |
| `passkeyListExists()` | — | List all passkeys |
| `passkeyRequestChallenge()` | — | Start auth challenge |
| `passkeyVerifyChallenge(credId, authData, cdj, sig)` | credential data | Verify challenge |
| `passkeyDelete(credentialId)` | credential ID | Delete passkey |
| `regPasskeyStart()` | — | Start reg passkey flow |
| `regPasskeyFinish(credId, attestObj, cdj)` | credential data | Finish reg passkey |
| `regPasskeyEnable()` | — | Enable reg passkey |
| `regPasskeyDisable()` | — | Disable reg passkey |
| `regPasskeyClear()` | — | Clear all reg passkeys |
| `regPasskeyUpdateEncryptionStatus(enabled)` | bool | Update encryption status |
| `getRegistrationUpsells()` | — | Get upsells |
| `getDynamicRegistrationUpsells()` | — | Get dynamic upsells |
| `registrationUpsellShown(upsellId)` | ID | Mark upsell as shown |
| `registrationDynamicUpsellShown(upsellId)` | ID | Mark dynamic upsell shown |
| `regAccountTransferVerifyToken(token)` | token | Verify transfer token |
| `contactsUpload(contacts)` | contact array | Upload contacts |
| `contactsBackup(contacts)` | contact array | Backup contacts |
| `contactsBackupQuery()` | — | Fetch backed-up contacts |
| `selfContactsQuery()` | — | Get own contacts |
| `suggestedContactsV2(limit?)` | number | Get suggestions |
| `usyncQuery(jids)` | JID array | USync batch lookup |
| `userCountryCodeGet()` | — | Get country code |
| `ageCollection()` | — | Age collection flow |
| `getAgeExperience()` | — | Get age experience |
| `setAgeExperience(birthYear, country?)` | year, country | Set age experience |
| `getUnkuAgeInfo()` | — | Get UNKU age info |
| `submitAge(birthYear, country?)` | year, country | Submit age |
| `getImagineMeOnboarded()` | — | Check Imagine Me status |
| `deleteImagineMeOnboarding()` | — | Reset Imagine Me |
| `fetchUserNoticesById(noticeIds)` | ID array | Fetch user notices |
| `removeAccountReachoutTimelock()` | — | Remove reachout timelock |
| `tosSetResult(tosId, result)` | TOS ID, result | Set TOS result |
| `validateVerifierConfidence(verifierId, confidence)` | ID, score | Validate verifier |
| `waBinaryDemoQuery()` | — | Binary demo query |
| `startChatContextIntegrityQuery(jids)` | JID array | Context integrity check |
| `messageCappingOteRequest()` | — | OTE request |
| `mobileConfigConsistencyLogging(config?)` | config object | Log config consistency |
| `reminderCreate(title, body, scheduledTime)` | strings, timestamp | Create reminder |
| `reminderDelete(reminderId)` | ID | Delete reminder |
| `ohaiKeyConfigQuery()` | — | Get OHAI key config |
| `requestPeerLogsUpload(bugId)` | bug ID | Request peer logs |
| `hasBusinessIntent()` | — | Check business intent |
| `escpsMigration()` | — | ESCPS migration |
| `createEnforcementAppeal(reason, details?)` | reason, details | Create appeal |
| `getAutoConfChallenge()` | — | Get auto-conf challenge |
| `getWaOldResponse()` | — | Get old WA response |
| `getWaMeLink()` | — | Get wa.me link |
| `fetchBotPkiCrl()` | — | Fetch PKI CRL |
| `teeChatParticipationToken(chatJid, participants)` | JID, participants | Generate TEE token |
| `generateLinkingBundle()` | — | Generate linking bundle |
| `getCacheableUnlinkedBundle()` | — | Get cacheable bundle |
| `getUnlinkedBundle()` | — | Get unlinked bundle |
| `getDsbInfo()` | — | Get DSB info |
| `wwwGetNonce()` | — | Get ACS nonce |
| `wwwExchangeNonce(nonce)` | nonce | Exchange for token |
| `wwwCreateAccessToken(nonce, userId)` | nonce, user ID | Create access token |
| `wwwGetCertificates()` | — | Get WWW certificates |
| `wwwCreateUser(input)` | user data | Create WWW user |
| `wwwDeleteUser()` | — | Delete WWW user |
| `wwwTradeNonces(nonces)` | nonce array | Trade nonces for tokens |
| `wwwTriggerRecovery(phoneNumber)` | phone | Trigger account recovery |
| `wwwValidateCanonicalUser(token)` | token | Validate canonical user |
