# WhatsApp Ban & Enforcement System

How WhatsApp detects and enforces bans, extracted from APK sources. Use this to avoid triggering restrictions and to handle enforcement events.

---

## Overview

WhatsApp runs several independent enforcement systems:

| System                 | Trigger                               | Effect                                            |
| ---------------------- | ------------------------------------- | ------------------------------------------------- |
| Account ban            | Policy violation detected server-side | Account permanently or temporarily suspended      |
| Spam warning           | Suspicious sending behavior           | Warning screen with countdown timer               |
| Reachout timelock      | Too many new-chat initiations         | Timed cooldown on starting new conversations      |
| Message capping        | Over-limit bulk messaging             | OTE request, send throttling                      |
| Heavy sender quota     | Broadcast list quota exceeded         | Broadcast list disabled until reset               |
| Gap enforcement        | Viewport-based content rules          | Chat-level content restrictions                   |
| Newsletter enforcement | Channel policy violations             | Channel suspension, geo-suspension, post deletion |

---

## Account Ban

### How bans are detected

Bans appear in HTTP responses from WhatsApp's registration and session endpoints. The client parses these fields from the JSON response body:

```json
{
  "violation_type": "spam",
  "violated_policy": "TERMS_OF_SERVICE",
  "violation_reason": "Sending unsolicited messages",
  "appeal_token": "WA|...",
  "source_acct": 1,
  "is_eu_smb": false,
  "version_upgrade": { ... },
  "custom_block_screen": { ... }
}
```

**Field reference:**

| Field                 | Type   | Meaning                                                     |
| --------------------- | ------ | ----------------------------------------------------------- |
| `violation_type`      | string | Category of violation (e.g. `"spam"`, `"automation"`)       |
| `violated_policy`     | string | The specific policy that was violated                       |
| `violation_reason`    | string | Human-readable explanation                                  |
| `appeal_token`        | string | `WA\|...` token used to submit the appeal                   |
| `source_acct`         | int    | Account source type (`-1` = unknown)                        |
| `is_eu_smb`           | bool   | Whether EU Small Business rules apply (affects appeal flow) |
| `version_upgrade`     | object | Present if ban is due to using an outdated app version      |
| `custom_block_screen` | object | Custom block screen data from WhatsApp's backend            |

The ban info is parsed in `KotlinRegistrationBridge` across multiple response handlers (`parseRegisterPhoneResponse`, `parseSameDeviceCheckResponse`, and others).

### Ban UI flow (from APK)

The ban system routes through `BanAppealActivity`, which hosts 7 screen states:

```
State 1 → BanInfoFragment         (initial ban screen — "your account has been banned")
State 2 → BanAppealFormFragment    (submit appeal form)
State 3 → BanAppealFormSubmitted   (appeal submitted confirmation)
State 4 → BanAppealUnbanned        (appeal approved — account restored)
State 5 → BanAppealBanned          (appeal rejected — account remains banned)
State 6 → BanAppealGuidanceFragment (education: what to do)
State 7 → BanAppealResponsibleUse  (responsible use guidelines)
```

The v2 flow (modern) uses `BanInfoFragment`, `BanAppealFormFragment`, etc.  
The legacy flow uses `LegacyBanInfoFragment`, `LegacyBanAppealFormFragment`, etc.

State `IN_REVIEW` is a special intermediate state shown while WhatsApp reviews the appeal.

### Appeal token in the library

Use `createEnforcementAppeal` to submit an appeal programmatically:

```js
// If you receive an appeal_token from the server, you can submit an appeal:
await sock.createEnforcementAppeal('false_positive', 'This account was incorrectly flagged')
```

The `appeal_token` from the ban response is the token used internally — it is passed as `appeal_request_token` in the intent extras to `BanAppealActivity`.

---

## Spam Warning

### What it is

A temporary warning screen with a countdown timer (not a permanent ban). The user can still use WhatsApp after dismissal.

### Trigger codes

From `SpamWarningActivity`, the warning reason is passed as an integer:

| Code | Meaning                        |
| ---- | ------------------------------ |
| 101  | General spam warning (type 1)  |
| 102  | General spam warning (type 2)  |
| 103  | General spam warning (type 3)  |
| 104  | General spam warning (type 4)  |
| 105  | Generic spam warning (default) |
| 106  | General spam warning (type 5)  |

### Key fields in the warning intent

```
spam_warning_reason_key   → int: reason code (see table above)
expiry_in_seconds         → int: how long the warning is shown (-1 = unknown/permanent)
spam_warning_message_key  → string: custom message text (server-defined)
faq_url_key               → string: URL to the WhatsApp spam FAQ
```

When `expiry_in_seconds != -1`, the APK shows a circular countdown progress bar. When the timer expires, the warning is dismissed automatically.

When `expiry_in_seconds == -1` (unknown expiry) and the user is in a special state (e.g. `A05 == 1`), the warning exits immediately with a redirect.

---

## Reachout Timelock (Error 463)

### What it is

A timed cooldown that prevents initiating new conversations. This is separate from a ban — the account still works, but the user cannot start new chats until the timelock expires.

### Timelock types

From `ReachoutTimelockInfoBottomSheet`, there are 20+ distinct timelock types (integer codes):

| Code range | Description                                                        |
| ---------- | ------------------------------------------------------------------ |
| 1          | Standard reachout timelock                                         |
| 3–17       | Various reachout restriction types (each has different UI strings) |
| 18         | Special type (uses feature flag 25042)                             |
| 20         | Alternate messaging restriction                                    |

Types 3–17 are "active" timelocks that display a circular countdown. Types 1, 18, 20 have different flows (no countdown, or immediate action).

### Timer mechanics

The timelock screen reads two timestamps:

- `TOwmL_end_time_in_ms` — when the lock expires (epoch ms)
- `TOwmL_start_time_in_ms` — when the lock started
- `TOwmL_type` — which type of lock (from the table above)

The circular progress bar shows time remaining. When `timeTillEnd <= 1000ms`, the timer completes and the UI transitions automatically.

### Library method

```js
// Remove an account reachout timelock (if the server allows it):
await sock.removeAccountReachoutTimelock()
```

---

## Message Capping (Bulk Message Limits)

### What it is

WhatsApp caps the number of messages a single account can send in a time window. When the cap is approached, the client sends an **OTE (Over-The-Envelope) request** to WhatsApp's servers to inform them.

### Network flow

`MessageCappingNetworkManager` sends a MEX mutation:

- **DataPath**: `xwa2_message_capping_ote_request`
- **Mutation**: `MessageCappingOteRequestMutation`
- **Schema**: `whatsapp-android-mex`
- **Input type**: `INDIVIDUAL_NEW_CHAT_THREAD`

The request includes:

- `reason_text` — human-readable reason for the OTE
- `selected_reason` — the specific reason code selected

The response is a `MessageCappingOteRequestMutation` result. On error, the error code and text are logged.

### Library method

```js
// Trigger a message capping OTE request:
await sock.messageCappingOteRequest()
```

This is normally called automatically by WhatsApp when approaching message limits. You can call it manually to check the current capping status.

---

## Heavy Sender Quota (Broadcast Lists)

### What it is

Broadcast lists (mass-send to multiple recipients at once) have a separate quota system. Accounts that send too many broadcasts are flagged as "heavy senders" and lose access to broadcast lists until the quota resets.

### Protocol flow

`BroadcastListQuotaProtocol` sends an IQ request on port 463 with a 32-second timeout. The response XML contains:

```xml
<limits>
  <messages_left>47</messages_left>
  <total_limit>256</total_limit>
  <is_heavy_sender>false</is_heavy_sender>
</limits>
<timeframe>
  <start_ts_s>1716825600</start_ts_s>
  <end_ts_s>1716912000</end_ts_s>
  <reset_ts_s>1716912000</reset_ts_s>
</timeframe>
```

### Quota fields

| Field                    | Meaning                                   |
| ------------------------ | ----------------------------------------- |
| `limits.messages_left`   | Remaining broadcasts in this window       |
| `limits.total_limit`     | Total allowed broadcasts per window       |
| `limits.is_heavy_sender` | If `true`, broadcast access is restricted |
| `timeframe.start_ts_s`   | Window start (unix seconds)               |
| `timeframe.end_ts_s`     | Window end (unix seconds)                 |
| `timeframe.reset_ts_s`   | When quota resets (unix seconds)          |

### Error codes from the IQ response

| Error code    | Meaning                                   |
| ------------- | ----------------------------------------- |
| 400           | Bad request (type 3)                      |
| 401           | Unauthorized (type 4)                     |
| 403           | Forbidden / heavy sender blocked (type 5) |
| 500           | Server error (type 1)                     |
| No error code | Generic failure (type 0)                  |

---

## Gap Enforcement

### What it is

Gap enforcement checks content rules against viewport snapshots of the user's inbox. It controls visual placement: for example, certain chats cannot appear in the pinned area, and certain content types cannot appear at the top of the archived inbox.

### Architecture

`RulesManager` evaluates rules in three passes over the viewport:

1. Pass over `c730230x.A01` (primary rules list)
2. Pass over `c730230x.A03` (secondary rules list)
3. Pass over `c730230x.A02` (tertiary rules list)

Each pass applies `InterfaceC81803aO.ANC(rule, viewportSnapshot, coroutine)`.

### ViewPortSnapshot fields

```
inboxTop                   → list of chats at the top of inbox
pinnedInInbox              → int: number of pinned chats
topLockedInbox             → list of locked/restricted chats
topArchivedInbox           → list of top archived chats
lastMarketingMessageTimestamp → unix ms: last marketing message time
```

Gap enforcement is client-side only. It controls what appears where in the UI, not whether messages are delivered.

---

## Newsletter / Channel Enforcement

WhatsApp Channels have their own enforcement system, handled by `NewsletterEnforcementsClient`.

### Enforcement types

The `NewsletterEnforcements` MEX query (dataPath: `NewsletterEnforcements`) returns multiple lists:

- **Policy violations** — posts that violated a policy (with appeal options)
- **Status enforcements** — newsletter status changes (suspended, geo-suspended)
- **Violating messages** — specific messages that were removed

Each enforcement object contains:

- `violation_type` — `EnumC27075BvL` (policy type)
- `violation_status` — `EnumC27081BvS` (current status)
- `violation_reason` — `EnumC27073BvJ` (why)
- `appeal_deadline_ms` / `appeal_window_ms` — appeal time window
- `appeal_info` — who reviewed it, reviewer type
- `geo_restriction` — which countries are affected

### Appeal process

```js
// For newsletter appeals, use createEnforcementAppeal:
await sock.createEnforcementAppeal('dispute', 'This content does not violate any policy')
```

`NewsletterEnforcementsClient.A0A` sends a `CreateEnforcementAppeal` MEX mutation with:

- `entity_id` — the newsletter JID
- `enforcement_id` — the specific enforcement to appeal
- `appeal_reason` — primary reason
- `additional_appeal_reason` — secondary/additional context
- `locale` — user's locale

### Newsletter enforcement screens (from APK)

| Screen                   | Class                                          | Trigger              |
| ------------------------ | ---------------------------------------------- | -------------------- |
| Suspension info          | `NewsletterSuspensionInfoActivity`             | Newsletter suspended |
| Geo-suspension           | `NewsletterGeosuspensionInfoActivity`          | Geo-blocked          |
| Copyright suspension     | `NewsletterCopyrightSuspensionInfoActivity`    | DMCA/copyright       |
| Violating messages       | `NewsletterViolatingMessagesActivity`          | Posts removed        |
| Profile picture deletion | `NewsletterProfilePictureDeletionInfoActivity` | PFP removed          |
| Appeals outcome          | `NewsletterAppealsOutcomeActivity`             | Appeal result        |
| User reports             | `NewsletterUserReportsActivity`                | User report review   |
| Dispute settlement       | `NewsletterEnforcementSelectActionActivity`    | Dispute options      |
| IP remediation           | `HowToEmailTheReporterFragment`                | Copyright contact    |

---

## Library Methods for Enforcement

baron-baileys-v2 methods that interact with the enforcement systems:

| Method                                          | System                  | What it does                            |
| ----------------------------------------------- | ----------------------- | --------------------------------------- |
| `messageCappingOteRequest()`                    | Message capping         | Notify server of capping status         |
| `removeAccountReachoutTimelock()`               | Reachout timelock       | Request timelock removal                |
| `createEnforcementAppeal(reason, details?)`     | Account/newsletter bans | Submit an appeal                        |
| `createGroupSuspensionAppeal(groupJid, reason)` | Group bans              | Appeal a suspended group                |
| `getAutoConfChallenge()`                        | Anti-automation         | Get challenge (proves you're not a bot) |
| `startChatContextIntegrityQuery(jids)`          | Start-chat gate         | Verify JIDs before opening chat         |

---

## What Triggers Bans (Inferred from APK Sources)

From the violation types and enforcement code, these behaviors are linked to enforcement actions:

**Account bans:**

- Sending unsolicited messages at high volume (violation_type: `spam`)
- Automated/bot behavior without authorization
- Policy violation (violated_policy: `TERMS_OF_SERVICE`)
- Using modified/third-party WhatsApp clients

**Spam warnings:**

- Sending the same message to many people quickly
- Being reported as spam by multiple recipients
- High message rate from a new account

**Reachout timelock:**

- Initiating too many new conversations (cold contacts) in a short period
- Messages to non-contacts being reported
- New account sending at high rate immediately after registration

**Heavy sender quota:**

- Broadcast list sends exceeding the daily/window limit
- Sending to broadcast lists with many recipients in quick succession
- `is_heavy_sender: true` response from the quota IQ

**Message capping:**

- Individual new-chat-thread volume too high
- OTE request triggers the cycle-based status reset

---

## How baron-baileys-v2 Handles Enforcement

The library's anti-ban system (`src/Socket/antiban.js`) includes:

- Rate limiting between messages
- Random delays to simulate human typing speed
- Jitter to avoid fixed-interval patterns
- Configurable burst limits

See [ANTIBAN.md](ANTIBAN.md) for the full anti-ban configuration.

The enforcement methods above let you react to actions the server reports. Use them to detect and recover from bans in long-running bots.
