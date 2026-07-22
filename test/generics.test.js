'use strict'

const {
	isStringNullOrEmpty,
	encodeBigEndian,
	toNumber,
	unixTimestampSeconds,
	writeRandomPadMax16,
	unpadRandomMax16,
	generateParticipantHashV2,
	generateMessageID,
	generateMessageIDV2,
	generateRegistrationId,
	generateMdTagPrefix,
	getKeyAuthor,
	trimUndefined,
	getStatusFromReceiptType,
	getCodeFromWSError,
	getCallStatusFromNode,
	isWABusinessPlatform,
	jitterDelay,
	exponentialBackoff,
	bytesToHex,
	hexToBytes,
	bytesToBase64Url,
	sha256Hex,
	hmacSha256,
	normalizeJidBatch,
	BufferJSON
} = require('../src/Utils/generics')

describe('isStringNullOrEmpty', () => {
	test('null → true', () => expect(isStringNullOrEmpty(null)).toBe(true))
	test('undefined → true', () => expect(isStringNullOrEmpty(undefined)).toBe(true))
	test('empty string → true', () => expect(isStringNullOrEmpty('')).toBe(true))
	test('non-empty string → false', () => expect(isStringNullOrEmpty('a')).toBe(false))
	test('whitespace → false', () => expect(isStringNullOrEmpty(' ')).toBe(false))
	test('0 → false', () => expect(isStringNullOrEmpty(0)).toBe(false))
})

describe('encodeBigEndian', () => {
	test('encodes 1 as 4-byte big-endian', () => {
		expect(Buffer.from(encodeBigEndian(1))).toEqual(Buffer.from([0, 0, 0, 1]))
	})

	test('encodes 256', () => {
		expect(Buffer.from(encodeBigEndian(256))).toEqual(Buffer.from([0, 0, 1, 0]))
	})

	test('respects length parameter', () => {
		expect(Buffer.from(encodeBigEndian(1, 2))).toEqual(Buffer.from([0, 1]))
	})

	test('encodes 0', () => {
		expect(Buffer.from(encodeBigEndian(0))).toEqual(Buffer.from([0, 0, 0, 0]))
	})

	test('encodes max uint32', () => {
		const result = encodeBigEndian(0xffffffff)
		expect(Buffer.from(result)).toEqual(Buffer.from([0xff, 0xff, 0xff, 0xff]))
	})
})

describe('toNumber', () => {
	test('plain number passthrough', () => expect(toNumber(42)).toBe(42))
	test('zero → 0', () => expect(toNumber(0)).toBe(0))
	test('null/undefined → 0', () => {
		expect(toNumber(null)).toBe(0)
		expect(toNumber(undefined)).toBe(0)
	})
	test('Long-like object with toNumber()', () => {
		expect(toNumber({ toNumber: () => 99 })).toBe(99)
	})
	test('Long-like object with .low', () => {
		expect(toNumber({ low: 7 })).toBe(7)
	})
})

describe('unixTimestampSeconds', () => {
	test('returns integer', () => {
		const ts = unixTimestampSeconds()
		expect(Number.isInteger(ts)).toBe(true)
	})

	test('is close to current time', () => {
		const ts = unixTimestampSeconds()
		const now = Math.floor(Date.now() / 1000)
		expect(Math.abs(ts - now)).toBeLessThanOrEqual(2)
	})

	test('accepts a Date argument', () => {
		const d = new Date(2000, 0, 1) // Jan 1 2000 local
		const ts = unixTimestampSeconds(d)
		expect(ts).toBe(Math.floor(d.getTime() / 1000))
	})
})

describe('pad / unpad', () => {
	test('unpad reverses pad', () => {
		const msg = Buffer.from('hello')
		const padded = writeRandomPadMax16(msg)
		const unpadded = unpadRandomMax16(padded)
		expect(Buffer.from(unpadded)).toEqual(msg)
	})

	test('padded is longer than original', () => {
		const msg = Buffer.from('hi')
		const padded = writeRandomPadMax16(msg)
		expect(padded.length).toBeGreaterThan(msg.length)
		expect(padded.length).toBeLessThanOrEqual(msg.length + 16)
	})

	test('unpadRandomMax16 throws on empty input', () => {
		expect(() => unpadRandomMax16(new Uint8Array(0))).toThrow('empty')
	})

	test('unpadRandomMax16 throws when pad > length', () => {
		// A buffer where the last byte says pad = 100, but buffer is shorter
		expect(() => unpadRandomMax16(new Uint8Array([100]))).toThrow()
	})
})

describe('generateParticipantHashV2', () => {
	test('returns string starting with "2:"', () => {
		const hash = generateParticipantHashV2(['491@s.whatsapp.net', '492@s.whatsapp.net'])
		expect(hash).toMatch(/^2:/)
	})

	test('order-independent — sorted internally', () => {
		const a = generateParticipantHashV2(['491@s.whatsapp.net', '492@s.whatsapp.net'])
		const b = generateParticipantHashV2(['492@s.whatsapp.net', '491@s.whatsapp.net'])
		expect(a).toBe(b)
	})

	test('different participants → different hash', () => {
		const a = generateParticipantHashV2(['491@s.whatsapp.net'])
		const b = generateParticipantHashV2(['999@s.whatsapp.net'])
		expect(a).not.toBe(b)
	})

	test('hash suffix is 6 chars', () => {
		const hash = generateParticipantHashV2(['491@s.whatsapp.net'])
		expect(hash.slice(2)).toHaveLength(6)
	})
})

describe('generateMessageID', () => {
	test('starts with 3EB0', () => {
		expect(generateMessageID()).toMatch(/^3EB0/)
	})

	test('is uppercase hex', () => {
		expect(generateMessageID()).toMatch(/^3EB0[0-9A-F]+$/)
	})

	test('is unique across calls', () => {
		expect(generateMessageID()).not.toBe(generateMessageID())
	})

	test('has expected length (4 + 36 = 40 chars)', () => {
		expect(generateMessageID()).toHaveLength(40)
	})
})

describe('generateMessageIDV2', () => {
	test('starts with 3EB0', () => {
		expect(generateMessageIDV2()).toMatch(/^3EB0/)
	})

	test('is uppercase hex', () => {
		expect(generateMessageIDV2()).toMatch(/^3EB0[0-9A-F]+$/)
	})

	test('is unique across calls', () => {
		expect(generateMessageIDV2()).not.toBe(generateMessageIDV2())
	})

	test('accepts userId without throwing', () => {
		expect(() => generateMessageIDV2('491234567890@s.whatsapp.net')).not.toThrow()
	})

	test('undefined userId is fine', () => {
		expect(() => generateMessageIDV2(undefined)).not.toThrow()
	})
})

describe('generateRegistrationId', () => {
	test('returns a number', () => expect(typeof generateRegistrationId()).toBe('number'))
	test('is within 14-bit range [0, 16383]', () => {
		for (let i = 0; i < 20; i++) {
			const id = generateRegistrationId()
			expect(id).toBeGreaterThanOrEqual(0)
			expect(id).toBeLessThanOrEqual(16383)
		}
	})
})

describe('generateMdTagPrefix', () => {
	test('matches pattern N.N-', () => {
		expect(generateMdTagPrefix()).toMatch(/^\d+\.\d+-$/)
	})
	test('is unique', () => {
		expect(generateMdTagPrefix()).not.toBe(generateMdTagPrefix())
	})
})

describe('getKeyAuthor', () => {
	test('fromMe → meId', () => {
		expect(getKeyAuthor({ fromMe: true }, 'me')).toBe('me')
	})

	test('fromMe with custom meId', () => {
		expect(getKeyAuthor({ fromMe: true }, '491@s.whatsapp.net')).toBe('491@s.whatsapp.net')
	})

	test('not fromMe → participant', () => {
		expect(getKeyAuthor({ fromMe: false, participant: '492@s.whatsapp.net' })).toBe('492@s.whatsapp.net')
	})

	test('prefers participantAlt over participant', () => {
		expect(getKeyAuthor({ fromMe: false, participantAlt: 'a', participant: 'b' })).toBe('a')
	})

	test('falls back to remoteJid', () => {
		expect(getKeyAuthor({ fromMe: false, remoteJid: '491@s.whatsapp.net' })).toBe('491@s.whatsapp.net')
	})

	test('null key → empty string', () => {
		expect(getKeyAuthor(null)).toBe('')
	})
})

describe('trimUndefined', () => {
	test('removes undefined keys', () => {
		const obj = { a: 1, b: undefined, c: 'x' }
		trimUndefined(obj)
		expect(obj).toEqual({ a: 1, c: 'x' })
	})

	test('keeps null and false', () => {
		const obj = { a: null, b: false, c: 0 }
		trimUndefined(obj)
		expect(obj).toEqual({ a: null, b: false, c: 0 })
	})

	test('empty object is fine', () => {
		const obj = {}
		expect(() => trimUndefined(obj)).not.toThrow()
	})
})

describe('isWABusinessPlatform', () => {
	test('"smbi" → true', () => expect(isWABusinessPlatform('smbi')).toBe(true))
	test('"smba" → true', () => expect(isWABusinessPlatform('smba')).toBe(true))
	test('regular string → false', () => expect(isWABusinessPlatform('android')).toBe(false))
	test('null → false', () => expect(isWABusinessPlatform(null)).toBe(false))
})

describe('getStatusFromReceiptType', () => {
	test('undefined type → DELIVERY_ACK (3)', () => {
		const status = getStatusFromReceiptType(undefined)
		expect(status).toBe(3) // DELIVERY_ACK
	})

	test('"read" → READ (4)', () => {
		expect(getStatusFromReceiptType('read')).toBe(4)
	})

	test('"read-self" → READ (4)', () => {
		expect(getStatusFromReceiptType('read-self')).toBe(4)
	})

	test('"played" → PLAYED (5)', () => {
		expect(getStatusFromReceiptType('played')).toBe(5)
	})

	test('"sender" → SERVER_ACK (2)', () => {
		expect(getStatusFromReceiptType('sender')).toBe(2)
	})

	test('unknown type → undefined', () => {
		expect(getStatusFromReceiptType('unknown')).toBeUndefined()
	})
})

describe('getCodeFromWSError', () => {
	test('returns 500 for generic error', () => {
		expect(getCodeFromWSError(new Error('boom'))).toBe(500)
	})

	test('extracts code from "Unexpected server response: 429"', () => {
		expect(getCodeFromWSError({ message: 'Unexpected server response: 429' })).toBe(429)
	})

	test('ignores extracted code below 400', () => {
		expect(getCodeFromWSError({ message: 'Unexpected server response: 200' })).toBe(500)
	})

	test('ENOTFOUND → 408', () => {
		expect(getCodeFromWSError({ code: 'ENOTFOUND' })).toBe(408)
	})

	test('"timed out" in message → 408', () => {
		expect(getCodeFromWSError({ message: 'connection timed out' })).toBe(408)
	})

	test('null → 500', () => {
		expect(getCodeFromWSError(null)).toBe(500)
	})
})

describe('getCallStatusFromNode', () => {
	test('offer', () => expect(getCallStatusFromNode({ tag: 'offer', attrs: {} })).toBe('offer'))
	test('offer_notice', () => expect(getCallStatusFromNode({ tag: 'offer_notice', attrs: {} })).toBe('offer'))
	test('terminate → terminate', () => expect(getCallStatusFromNode({ tag: 'terminate', attrs: {} })).toBe('terminate'))
	test('terminate timeout', () =>
		expect(getCallStatusFromNode({ tag: 'terminate', attrs: { reason: 'timeout' } })).toBe('timeout'))
	test('reject', () => expect(getCallStatusFromNode({ tag: 'reject', attrs: {} })).toBe('reject'))
	test('accept', () => expect(getCallStatusFromNode({ tag: 'accept', attrs: {} })).toBe('accept'))
	test('preaccept', () => expect(getCallStatusFromNode({ tag: 'preaccept', attrs: {} })).toBe('preaccept'))
	test('unknown tag → ringing', () => expect(getCallStatusFromNode({ tag: 'unknown_xyz', attrs: {} })).toBe('ringing'))
})

describe('jitterDelay', () => {
	test('result is within ±variance of base', () => {
		for (let i = 0; i < 50; i++) {
			const result = jitterDelay(1000, 0.3)
			expect(result).toBeGreaterThanOrEqual(700)
			expect(result).toBeLessThanOrEqual(1300)
		}
	})

	test('zero variance → exactly baseMs', () => {
		expect(jitterDelay(500, 0)).toBe(500)
	})
})

describe('exponentialBackoff', () => {
	test('attempt 0 → baseMs', () => expect(exponentialBackoff(0, 500)).toBe(500))
	test('attempt 1 → 2×baseMs', () => expect(exponentialBackoff(1, 500)).toBe(1000))
	test('attempt 2 → 4×baseMs', () => expect(exponentialBackoff(2, 500)).toBe(2000))
	test('caps at maxMs', () => expect(exponentialBackoff(100, 500, 30000)).toBe(30000))
	test('default args work', () => {
		expect(exponentialBackoff(0)).toBe(500)
		expect(exponentialBackoff(1)).toBe(1000)
	})
})

describe('bytesToHex / hexToBytes', () => {
	test('roundtrip', () => {
		const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef])
		expect(hexToBytes(bytesToHex(buf))).toEqual(buf)
	})

	test('known encoding', () => {
		expect(bytesToHex(Buffer.from([0x00, 0xff]))).toBe('00ff')
	})

	test('hexToBytes decodes known string', () => {
		expect(hexToBytes('deadbeef')).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
	})
})

describe('bytesToBase64Url', () => {
	test('produces base64url output', () => {
		const result = bytesToBase64Url(Buffer.from('hello'))
		expect(result).toBe(Buffer.from('hello').toString('base64url'))
		expect(result).not.toContain('+')
		expect(result).not.toContain('/')
	})
})

describe('sha256Hex', () => {
	test('known hash of empty string', () => {
		expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
	})

	test('is 64 hex chars', () => {
		expect(sha256Hex('hello')).toHaveLength(64)
	})

	test('consistent across calls', () => {
		expect(sha256Hex('test')).toBe(sha256Hex('test'))
	})
})

describe('hmacSha256', () => {
	test('returns a Buffer of length 32', () => {
		const result = hmacSha256(Buffer.from('data'), Buffer.from('key'))
		expect(result).toHaveLength(32)
	})

	test('same inputs → same output', () => {
		const a = hmacSha256(Buffer.from('msg'), Buffer.from('key'))
		const b = hmacSha256(Buffer.from('msg'), Buffer.from('key'))
		expect(a).toEqual(b)
	})

	test('different key → different result', () => {
		const a = hmacSha256(Buffer.from('msg'), Buffer.from('key1'))
		const b = hmacSha256(Buffer.from('msg'), Buffer.from('key2'))
		expect(a).not.toEqual(b)
	})
})

describe('normalizeJidBatch', () => {
	test('deduplicates identical JIDs', () => {
		const result = normalizeJidBatch(['491@s.whatsapp.net', '491@s.whatsapp.net', '492@s.whatsapp.net'])
		expect(result).toEqual(['491@s.whatsapp.net', '492@s.whatsapp.net'])
	})

	test('applies normalizer function', () => {
		const normalizer = jid => jid.replace('@c.us', '@s.whatsapp.net')
		const result = normalizeJidBatch(['491@c.us', '491@s.whatsapp.net'], normalizer)
		expect(result).toHaveLength(1)
	})

	test('skips falsy values', () => {
		const result = normalizeJidBatch([null, '', '491@s.whatsapp.net', undefined])
		expect(result).toEqual(['491@s.whatsapp.net'])
	})

	test('empty array → empty result', () => {
		expect(normalizeJidBatch([])).toEqual([])
	})
})

describe('BufferJSON', () => {
	describe('replacer', () => {
		test('serializes Buffer to {type:"Buffer", data:base64}', () => {
			const buf = Buffer.from([1, 2, 3])
			const result = BufferJSON.replacer('k', buf)
			expect(result).toEqual({ type: 'Buffer', data: buf.toString('base64') })
		})

		test('serializes Uint8Array', () => {
			const arr = new Uint8Array([4, 5])
			const result = BufferJSON.replacer('k', arr)
			expect(result.type).toBe('Buffer')
		})

		test('passes through non-buffer values', () => {
			expect(BufferJSON.replacer('k', 42)).toBe(42)
			expect(BufferJSON.replacer('k', 'hello')).toBe('hello')
			expect(BufferJSON.replacer('k', null)).toBe(null)
		})
	})

	describe('reviver', () => {
		test('restores Buffer from {type:"Buffer", data:base64}', () => {
			const original = Buffer.from([1, 2, 3])
			const serialized = { type: 'Buffer', data: original.toString('base64') }
			expect(BufferJSON.reviver('k', serialized)).toEqual(original)
		})

		test('passes through non-buffer values', () => {
			expect(BufferJSON.reviver('k', 'hello')).toBe('hello')
			expect(BufferJSON.reviver('k', 42)).toBe(42)
		})
	})

	test('JSON roundtrip with Buffer', () => {
		const original = { msg: Buffer.from('hello world') }
		const json = JSON.stringify(original, BufferJSON.replacer)
		const restored = JSON.parse(json, BufferJSON.reviver)
		expect(restored.msg).toEqual(original.msg)
	})
})
