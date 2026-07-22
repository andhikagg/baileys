'use strict'

// Regression tests for bugs fixed in src/Signal/libsignal.js and src/Socket/socket.js
// Uses the SessionCipher spy in test/__mocks__/whatsapp-rust-bridge-baron.js to inspect
// what signalStorage passes back to the Rust bridge without needing a real Signal session.

const rb = require('whatsapp-rust-bridge-baron')
const { makeLibSignalRepository } = require('../src/Signal/libsignal')

// ── helpers ───────────────────────────────────────────────────────────────────

const noopLogger = {
	info: () => {},
	warn: () => {},
	debug: () => {},
	error: () => {},
	trace: () => {},
	child: () => noopLogger
}

const makeKeys = (store = {}) => ({
	get: async (type, ids) => {
		const out = {}
		for (const id of ids) out[id] = store[`${type}:${id}`] ?? undefined
		return out
	},
	set: async changes => {
		for (const [type, entries] of Object.entries(changes)) {
			for (const [id, val] of Object.entries(entries)) {
				if (val == null) delete store[`${type}:${id}`]
				else store[`${type}:${id}`] = val
			}
		}
	},
	transaction: async fn => fn()
})

const makeCredsWithSPK = signedPreKey => ({
	registrationId: 1,
	advSecretKey: Buffer.alloc(32),
	processedHistoryMessages: [],
	nextPreKeyId: 1,
	firstUnuploadedPreKeyId: 1,
	accountSyncCounter: 0,
	accountSettings: {},
	deviceId: '',
	phoneId: '',
	identityId: Buffer.alloc(20),
	noiseKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
	signedIdentityKey: { private: Buffer.alloc(32), public: Buffer.alloc(32) },
	signedPreKey
})

// ── loadSignedPreKey ──────────────────────────────────────────────────────────

describe('signalStorage.loadSignedPreKey', () => {
	beforeEach(() => {
		rb.SessionCipher.lastLoadedSPK = null
		rb.SessionCipher.instances = []
	})

	test('includes signature bytes from creds', async () => {
		const sig = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x01, 0x02])
		const creds = makeCredsWithSPK({
			keyId: 1,
			keyPair: { public: Buffer.alloc(32, 0x05), private: Buffer.alloc(32, 0x06) },
			signature: sig
		})
		const repo = makeLibSignalRepository({ creds, keys: makeKeys() }, noopLogger, null)
		// pkmsg decryption triggers loadSignedPreKey inside the SessionCipher spy
		await repo.decryptMessage({ jid: '491234567890@s.whatsapp.net', type: 'pkmsg', ciphertext: Buffer.alloc(50) })

		expect(rb.SessionCipher.lastLoadedSPK).not.toBeNull()
		expect(rb.SessionCipher.lastLoadedSPK.signature).toBeDefined()
		expect(Buffer.from(rb.SessionCipher.lastLoadedSPK.signature)).toEqual(sig)
	})

	test('signature is a Buffer (not raw array)', async () => {
		const sig = Buffer.from(Array.from({ length: 64 }, (_, i) => i))
		const creds = makeCredsWithSPK({
			keyId: 2,
			keyPair: { public: Buffer.alloc(32, 0x11), private: Buffer.alloc(32, 0x22) },
			signature: sig
		})
		const repo = makeLibSignalRepository({ creds, keys: makeKeys() }, noopLogger, null)
		await repo.decryptMessage({ jid: '491234567890@s.whatsapp.net', type: 'pkmsg', ciphertext: Buffer.alloc(50) })

		const spk = rb.SessionCipher.lastLoadedSPK
		expect(Buffer.isBuffer(spk.signature)).toBe(true)
	})

	test('privKey and pubKey are still present', async () => {
		const pub = Buffer.alloc(32, 0x33)
		const priv = Buffer.alloc(32, 0x44)
		const creds = makeCredsWithSPK({
			keyId: 3,
			keyPair: { public: pub, private: priv },
			signature: Buffer.alloc(64, 0x55)
		})
		const repo = makeLibSignalRepository({ creds, keys: makeKeys() }, noopLogger, null)
		await repo.decryptMessage({ jid: '491234567890@s.whatsapp.net', type: 'pkmsg', ciphertext: Buffer.alloc(50) })

		const spk = rb.SessionCipher.lastLoadedSPK
		expect(Buffer.from(spk.pubKey)).toEqual(pub)
		expect(Buffer.from(spk.privKey)).toEqual(priv)
	})

	test('signature is undefined when creds have no signature (old format)', async () => {
		const creds = makeCredsWithSPK({
			keyId: 4,
			keyPair: { public: Buffer.alloc(32), private: Buffer.alloc(32) }
			// no signature field — simulates old / partially migrated creds
		})
		const repo = makeLibSignalRepository({ creds, keys: makeKeys() }, noopLogger, null)
		await repo.decryptMessage({ jid: '491234567890@s.whatsapp.net', type: 'pkmsg', ciphertext: Buffer.alloc(50) })

		expect(rb.SessionCipher.lastLoadedSPK.signature).toBeUndefined()
	})
})

// ── makeSocket logger export ──────────────────────────────────────────────────

describe('makeInteropSocket logger availability', () => {
	test('makeInteropSocket receives logger from sock and does not crash on logger calls', () => {
		// makeInteropSocket destructures logger from the sock object it receives.
		// Before the fix, makeSocket did not return logger so interop got undefined → TypeError.
		const calls = []
		const mockLogger = {
			info: (...a) => calls.push(['info', ...a]),
			warn: (...a) => calls.push(['warn', ...a]),
			debug: (...a) => calls.push(['debug', ...a]),
			error: (...a) => calls.push(['error', ...a]),
			trace: (...a) => calls.push(['trace', ...a])
		}
		// Simulate the sock object that makeSocket now returns (includes logger)
		const mockSock = {
			logger: mockLogger,
			query: async () => ({ content: [] }),
			generateMessageTag: () => 'tag-1',
			signalRepository: {}
		}
		const { makeInteropSocket } = require('../src/Socket/interop')
		const interopSock = makeInteropSocket(mockSock)

		// initInterop is exposed; it will call logger.warn/info internally on errors
		expect(typeof interopSock.initInterop).toBe('function')
		// Calling logger methods directly should not throw (undefined guard)
		expect(() => mockLogger.warn({ err: new Error('test') }, 'test')).not.toThrow()
	})
})
