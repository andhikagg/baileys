'use strict'

const crypto = require('crypto')
const {
	generateSignalPubKey,
	Curve,
	aesEncryptGCM,
	aesDecryptGCM,
	aesEncryptCTR,
	aesDecryptCTR,
	aesDecrypt,
	aesDecryptWithIV,
	aesEncrypt,
	aesEncrypWithIV,
	hmacSign,
	sha256,
	derivePairingCodeKey
} = require('../src/Utils/crypto')

const KEY32 = crypto.randomBytes(32)
const IV16 = crypto.randomBytes(16)
const IV12 = crypto.randomBytes(12)
const AAD = Buffer.from('additional-data')

describe('generateSignalPubKey', () => {
	test('32-byte key gets 0x05 prefix → 33 bytes', () => {
		const key = Buffer.alloc(32, 0xab)
		const result = generateSignalPubKey(key)
		expect(result).toHaveLength(33)
		expect(result[0]).toBe(0x05)
	})

	test('33-byte key passes through unchanged', () => {
		const key = Buffer.alloc(33, 0xab)
		key[0] = 0x05
		const result = generateSignalPubKey(key)
		expect(result).toHaveLength(33)
		expect(Buffer.from(result)).toEqual(key)
	})
})

describe('Curve', () => {
	test('generateKeyPair returns private and public Buffers', () => {
		const pair = Curve.generateKeyPair()
		expect(Buffer.isBuffer(pair.private)).toBe(true)
		expect(Buffer.isBuffer(pair.public)).toBe(true)
		expect(pair.public).toHaveLength(32) // 0x05 prefix stripped
	})

	test('sharedKey returns 32 bytes', () => {
		const a = Curve.generateKeyPair()
		const b = Curve.generateKeyPair()
		const shared = Curve.sharedKey(a.private, b.public)
		expect(Buffer.isBuffer(shared)).toBe(true)
		expect(shared).toHaveLength(32)
	})

	test('sign returns 64 bytes', () => {
		const pair = Curve.generateKeyPair()
		const sig = Curve.sign(pair.private, Buffer.from('message'))
		expect(Buffer.isBuffer(sig)).toBe(true)
		expect(sig).toHaveLength(64)
	})

	test('verify does not throw', () => {
		const pair = Curve.generateKeyPair()
		const msg = Buffer.from('test')
		const sig = Curve.sign(pair.private, msg)
		expect(() => Curve.verify(pair.public, msg, sig)).not.toThrow()
	})
})

describe('AES-256-GCM roundtrip', () => {
	test('encrypt then decrypt returns original plaintext', () => {
		const plaintext = Buffer.from('hello world')
		const ct = aesEncryptGCM(plaintext, KEY32, IV12, AAD)
		const pt = aesDecryptGCM(ct, KEY32, IV12, AAD)
		expect(Buffer.from(pt)).toEqual(plaintext)
	})

	test('ciphertext is longer than plaintext (includes auth tag)', () => {
		const pt = Buffer.from('test')
		const ct = aesEncryptGCM(pt, KEY32, IV12, AAD)
		expect(ct.length).toBeGreaterThan(pt.length)
	})

	test('returns Buffer', () => {
		const ct = aesEncryptGCM(Buffer.from('x'), KEY32, IV12, AAD)
		expect(Buffer.isBuffer(ct)).toBe(true)
	})
})

describe('AES-256-CTR roundtrip', () => {
	test('encrypt then decrypt returns original', () => {
		const pt = Buffer.from('ctr mode test')
		const ct = aesEncryptCTR(pt, KEY32, IV16)
		const result = aesDecryptCTR(ct, KEY32, IV16)
		expect(Buffer.from(result)).toEqual(pt)
	})

	test('ciphertext length equals plaintext length', () => {
		const pt = Buffer.from('exactly')
		const ct = aesEncryptCTR(pt, KEY32, IV16)
		expect(ct.length).toBe(pt.length)
	})
})

describe('AES-256-CBC', () => {
	test('aesEncrypWithIV / aesDecryptWithIV roundtrip', () => {
		// Use PKCS#7-padded plaintext (multiple of 16)
		const pt = Buffer.from('0123456789abcdef') // exactly 16 bytes
		const ct = aesEncrypWithIV(pt, KEY32, IV16)
		const result = aesDecryptWithIV(ct, KEY32, IV16)
		expect(Buffer.from(result)).toEqual(pt)
	})

	test('aesEncrypt / aesDecrypt roundtrip (IV prepended)', () => {
		const pt = Buffer.from('0123456789abcdef')
		const ct = aesEncrypt(pt, KEY32)
		const result = aesDecrypt(ct, KEY32)
		expect(Buffer.from(result)).toEqual(pt)
	})
})

describe('hmacSign', () => {
	test('returns 32-byte Buffer for sha256 (default)', () => {
		const result = hmacSign(Buffer.from('data'), Buffer.from('key'))
		expect(Buffer.isBuffer(result)).toBe(true)
		expect(result).toHaveLength(32)
	})

	test('consistent output for same inputs', () => {
		const a = hmacSign(Buffer.from('msg'), Buffer.from('k'))
		const b = hmacSign(Buffer.from('msg'), Buffer.from('k'))
		expect(a).toEqual(b)
	})

	test('fallback path for non-sha256 variant', () => {
		const result = hmacSign(Buffer.from('data'), Buffer.from('key'), 'sha512')
		expect(Buffer.isBuffer(result)).toBe(true)
		expect(result).toHaveLength(64) // SHA-512 HMAC is 64 bytes
	})
})

describe('sha256', () => {
	test('returns 32-byte Buffer', () => {
		const result = sha256(Buffer.from('hello'))
		expect(Buffer.isBuffer(result)).toBe(true)
		expect(result).toHaveLength(32)
	})

	test('consistent', () => {
		const a = sha256(Buffer.from('test'))
		const b = sha256(Buffer.from('test'))
		expect(a).toEqual(b)
	})

	test('different input → different output', () => {
		expect(sha256(Buffer.from('a'))).not.toEqual(sha256(Buffer.from('b')))
	})
})

describe('derivePairingCodeKey', () => {
	test('returns 32-byte Buffer', async () => {
		const salt = crypto.randomBytes(32)
		const key = await derivePairingCodeKey('ABCD-EFGH', salt)
		expect(Buffer.isBuffer(key)).toBe(true)
		expect(key).toHaveLength(32)
	})

	test('deterministic for same inputs', async () => {
		const salt = Buffer.alloc(32, 0x42)
		const a = await derivePairingCodeKey('1234-5678', salt)
		const b = await derivePairingCodeKey('1234-5678', salt)
		expect(a).toEqual(b)
	})

	test('different pairing code → different key', async () => {
		const salt = Buffer.alloc(32, 0x01)
		const a = await derivePairingCodeKey('AAAA-BBBB', salt)
		const b = await derivePairingCodeKey('CCCC-DDDD', salt)
		expect(a).not.toEqual(b)
	})
})
