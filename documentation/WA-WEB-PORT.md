# WhatsApp-Web Protocol Port

Operations and stanza handlers reverse-engineered from **captured WhatsApp Web
traffic** and WA Web's own module catalog, then ported to this library. Every
item below maps to a real WA Web `WASmax*RPC` operation or a top-level stanza
seen on the wire.

> ⚠️ These are derived from captures and verified for **wire shape**, not yet
> round-tripped against live WhatsApp in every case. Treat the niche ones as
> "should work, verify on a live session".

---

## USync: Feature protocol

Query which features a device supports (`document`, `encrypt*`, `voip`,
`multi_agent`, …) via the standard USync mechanism.

```js
const { USyncQuery, USyncUser } = require('baron-baileys-v2/src/WAUSync')
const { USyncFeatureProtocol } = require('baron-baileys-v2/src/WAUSync/Protocols/USyncFeatureProtocol')

const query = new USyncQuery().withUser(new USyncUser().withId('49123456789@s.whatsapp.net'))
query.protocols.push(new USyncFeatureProtocol(['encrypt', 'voip'])) // or default = all features

const result = await sock.executeUSyncQuery(query)
// result.list[i].feature -> { encrypt: '2', voip: '1' }
```

---

## Privacy & account

```js
// Global "block messages from unknown accounts" toggle (xmlns w:comms:chat)
const status = await sock.getChatBlockingStatus() // 'blocked' | 'unblocked'
await sock.updateChatBlockingStatus('block') // or 'unblock'

// Pending TOS disclosures / notices (xmlns tos)
const notices = await sock.getUserDisclosures() // [{ t, version, type, ... }]
await sock.acceptTosNotice(noticeId) // result defaults to '105' (accept)
await sock.acceptTosNotice(noticeId, '155') // explicit result code

// Feature opt-out list
const optOut = await sock.getOptOutList()

// Push-notification settings (mainly web push)
const push = await sock.getPushConfig()
await sock.setPushConfig({ platform: 'web', endpoint, auth, p256dh })

// Spam reporting (xmlns spam)
await sock.reportSpam(jid, messages, spamFlow, subject)
// messages: [{ t, id }]  spamFlow defaults to 'contact_info_report'
```

---

## Business

```js
// Linked Facebook/Instagram accounts (WhatsApp-as-a-page)
const linked = await sock.getLinkedAccounts() // { pageInfo, linkState, node }

// Marketing-message / meta-verified / genai eligibility
const elig = await sock.getBusinessEligibility({ metaVerified: 1, marketingMessages: 1 })
// -> { status: 'success' | 'fail', ... }
```

---

## Groups & communities

```js
await sock.groupAcknowledge(groupJid) // <ack/>

// participants of a community's linked/sub groups
const linkedParts = await sock.groupGetLinkedParticipants(communityJid) // [{ jid, phoneNumber? }]

// join a community sub-group (may raise a membership-approval request)
const { approvalRequested } = await sock.groupJoinLinked(communityJid, subGroupJid)

// batch-fetch group profile pictures (single group? prefer profilePictureUrl)
const pics = await sock.getGroupProfilePictures([g1, g2], 'preview')

// sub-group suggestions
await sock.groupCreateSubGroupSuggestion(communityJid, suggestionNodes)
await sock.groupSubGroupSuggestionsAction(communityJid, 'approve', [{ creator, jid }])
```

### New group-metadata fields

`groupMetadata(jid)` now also returns the WA Web group-sharing settings:

| Field                    | Source tag                          | Values                              |
| ------------------------ | ----------------------------------- | ----------------------------------- |
| `memberShareHistoryMode` | `<member_share_group_history_mode>` | `all_member_share` \| `admin_share` |
| `memberLinkMode`         | `<member_link_mode>`                | `admin_link` \| `all_member_link`   |
| `limitSharing`           | `<limit_sharing_enabled>`           | `boolean` (presence flag)           |

---

## Calls

```js
// existing: createCallLink — now also toggle the link's waiting room
await sock.toggleCallLinkWaitingRoom(linkToken, true /* enabled */, 'audio')
```

### Top-level call signalling (incoming)

Some accounts receive call signalling as **top-level** stanzas (`<offer>`,
`<terminate>`, `<mute_v2>`, `<transport>`, … each carrying a `call-id`) instead
of wrapped in `<call>`. The library now additively routes these: it emits the
usual `call` event for state stanzas (`offer`/`terminate`/`accept`/`reject`/
`preaccept`) and acks all of them so WhatsApp doesn't redeliver. The existing
`<call>` path is unchanged.

```js
sock.ev.on('call', calls => {
	for (const c of calls) console.log(c.status, c.from, c.id) // works for both wrappings
})
```

---

## Mex notifications

`notification type="mex"` carries **XWA2 property updates** for groups and newsletters.
Each stanza has one or more `<update op_name="...">` children whose content is JSON.

### Newsletter events (from mex)

| Op name                                   | Event emitted                    | Key payload fields                                 |
| ----------------------------------------- | -------------------------------- | -------------------------------------------------- |
| `NotificationNewsletterJoin`              | `newsletter-participants.update` | `{ id, action:'join', new_role, metadata }`        |
| `NotificationNewsletterMuteChange`        | `newsletter-settings.update`     | `{ id, update: { mute: 'ON'\|'OFF' } }`            |
| `NotificationNewsletterUserSettingChange` | `newsletter-settings.update`     | `{ id, update: { userSetting: { type, value } } }` |
| `NotificationNewsletterUpdate`            | `newsletter-settings.update`     | `{ id, update: thread_metadata.settings }`         |

### Group property events (from mex)

These are pushed when an admin changes a group property via the community settings UI.

| Op name                                                      | Event emitted   | Payload field changed    |
| ------------------------------------------------------------ | --------------- | ------------------------ |
| `NotificationGroupMemberLinkPropertyUpdate`                  | `groups.update` | `memberAddMode`          |
| `NotificationGroupLimitSharingPropertyUpdate`                | `groups.update` | `limitSharing`           |
| `NotificationGroupMemberShareGroupHistoryModePropertyUpdate` | `groups.update` | `memberShareHistoryMode` |

```js
sock.ev.on('groups.update', updates => {
	for (const u of updates) {
		if (u.memberAddMode) console.log(u.id, 'link mode ->', u.memberAddMode)
		if (u.limitSharing !== undefined) console.log(u.id, 'limit sharing ->', u.limitSharing)
		if (u.memberShareHistoryMode) console.log(u.id, 'history mode ->', u.memberShareHistoryMode)
	}
})
```

---

## Newsletter live updates

`notification type="newsletter"` with a `<live_updates>` child carries per-message
engagement data (reactions and forwards), not a single view count. The `newsletter.live-update`
event now reflects the actual wire format:

```js
sock.ev.on('newsletter.live-update', u => {
	// u.id         - newsletter JID
	// u.server_id  - message server_id
	// u.timestamp  - update timestamp (seconds)
	// u.forwardsCount - number of forwards (may be undefined)
	// u.reactions  - [{ code: '❤️', count: 46 }, ...]
	console.log(u.server_id, u.reactions)
})
```

---

## Account events

### Dirty flag (`account.dirty`)

Server signals that account data changed and a full resync may be needed.
A `notification` stanza with the same type follows shortly after.

```js
sock.ev.on('account.dirty', ({ type, timestamp }) => {
	// type: 'account_sync' | 'regular_high' | ...
	console.log('dirty:', type, timestamp)
})
```

### Device list sync (`account.devices-synced`)

Sent when a linked device is added, removed, or its key index changes.
Contains the **complete** device list (not just the delta) plus a signed
key-index-list blob.

```js
sock.ev.on('account.devices-synced', ev => {
	// ev.dhash            - device list hash ("2:xxxxxxxx")
	// ev.devices          - [{ jid, keyIndex? }]
	// ev.keyIndexList     - Buffer (ADVSignedKeyIndexList protobuf)
	// ev.keyIndexListTimestamp - unix seconds
	console.log('devices now:', ev.devices.length, ev.dhash)
})
```

---

## New events (summary)

| Event                            | When                                                                                    | Payload                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `business.privacy-settings-sync` | server pushes SMB privacy/data-sharing sync (`<notification type="business"><privacy>`) | `{ jid, categories, attrs }`                                                         |
| `coexistence.update`             | WA ⇄ Messenger/Instagram onboarding/offboarding push (`<notification type="hosted">`)   | `{ jid, kind: 'onboarding' \| 'offboarding', status?, productSurface? }`             |
| `account.dirty`                  | server flags that account data changed (`<ib><dirty>`)                                  | `{ type, timestamp? }`                                                               |
| `account.devices-synced`         | linked device added/removed or key index changed (`<notification type="account_sync">`) | `{ dhash, devices, keyIndexList?, keyIndexListTimestamp? }`                          |
| `newsletter-participants.update` | subscribed to a newsletter (mex `NotificationNewsletterJoin`)                           | `{ id, action:'join', new_role, metadata }`                                          |
| `newsletter-settings.update`     | newsletter muted/unmuted or user setting changed (mex)                                  | `{ id, update: { mute? } \| { userSetting? } \| settings }`                          |
| `newsletter.live-update`         | newsletter message engagement pushed (`<notification type="newsletter"><live_updates>`) | `{ id, server_id, timestamp?, forwardsCount?, reactions: [{code, count}] }`          |
| `groups.update`                  | group member-link or limit-sharing setting changed via mex                              | `[{ id, memberAddMode? }]` or `[{ id, limitSharing? }]`                              |
| `devices.update`                 | another account's linked device added or removed (`<notification type="devices">`)      | `{ id, devices: [{jid?, lid?, keyIndex?, platform?, isCompanion?}], isSelf, added }` |

```js
sock.ev.on('account.dirty', ({ type }) => console.log('dirty:', type))
sock.ev.on('account.devices-synced', ev => console.log('devices:', ev.devices.length))
sock.ev.on('coexistence.update', u => console.log(u.kind, u.status))
sock.ev.on('business.privacy-settings-sync', s => console.log(s.categories))
```

---

## Poll votes (automatic)

`pollUpdateMessage` is now decrypted automatically inside the library — no standalone
helper needed. When a user votes on a poll, the library emits `messages.update` with
the decrypted vote attached:

```js
sock.ev.on('messages.update', updates => {
	for (const { key, update } of updates) {
		if (update.pollUpdates) {
			for (const pu of update.pollUpdates) {
				// pu.vote.selectedOptions — array of SHA-256 hashes of chosen option names
				console.log('vote on poll', key.id, 'options:', pu.vote.selectedOptions)
			}
		}
	}
})
```

The library uses the bot's LID as `pollCreatorJid` (with PN fallback for accounts
without LID), and `message.key.participant || message.key.remoteJid` as `voterJid` —
so both LID and PN addressed votes decrypt correctly. `messageSecret` is found even
when the creation message is wrapped in `viewOnceMessage` or `botInvokeMessage`.

`getMessage` must be provided in the socket config and must return the stored
`proto.Message` for the creation key (standard baileys setup already does this).

---

## Tests

See [`test/wa-web-protocol-port.test.js`](../test/wa-web-protocol-port.test.js)
(`USyncFeatureProtocol`, group-settings extraction, and IQ/call wire-shape locks).
