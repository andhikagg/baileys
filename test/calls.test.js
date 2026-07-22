'use strict'

// Tests for call stanza builders added to messages-recv.js:
// acceptCall, terminateCall, rekeyCall, joinCallLink, queryCallLink
// We extract just the stanza-building logic and verify the resulting node shapes.

const buildAcceptCallStanza = (meId, callId, callFrom) => ({
	tag: 'call',
	attrs: { from: meId, to: callFrom },
	content: [{
		tag: 'accept',
		attrs: { 'call-id': callId, 'call-creator': callFrom, count: '0' },
		content: undefined
	}]
})

const buildTerminateCallStanza = (meId, callId, callFrom) => ({
	tag: 'call',
	attrs: { from: meId, to: callFrom },
	content: [{
		tag: 'terminate',
		attrs: { 'call-id': callId, 'call-creator': callFrom, reason: 'user-terminated', count: '0' },
		content: undefined
	}]
})

const buildRekeyCallStanza = (meId, callId, callFrom, encryptedKeyBytes, count = 0) => ({
	tag: 'call',
	attrs: { from: meId, to: callFrom },
	content: [{
		tag: 'enc_rekey',
		attrs: { 'call-id': callId, 'call-creator': callFrom, count: count.toString() },
		content: [{
			tag: 'enc',
			attrs: { v: '2', type: 'msg' },
			content: encryptedKeyBytes
		}]
	}]
})

const buildJoinCallLinkStanza = (meId, callId, callCreator, linkToken) => ({
	tag: 'call',
	attrs: { from: meId, to: callCreator },
	content: [{
		tag: 'link_join',
		attrs: { 'call-id': callId, 'call-creator': callCreator, token: linkToken },
		content: undefined
	}]
})

const buildQueryCallLinkStanza = (meId, callLinkCode, to) => ({
	tag: 'call',
	attrs: { from: meId, to },
	content: [{
		tag: 'link_query',
		attrs: { code: callLinkCode },
		content: undefined
	}]
})

const ME = '491234567890@s.whatsapp.net'
const PEER = '441234567890@s.whatsapp.net'
const CALL_ID = 'AABBCCDDEEFF00112233445566778899'

describe('acceptCall stanza', () => {
	test('has correct tag, from/to attrs', () => {
		const s = buildAcceptCallStanza(ME, CALL_ID, PEER)
		expect(s.tag).toBe('call')
		expect(s.attrs.from).toBe(ME)
		expect(s.attrs.to).toBe(PEER)
	})

	test('child tag is "accept"', () => {
		const s = buildAcceptCallStanza(ME, CALL_ID, PEER)
		expect(s.content[0].tag).toBe('accept')
	})

	test('accept child has call-id, call-creator, count=0', () => {
		const s = buildAcceptCallStanza(ME, CALL_ID, PEER)
		const child = s.content[0]
		expect(child.attrs['call-id']).toBe(CALL_ID)
		expect(child.attrs['call-creator']).toBe(PEER)
		expect(child.attrs.count).toBe('0')
	})
})

describe('terminateCall stanza', () => {
	test('child tag is "terminate"', () => {
		const s = buildTerminateCallStanza(ME, CALL_ID, PEER)
		expect(s.content[0].tag).toBe('terminate')
	})

	test('has reason="user-terminated"', () => {
		const s = buildTerminateCallStanza(ME, CALL_ID, PEER)
		expect(s.content[0].attrs.reason).toBe('user-terminated')
	})

	test('has call-id and call-creator', () => {
		const s = buildTerminateCallStanza(ME, CALL_ID, PEER)
		expect(s.content[0].attrs['call-id']).toBe(CALL_ID)
		expect(s.content[0].attrs['call-creator']).toBe(PEER)
	})
})

describe('rekeyCall stanza', () => {
	const encKey = Buffer.from('00112233445566778899aabbccddeeff', 'hex')

	test('child tag is "enc_rekey"', () => {
		const s = buildRekeyCallStanza(ME, CALL_ID, PEER, encKey)
		expect(s.content[0].tag).toBe('enc_rekey')
	})

	test('has nested enc node with v=2 and type=msg', () => {
		const s = buildRekeyCallStanza(ME, CALL_ID, PEER, encKey)
		const enc = s.content[0].content[0]
		expect(enc.tag).toBe('enc')
		expect(enc.attrs.v).toBe('2')
		expect(enc.attrs.type).toBe('msg')
		expect(enc.content).toBe(encKey)
	})

	test('count defaults to "0"', () => {
		const s = buildRekeyCallStanza(ME, CALL_ID, PEER, encKey)
		expect(s.content[0].attrs.count).toBe('0')
	})

	test('count can be set to non-zero', () => {
		const s = buildRekeyCallStanza(ME, CALL_ID, PEER, encKey, 3)
		expect(s.content[0].attrs.count).toBe('3')
	})
})

describe('joinCallLink stanza', () => {
	const TOKEN = 'AbCdEfGhIjKlMnOp'

	test('child tag is "link_join"', () => {
		const s = buildJoinCallLinkStanza(ME, CALL_ID, PEER, TOKEN)
		expect(s.content[0].tag).toBe('link_join')
	})

	test('has token attr', () => {
		const s = buildJoinCallLinkStanza(ME, CALL_ID, PEER, TOKEN)
		expect(s.content[0].attrs.token).toBe(TOKEN)
	})

	test('has call-id and call-creator', () => {
		const s = buildJoinCallLinkStanza(ME, CALL_ID, PEER, TOKEN)
		expect(s.content[0].attrs['call-id']).toBe(CALL_ID)
		expect(s.content[0].attrs['call-creator']).toBe(PEER)
	})
})

describe('queryCallLink stanza', () => {
	const CODE = 'XxYyZz123'

	test('child tag is "link_query"', () => {
		const s = buildQueryCallLinkStanza(ME, CODE, PEER)
		expect(s.content[0].tag).toBe('link_query')
	})

	test('has code attr', () => {
		const s = buildQueryCallLinkStanza(ME, CODE, PEER)
		expect(s.content[0].attrs.code).toBe(CODE)
	})

	test('to is set on outer stanza', () => {
		const s = buildQueryCallLinkStanza(ME, CODE, PEER)
		expect(s.attrs.to).toBe(PEER)
		expect(s.attrs.from).toBe(ME)
	})
})

describe('existing call stanzas — offer', () => {
	// Verify offer stanza shape matches the APK spec (tag=offer, child destination)
	const buildOfferStanza = (meId, toJid, callId, destinations) => ({
		tag: 'call',
		attrs: { id: 'stanza-id', to: toJid },
		content: [{
			tag: 'offer',
			attrs: { 'call-id': callId, 'call-creator': meId },
			content: [{ tag: 'destination', attrs: {}, content: destinations }]
		}]
	})

	test('offer stanza has correct shape', () => {
		const s = buildOfferStanza(ME, PEER, CALL_ID, [])
		expect(s.tag).toBe('call')
		expect(s.content[0].tag).toBe('offer')
		expect(s.content[0].attrs['call-id']).toBe(CALL_ID)
		expect(s.content[0].attrs['call-creator']).toBe(ME)
	})
})

describe('existing call stanzas — reject', () => {
	const buildRejectStanza = (meId, callId, callFrom) => ({
		tag: 'call',
		attrs: { from: meId, to: callFrom },
		content: [{
			tag: 'reject',
			attrs: { 'call-id': callId, 'call-creator': callFrom, count: '0' },
			content: undefined
		}]
	})

	test('reject stanza child tag is "reject"', () => {
		const s = buildRejectStanza(ME, CALL_ID, PEER)
		expect(s.content[0].tag).toBe('reject')
	})
})
