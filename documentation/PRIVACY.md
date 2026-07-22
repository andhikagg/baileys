# Privacy, Status, Profile & Account (`src/Socket/privacy.js`)

This module covers privacy settings, text status (About), profile pictures, account login/logout, trusted devices, linked social profiles, and misc MEX operations.

---

## Privacy Settings

### Fetch all privacy settings

```js
const settings = await sock.getPrivacySettings(sock.user.id)
// Returns xwa2_fetch_wa_users with privacy_settings[] per user
```

### Set a privacy setting

```js
// Known features: LAST_SEEN, ONLINE, PROFILE_PHOTO, STATUS,
//                 READ_RECEIPTS, GROUPS, CALLS, SCREENSHOT, LIVE_LOCATION
// Known values:   ALL, CONTACTS, CONTACT_BLACKLIST, NONE

await sock.setPrivacySetting('LAST_SEEN', 'CONTACTS')
await sock.setPrivacySetting('GROUPS', 'CONTACT_BLACKLIST')
await sock.setPrivacySetting('READ_RECEIPTS', 'ALL')
```

### Contact lists for privacy settings

When a setting uses `CONTACT_BLACKLIST` or `CONTACTS`, manage the list:

```js
// Set the list (replaces current)
await sock.updatePrivacyContactList(
    'GROUPS',            // feature
    'CONTACT_BLACKLIST', // setting
    ['491234567890@s.whatsapp.net', '491987654321@s.whatsapp.net']
)

// Fetch the current list
const list = await sock.getPrivacyContactList('GROUPS', 'CONTACT_BLACKLIST')
```

---

## Text Status (About / Evolved About)

```js
// Update your own status text
await sock.updateTextStatus('Available for chats', '👋')

// Without emoji
await sock.updateTextStatus('Busy')

// Fetch text statuses for a list of JIDs
const statuses = await sock.getTextStatusList([
    '491234567890@s.whatsapp.net',
    '491987654321@s.whatsapp.net'
])

// Fetch only statuses newer than a timestamp
const recent = await sock.getTextStatusList(jids, Date.now() - 86400000)

// Update the legacy user status string
await sock.updateUserStatus('Hey there! I am using WhatsApp.')
```

---

## Profile Picture

```js
// Fetch picture info for a JID (URL, timestamp, etc.)
const info = await sock.fetchUserPictureInfo('491234567890@s.whatsapp.net')

// Set your own profile picture via MEX
// imageBase64: base64-encoded JPEG
await sock.setProfilePictureMex(imageBase64, 'image')   // full image
await sock.setProfilePictureMex(imageBase64, 'preview') // preview
```

---

## Account Login / Logout (Companion Mode)

These are used internally during the companion device registration flow:

```js
// Mark account as logged-in
await sock.accountLogin('491234567890')

// Mark account as logged-out
await sock.accountLogout('491234567890')

// With biometric flag
await sock.accountLogout('491234567890', true)
```

---

## Multi-Account

```js
// Link a secondary WhatsApp account
await sock.addMultiAccountLink('491234567890')

// Revoke a linked secondary account
await sock.revokeMultiAccount('491234567890@s.whatsapp.net')
```

---

## Trusted Devices (Biometric / Passkey login)

Trusted devices allow logging in without a phone scan:

```js
// Fetch all trusted devices
const devices = await sock.getTrustedDevices()

// Add a trusted device (from registration flow)
await sock.addTrustedDevice('device-id-suffix', 'My Laptop')

// Remove trust from a device (keeps device record)
await sock.untrustTrustedDevice('device-id-suffix', 'USER_INITIATED')

// Delete a trusted device completely
await sock.deleteTrustedDevice('device-id-suffix')
```

---

## Linked Social Profiles (Facebook / Instagram)

Link your FB or IG account to your WhatsApp profile:

```js
// Link by username
await sock.linkedProfilesSet([
    { type: 'FB', username: 'myFacebookUsername' },
    { type: 'IG', username: 'myInstagramHandle' }
])

// Link by viewer ID (vid)
await sock.linkedProfilesSet([
    { type: 'FB', vid: '123456789' }
])

// Update visibility on profile
await sock.linkedProfilesUpdate([
    { type: 'FB', showOnProfile: true },
    { type: 'IG', showOnProfile: false }
])

// Remove linked profiles
await sock.linkedProfilesRemove(['FB', 'IG'])
await sock.linkedProfilesRemove(['IG']) // remove only Instagram
```

---

## Blocklist Migration (LID)

Migrates your blocklist to LID addressing (required after LID migration):

```js
await sock.migrateBlocklistLid(
    ['491234567890@s.whatsapp.net'],
    'current-dhash-value',  // blocklist hash
    true                    // dirty_ack
)
```

---

## QR Code Scan (Companion Linking)

```js
// Scan a QR code to link a companion device
const result = await sock.qrCodeScan(qrData)
```

---

## Integrity Checks

```js
// Check if JIDs are valid WhatsApp users before opening a chat
const result = await sock.contactIntegrityQuery(
    ['491234567890@s.whatsapp.net'],
    'START_CHAT_CONTEXT' // use case
)

// Business integrity check
const bizResult = await sock.bizIntegrityQuery(['491234567890@s.whatsapp.net'])
```

---

## Misc

```js
// Fetch mobile config (feature flags, EP config)
const config = await sock.fetchMobileConfig(0, 0, '')

// Notify group members of your push name
await sock.notifyPushName('120363000000000000@g.us', [
    { jid: '491234567890@s.whatsapp.net', pushName: 'Alice' }
])
```

---

## Full Method Reference

| Method | Parameters | What it does |
|--------|-----------|-------------|
| `getPrivacySettings(jid, features?)` | JID, feature list | Fetch all privacy settings |
| `setPrivacySetting(feature, setting)` | feature, value | Change one privacy setting |
| `updatePrivacyContactList(feature, setting, jids)` | feature, setting, JIDs | Update allow/block list |
| `getPrivacyContactList(feature, setting)` | feature, setting | Fetch allow/block list |
| `updateTextStatus(text, emoji?)` | text, emoji | Update About/text status |
| `getTextStatusList(jids, lastUpdateTime?)` | JIDs, timestamp | Fetch About texts |
| `updateUserStatus(status)` | string | Update legacy status string |
| `fetchUserPictureInfo(jid)` | JID | Fetch profile picture info |
| `setProfilePictureMex(imageBase64, type?)` | base64, type | Set profile picture |
| `accountLogin(phoneNumber)` | phone | Mark account logged-in |
| `accountLogout(phoneNumber, enabledBiometric?)` | phone, bool | Mark account logged-out |
| `addMultiAccountLink(phoneNumber)` | phone | Link secondary account |
| `revokeMultiAccount(accountJid)` | JID | Revoke secondary account |
| `addTrustedDevice(deviceId, deviceName)` | ID, name | Add trusted device |
| `getTrustedDevices()` | — | List trusted devices |
| `untrustTrustedDevice(deviceId, reason?)` | ID, reason | Remove trust |
| `deleteTrustedDevice(deviceId)` | ID | Delete trusted device |
| `linkedProfilesSet(profiles)` | profile list | Link FB/IG profiles |
| `linkedProfilesUpdate(profiles)` | profile list | Update profile visibility |
| `linkedProfilesRemove(types)` | ['FB'\|'IG'] | Unlink profiles |
| `migrateBlocklistLid(jids, dhash?, dirtyAck?)` | JIDs, hash, bool | Migrate blocklist to LID |
| `qrCodeScan(qrData)` | QR string | Scan companion QR code |
| `contactIntegrityQuery(jids, useCase?)` | JIDs, use case | Verify JIDs before chat |
| `bizIntegrityQuery(jids)` | JIDs | Verify business JIDs |
| `fetchMobileConfig(apiVersion?, epRefreshId?, flags?)` | ints, string | Fetch mobile config |
| `notifyPushName(groupJid, participants)` | JID, list | Broadcast push name |
