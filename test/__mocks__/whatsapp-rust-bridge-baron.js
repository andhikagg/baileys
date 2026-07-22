'use strict'
// Jest mock for whatsapp-rust-bridge — uses Node.js native crypto
// so tests run without WASM/ESM initialization
const crypto = require('crypto')

// ── HKDF ─────────────────────────────────────────────────────────────────────
const hkdf = (buffer, length, opts = {}) => {
	const { salt, info } = opts
	const saltBuf = salt ? Buffer.from(salt) : Buffer.alloc(0)
	const infoBuf = info ? Buffer.from(info) : Buffer.alloc(0)
	return crypto.hkdfSync('sha256', Buffer.from(buffer), saltBuf, infoBuf, length)
}

// ── AES-256-GCM ───────────────────────────────────────────────────────────────
const aesDecryptGCM = (ciphertextWithTag, key, iv, aad) => {
	const GCM_TAG = 16
	const ct = ciphertextWithTag.slice(0, ciphertextWithTag.length - GCM_TAG)
	const tag = ciphertextWithTag.slice(-GCM_TAG)
	const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv))
	d.setAAD(Buffer.from(aad))
	d.setAuthTag(Buffer.from(tag))
	return Buffer.concat([d.update(Buffer.from(ct)), d.final()])
}

const aesEncryptGCM = (plaintext, key, iv, aad) => {
	const c = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), Buffer.from(iv))
	c.setAAD(Buffer.from(aad))
	const enc = Buffer.concat([c.update(Buffer.from(plaintext)), c.final()])
	return Buffer.concat([enc, c.getAuthTag()])
}

// ── AES-256-CTR ───────────────────────────────────────────────────────────────
const aesEncryptCTR = (plaintext, key, iv) => {
	const c = crypto.createCipheriv('aes-256-ctr', Buffer.from(key), Buffer.from(iv))
	return Buffer.concat([c.update(Buffer.from(plaintext)), c.final()])
}

const aesDecryptCTR = (ciphertext, key, iv) => {
	const d = crypto.createDecipheriv('aes-256-ctr', Buffer.from(key), Buffer.from(iv))
	return Buffer.concat([d.update(Buffer.from(ciphertext)), d.final()])
}

// ── AES-256-CBC ───────────────────────────────────────────────────────────────
const aesEncrypt = (plaintext, key) => {
	const iv = crypto.randomBytes(16)
	const c = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
	const enc = Buffer.concat([c.update(Buffer.from(plaintext)), c.final()])
	return Buffer.concat([iv, enc])
}

const aesDecrypt = (buffer, key) => {
	const iv = Buffer.from(buffer).slice(0, 16)
	const ct = Buffer.from(buffer).slice(16)
	const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
	return Buffer.concat([d.update(ct), d.final()])
}

const aesEncrypWithIV = (plaintext, key, iv) => {
	const c = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv))
	return Buffer.concat([c.update(Buffer.from(plaintext)), c.final()])
}

const aesDecryptWithIV = (buffer, key, iv) => {
	const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv))
	return Buffer.concat([d.update(Buffer.from(buffer)), d.final()])
}

// ── HMAC / SHA ────────────────────────────────────────────────────────────────
const sha256 = buf => crypto.createHash('sha256').update(buf).digest()
const hmacSign = (buf, key) => crypto.createHmac('sha256', Buffer.from(key)).update(buf).digest()
const md5 = buf => crypto.createHash('md5').update(buf).digest()

// ── Curve25519 stubs (minimal for unit tests — not cryptographically correct) ─
const generateKeyPair = () => {
	const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519', {
		privateKeyEncoding: { type: 'pkcs8', format: 'der' },
		publicKeyEncoding: { type: 'spki', format: 'der' }
	})
	// Return 32-byte raw representations
	return {
		privKey: privateKey.slice(-32),
		pubKey: Buffer.concat([Buffer.from([0x05]), publicKey.slice(-32)])
	}
}

const calculateAgreement = (pubKey, privKey) => {
	// For tests, return a deterministic 32-byte shared secret
	return crypto.createHash('sha256').update(Buffer.from(pubKey)).update(Buffer.from(privKey)).digest()
}

const calculateSignature = (privKey, message) => {
	// Stub: return deterministic 64 bytes
	return Buffer.concat([
		crypto.createHmac('sha256', Buffer.from(privKey)).update(Buffer.from(message)).digest(),
		crypto
			.createHmac('sha256', Buffer.from(privKey))
			.update(Buffer.from(message))
			.update(Buffer.from([1]))
			.digest()
	])
}

const verifySignature = (pubKey, message, signature) => {
	// Stub: always return true in tests (crypto tests verify logic flow, not crypto correctness)
	return true
}

// ── WABinary encode/decode stubs ──────────────────────────────────────────────
const encodeNode = node => {
	// Minimal stub: returns a fixed sentinel buffer; real encoding needs WASM
	return Buffer.from(JSON.stringify({ tag: node.tag, attrs: node.attrs }))
}

const decodeNode = u8 => {
	// Return a minimal InternalBinaryNode-like object
	return {
		toJSON: () => ({ tag: 'iq', attrs: { id: '1', type: 'get' }, content: undefined })
	}
}

// ── LT Hash ──────────────────────────────────────────────────────────────────
class LTHashAntiTampering {
	add() {}
	subtract() {}
	getResult() {
		return Buffer.alloc(128)
	}
}

// ── SessionCipher spy ─────────────────────────────────────────────────────────
// Captures the storage object passed to it so tests can inspect what
// loadSignedPreKey / loadPreKey return without needing real Signal sessions.
class SessionCipher {
	constructor(storage, addr) {
		this._storage = storage
		this._addr = addr
		SessionCipher.instances.push(this)
	}
	async decryptPreKeyWhisperMessage(_ciphertext) {
		// Call loadSignedPreKey so tests can verify its return shape
		SessionCipher.lastLoadedSPK = await this._storage.loadSignedPreKey(1)
		return Buffer.from('decrypted-pkmsg')
	}
	async decryptWhisperMessage(_ciphertext) {
		return Buffer.from('decrypted-msg')
	}
	async encrypt(data) {
		return { type: 3, body: Buffer.from(data).toString('binary') }
	}
}
SessionCipher.instances = []
SessionCipher.lastLoadedSPK = null

class ProtocolAddress {
	constructor(name, deviceId) {
		this._name = name
		this._deviceId = deviceId
	}
	toString() {
		return `${this._name}.${this._deviceId}`
	}
}

module.exports = {
	hkdf,
	aesDecryptGCM,
	aesEncryptGCM,
	aesEncryptCTR,
	aesDecryptCTR,
	aesEncrypt,
	aesDecrypt,
	aesEncrypWithIV,
	aesDecryptWithIV,
	sha256,
	hmacSign,
	md5,
	generateKeyPair,
	calculateAgreement,
	calculateSignature,
	verifySignature,
	encodeNode,
	decodeNode,
	LTHashAntiTampering,
	SessionCipher,
	ProtocolAddress
}
