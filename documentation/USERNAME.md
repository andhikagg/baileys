# WhatsApp Username Support

Baron-Baileys-v2 implements the full WhatsApp username protocol, reverse-engineered from WhatsApp 2.26.17.2 (Java decompilation of `C1568872p.java`, `C164057Wg.java`, `MexUsernamePinProtocolApi.java`) and updated with live traffic captured from WA 2.26.26.4 using `wa-logger-2.26.26.4.js`.

## How Usernames Work in WhatsApp

WhatsApp usernames (`@username`) are optional profile identifiers. They allow users to be found without sharing a phone number. The protocol uses two layers:

- **`w:mex`** (GraphQL over IQ) — for managing your own username (check, set, delete, PIN)
- **USync** — for looking up contacts by username or fetching a contact's username

---

## Query IDs (WA 2.26.26.4 — live-captured)

Username operations use numeric `query_id` values embedded in MEX IQ stanzas. The IDs below were captured from a live WA 2.26.26.4 session using `wa-logger-2.26.26.4.js` while going through Settings → Profile → Username.

```js
const USERNAME_QUERY_IDS = {
    CHECK:   '26124072630599518',  // UsernameCheck — availability + suggestions
    RESERVE: '27108705368767936',  // UsernameReserve — confirm/set username
    GET:     '32618050064506055',  // GetMyUsername — fetch own username (empty variables)
    PIN:     '25529696019976770',  // UsernamePinSet/Delete/Verify
    LOOKUP:  '25975613018777537',  // User lookup by JID (interactive search)
    PROFILE: '25741205615468935',  // User profile fetch by JID with last_update_time
}
```

**To re-capture for a new WA version:**

1. Run `wa-logger-2.26.26.4.js` on a rooted device with Frida
2. Open WA → Settings → Profile → Username
3. Type a username and check / confirm it
4. Search the log for `xmlns="w:mex"` — the `query_id` attribute and JSON body are both visible

---

## Username Flow (two-step with shared session_id)

Step 1 — availability check:
```xml
<iq to="s.whatsapp.net" xmlns="w:mex" type="get" id="032">
  <query query_id="26124072630599518">{"queryId":"26124072630599518","variables":{"include_suggestions":false,"session_id":"aa2b42c1-f505-4e0b-9afd-ba4068136369","source":"USER_INPUT","username":"myname"}}</query>
</iq>
```

Step 2 — reserve/set (same `session_id`):
```xml
<iq to="s.whatsapp.net" xmlns="w:mex" type="get" id="033">
  <query query_id="27108705368767936">{"queryId":"27108705368767936","variables":{"reserved":true,"session_id":"aa2b42c1-f505-4e0b-9afd-ba4068136369","source":"USER_INPUT","username":"myname"}}</query>
</iq>
```

The `session_id` (UUID v4) is generated fresh per username attempt and links both steps. `reserved: true` is sent by the client in the reserve step.

---

## API Reference

### `checkUsername(username, includeSuggestions?)`

Check whether a username is available before setting it.

```js
const result = await sock.checkUsername('myusername')

if (result.available) {
    console.log(`@${result.username} is available!`)
} else {
    console.log(`@${result.username} is taken`)
    console.log('Suggestions:', result.suggestions)
    // ['myusername1', 'myusername_2', ...]

    console.log('Rejection reasons:', result.rejectionReasons)
    // e.g. ['REQUIRE_FB_ACCOUNT_LINKING']

    console.log('Can get suggestions:', result.suggestionsEligible)
}

// Skip suggestions (faster check)
const quick = await sock.checkUsername('myusername', false)
```

**Returns:**

| Field | Type | Description |
|---|---|---|
| `available` | boolean | Whether the username is free |
| `username` | string | The username that was checked |
| `suggestions` | string[] | Alternatives if taken (only when `available=false`) |
| `rejectionReasons` | string[] | Why it was rejected (only when `available=false`) |
| `suggestionsEligible` | boolean | Whether suggestions can be shown |

---

### `setUsername(username, options?)`

Set your WhatsApp username.

```js
// Simple set
await sock.setUsername('myusername')

// With source tracking
await sock.setUsername('myusername', {
    source: sock.USERNAME_SOURCE.USER_INPUT  // default
})

// From a suggestion the server offered
await sock.setUsername('myusername1', {
    source: sock.USERNAME_SOURCE.SUGGESTION
})

// With a PIN to protect it
await sock.setUsername('myusername', {
    pin: '1234'
})
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `source` | string | `'USER_INPUT'` | Origin: `'USER_INPUT'`, `'SUGGESTION'`, `'FB'`, `'IG'` |
| `sessionId` | string | auto-generated UUID | Links check + reserve steps |
| `pin` | string | — | PIN to protect the username |

**Recommended flow (check before set):**
```js
const check = await sock.checkUsername('myusername')

if (!check.available) {
    console.log('Try one of these:', check.suggestions)
    return
}

await sock.setUsername('myusername')
console.log('Username set!')
```

---

### `deleteUsername()`

Remove your username entirely.

```js
await sock.deleteUsername()
console.log('Username removed')
```

> Internally sends `username: null` — confirmed from `C1568872p.java:24`:
> `str4 = str == null ? "delete" : "set"`

---

### `getMyUsername()`

Get your own current username.

```js
const username = await sock.getMyUsername()

if (username) {
    console.log('My username:', username)
    // 'myusername'
} else {
    console.log('No username set')
}
```

---

### `setUsernamePin(pin)`

Set a PIN that protects your username. People who want to start a chat with you via username must enter this PIN.

```js
// Set a PIN
await sock.setUsernamePin('1234')

// Delete the PIN (pass null)
await sock.setUsernamePin(null)
```

PIN stanza (live-captured):

```xml
<query query_id="25529696019976770">{"queryId":"25529696019976770","variables":{"pin":"7601"}}</query>
```

---

### `findUserByUsername(username, pin?)`

Look up a WhatsApp user by their `@username`. Returns their JID so you can message them.

```js
// Find without PIN
const user = await sock.findUserByUsername('theirusername')

if (!user || !user.contact) {
    console.log('User not found or not on WhatsApp')
} else {
    console.log('JID:', user.jid)
    // e.g. '491234567890@s.whatsapp.net'
    await sock.sendMessage(user.jid, { text: 'Hey!' })
}

// Find a PIN-protected username
const user2 = await sock.findUserByUsername('privateuser', '1234')
```

**Returns:**

| Field | Type | Description |
|---|---|---|
| `jid` | string | The user's WhatsApp JID |
| `contact` | boolean | Whether they are on WhatsApp |

---

### `fetchContactUsernames(...jids)`

Fetch the username of one or more contacts by their JID. Uses USync protocol.

```js
// Single contact
const results = await sock.fetchContactUsernames('491234567890@s.whatsapp.net')
console.log(results[0].username) // 'theirusername' or null

// Multiple contacts
const results2 = await sock.fetchContactUsernames(
    '491234567890@s.whatsapp.net',
    '491987654321@s.whatsapp.net'
)

for (const entry of results2) {
    console.log(entry.id, '→', entry.username ?? '(no username)')
}
```

---

## Constants

```js
// Check result values (from EnumC141106Vn in APK)
sock.USERNAME_CHECK_RESULT.SUCCESS  // 'SUCCESS'
sock.USERNAME_CHECK_RESULT.INVALID  // 'INVALID'

// Username source values (from C1568872p.java)
sock.USERNAME_SOURCE.USER_INPUT  // 'USER_INPUT'
sock.USERNAME_SOURCE.SUGGESTION  // 'SUGGESTION'
sock.USERNAME_SOURCE.FB          // 'FB'
sock.USERNAME_SOURCE.IG          // 'IG'
```

---

## Complete Example

```js
const makeWASocket = require('./src').default
const { useMultiFileAuthState } = require('./src')

async function main() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const sock = makeWASocket({ auth: state })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async ({ connection }) => {
        if (connection !== 'open') return

        // --- Set your own username ---
        const desired = 'mycoolname'

        const check = await sock.checkUsername(desired)
        if (!check.available) {
            console.log('Taken! Suggestions:', check.suggestions)
            return
        }

        await sock.setUsername(desired)
        console.log('Username set to @' + desired)

        // Optionally protect it with a PIN
        await sock.setUsernamePin('9876')

        // --- Get your username back ---
        const mine = await sock.getMyUsername()
        console.log('My username:', mine) // 'mycoolname'

        // --- Find someone by their username ---
        const found = await sock.findUserByUsername('friendsusername')
        if (found?.contact) {
            await sock.sendMessage(found.jid, {
                text: 'Found you via your username!'
            })
        }

        // --- Fetch usernames of your contacts ---
        const usernames = await sock.fetchContactUsernames(
            '491234567890@s.whatsapp.net',
            '491987654321@s.whatsapp.net'
        )
        for (const u of usernames) {
            console.log(u.id, '→', u.username ?? '(none)')
        }
    })
}

main()
```

---

## Protocol Details

### w:mex stanza shape

```xml
<iq to="s.whatsapp.net" xmlns="w:mex" type="get" id="...">
  <query query_id="XXXXXXXXXXXXXXXXX">
    {"queryId":"XXXXXXXXXXXXXXXXX","variables":{...}}
  </query>
</iq>
```

All MEX operations (queries and mutations) use `type="get"` on the IQ wrapper. The `query_id` in the `<query>` attribute and in the JSON body must match.

### UsernameCheck response

```json
{
  "data": {
    "xwa2_username_check": {
      "result": "SUCCESS",
      "suggestions": [],
      "rejection_reasons": [],
      "suggestions_eligible": true
    }
  }
}
```

### UsernameCheck variables (`query_id: 26124072630599518`)

| Variable | Type | Notes |
|---|---|---|
| `username` | string | Username to check |
| `include_suggestions` | boolean | Whether to return suggestions if taken |
| `session_id` | string | UUID v4, same value must be used in reserve step |
| `source` | string | `USER_INPUT`, `SUGGESTION`, `FB`, `IG` |

### UsernameReserve variables (`query_id: 27108705368767936`)

| Variable | Type | Notes |
|---|---|---|
| `username` | string | Username to reserve |
| `reserved` | boolean | Always `true` from client |
| `session_id` | string | Same UUID as the check step |
| `source` | string | `USER_INPUT`, `SUGGESTION`, `FB`, `IG` |

### GetMyUsername (`query_id: 32618050064506055`)

Empty variables `{}`. Used both as polling heartbeat and to fetch current username.

### UsernamePinSet variables (`query_id: 25529696019976770`)

| Variable | Type   | Notes                |
|----------|--------|----------------------|
| `pin`    | string | 4-digit PIN to set   |

Pass empty variables `{}` to delete the PIN (live-captured: `{"queryId":"25529696019976770","variables":{}}`).

### USync username lookup (findUserByUsername)

```xml
<iq xmlns="usync" to="s.whatsapp.net" type="get">
  <usync mode="query" context="interactive">
    <list>
      <user>
        <contact username="theirusername" pin="1234"/>
      </user>
    </list>
    <query>
      <contact/>
    </query>
  </usync>
</iq>
```

---

## Source Files

### WhatsApp 2.26.17.2 APK (decompilation)

| File | Role |
|---|---|
| `X/C1568872p.java` | Main username protocol handler — Check, Set, Get |
| `X/C164057Wg.java` | Response parsing — confirms `xwa2_username_check` data path |
| `X/C1363364t.java` | UsernameCheck GraphQL response wrapper |
| `X/C1363864y.java` | UsernameSet GraphQL response wrapper |
| `X/C1363664w.java` | UsernameGet GraphQL response wrapper |
| `com/.../MexUsernamePinProtocolApi.java` | PIN set/delete — operation `UsernamePinSet` |
| `X/EnumC141106Vn.java` | Check result enum: SUCCESS, INVALID |
| `X/EnumC141056Vi.java` | Rejection reasons enum |

### WA 2.26.26.4 — live traffic capture

Captured with `tools/wa-logger-2.26.26.4.js` (Frida 17.x, ONEPLUS A6003).

All query_id values above confirmed from real device session on 2026-06-30.
