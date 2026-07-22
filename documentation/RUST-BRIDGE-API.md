# Rust Bridge API — Integration Status

Full catalog of the `whatsapp-rust-bridge-baron` WASM API surface. Everything in the bridge runs in Rust/WASM; calls cross the JS↔WASM boundary once and return.

---

## Already integrated

All of these are used by baron-baileys-v2 internally.

| API                                                                                   | Used in                                                        |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `aesEncrypt/Decrypt` (CBC, GCM, CTR, +IV variants)                                    | `src/Utils/crypto.js`                                          |
| `hmacSign`, `sha256`, `md5`, `hkdf`                                                   | `src/Utils/crypto.js`                                          |
| `calculateAgreement`, `calculateSignature`, `verifySignature`                         | `src/Utils/crypto.js`                                          |
| `generateKeyPair`, `generatePreKey`, `generateSignedPreKey`, `generateRegistrationId` | `src/Utils/crypto.js`, `src/Utils/validate-connection.js`      |
| `_serializeIdentityKeyPair`                                                           | signal stack                                                   |
| `encodeNode`, `decodeNode`                                                            | `src/WABinary/encode.js`, `decode.js`                          |
| `expandAppStateKeys`                                                                  | `src/Utils/chat-utils.js`                                      |
| `generateContentMac`, `generateIndexMac`, `generatePatchMac`, `generateSnapshotMac`   | (available but currently implemented in JS in `chat-utils.js`) |
| `LTHashState`, `LTHashAntiTampering`                                                  | `src/Utils/lt-hash.js`                                         |
| `NoiseSession` (Noise XX)                                                             | `src/Utils/noise-handler.js`                                   |
| `NoiseXxFallbackSession`                                                              | `src/Utils/noise-handler.js`                                   |
| `SessionBuilder`, `SessionCipher`, `SessionRecord`                                    | `src/Signal/libsignal.js`                                      |
| `GroupCipher`, `GroupSessionBuilder`                                                  | `src/Signal/Group/`                                            |
| `SenderKeyDistributionMessage`, `SenderKeyName`, `SenderKeyRecord`                    | `src/Signal/Group/`                                            |
| `ProtocolAddress`                                                                     | `src/Signal/libsignal.js`                                      |
| `getPreKeyMessageIdentityKey`                                                         | `src/Signal/libsignal.js`                                      |
| `getEnabledFeatures`                                                                  | `src/Utils/crypto.js` (re-exported)                            |

---

## Available but not yet integrated

### 1. `NoiseIkSession` — fast reconnect (0-RTT)

**Value:** Cuts reconnect latency by doing the Noise handshake in 1 round-trip instead of 2.

**API:**

```js
const ik = new rb.NoiseIkSession(
  clientStaticPub,   // 33-byte public key (0x05 prefix)
  clientStaticPriv,  // 32-byte private key
  serverStaticPub,   // 32-byte server static key (cached from prior XX, now in creds.serverStaticPub)
  clientPayload,     // 0-RTT ClientPayload proto bytes
  prologue           // NOISE_WA_HEADER (4 bytes)
)

const clientHello = ik.buildClientHello()  // already framed, send directly
const result = ik.readServerHello(responseBytes, routingInfo?)
// result.success === true  → use result.writeCipher / result.readCipher
// result.success === false → use result.fallbackSession (NoiseSession) for XX
```

**What's already done:**

- `noise-handler.js` now extracts the server's static public key from the leaf certificate after a successful XX handshake.
- `socket.js` saves it to `creds.serverStaticPub` on first connect (persisted via `creds.update`).

**What remains:**

- On reconnect, if `creds.serverStaticPub` is set, build the client payload early and use `NoiseIkSession` instead of `NoiseSession`.
- Wrap `result.writeCipher`/`result.readCipher` into the noise-handler interface (the interface of these objects is `any` in the TS types; needs investigation or testing).
- Handle fallback: if `result.success === false`, continue with `result.fallbackSession` which is a ready `NoiseSession`.
- Clear `creds.serverStaticPub` if the server repeatedly rejects IK (key rotated).

---

### 2. `CallEngine` + `MediaPipeline` + `MlowEncoder` + `MlowDecoder` — call media

**Value:** Full call media support (audio codec + E2E SRTP + call signaling engine). Currently the library handles call signaling stanzas but has no media plane.

**API (sans-io call engine):**

```js
const engine = rb.CallEngine.create(callKey, localLidJid, remoteLidJid, mediaType, monotonicMs)
engine.start(monotonicMs)
const outputs = engine.pollOutput() // drain after any input
engine.handleMicFrame(pcmF32, monotonicMs)
engine.handleRelayPacket(relayBytes, monotonicMs)
engine.rekeyRecv(newKey, monotonicMs)
const playout = engine.takePlayout()
```

**MLow audio codec:**

```js
const enc = new rb.MlowEncoder()
const encoded = enc.encode(pcmF32Samples)

const dec = new rb.MlowDecoder()
const pcm = dec.decode(mlowPayload) // → Float32Array
```

**E2E SRTP media pipeline:**

```js
const pipe = rb.MediaPipeline.create(callKey, localLidJid, remoteLidJid)
const srtp = pipe.protectAudio(rtpPayload)
const plain = pipe.unprotectAudio(srtpPacket)
pipe.rekeyRecv(newKeyBytes)
```

**What remains:** Everything. This requires new socket-level infrastructure (WebRTC/relay transport, mic/speaker hooks, call state machine).

---

### 3. `collectAppStateKeyIds` — batch pre-fetch app state keys

**Value:** Scan all patch/snapshot bytes for key IDs upfront, then batch-fetch before processing. Reduces async serial key fetches in `decodeSyncdMutations`.

**API:**

```js
// snapshotBytes: raw SyncdSnapshot protobuf bytes (Uint8Array)
// patchesBytes: Array<Uint8Array> of raw SyncdPatch bytes
const keyIds = rb.collectAppStateKeyIds(snapshotBytes, patchesBytes)
// → Array<Uint8Array> — unique key ID byte arrays to fetch
```

**Integration point:** `extractSyncdPatches` in `chat-utils.js`, where the raw bytes are available before decoding. Would need to pre-fetch all keys before calling `decodePatches`.

---

### 4. `decodeAppStateRecord` + `encodeAppStateMutation` — Rust-native app state codec

**Value:** Replace the JS `generateMac`/decrypt/decode loop in `decodeSyncdMutations` and `encodeSyncdPatch` with Rust implementations.

**Caution:** The `operation` encoding must match — JS uses `SET=0x01, REMOVE=0x02` as HMAC bytes; Rust docs say `0=SET, 1=REMOVE` as the parameter value. Needs byte-level parity testing before swapping.

---

### 5. JID utilities (already in JS — low priority)

The bridge exports `parseJid`, `encodeJid`, `jidNormalizedUser`, `isGroupJid`, `isUserJid`, `isNewsletterJid`, `isLidJid`, `isMessengerJid`, `isBotJid`, etc. — all already implemented in `src/WABinary/jid-utils.js` as fast string operations. WASM FFI overhead makes replacing them a net loss for most call sites.

---

## `getWAConnHeader` — do not use

The bridge exports `getWAConnHeader()` which returns the 4-byte WA connection header `[87, 65, proto_version, dict_version]`. The current hardcoded value in `src/Defaults/index.js` (`NOISE_WA_HEADER`) bakes in the correct `DICT_VERSION` for this library's token table. Using the bridge's version risks a version mismatch if the embedded dict version differs. Leave as-is.
