# MEX — WhatsApp's Internal GraphQL Protocol

Baron-Baileys-v2 exposes all MEX operations as socket methods. MEX is WhatsApp's internal GraphQL system that runs over the existing WebSocket connection, with no extra HTTP requests and no authentication tokens beyond your normal session.

## What is MEX?

MEX (**M**obile **Ex**ecution) is WhatsApp's internal GraphQL-over-WebSocket protocol. Queries are sent as XML IQ stanzas over the same WebSocket used for messages. The server replies in the same stanza with a JSON response body.

Internally WhatsApp uses Pando/MEX, a Facebook-originated mobile GraphQL framework. Every feature from privacy settings to newsletter management to passkeys goes through it.

## Quick Start

```js
const { makeWASocket, useMultiFileAuthState } = require('baron-baileys-v2')

const { state, saveCreds } = await useMultiFileAuthState('./auth')
const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)

// Wait for connection
await new Promise(resolve =>
	sock.ev.once('connection.update', ({ connection }) => {
		if (connection === 'open') resolve()
	})
)

// Now all MEX methods are available directly on sock:
const settings = await sock.fetchPrivacySettings()
console.log(settings)
// { last: 'all', online: 'all', profile: 'contacts', status: 'contacts', ... }
```

## Privacy Settings

### Read all settings

```js
const settings = await sock.fetchPrivacySettings()
// Returns a flat object — keys map to WA privacy categories:
// {
//   last: 'all',             // last seen
//   online: 'all',           // online status
//   profile: 'contacts',     // profile picture
//   status: 'contacts',      // status/stories
//   readreceipts: 'all',     // read receipts
//   groupadd: 'all',         // who can add you to groups
//   calladd: 'all',          // who can call you
// }

// Force a fresh fetch (bypasses cache):
const fresh = await sock.fetchPrivacySettings(true)
```

### Change a privacy setting (via MEX)

`setPrivacySetting` goes through the MEX GraphQL server. **All enum values must be UPPERCASE** — `'LAST_SEEN'` not `'last'`, `'ALL'` not `'all'`. The IQ-based helpers (`updateLastSeenPrivacy` etc.) accept lowercase and bypass MEX entirely.

```js
// Feature names (UPPERCASE)
//   LAST_SEEN, ONLINE, PROFILE_PHOTO, STATUS,
//   READ_RECEIPTS, GROUPS, CALLS, SCREENSHOT, LIVE_LOCATION

// Setting values (UPPERCASE)
//   ALL, CONTACTS, CONTACT_BLACKLIST, NONE

await sock.setPrivacySetting('LAST_SEEN', 'CONTACTS')
await sock.setPrivacySetting('ONLINE', 'CONTACTS')
await sock.setPrivacySetting('GROUPS', 'CONTACT_BLACKLIST')
await sock.setPrivacySetting('CALLS', 'NONE')
await sock.setPrivacySetting('READ_RECEIPTS', 'ALL')
```

### Change a privacy setting (via IQ, always works)

These helpers use the legacy WhatsApp IQ protocol instead of MEX, so they work on all account types:

```js
await sock.updateLastSeenPrivacy('all') // all | contacts | contact_blacklist | none
await sock.updateOnlinePrivacy('contacts')
await sock.updateProfilePicturePrivacy('all')
await sock.updateGroupsAddPrivacy('contact_blacklist')
await sock.updateReadReceiptsPrivacy('all')
await sock.updateCallPrivacy('contacts')
```

### Manage privacy contact lists

When a setting is `CONTACT_BLACKLIST` or `CONTACTS`, you manage the list of JIDs separately:

```js
// Fetch the current list
const list = await sock.getPrivacyContactList('groupadd', 'contact_blacklist')
// Returns: { jids: ['491234...@s.whatsapp.net', ...] }

// Replace the list entirely
await sock.updatePrivacyContactList('groupadd', 'contact_blacklist', [
	'491234567890@s.whatsapp.net',
	'491987654321@s.whatsapp.net'
])
```

---

## Contact Integrity Check

Before opening a chat with an unknown JID, verify the user exists on WhatsApp:

```js
const result = await sock.contactIntegrityQuery(
	['491234567890@s.whatsapp.net'],
	'START_CHAT_CONTEXT' // default use case
)
// Returns user data including whether each JID is a valid WA user

// Or use the USync-based helper which is simpler:
const [entry] = await sock.onWhatsApp('491234567890')
// entry.exists === true if the number is on WhatsApp
// entry.jid    === '491234567890@s.whatsapp.net'
```

---

## Text Status (About)

```js
// Update your About text
await sock.updateTextStatus('Available for chats 👋')

// Fetch About text for a list of JIDs
const statuses = await sock.getTextStatusList(['491234567890@s.whatsapp.net', '491987654321@s.whatsapp.net'])
// Returns: [{ jid, text, emoji, timestamp }, ...]

// Fetch only statuses newer than a given timestamp
const recent = await sock.getTextStatusList(jids, Date.now() - 24 * 60 * 60 * 1000)
```

---

## Profile Picture

```js
// Fetch profile picture info (URL, timestamp, type)
const info = await sock.fetchUserPictureInfo('491234567890@s.whatsapp.net')
// Returns: { url, timestamp, type, ... }

// Set your own profile picture
const imageBase64 = require('fs').readFileSync('./photo.jpg').toString('base64')
await sock.setProfilePictureMex(imageBase64, 'image') // full-resolution
await sock.setProfilePictureMex(imageBase64, 'preview') // preview thumbnail
```

---

## Username

```js
// Check if a username is available
const check = await sock.checkUsername('myusername')
// Returns: { available: true, username: 'myusername' }

// Check multiple at once
const multi = await sock.checkUsernameMulti(['baron', 'test123'])

// Set your username (must be available)
await sock.setUsername('myusername')

// Get your current username
const mine = await sock.getMyUsername()
// Returns: 'myusername' or null

// Find a user by username
const user = await sock.findUserByUsername('someusername')
// Returns: { jid: '491234...@s.whatsapp.net', contact: false } or null if not found

// Get username recommendations from WA
const suggestions = await sock.getUsernameRecommendations()
```

---

## Password

```js
// Check if a password is set
const { has_password } = await sock.hasPassword()

// Set a new password
await sock.setPassword('my-secure-password')

// Change existing password
await sock.setPassword('new-password', 'old-password')

// Verify a password
await sock.checkPassword('my-secure-password')

// Remove password
await sock.deletePassword('my-secure-password')
```

---

## Passkeys (FIDO2 / WebAuthn)

```js
// Check if a passkey exists
const exists = await sock.passkeyExists()

// List all passkeys
const list = await sock.passkeyListExists()

// Start authentication challenge
const challenge = await sock.passkeyRequestChallenge()

// Verify the challenge (after user authenticates with their device)
await sock.passkeyVerifyChallenge(credentialId, authenticatorData, clientDataJson, signature)

// Delete a passkey
await sock.passkeyDelete(credentialId)
```

---

## Mobile Config

```js
// Fetch feature flags and endpoint config from WhatsApp's servers
const config = await sock.fetchMobileConfig()
// Returns a large object with WA feature flags and server endpoints
```

---

## Error Handling

All MEX methods throw a `Boom` error on failure. Always wrap in try/catch:

```js
const { Boom } = require('@hapi/boom')

try {
	await sock.setPrivacySetting('LAST_SEEN', 'CONTACTS')
} catch (err) {
	if (err instanceof Boom) {
		console.log(err.output.statusCode) // 400, 403, 404, 429, ...
		console.log(err.message) // 'Bad Request', 'Forbidden', etc.
	}
}
```

Common status codes:

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| 400  | Wrong variables format or invalid enum value |
| 403  | Feature not available on this account type   |
| 404  | Resource not found                           |
| 429  | Rate limited                                 |

---

## How it Works Internally

Each MEX call sends this IQ stanza over the WebSocket:

```xml
<iq id="<tag>" type="get" to="s.whatsapp.net" xmlns="w:mex">
  <query query_id="<numeric_doc_id>">{"variables":{...}}</query>
</iq>
```

The `query_id` is a numeric ID (16–17 digits) that identifies the specific GraphQL operation on WhatsApp's servers. These IDs are extracted from `assets/whatsapp-android-mex_client_persist_ids.json` in the WhatsApp APK and verified against the current APK on every release.

---

## Method Index by Feature Area

| Area                                                               | Where documented                         |
| ------------------------------------------------------------------ | ---------------------------------------- |
| Privacy settings, profile picture, contact lists, integrity checks | [PRIVACY.md](PRIVACY.md)                 |
| Passwords, passkeys, contacts backup, age verification             | [REGISTRATION.md](REGISTRATION.md)       |
| Managed accounts, payments passkey, IPLS                           | [MANAGED-ACCOUNT.md](MANAGED-ACCOUNT.md) |
| Username (`@username`)                                             | [USERNAME.md](USERNAME.md)               |
| HTTPS GraphQL (Meta AI, Events, Payments)                          | [GRAPHQL.md](GRAPHQL.md)                 |
| Interoperability (BirdyChat, Haiket, DMA)                          | [INTEROP.md](INTEROP.md)                 |
