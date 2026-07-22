'use strict'

const { buildAckStanza } = require('../src/Utils/stanza-ack')

describe('buildAckStanza', () => {
	test('basic message node returns ack with class=message', () => {
		const node = { tag: 'message', attrs: { id: 'msg1', from: 'sender@s.whatsapp.net' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.tag).toBe('ack')
		expect(ack.attrs.id).toBe('msg1')
		expect(ack.attrs.to).toBe('sender@s.whatsapp.net')
		expect(ack.attrs.class).toBe('message')
	})

	test('message node with meId includes from=meId', () => {
		const node = { tag: 'message', attrs: { id: 'x', from: 'sender@s.whatsapp.net' } }
		const ack = buildAckStanza(node, null, 'me@s.whatsapp.net')
		expect(ack.attrs.from).toBe('me@s.whatsapp.net')
	})

	test('non-message node with meId does NOT set from', () => {
		const node = { tag: 'notification', attrs: { id: 'n1', from: 'sender@s.whatsapp.net' } }
		const ack = buildAckStanza(node, null, 'me@s.whatsapp.net')
		expect(ack.attrs.from).toBeUndefined()
	})

	test('error code is stringified in attrs.error', () => {
		const node = { tag: 'message', attrs: { id: 'e1', from: 'a@b' } }
		const ack = buildAckStanza(node, 404, null)
		expect(ack.attrs.error).toBe('404')
	})

	test('no error code → attrs.error absent', () => {
		const node = { tag: 'message', attrs: { id: 'e1', from: 'a@b' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.error).toBeUndefined()
	})

	test('participant is propagated', () => {
		const node = { tag: 'message', attrs: { id: 'p1', from: 'g@g.us', participant: 'u@s' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.participant).toBe('u@s')
	})

	test('no participant → absent', () => {
		const node = { tag: 'message', attrs: { id: 'p2', from: 'a@b' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.participant).toBeUndefined()
	})

	test('recipient is propagated', () => {
		const node = { tag: 'message', attrs: { id: 'r1', from: 'a@b', recipient: 'r@b' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.recipient).toBe('r@b')
	})

	test('non-call node with type → type passed through', () => {
		const node = { tag: 'notification', attrs: { id: 'n2', from: 'a@b', type: 'devices' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.type).toBe('devices')
		expect(ack.attrs.class).toBe('notification')
	})

	// ── Call stanzas ─────────────────────────────────────────────────────────
	const CALL_TAGS = [
		'offer',
		'offer_notice',
		'terminate',
		'accept',
		'reject',
		'preaccept',
		'transport',
		'video',
		'duration',
		'mute_v2',
		'lobby',
		'heartbeat',
		'relaylatency',
		'link_query',
		'group_update'
	]

	for (const tag of CALL_TAGS) {
		test(`call stanza "${tag}" → class=call, type=${tag}`, () => {
			const node = { tag, attrs: { id: `${tag}-1`, from: 'a@b' } }
			const ack = buildAckStanza(node, null, null)
			expect(ack.attrs.class).toBe('call')
			expect(ack.attrs.type).toBe(tag)
		})
	}

	test('call stanza with error code includes error attr', () => {
		const node = { tag: 'offer', attrs: { id: 'c1', from: 'a@b' } }
		const ack = buildAckStanza(node, 503, null)
		expect(ack.attrs.error).toBe('503')
		expect(ack.attrs.class).toBe('call')
	})

	test('call stanza attrs.type (if present) does NOT override call type', () => {
		// When it's a call stanza, type = tag name; any node.attrs.type is ignored
		const node = { tag: 'offer', attrs: { id: 'c2', from: 'a@b', type: 'ignored' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.type).toBe('offer')
	})

	test('iq node gets class=iq', () => {
		const node = { tag: 'iq', attrs: { id: 'iq1', from: 'a@b' } }
		const ack = buildAckStanza(node, null, null)
		expect(ack.attrs.class).toBe('iq')
	})
})
