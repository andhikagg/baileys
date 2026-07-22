# Communities & AI Groups (`src/Socket/communities.js`, `src/Socket/aigroups.js`)

---

## Communities

WhatsApp Communities are top-level organizations that contain multiple linked groups (sub-groups). They have their own IQ namespace (`w:g2`) like groups but with community-specific tags.

### Fetch community metadata

```js
const meta = await sock.communityMetadata('120363000000000000@g.us')
// Returns: id, subject, owner, desc, descId, participants, linkedParent,
//          restrict, announce, isCommunity, joinApprovalMode, memberAddMode,
//          ephemeralDuration, creation, size, addressingMode
```

### Create a community

```js
const community = await sock.communityCreate(
    'Community Name',
    'Description of this community'
)
// Automatically creates a general chat sub-group
```

### Create a sub-group inside a community

```js
const subgroup = await sock.communityCreateGroup(
    'Sub-Group Name',
    ['491234567890@s.whatsapp.net'],  // initial participants
    '120363000000000000@g.us'         // parent community JID
)
```

### Invite links

```js
// Get invite code
const code = await sock.communityInviteCode('120363000000000000@g.us')
// → 'AbCdEfGhIjKlMnOp'

// Revoke and regenerate invite
const newCode = await sock.communityRevokeInvite('120363000000000000@g.us')

// Join by code
const jid = await sock.communityAcceptInvite('AbCdEfGhIjKlMnOp')

// Get info before joining (preview)
const info = await sock.communityGetInviteInfo('AbCdEfGhIjKlMnOp')

// Accept a CommunityInviteMessage (v4 invite)
await sock.communityAcceptInviteV4(
    { remoteJid: senderJid, id: messageId },
    msg.message.groupInviteMessage
)

// Revoke a v4 invite for a specific person
await sock.communityRevokeInviteV4(
    '120363000000000000@g.us',
    '491234567890@s.whatsapp.net'
)
```

### Link / unlink sub-groups

```js
// Add an existing group to a community
await sock.communityLinkGroup(
    '120363000000000001@g.us',  // group to add
    '120363000000000000@g.us'   // parent community
)

// Remove a group from a community
await sock.communityUnlinkGroup(
    '120363000000000001@g.us',
    '120363000000000000@g.us'
)

// Get all sub-groups of a community (or community of a sub-group)
const result = await sock.communityFetchLinkedGroups('120363000000000000@g.us')
// Returns: { communityJid, isCommunity, linkedGroups: [{ id, subject, creation, owner, size }] }
```

### Manage participants

```js
// Add participants to community
await sock.communityParticipantsUpdate(
    '120363000000000000@g.us',
    ['491234567890@s.whatsapp.net'],
    'add'
)

// Remove participants (also removes from linked groups)
await sock.communityParticipantsUpdate(jid, participants, 'remove')

// Promote to admin
await sock.communityParticipantsUpdate(jid, participants, 'promote')

// Demote admin
await sock.communityParticipantsUpdate(jid, participants, 'demote')
```

### Join approval (membership requests)

```js
// Enable join approval mode
await sock.communityJoinApprovalMode('120363000000000000@g.us', 'on')
await sock.communityJoinApprovalMode('120363000000000000@g.us', 'off')

// List pending requests
const requests = await sock.communityRequestParticipantsList('120363000000000000@g.us')
// Returns: [{ jid, t (timestamp), method }]

// Approve or reject
await sock.communityRequestParticipantsUpdate(
    '120363000000000000@g.us',
    ['491234567890@s.whatsapp.net'],
    'approve'
)
await sock.communityRequestParticipantsUpdate(jid, participants, 'reject')
```

### Update community info

```js
// Change subject
await sock.communityUpdateSubject('120363000000000000@g.us', 'New Name')

// Change description
await sock.communityUpdateDescription('120363000000000000@g.us', 'New description')
await sock.communityUpdateDescription('120363000000000000@g.us', null) // delete

// Update profile picture
await sock.communityUpdatePicture('120363000000000000@g.us', imageBuffer)

// Remove profile picture
await sock.communityRemovePicture('120363000000000000@g.us')

// Change settings (announce-only, lock, etc.)
await sock.communitySettingUpdate('120363000000000000@g.us', 'announcement')  // admin-only posts
await sock.communitySettingUpdate('120363000000000000@g.us', 'not_announcement')

// Member add mode
await sock.communityMemberAddMode('120363000000000000@g.us', 'all_member_add')
await sock.communityMemberAddMode('120363000000000000@g.us', 'admin_add')

// Ephemeral messages
await sock.communityToggleEphemeral('120363000000000000@g.us', 86400)  // 24h
await sock.communityToggleEphemeral('120363000000000000@g.us', 0)      // off
```

### Leave / deactivate

```js
// Leave a community
await sock.communityLeave('120363000000000000@g.us')

// Deactivate / delete a community (admin only)
await sock.communityDeactivate('120363000000000000@g.us')
```

### MEX queries (JSON responses)

```js
// Total participant count of a community
const count = await sock.communityParticipantCount('120363000000000000@g.us')

// Sub-groups via MEX (richer data than IQ)
const subgroups = await sock.communitySubgroupsMex('120363000000000000@g.us')

// Participant count of a specific sub-group
const subCount = await sock.communitySubgroupParticipantCount('120363000000000001@g.us')

// Transfer community ownership
await sock.communityTransferOwnershipMex(
    '120363000000000000@g.us',  // community JID
    '491234567890@s.whatsapp.net' // new owner JID
)
```

### Fetch all joined communities

```js
const communities = await sock.communityFetchAllParticipating()
// Returns: { [jid]: communityMetadata }
// Also emits groups.update event
```

---

## AI Groups

AI Groups are WhatsApp groups with an AI bot participant. They use the same `w:g2` IQ namespace with additional AI-specific operations.

### Create an AI group

```js
const meta = await sock.aiGroupCreate(
    'AI Group Name',
    ['491234567890@s.whatsapp.net'], // human participants
    {
        ephemeralExpiration: 86400,           // 24h disappearing
        memberAddMode: 'all_member_add',
        memberShareGroupHistoryMode: 'all_member_share',
        memberLinkMode: 'all_member_link'
    }
)
```

### Get AI group metadata

```js
const meta = await sock.aiGroupMetadata('120363000000000000@g.us')
// Returns standard group metadata + isAIGroup: true
```

### Add a bot to the group

```js
// Default Meta AI bot: 867051314767696@bot
const result = await sock.aiGroupAddBot(
    '120363000000000000@g.us',
    '867051314767696' // bot user ID (without @bot)
)
// Returns: [{ status: '200'|error, jid }]
```

### Participants

```js
// Add/remove/promote/demote human participants
const result = await sock.aiGroupParticipantsUpdate(
    '120363000000000000@g.us',
    ['491234567890@s.whatsapp.net'],
    'add'    // 'add' | 'remove' | 'promote' | 'demote'
)

// Leave an AI group
await sock.aiGroupLeave('120363000000000000@g.us')
```

### Group info / settings

```js
// Change subject
await sock.aiGroupUpdateSubject('120363000000000000@g.us', 'New Subject')

// Change settings
await sock.aiGroupSettingUpdate('120363000000000000@g.us', 'announcement')

// Toggle ephemeral
await sock.aiGroupToggleEphemeral('120363000000000000@g.us', 86400)
await sock.aiGroupToggleEphemeral('120363000000000000@g.us', 0) // off
```

### Invite links

```js
// Get invite code
const code = await sock.aiGroupInviteCode('120363000000000000@g.us')

// Revoke and regenerate
const newCode = await sock.aiGroupRevokeInvite('120363000000000000@g.us')

// Join by code
const jid = await sock.aiGroupAcceptInvite('AbCdEfGhIjKlMnOp')
```

---

## Community vs Group vs AI Group

| Feature | Group | Community | AI Group |
|---------|-------|-----------|----------|
| IQ namespace | `w:g2` | `w:g2` | `w:g2` |
| JID suffix | `@g.us` | `@g.us` | `@g.us` |
| Has AI bot | No | No | Yes |
| Can have sub-groups | No | Yes | No |
| Join approval mode | Yes | Yes | No |
| `isAIGroup` flag | No | No | Yes |
| `isCommunity` flag | No | Yes | No |

---

## Full Method Reference — Communities

| Method | What it does |
|--------|-------------|
| `communityMetadata(jid)` | Get community info |
| `communityCreate(subject, body)` | Create new community |
| `communityCreateGroup(subject, participants, parentJid)` | Create sub-group |
| `communityLeave(id)` | Leave community |
| `communityDeactivate(jid)` | Delete/deactivate community |
| `communityUpdateSubject(jid, subject)` | Change name |
| `communityUpdateDescription(jid, description)` | Change description |
| `communityUpdatePicture(jid, content)` | Set profile picture |
| `communityRemovePicture(jid)` | Remove profile picture |
| `communitySettingUpdate(jid, setting)` | Toggle settings |
| `communityMemberAddMode(jid, mode)` | Who can add members |
| `communityJoinApprovalMode(jid, mode)` | Enable/disable approval |
| `communityLinkGroup(groupJid, parentJid)` | Add group to community |
| `communityUnlinkGroup(groupJid, parentJid)` | Remove group from community |
| `communityFetchLinkedGroups(jid)` | List sub-groups |
| `communityParticipantsUpdate(jid, participants, action)` | Add/remove/promote/demote |
| `communityRequestParticipantsList(jid)` | List pending join requests |
| `communityRequestParticipantsUpdate(jid, participants, action)` | Approve/reject requests |
| `communityInviteCode(jid)` | Get invite link code |
| `communityRevokeInvite(jid)` | Reset invite link |
| `communityAcceptInvite(code)` | Join by invite code |
| `communityAcceptInviteV4(key, inviteMessage)` | Accept invite message |
| `communityRevokeInviteV4(jid, invitedJid)` | Revoke v4 invite |
| `communityGetInviteInfo(code)` | Preview community before joining |
| `communityToggleEphemeral(jid, expiration)` | Set disappearing messages |
| `communityFetchAllParticipating()` | List all joined communities |
| `communityParticipantCount(jid)` | Total member count (MEX) |
| `communitySubgroupsMex(jid)` | Sub-groups list (MEX) |
| `communitySubgroupParticipantCount(subgroupJid)` | Sub-group member count (MEX) |
| `communityTransferOwnershipMex(jid, newOwnerJid)` | Transfer ownership (MEX) |

## Full Method Reference — AI Groups

| Method | What it does |
|--------|-------------|
| `aiGroupMetadata(jid)` | Get AI group info |
| `aiGroupCreate(subject, participants?, options?)` | Create AI group |
| `aiGroupAddBot(jid, botUser?)` | Add bot participant |
| `aiGroupLeave(id)` | Leave AI group |
| `aiGroupParticipantsUpdate(jid, participants, action)` | Add/remove/promote/demote |
| `aiGroupUpdateSubject(jid, subject)` | Change subject |
| `aiGroupSettingUpdate(jid, setting)` | Toggle settings |
| `aiGroupToggleEphemeral(jid, expiration)` | Disappearing messages |
| `aiGroupInviteCode(jid)` | Get invite code |
| `aiGroupRevokeInvite(jid)` | Reset invite code |
| `aiGroupAcceptInvite(code)` | Join by invite code |
