# USync — Bulk User Data Query Protocol (`src/WAUSync/`)

USync is WhatsApp's internal binary IQ protocol for batch-querying user data. One request can fetch multiple data types for multiple users simultaneously.

---

## How it works

A USync query consists of:

- One or more **protocols** — what data types to request (devices, contact status, profile picture, etc.)
- One or more **users** — who to query

The socket sends an `<iq xmlns="usync">` stanza and parses the response per protocol.

---

## Usage

```js
const { USyncQuery, USyncUser } = require('baron-baileys-v2/src/WAUSync')

// Build a query
const query = new USyncQuery()
	.withContactProtocol() // is this number on WhatsApp?
	.withStatusProtocol() // their "About" status text
	.withDeviceProtocol() // linked devices + key index
	.withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))
	.withUser(new USyncUser().withId('441234567890@s.whatsapp.net'))

// Execute it
const result = await sock.executeUSyncQuery(query)

// result.list — main list of users with their data
// result.sideList — secondary/cached results (used for LID side-list)
for (const entry of result.list) {
	console.log(entry.id) // JID
	console.log(entry.contact) // true/false (is on WhatsApp)
	console.log(entry.status) // { status, setAt }
	console.log(entry.devices) // { deviceList, keyIndex }
}
```

---

## Query context and mode

```js
// context: 'interactive' (default) | 'background' | 'message'
// mode:    'query' (default) | 'delta'

new USyncQuery()
	.withContext('background') // for background refreshes
	.withContext('message') // used internally before sending
	.withMode('delta') // only return changes since last query
```

---

## All Protocols

### `withContactProtocol()` — Is this number on WhatsApp?

Look up by phone number, JID, or `@username`:

```js
// By phone number
const q = new USyncQuery().withContactProtocol().withUser(new USyncUser().withPhone('+491234567890'))

// By JID
const q2 = new USyncQuery().withContactProtocol().withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// By username
const q3 = new USyncQuery().withContactProtocol().withUser(new USyncUser().withUsername('myusername'))

// By username with PIN (for PIN-protected usernames)
const q4 = new USyncQuery()
	.withContactProtocol()
	.withUser(new USyncUser().withUsername('myusername').withUsernameKey('pin123'))

const result = await sock.executeUSyncQuery(q)
// entry.contact → true (on WhatsApp) | false (not registered)
```

> `sock.onWhatsApp('+491234567890')` uses this protocol internally.

---

### `withDeviceProtocol()` — Linked devices and key index

Returns all companion devices for a user and the signed key index (used for multi-device message sending):

```js
const q = new USyncQuery().withDeviceProtocol().withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.devices = {
//   deviceList: [
//     { id: 0, keyIndex: 1, isHosted: false },
//     { id: 1, keyIndex: 2, isHosted: false },
//   ],
//   keyIndex: {
//     timestamp: 1716825600,
//     signedKeyIndex: Buffer,
//     expectedTimestamp: 1716912000
//   }
// }
```

> Used internally by `messages-send.js` before encrypting multi-device messages.

---

### `withStatusProtocol()` — Legacy About/status text

```js
const q = new USyncQuery().withStatusProtocol().withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.status = { status: 'Hey there!', setAt: Date }
// entry.status = { status: '', setAt: Date }  ← privacy-hidden
// entry.status = null                          ← not set
```

> `sock.fetchStatus(...jids)` uses this protocol internally.

---

### `withDisappearingModeProtocol()` — Default disappearing message duration

```js
const q = new USyncQuery()
	.withDisappearingModeProtocol()
	.withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.disappearing_mode = { duration: 86400, setAt: Date }
// duration: seconds (e.g. 86400 = 24h, 604800 = 7d, 7776000 = 90d, 0 = off)
```

> `sock.fetchDisappearingDuration(...jids)` uses this internally.

---

### `withUsernameProtocol()` — Fetch @username for a JID

```js
const q = new USyncQuery().withUsernameProtocol().withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.username = 'alice' | null
```

> `sock.fetchContactUsernames(...jids)` uses this internally.

---

### `withLIDProtocol()` — Resolve LID ↔ Phone Number

LID (Linked Identity) is WhatsApp's privacy-preserving internal user identifier:

```js
// Resolve a PN to its LID
const q = new USyncQuery()
	.withLIDProtocol()
	.withContext('background')
	.withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.lid = '12345678901234567890:0@lid'

// Query LID by LID (reverse)
const q2 = new USyncQuery()
	.withLIDProtocol()
	.withUser(new USyncUser().withId('12345678901234567890:0@lid').withLid('12345678901234567890:0@lid'))
```

---

### `withBotProfileProtocol()` — Fetch bot persona profile

```js
const q = new USyncQuery()
	.withBotProfileProtocol()
	.withUser(new USyncUser().withId('867051314767696@bot').withPersonaId('persona-id-string'))

// entry.bot = {
//   jid: '867051314767696@bot',
//   name: 'Meta AI',
//   description: '...',
//   category: 'AI',
//   personaId: '...',
//   isDefault: true,
//   commands: [{ name: '/imagine', description: 'Generate an image' }],
//   prompts: ['🎨 Create an image', '✍️ Write a story'],
//   commandsDescription: 'Available commands',
//   attributes: '...'
// }
```

> `sock.fetchBotProfiles(jids)` uses this internally.

---

### `withBusinessProtocol(profileVersion?)` — Business profile info

```js
const q = new USyncQuery()
	.withBusinessProtocol('2') // profileVersion default: '2'
	.withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// Supply cached values to get delta updates only:
const userWithCache = new USyncUser().withId('491234567890@s.whatsapp.net')
userWithCache.verifiedNameSerial = 'serial-string'
userWithCache.businessProfileTag = 'tag-string'

// entry.business = {
//   verifiedName: 'Company Name' | null,
//   verifiedLevel: 'high' | null,
//   profileTag: 'tag-string' | null,
//   pnJid: '491234567890@s.whatsapp.net' | null
// }
```

---

### `withPictureProtocol(type?)` — Profile picture URL

```js
// type: 'image' (full resolution) | 'preview' (thumbnail, default)
const q = new USyncQuery().withPictureProtocol('image').withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// Supply cached picture ID to only get update if it changed:
const userWithCached = new USyncUser().withId('491234567890@s.whatsapp.net')
userWithCached.pictureId = '12345678'

// entry.picture = { id: '12345678', directPath: '/v/...', hash: '...' }
// entry.picture = null   ← no picture or hidden by privacy setting
```

---

### `withTextStatusProtocol()` — Evolved About (text + emoji)

The newer "text status" (About with emoji, visible for a limited time):

```js
const q = new USyncQuery().withTextStatusProtocol().withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// entry.text_status = {
//   text: 'Having a great day!',
//   emoji: '😊',
//   setAt: Date,
//   expiresAt: Date | null   ← null means no expiry
// }
```

---

### `withSidelistProtocol(useLidAddressing?)` — LID side-list

The side list returns LID-mapped secondary data. Used internally for multi-device sessions:

```js
const q = new USyncQuery()
	.withSidelistProtocol(true) // true = use LID addressing (default)
	.withUser(new USyncUser().withId('491234567890@s.whatsapp.net'))

// result.sideList — array of users with their side-list data

// Delete a sidelist entry:
const userDelete = new USyncUser().withId('491234567890@s.whatsapp.net')
userDelete.sidelistDelete = true
```

---

## Combining protocols

Multiple protocols in one round trip:

```js
const { USyncQuery, USyncUser } = require('baron-baileys-v2/src/WAUSync')

const jids = ['491234567890@s.whatsapp.net', '441234567890@s.whatsapp.net', '19146088152@s.whatsapp.net']

const q = new USyncQuery()
	.withContactProtocol()
	.withStatusProtocol()
	.withPictureProtocol('preview')
	.withUsernameProtocol()
	.withDisappearingModeProtocol()

for (const jid of jids) {
	q.withUser(new USyncUser().withId(jid))
}

const result = await sock.executeUSyncQuery(q)

for (const entry of result.list) {
	console.log({
		jid: entry.id,
		onWA: entry.contact, // true/false
		about: entry.status?.status, // "Hey there!"
		picture: entry.picture, // { id, directPath, hash }
		username: entry.username, // 'alice' | null
		disappear: entry.disappearing_mode?.duration // seconds
	})
}
```

---

## USyncUser fields

| Builder method               | Field                | Used by protocol        |
| ---------------------------- | -------------------- | ----------------------- |
| `.withId(jid)`               | `id`                 | All protocols           |
| `.withPhone(phone)`          | `phone`              | Contact                 |
| `.withLid(lid)`              | `lid`                | LID                     |
| `.withUsername(username)`    | `username`           | Contact                 |
| `.withUsernameKey(pin)`      | `usernameKey`        | Contact (PIN-protected) |
| `.withType(type)`            | `type`               | Contact                 |
| `.withPersonaId(id)`         | `personaId`          | BotProfile              |
| `user.pictureId = id`        | `pictureId`          | Picture (cache check)   |
| `user.verifiedNameSerial`    | `verifiedNameSerial` | Business (delta)        |
| `user.businessProfileTag`    | `businessProfileTag` | Business (delta)        |
| `user.sidelistDelete = true` | `sidelistDelete`     | Sidelist                |

---

## Protocol summary

| Protocol     | Method                           | Tag name            | Returns                                              |
| ------------ | -------------------------------- | ------------------- | ---------------------------------------------------- |
| Contact      | `withContactProtocol()`          | `contact`           | `bool` (is on WA)                                    |
| Device       | `withDeviceProtocol()`           | `devices`           | `{ deviceList, keyIndex }`                           |
| Status       | `withStatusProtocol()`           | `status`            | `{ status, setAt }`                                  |
| Disappearing | `withDisappearingModeProtocol()` | `disappearing_mode` | `{ duration, setAt }`                                |
| Username     | `withUsernameProtocol()`         | `username`          | `string \| null`                                     |
| LID          | `withLIDProtocol()`              | `lid`               | `string \| null`                                     |
| BotProfile   | `withBotProfileProtocol()`       | `bot`               | bot profile object                                   |
| Business     | `withBusinessProtocol(v?)`       | `business`          | `{ verifiedName, verifiedLevel, profileTag, pnJid }` |
| Picture      | `withPictureProtocol(type?)`     | `picture`           | `{ id, directPath, hash }`                           |
| TextStatus   | `withTextStatusProtocol()`       | `text_status`       | `{ text, emoji, setAt, expiresAt }`                  |
| Sidelist     | `withSidelistProtocol(lid?)`     | `sidelist`          | `{ type }`                                           |

---

## Socket methods that use USync internally

| Method                               | Protocols used   |
| ------------------------------------ | ---------------- |
| `onWhatsApp(...phones)`              | Contact          |
| `fetchStatus(...jids)`               | Status           |
| `fetchDisappearingDuration(...jids)` | DisappearingMode |
| `fetchContactUsernames(...jids)`     | Username         |
| `fetchBotProfiles(jids)`             | BotProfile       |
| `findUserByUsername(username, pin?)` | Contact          |
| message sending                      | Device + LID     |
| `pnFromLIDUSync(jids)`               | LID              |
