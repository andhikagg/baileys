'use strict'

const { SenderKeyName } = require('../src/Signal/Group/sender-key-name')
const { SenderChainKey } = require('../src/Signal/Group/sender-chain-key')
const { SenderKeyState } = require('../src/Signal/Group/sender-key-state')
const { SenderMessageKey } = require('../src/Signal/Group/sender-message-key')
const { SenderKeyDistributionMessage } = require('../src/Signal/Group/sender-key-distribution-message')

// ── SenderKeyName ─────────────────────────────────────────────────────────────
describe('SenderKeyName', () => {
	const sender = { id: '491234567890@s.whatsapp.net', deviceId: 2 }
	const name = new SenderKeyName('group-id-1', sender)

	test('getGroupId', () => {
		expect(name.getGroupId()).toBe('group-id-1')
	})

	test('getSender', () => {
		expect(name.getSender()).toBe(sender)
	})

	test('serialize produces groupId::id::deviceId', () => {
		expect(name.serialize()).toBe('group-id-1::491234567890@s.whatsapp.net::2')
	})

	test('toString equals serialize', () => {
		expect(name.toString()).toBe(name.serialize())
	})

	test('equals: same groupId + same sender id → true', () => {
		const senderCopy = {
			id: '491234567890@s.whatsapp.net',
			deviceId: 2,
			toString: () => '491234567890@s.whatsapp.net::2'
		}
		const name2 = new SenderKeyName('group-id-1', { ...senderCopy })
		// equals compares groupId and sender.toString() — supply toString
		sender.toString = () => '491234567890@s.whatsapp.net::2'
		const nameWithStr = new SenderKeyName('group-id-1', sender)
		const name3 = new SenderKeyName('group-id-1', senderCopy)
		expect(nameWithStr.equals(name3)).toBe(true)
	})

	test('equals: different groupId → false', () => {
		sender.toString = () => '491234567890@s.whatsapp.net::2'
		const other = new SenderKeyName('other-group', sender)
		expect(name.equals(other)).toBe(false)
	})

	test('equals: null → false', () => {
		expect(name.equals(null)).toBe(false)
	})

	test('hashCode returns a number', () => {
		const code = name.hashCode()
		expect(typeof code).toBe('number')
		expect(Number.isFinite(code)).toBe(true)
	})

	test('hashCode is deterministic for same inputs', () => {
		const a = new SenderKeyName('grp', { toString: () => 'user::0' })
		const b = new SenderKeyName('grp', { toString: () => 'user::0' })
		expect(a.hashCode()).toBe(b.hashCode())
	})

	test('hashCode differs for different groupIds', () => {
		const a = new SenderKeyName('grp-a', { toString: () => 'user::0' })
		const b = new SenderKeyName('grp-b', { toString: () => 'user::0' })
		expect(a.hashCode()).not.toBe(b.hashCode())
	})
})

// ── SenderChainKey ────────────────────────────────────────────────────────────
describe('SenderChainKey', () => {
	const seed = Buffer.alloc(32, 0x42)
	const chain = new SenderChainKey(0, seed)

	test('getIteration returns initial iteration', () => {
		expect(chain.getIteration()).toBe(0)
	})

	test('getSeed returns buffer equal to input', () => {
		expect(Buffer.from(chain.getSeed())).toEqual(seed)
	})

	test('getSenderMessageKey returns a SenderMessageKey with matching iteration', () => {
		const msgKey = chain.getSenderMessageKey()
		expect(msgKey.getIteration()).toBe(0)
		expect(Buffer.isBuffer(msgKey.getIv())).toBe(true)
		expect(Buffer.isBuffer(msgKey.getCipherKey())).toBe(true)
		expect(msgKey.getIv()).toHaveLength(16)
		expect(msgKey.getCipherKey()).toHaveLength(32)
	})

	test('getNext returns iteration + 1', () => {
		const next = chain.getNext()
		expect(next.getIteration()).toBe(1)
	})

	test('getNext returns new SenderChainKey instance', () => {
		expect(chain.getNext()).not.toBe(chain)
	})

	test('chain advances: getNext().getIteration() increments', () => {
		let c = new SenderChainKey(5, seed)
		c = c.getNext()
		expect(c.getIteration()).toBe(6)
		c = c.getNext()
		expect(c.getIteration()).toBe(7)
	})
})

// ── SenderMessageKey ──────────────────────────────────────────────────────────
describe('SenderMessageKey', () => {
	const seed = Buffer.alloc(32, 0x11)
	const msgKey = new SenderMessageKey(3, seed)

	test('getIteration', () => {
		expect(msgKey.getIteration()).toBe(3)
	})

	test('getSeed returns input seed', () => {
		expect(Buffer.from(msgKey.getSeed())).toEqual(seed)
	})

	test('getIv returns 16-byte Buffer', () => {
		expect(Buffer.isBuffer(msgKey.getIv())).toBe(true)
		expect(msgKey.getIv()).toHaveLength(16)
	})

	test('getCipherKey returns 32-byte Buffer', () => {
		expect(Buffer.isBuffer(msgKey.getCipherKey())).toBe(true)
		expect(msgKey.getCipherKey()).toHaveLength(32)
	})

	test('deterministic: same seed → same iv and cipherKey', () => {
		const a = new SenderMessageKey(0, seed)
		const b = new SenderMessageKey(0, seed)
		expect(a.getIv()).toEqual(b.getIv())
		expect(a.getCipherKey()).toEqual(b.getCipherKey())
	})

	test('different seed → different derived keys', () => {
		const a = new SenderMessageKey(0, Buffer.alloc(32, 0xaa))
		const b = new SenderMessageKey(0, Buffer.alloc(32, 0xbb))
		expect(a.getIv()).not.toEqual(b.getIv())
	})
})

// ── SenderKeyState ────────────────────────────────────────────────────────────
describe('SenderKeyState', () => {
	const chainKey = Buffer.alloc(32, 0x55)
	const pub = Buffer.alloc(32, 0x01)
	const priv = Buffer.alloc(32, 0x02)

	test('getKeyId from params constructor', () => {
		const state = new SenderKeyState(7, 0, chainKey, null, pub, priv)
		expect(state.getKeyId()).toBe(7)
	})

	test('getSenderChainKey returns SenderChainKey', () => {
		const state = new SenderKeyState(1, 3, chainKey, null, pub, priv)
		const ck = state.getSenderChainKey()
		expect(ck.getIteration()).toBe(3)
	})

	test('setSenderChainKey updates the structure', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		const next = state.getSenderChainKey().getNext()
		state.setSenderChainKey(next)
		expect(state.getSenderChainKey().getIteration()).toBe(1)
	})

	test('getSigningKeyPublic: 32-byte input gets 0x05 prefix → 33 bytes', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		const sigPub = state.getSigningKeyPublic()
		expect(sigPub).toHaveLength(33)
		expect(sigPub[0]).toBe(0x05)
	})

	test('getSigningKeyPublic: 33-byte key passes through', () => {
		const pub33 = Buffer.concat([Buffer.from([0x05]), pub])
		const state = new SenderKeyState(1, 0, chainKey, null, pub33, priv)
		expect(state.getSigningKeyPublic()).toHaveLength(33)
	})

	test('getSigningKeyPrivate returns Buffer', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		expect(Buffer.isBuffer(state.getSigningKeyPrivate())).toBe(true)
	})

	test('hasSenderMessageKey: false initially', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		expect(state.hasSenderMessageKey(0)).toBe(false)
	})

	test('addSenderMessageKey → hasSenderMessageKey true', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		const ck = state.getSenderChainKey()
		const msgKey = ck.getSenderMessageKey()
		state.addSenderMessageKey(msgKey)
		expect(state.hasSenderMessageKey(msgKey.getIteration())).toBe(true)
	})

	test('removeSenderMessageKey returns the key and removes it', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		const msgKey = state.getSenderChainKey().getSenderMessageKey()
		state.addSenderMessageKey(msgKey)
		const removed = state.removeSenderMessageKey(msgKey.getIteration())
		expect(removed).not.toBeNull()
		expect(removed.getIteration()).toBe(msgKey.getIteration())
		expect(state.hasSenderMessageKey(msgKey.getIteration())).toBe(false)
	})

	test('removeSenderMessageKey on missing key returns null', () => {
		const state = new SenderKeyState(1, 0, chainKey, null, pub, priv)
		expect(state.removeSenderMessageKey(999)).toBeNull()
	})

	test('getStructure returns internal structure', () => {
		const state = new SenderKeyState(5, 2, chainKey, null, pub, priv)
		const s = state.getStructure()
		expect(s.senderKeyId).toBe(5)
		expect(s.senderChainKey.iteration).toBe(2)
	})

	test('constructor from senderKeyStateStructure', () => {
		const structure = {
			senderKeyId: 9,
			senderChainKey: { iteration: 4, seed: chainKey },
			senderSigningKey: { public: pub, private: priv },
			senderMessageKeys: []
		}
		const state = new SenderKeyState(null, null, null, null, null, null, structure)
		expect(state.getKeyId()).toBe(9)
		expect(state.getSenderChainKey().getIteration()).toBe(4)
	})

	test('constructor from structure with missing senderMessageKeys defaults to []', () => {
		const structure = {
			senderKeyId: 1,
			senderChainKey: { iteration: 0, seed: chainKey },
			senderSigningKey: { public: pub, private: priv }
		}
		const state = new SenderKeyState(null, null, null, null, null, null, structure)
		expect(state.hasSenderMessageKey(0)).toBe(false)
	})

	test('signatureKeyPair sets public/private', () => {
		const pair = { public: pub, private: priv }
		const state = new SenderKeyState(1, 0, chainKey, pair)
		expect(state.getSigningKeyPrivate()).toEqual(priv)
	})
})

// ── SenderKeyDistributionMessage ──────────────────────────────────────────────
describe('SenderKeyDistributionMessage', () => {
	const id = 42
	const iteration = 1
	const chainKey = Buffer.alloc(32, 0xaa)
	const sigKey = Buffer.alloc(32, 0xbb)

	let msg
	beforeAll(() => {
		msg = new SenderKeyDistributionMessage(id, iteration, chainKey, sigKey)
	})

	test('getId', () => {
		expect(msg.getId()).toBe(id)
	})

	test('getIteration', () => {
		expect(msg.getIteration()).toBe(iteration)
	})

	test('getChainKey matches input', () => {
		expect(Buffer.from(msg.getChainKey())).toEqual(chainKey)
	})

	test('getSignatureKey matches input', () => {
		expect(Buffer.from(msg.getSignatureKey())).toEqual(sigKey)
	})

	test('getType is SENDERKEY_DISTRIBUTION_TYPE (5)', () => {
		expect(msg.getType()).toBe(5)
	})

	test('serialize returns a Buffer', () => {
		const s = msg.serialize()
		expect(Buffer.isBuffer(s)).toBe(true)
		expect(s.length).toBeGreaterThan(0)
	})

	test('first byte encodes version', () => {
		const s = msg.serialize()
		// intsToByteHighAndLow(3, 3) = (3<<4|3)&0xff = 0x33 = 51
		expect(s[0]).toBe(51)
	})

	test('roundtrip via serialized constructor', () => {
		const serialized = msg.serialize()
		const msg2 = new SenderKeyDistributionMessage(null, null, null, null, serialized)
		expect(msg2.getId()).toBe(id)
		expect(msg2.getIteration()).toBe(iteration)
	})
})
